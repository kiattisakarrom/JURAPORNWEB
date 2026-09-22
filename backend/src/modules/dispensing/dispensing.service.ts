import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import { DispensingHistoryDto, ForceReleaseChannelDto, TransferPackageDto } from './dispensing.dto';

type QueueRow = {
  PACKAGE_ID: string; WORKFLOW_ID: string; PACKAGE_NUMBER: string; PAGE_NOW: string;
  DISPENSING_PICKUP_STATUS: string | null; DISPENSING_CHANNEL: number | null;
  QUEUE_READY_AT: Date | null; CHECKING_COMPLETED_AT: Date | null;
  LAST_CALLED_AT: Date | null; RECEIVED_AT: Date | null; CALL_COUNT: number;
  ROW_VERSION: Buffer; VISITDATETIME: Date; VISITNUMBER: string;
  PATIENTID: string | null; PATIENT_NAME: string | null; VERIFY_NOTE: string | null;
  ITEM_COUNT: number;
};

type ClaimRow = { CHANNEL_NO: number; CLAIM_TOKEN_HASH: Buffer };
@Injectable()
export class DispensingService {
  constructor(private readonly db: DatabaseService, private readonly config: ConfigService) {}

  async queue() {
    return this.db.withTransaction(async request => {
      const cursor = await this.version(request);
      const rows = await this.loadRows(request);
      const channels = await this.readChannels(request);
      return { CURSOR: cursor, UPSERTS: rows.map(row => this.toItem(row)), CHANNELS: channels };
    }, sql.ISOLATION_LEVEL.SNAPSHOT);
  }

  async changes(cursor: string) {
    return this.db.withTransaction(async request => {
      const version = await this.version(request);
      const check = request();
      check.input('cursor', sql.BigInt, cursor);
      const valid = await check.query<{ INVALID: number }>(`
        SELECT CASE WHEN @cursor > CHANGE_TRACKING_CURRENT_VERSION()
          OR @cursor < CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID('dbo.TBLPACKAGEMASTER'))
          OR @cursor < CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID('dbo.TBLWORKFLOWMASTER'))
          THEN 1 ELSE 0 END AS INVALID;
      `);
      if (valid.recordset[0]?.INVALID) throw new ConflictException('Dispensing cursor expired; reload queue');
      const changed = request();
      changed.input('cursor', sql.BigInt, cursor);
      const ids = await changed.query<{ PACKAGE_ID: string }>(`
        SELECT CONVERT(varchar(36),c.PACKAGE_ID) AS PACKAGE_ID
        FROM CHANGETABLE(CHANGES dbo.TBLPACKAGEMASTER, @cursor) AS c
        UNION
        SELECT CONVERT(varchar(36),p.PACKAGE_ID) FROM CHANGETABLE(CHANGES dbo.TBLWORKFLOWMASTER, @cursor) AS c
        JOIN dbo.TBLPACKAGEMASTER AS p ON p.WORKFLOW_ID=c.WORKFLOW_ID;
      `);
      const changedIds = ids.recordset.map(row => row.PACKAGE_ID);
      const rows = changedIds.length ? await this.loadRows(request, changedIds) : [];
      const live = new Set(rows.map(row => row.PACKAGE_ID.toLowerCase()));
      return {
        CURSOR: version,
        UPSERTS: rows.map(row => this.toItem(row)),
        REMOVED_IDS: changedIds.filter(id => !live.has(id.toLowerCase())),
        CHANNELS: await this.readChannels(request),
      };
    }, sql.ISOLATION_LEVEL.SNAPSHOT);
  }

  async channels() {
    return this.readChannels(() => this.db.createRequest());
  }

  async claim(channel: number, token: string) {
    this.assertChannel(channel);
    const hash = this.tokenHash(token);
    try {
      await this.db.withTransaction(async request => {
        const lookup = request();
        lookup.input('channel', sql.TinyInt, channel);
        const active = await lookup.query<ClaimRow>(`
          SELECT CHANNEL_NO, CLAIM_TOKEN_HASH FROM dbo.TBLDISPENSINGCHANNELCLAIMS WITH (UPDLOCK, HOLDLOCK)
          WHERE CHANNEL_NO=@channel AND RELEASED_AT IS NULL;
        `);
        if (active.recordset[0]) {
          if (!active.recordset[0].CLAIM_TOKEN_HASH.equals(hash)) throw new ConflictException('ช่องนี้มีผู้ใช้งานอยู่แล้ว');
          return;
        }
        const revoked = request();
        revoked.input('hash', sql.VarBinary(32), hash);
        const released = await revoked.query<{ CLAIM_ID: string }>(`
          SELECT TOP (1) CLAIM_ID FROM dbo.TBLDISPENSINGCHANNELCLAIMS
          WHERE CLAIM_TOKEN_HASH=@hash AND RELEASED_AT IS NOT NULL;
        `);
        if (released.recordset[0]) throw new ConflictException('สิทธิ์ถือช่องเดิมถูกปล่อยแล้ว กรุณาเลือกช่องใหม่');
        const insert = request();
        insert.input('channel', sql.TinyInt, channel);
        insert.input('hash', sql.VarBinary(32), hash);
        await insert.query(`INSERT INTO dbo.TBLDISPENSINGCHANNELCLAIMS(CHANNEL_NO, CLAIM_TOKEN_HASH) VALUES (@channel,@hash);`);
      }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('ช่องนี้มีผู้ใช้งานอยู่แล้ว');
      throw error;
    }
    return { CHANNEL_NO: channel, CLAIMED: true };
  }

  async validateClaim(channel: number, token: string) {
    this.assertChannel(channel);
    const request = this.db.createRequest();
    request.input('channel', sql.TinyInt, channel);
    request.input('hash', sql.VarBinary(32), this.tokenHash(token));
    const result = await request.query<{ CLAIM_ID: string }>(`
      SELECT CLAIM_ID FROM dbo.TBLDISPENSINGCHANNELCLAIMS
      WHERE CHANNEL_NO=@channel AND CLAIM_TOKEN_HASH=@hash AND RELEASED_AT IS NULL;
    `);
    if (!result.recordset[0]) throw new ConflictException('ไม่ได้ถือครองช่องนี้แล้ว');
    return { CHANNEL_NO: channel, CLAIMED: true };
  }

  async release(channel: number, token: string, reason = 'ผู้ถือช่องกดปล่อยช่อง') {
    this.assertChannel(channel);
    await this.db.withTransaction(async request => {
      const update = request();
      update.input('channel', sql.TinyInt, channel);
      update.input('hash', sql.VarBinary(32), this.tokenHash(token));
      update.input('reason', sql.NVarChar(250), reason);
      const result = await update.query(`
        UPDATE dbo.TBLDISPENSINGCHANNELCLAIMS SET RELEASED_AT=SYSUTCDATETIME(),
          RELEASE_REASON=@reason
        WHERE CHANNEL_NO=@channel AND CLAIM_TOKEN_HASH=@hash AND RELEASED_AT IS NULL;
      `);
      if (!result.rowsAffected[0]) throw new ConflictException('ไม่ได้ถือครองช่องนี้แล้ว');
    });
    return { CHANNEL_NO: channel, CLAIMED: false };
  }

  async forceRelease(channel: number, body: ForceReleaseChannelDto) {
    this.assertChannel(channel);
    const configuredUsername = this.config.get<string>('DISPENSING_ADMIN_USERNAME');
    const configuredPassword = this.config.get<string>('DISPENSING_ADMIN_PASSWORD');
    if (!configuredUsername || !configuredPassword) {
      throw new ServiceUnavailableException('ยังไม่ได้กำหนดรหัสผู้ดูแลช่องจ่ายยาใน Backend');
    }
    if (!this.sameSecret(body.username, configuredUsername) || !this.sameSecret(body.password, configuredPassword)) {
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    const reason = `Web force release by ${body.username.trim()}: ${body.reason.trim()}`;
    await this.db.withTransaction(async request => {
      const update = request();
      update.input('channel', sql.TinyInt, channel);
      update.input('reason', sql.NVarChar(200), reason);
      const result = await update.query(`
        UPDATE dbo.TBLDISPENSINGCHANNELCLAIMS
        SET RELEASED_AT=SYSUTCDATETIME(), RELEASE_REASON=@reason
        WHERE CHANNEL_NO=@channel AND RELEASED_AT IS NULL;
      `);
      if (!result.rowsAffected[0]) throw new ConflictException('ช่องนี้ถูกปล่อยไปแล้ว');
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return { CHANNEL_NO: channel, CLAIMED: false };
  }

  async transfer(packageId: string, channel: number, body: TransferPackageDto) {
    this.assertChannel(channel);
    await this.db.withTransaction(async request => {
      const lookup = request();
      lookup.input('packageId', sql.UniqueIdentifier, packageId);
      const result = await lookup.query<QueueRow>(`
        SELECT p.PACKAGE_ID,p.WORKFLOW_ID,p.PAGE_NOW,p.DISPENSING_PICKUP_STATUS,
          p.DISPENSING_CHANNEL,p.ROW_VERSION
        FROM dbo.TBLPACKAGEMASTER AS p WITH (UPDLOCK,HOLDLOCK) WHERE p.PACKAGE_ID=@packageId;
      `);
      const item = result.recordset[0];
      if (!item) throw new NotFoundException('Package was not found');
      const replay = request();
      replay.input('actionId', sql.UniqueIdentifier, body.actionId);
      const existing = await replay.query<{ PACKAGE_ID: string; EVENT_TYPE: string; TARGET_CHANNEL: number | null }>(`
        SELECT PACKAGE_ID,EVENT_TYPE,TRY_CONVERT(tinyint,JSON_VALUE(EVENT_DATA,'$.toChannel')) AS TARGET_CHANNEL
        FROM dbo.TBLPACKAGEEVENTS WHERE ACTION_ID=@actionId;
      `);
      if (existing.recordset[0]) {
        if (existing.recordset[0].PACKAGE_ID.toLowerCase() !== packageId.toLowerCase()
          || existing.recordset[0].EVENT_TYPE !== 'DISPENSING_TRANSFER'
          || existing.recordset[0].TARGET_CHANNEL !== channel) throw new ConflictException('Action ID was already used');
        return;
      }
      if (!['AWAITING_DISPENSING','DISPENSING'].includes(item.PAGE_NOW)
        || ![null,'WAITING_CALL','MISSED_CALL'].includes(item.DISPENSING_PICKUP_STATUS)) {
        throw new ConflictException('ย้ายได้เฉพาะก่อนเรียกหรือหลัง Missed-call');
      }
      if (Buffer.from(item.ROW_VERSION).toString('base64') !== body.expectedRowVersion) {
        throw new ConflictException('ข้อมูลคิวเปลี่ยนแล้ว กรุณาโหลดใหม่');
      }
      await this.assertClaim(request, channel, body.claimToken);
      if (item.DISPENSING_CHANNEL === channel) throw new ConflictException('รายการนี้อยู่ช่องของคุณแล้ว');
      const update = request();
      update.input('packageId', sql.UniqueIdentifier, packageId);
      update.input('channel', sql.TinyInt, channel);
      await update.query(`UPDATE dbo.TBLPACKAGEMASTER SET DISPENSING_CHANNEL=@channel,UPDATED_AT=SYSUTCDATETIME() WHERE PACKAGE_ID=@packageId;`);
      const event = request();
      event.input('workflowId', sql.UniqueIdentifier, item.WORKFLOW_ID);
      event.input('packageId', sql.UniqueIdentifier, packageId);
      event.input('actionId', sql.UniqueIdentifier, body.actionId);
      event.input('details', sql.NVarChar(sql.MAX), JSON.stringify({ fromChannel: item.DISPENSING_CHANNEL, toChannel: channel }));
      await event.query(`INSERT INTO dbo.TBLPACKAGEEVENTS(WORKFLOW_ID,PACKAGE_ID,EVENT_TYPE,RESULT,ACTION_ID,EVENT_DATA)
        VALUES(@workflowId,@packageId,'DISPENSING_TRANSFER','SUCCESS',@actionId,@details);`);
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return { PACKAGE_ID: packageId, CHANNEL_NO: channel };
  }

  async receiveReady(vn: string, visitDate: string) {
    const normalizedVn = vn.trim();
    const normalizedDate = visitDate.trim();
    await this.db.withTransaction(async request => {
      const lock = request();
      lock.input('resource', sql.NVarChar(255), `dispensing-ready:${normalizedDate}:${normalizedVn}`);
      await lock.query(`DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource=@resource,
        @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @result<0 THROW 51000,'Dispensing readiness is busy; retry',1;`);
      const find = request();
      find.input('date', sql.Date, normalizedDate);
      find.input('vn', sql.VarChar(50), normalizedVn);
      const existing = await find.query<{ FIRST_READY_AT: Date; APPLIED_WORKFLOW_ID: string | null }>(`
        SELECT FIRST_READY_AT,APPLIED_WORKFLOW_ID FROM dbo.TBLHOSPITALQUEUESTEP WITH (UPDLOCK,HOLDLOCK)
        WHERE VISIT_DATE=@date AND VN=@vn;
      `);
      const packageRequest = request();
      packageRequest.input('date', sql.Date, normalizedDate);
      packageRequest.input('vn', sql.VarChar(50), normalizedVn);
      const active = await packageRequest.query<{ PACKAGE_ID: string; WORKFLOW_ID: string }>(`
        SELECT TOP (1) p.PACKAGE_ID,p.WORKFLOW_ID
        FROM dbo.TBLWORKFLOWMASTER AS w
        JOIN dbo.TBLPACKAGEMASTER AS p WITH (UPDLOCK,HOLDLOCK) ON p.WORKFLOW_ID=w.WORKFLOW_ID AND p.IS_ACTIVE=1
        WHERE w.VISITDATETIME=@date AND w.VISITNUMBER=@vn AND w.IS_ACTIVE=1
          AND p.PAGE_NOW IN ('AWAITING_DISPENSING','DISPENSING')
        ORDER BY w.WORKFLOW_RUN_NO DESC;
      `);
      const current = active.recordset[0];
      const workflowRequest = request();
      workflowRequest.input('date', sql.Date, normalizedDate);
      workflowRequest.input('vn', sql.VarChar(50), normalizedVn);
      const workflow = await workflowRequest.query<{ WORKFLOW_ID: string }>(`
        SELECT TOP (1) WORKFLOW_ID FROM dbo.TBLWORKFLOWMASTER
        WHERE VISITDATETIME=@date AND VISITNUMBER=@vn AND IS_ACTIVE=1
        ORDER BY WORKFLOW_RUN_NO DESC;
      `);
      const activeWorkflowId = workflow.recordset[0]?.WORKFLOW_ID;
      const isNewRun = Boolean(activeWorkflowId && existing.recordset[0]?.APPLIED_WORKFLOW_ID
        && existing.recordset[0].APPLIED_WORKFLOW_ID !== activeWorkflowId);
      const upsert = request();
      upsert.input('date', sql.Date, normalizedDate);
      upsert.input('vn', sql.VarChar(50), normalizedVn);
      if (existing.recordset[0]) {
        upsert.input('newRun', sql.Bit, isNewRun);
        await upsert.query(`UPDATE dbo.TBLHOSPITALQUEUESTEP SET
          LAST_RECEIVED_AT=SYSUTCDATETIME(), RECEIPT_COUNT=RECEIPT_COUNT+1,
          FIRST_READY_AT=CASE WHEN @newRun=1 THEN SYSUTCDATETIME() ELSE FIRST_READY_AT END,
          APPLIED_WORKFLOW_ID=CASE WHEN @newRun=1 THEN NULL ELSE APPLIED_WORKFLOW_ID END
          WHERE VISIT_DATE=@date AND VN=@vn;`);
      } else {
        await upsert.query(`INSERT INTO dbo.TBLHOSPITALQUEUESTEP(VISIT_DATE,VN,STEP_ID)
          VALUES(@date,@vn,'04');`);
      }
      if (!current) return;
      const update = request();
      update.input('packageId', sql.UniqueIdentifier, current.PACKAGE_ID);
      update.input('workflowId', sql.UniqueIdentifier, current.WORKFLOW_ID);
      update.input('date', sql.Date, normalizedDate);
      update.input('vn', sql.VarChar(50), normalizedVn);
      await update.query(`
        UPDATE p SET PAGE_NOW='DISPENSING',
          DISPENSING_CHANNEL=ISNULL(p.DISPENSING_CHANNEL,1),
          DISPENSING_PICKUP_STATUS=ISNULL(p.DISPENSING_PICKUP_STATUS,'WAITING_CALL'),
          QUEUE_READY_AT=ISNULL(p.QUEUE_READY_AT,
            CASE WHEN p.CHECKING_COMPLETED_AT>step.FIRST_READY_AT THEN p.CHECKING_COMPLETED_AT ELSE step.FIRST_READY_AT END),
          UPDATED_AT=CASE WHEN p.QUEUE_READY_AT IS NULL THEN SYSUTCDATETIME() ELSE p.UPDATED_AT END
        FROM dbo.TBLPACKAGEMASTER AS p
        JOIN dbo.TBLHOSPITALQUEUESTEP AS step ON step.VISIT_DATE=@date AND step.VN=@vn
        WHERE p.PACKAGE_ID=@packageId AND p.CHECKING_COMPLETED_AT IS NOT NULL;
        UPDATE dbo.TBLHOSPITALQUEUESTEP SET APPLIED_WORKFLOW_ID=@workflowId
          WHERE VISIT_DATE=@date AND VN=@vn;
      `);
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return { success: true, message: 'รับสถานะคิวสำเร็จ', data: { vn: normalizedVn, visit_date: normalizedDate, step_id: '04' } };
  }

  async recent() {
    const result = await this.db.createRequest().query<{ VISIT_DATE: Date; VN: string; STEP_ID: string; FIRST_READY_AT: Date; LAST_RECEIVED_AT: Date; RECEIPT_COUNT: number }>(`
      SELECT TOP (50) VISIT_DATE,VN,STEP_ID,FIRST_READY_AT,LAST_RECEIVED_AT,RECEIPT_COUNT
      FROM dbo.TBLHOSPITALQUEUESTEP ORDER BY LAST_RECEIVED_AT DESC,VISIT_DATE DESC,VN;
    `);
    return { success: true, data: result.recordset.map(row => ({
      vn: row.VN, visit_date: this.date(row.VISIT_DATE), step_id: row.STEP_ID,
      first_received_at: row.FIRST_READY_AT.toISOString(), last_received_at: row.LAST_RECEIVED_AT.toISOString(),
      receipt_count: row.RECEIPT_COUNT,
    })) };
  }

  async history(query: DispensingHistoryDto) {
    if (query.fromDate > query.toDate) throw new BadRequestException('Invalid date range');
    const request = this.db.createRequest();
    request.input('fromDate', sql.Date, query.fromDate);
    request.input('toDate', sql.Date, query.toDate);
    request.input('offset', sql.Int, (query.page - 1) * 50);
    const result = await request.query<QueueRow>(`
      SELECT p.PACKAGE_ID,p.WORKFLOW_ID,p.PACKAGE_NUMBER,p.PAGE_NOW,p.DISPENSING_PICKUP_STATUS,
        p.DISPENSING_CHANNEL,p.QUEUE_READY_AT,p.CHECKING_COMPLETED_AT,p.LAST_CALLED_AT,p.RECEIVED_AT,
        p.CALL_COUNT,p.ROW_VERSION,w.VISITDATETIME,w.VISITNUMBER,w.PATIENTID,w.PATIENT_NAME,p.VERIFY_NOTE,
        (SELECT COUNT(*) FROM dbo.TBLPACKAGEITEMS AS i WHERE i.PACKAGE_ID=p.PACKAGE_ID) AS ITEM_COUNT
      FROM dbo.TBLPACKAGEMASTER AS p JOIN dbo.TBLWORKFLOWMASTER AS w ON w.WORKFLOW_ID=p.WORKFLOW_ID
      WHERE p.PAGE_NOW='COMPLETE' AND p.RECEIVED_AT>=@fromDate AND p.RECEIVED_AT<DATEADD(DAY,1,@toDate)
      ORDER BY p.RECEIVED_AT DESC,p.PACKAGE_ID DESC OFFSET @offset ROWS FETCH NEXT 50 ROWS ONLY;
    `);
    return { PAGE: query.page, ITEMS: result.recordset.map(row => this.toItem(row)), HAS_MORE: result.recordset.length === 50 };
  }

  private async version(request: () => sql.Request) {
    const result = await request().query<{ VERSION: string | null }>(`
      SELECT CONVERT(varchar(30),CHANGE_TRACKING_CURRENT_VERSION()) AS VERSION;
    `);
    if (!result.recordset[0]?.VERSION) throw new ConflictException('Realtime change tracking is unavailable');
    return result.recordset[0].VERSION;
  }

  private async loadRows(request: () => sql.Request, ids?: string[]): Promise<QueueRow[]> {
    const query = request();
    query.input('ids', sql.NVarChar(sql.MAX), ids ? JSON.stringify(ids) : null);
    const result = await query.query<QueueRow>(`
      SELECT p.PACKAGE_ID,p.WORKFLOW_ID,p.PACKAGE_NUMBER,p.PAGE_NOW,p.DISPENSING_PICKUP_STATUS,
        p.DISPENSING_CHANNEL,p.QUEUE_READY_AT,p.CHECKING_COMPLETED_AT,p.LAST_CALLED_AT,p.RECEIVED_AT,
        p.CALL_COUNT,p.ROW_VERSION,w.VISITDATETIME,w.VISITNUMBER,w.PATIENTID,w.PATIENT_NAME,p.VERIFY_NOTE,
        (SELECT COUNT(*) FROM dbo.TBLPACKAGEITEMS AS i WHERE i.PACKAGE_ID=p.PACKAGE_ID) AS ITEM_COUNT
      FROM dbo.TBLPACKAGEMASTER AS p JOIN dbo.TBLWORKFLOWMASTER AS w ON w.WORKFLOW_ID=p.WORKFLOW_ID
      WHERE p.IS_ACTIVE=1 AND p.PAGE_NOW IN ('AWAITING_DISPENSING','DISPENSING')
        AND (@ids IS NULL OR p.PACKAGE_ID IN (SELECT TRY_CONVERT(uniqueidentifier,value) FROM OPENJSON(@ids)))
      ORDER BY p.QUEUE_READY_AT,p.PACKAGE_ID;
    `);
    return result.recordset;
  }

  private async readChannels(request: () => sql.Request) {
    const result = await request().query<{ CHANNEL_NO: number }>(`
      SELECT CHANNEL_NO FROM dbo.TBLDISPENSINGCHANNELCLAIMS WHERE RELEASED_AT IS NULL;
    `);
    const occupied = new Set(result.recordset.map(row => row.CHANNEL_NO));
    return Array.from({ length: 8 }, (_, index) => ({ CHANNEL_NO: index + 1, OCCUPIED: occupied.has(index + 1) }));
  }

  private toItem(row: QueueRow) {
    return {
      PACKAGE_ID: row.PACKAGE_ID, WORKFLOW_ID: row.WORKFLOW_ID, PACKAGE_NUMBER: row.PACKAGE_NUMBER,
      PAGE_NOW: row.PAGE_NOW, DISPENSING_PICKUP_STATUS: row.DISPENSING_PICKUP_STATUS,
      DISPENSING_CHANNEL: row.DISPENSING_CHANNEL ?? 1,
      QUEUE_READY_AT: row.QUEUE_READY_AT?.toISOString() ?? null,
      CHECKING_COMPLETED_AT: row.CHECKING_COMPLETED_AT?.toISOString() ?? null,
      LAST_CALLED_AT: row.LAST_CALLED_AT?.toISOString() ?? null,
      RECEIVED_AT: row.RECEIVED_AT?.toISOString() ?? null,
      CALL_COUNT: row.CALL_COUNT, ROW_VERSION: Buffer.from(row.ROW_VERSION).toString('base64'),
      VISITDATETIME: this.date(row.VISITDATETIME), VISITNUMBER: row.VISITNUMBER,
      PATIENTID: row.PATIENTID, PATIENT_NAME: row.PATIENT_NAME, VERIFY_NOTE: row.VERIFY_NOTE,
      ITEM_COUNT: row.ITEM_COUNT,
    };
  }

  private async assertClaim(request: () => sql.Request, channel: number, token: string) {
    const lookup = request();
    lookup.input('channel', sql.TinyInt, channel);
    lookup.input('hash', sql.VarBinary(32), this.tokenHash(token));
    const result = await lookup.query(`
      SELECT CLAIM_ID FROM dbo.TBLDISPENSINGCHANNELCLAIMS WITH (UPDLOCK,HOLDLOCK)
      WHERE CHANNEL_NO=@channel AND CLAIM_TOKEN_HASH=@hash AND RELEASED_AT IS NULL;
    `);
    if (!result.recordset[0]) throw new ConflictException('ไม่ได้ถือครองช่องนี้แล้ว');
  }

  private tokenHash(token: string) { return createHash('sha256').update(token).digest(); }
  private sameSecret(input: string, configured: string) {
    const inputHash = createHash('sha256').update(input).digest();
    const configuredHash = createHash('sha256').update(configured).digest();
    return inputHash.equals(configuredHash);
  }
  private isUniqueViolation(error: unknown) {
    const candidate = error as { number?: number; originalError?: { number?: number } };
    return [2601, 2627].includes(candidate?.number ?? candidate?.originalError?.number ?? -1);
  }
  private assertChannel(channel: number) {
    if (!Number.isInteger(channel) || channel < 1 || channel > 8) throw new BadRequestException('Channel must be 1–8');
  }
  private date(value: Date) { return value.toISOString().slice(0, 10); }
}
