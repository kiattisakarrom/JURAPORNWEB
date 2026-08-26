import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import {
  VerifyPrescriptionListItem,
  VerifyPrescriptionPatient,
} from '../verify/interfaces/verify-prescriptions-response.interface';
import { VerifyItem } from '../verify/interfaces/verify-response.interface';
import { VerifyService } from '../verify/verify.service';
import {
  CheckingPackagePairDto,
  ClaimVerifyLockDto,
  DispensingPickupStatusDto,
  DispensingStatusDto,
  MatchingPackageScanDto,
  PackagePriorityDto,
  PackagesQueryDto,
  PackageTransitionActionDto,
  PackageTransitionDto,
  PackageWorkflowsQueryDto,
  SetPackagePendingDto,
  VerifyLockDto,
  VerifyModeDto,
  VerifyPackageDto,
} from './dto/package-workflow.dto';
import {
  CheckingPairResponse,
  PackageItemResponse,
  PackageResponse,
  PackageWorkflowPrescriptionResponse,
  PackageWorkflowResponse,
  VerifyPackageResponse,
} from './interfaces/package-workflow-response.interface';

interface WorkflowIdentityRow {
  WORKFLOW_ID: string;
  VISITDATETIME: Date | string;
  VISITNUMBER: string;
  CASE_STATUS: string;
  VERIFY_LOCK_TOKEN: string | null;
  VERIFY_LOCK_SESSION: string | null;
  VERIFY_LOCK_EXPIRES_AT: Date | string | null;
}

interface WorkflowQueryRow {
  WORKFLOW_ID: string;
  WORKFLOW_PUBLIC_ID: string;
  VISITDATETIME: Date | string;
  VISITNUMBER: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  WORKFLOW_RUN_NO: number;
  CASE_STATUS: string;
  IS_ACTIVE: boolean;
  QUEUE_NO: number | null;
  BLOCK_REASON_CODE: string | null;
  BLOCK_REASON_TEXT: string | null;
  PAYMENT_STATUS: string;
  CREATED_AT: Date | string;
  UPDATED_AT: Date | string;
  ROW_VERSION: Buffer;
  VERIFY_LOCK_TOKEN: string | null;
  VERIFY_LOCK_SESSION: string | null;
  VERIFY_LOCK_OWNER: string | null;
  VERIFY_LOCK_WORKSTATION: string | null;
  VERIFY_LOCKED_AT: Date | string | null;
  VERIFY_LOCK_EXPIRES_AT: Date | string | null;
  ACTIVE_PACKAGE_ID: string | null;
  PACKAGE_PRESCRIPTION_ID: string | null;
  PRESCRIPTIONNUMBER: string | null;
  VERIFY_STATUS: string | null;
  VERIFIED_AT: Date | string | null;
  SOURCE_HASH: string | null;
  ITEM_PRESCRIPTIONNUMBER: string | null;
  ITEM_MEDICINECODE: string | null;
  ITEMSEQ: number | null;
  PACKAGE_ID: string | null;
  PACKAGE_NUMBER: string | null;
  PACKAGE_PRIORITY: string | null;
  PAGE_NOW: string | null;
  PACKAGE_STATUS: string | null;
  DISPENSING_PICKUP_STATUS: string | null;
}

interface PackageQueryRow {
  PACKAGE_ID: string;
  WORKFLOW_ID: string;
  PACKAGE_NUMBER: string;
  BATCH_NO: number;
  PACKAGE_PRIORITY: string;
  PAGE_NOW: string;
  PACKAGE_STATUS: string;
  IS_ACTIVE: boolean;
  VERIFY_NOTE: string | null;
  DISPENSING_PICKUP_STATUS: string | null;
  CALL_COUNT: number;
  LAST_CALLED_AT: Date | string | null;
  RECEIVED_AT: Date | string | null;
  PACKAGE_CREATED_AT: Date | string;
  PACKAGE_UPDATED_AT: Date | string;
  ROW_VERSION: Buffer;
  VISITDATETIME: Date | string;
  VISITNUMBER: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  PAYMENT_STATUS: string;
  PACKAGE_ITEM_ID: string | null;
  PRESCRIPTIONNUMBER: string | null;
  ITEMSEQ: number | null;
  MEDICINECODE: string | null;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
  SOURCE_URGENCY_CODE: string | null;
  PICKING_STATUS: string | null;
  MATCHING_STATUS: string | null;
  CHECKING_STATUS: string | null;
  MATCHED_AT: Date | string | null;
  CHECKED_AT: Date | string | null;
  LABEL_PUBLIC_ID: string | null;
  QR_TOKEN: string | null;
  LABEL_STATUS: string | null;
  PRINT_COUNT: number | null;
  PRINTED_AT: Date | string | null;
}

interface PackageIdentityRow {
  PACKAGE_ID: string;
  WORKFLOW_ID: string;
  PAGE_NOW: string;
  DISPENSING_PICKUP_STATUS: string | null;
  VISITDATETIME: Date | string;
  VISITNUMBER: string;
}

interface PackageItemIdentityRow {
  PACKAGE_ITEM_ID: string;
  MEDICINECODE: string;
  QR_TOKEN: string;
}

interface CountRow {
  TOTAL_COUNT: number | string;
  COMPLETED_COUNT: number | string;
}

const VERIFY_LOCK_MINUTES = 5;

@Injectable()
export class PackageWorkflowService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly verifyService: VerifyService,
  ) {}

  async findWorkflows(
    query: PackageWorkflowsQueryDto,
  ): Promise<PackageWorkflowResponse[]> {
    this.validateDateRange(query.fromDate, query.toDate);
    const conditions = ['1 = 1'];
    const request = this.databaseService.createRequest();
    request.input('limit', sql.Int, query.limit);
    if (query.patientId) {
      conditions.push('workflow.PATIENTID = @patientId');
      request.input('patientId', sql.VarChar(15), query.patientId);
    }
    if (query.visitNumber) {
      conditions.push('workflow.VISITNUMBER = @visitNumber');
      request.input('visitNumber', sql.VarChar(10), query.visitNumber);
    }
    if (query.fromDate && query.toDate) {
      conditions.push('workflow.VISITDATETIME >= @fromDate');
      conditions.push('workflow.VISITDATETIME < DATEADD(DAY, 1, @toDate)');
      request.input('fromDate', sql.Date, query.fromDate);
      request.input('toDate', sql.Date, query.toDate);
    }

    const result = await request.query<WorkflowQueryRow>(`
      WITH FilteredWorkflows AS (
        SELECT TOP (@limit) workflow.*
        FROM dbo.TBLWORKFLOWMASTER AS workflow
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY workflow.VISITDATETIME DESC, workflow.CREATED_AT DESC
      )
      SELECT
        workflow.WORKFLOW_ID, workflow.WORKFLOW_PUBLIC_ID,
        workflow.VISITDATETIME, workflow.VISITNUMBER, workflow.PATIENTID,
        workflow.PATIENT_NAME, workflow.WORKFLOW_RUN_NO,
        workflow.CASE_STATUS, workflow.IS_ACTIVE, workflow.QUEUE_NO,
        workflow.BLOCK_REASON_CODE, workflow.BLOCK_REASON_TEXT,
        workflow.PAYMENT_STATUS, workflow.CREATED_AT, workflow.UPDATED_AT,
        workflow.ROW_VERSION, workflow.VERIFY_LOCK_TOKEN,
        workflow.VERIFY_LOCK_SESSION, workflow.VERIFY_LOCK_OWNER,
        workflow.VERIFY_LOCK_WORKSTATION, workflow.VERIFY_LOCKED_AT,
        workflow.VERIFY_LOCK_EXPIRES_AT, activePackage.PACKAGE_ID AS ACTIVE_PACKAGE_ID,
        prescription.PACKAGE_PRESCRIPTION_ID, prescription.PRESCRIPTIONNUMBER,
        prescription.VERIFY_STATUS, prescription.VERIFIED_AT,
        prescription.SOURCE_HASH, item.PRESCRIPTIONNUMBER AS ITEM_PRESCRIPTIONNUMBER,
        item.MEDICINECODE AS ITEM_MEDICINECODE, item.ITEMSEQ,
        package.PACKAGE_ID, package.PACKAGE_NUMBER, package.PACKAGE_PRIORITY,
        package.PAGE_NOW, package.PACKAGE_STATUS,
        package.DISPENSING_PICKUP_STATUS
      FROM FilteredWorkflows AS workflow
      OUTER APPLY (
        SELECT TOP (1) active.PACKAGE_ID
        FROM dbo.TBLPACKAGEMASTER AS active
        WHERE active.WORKFLOW_ID = workflow.WORKFLOW_ID AND active.IS_ACTIVE = 1
      ) AS activePackage
      LEFT JOIN dbo.TBLPACKAGEPRESCRIPTIONS AS prescription
        ON prescription.WORKFLOW_ID = workflow.WORKFLOW_ID
      LEFT JOIN dbo.TBLPACKAGEITEMS AS item
        ON item.WORKFLOW_ID = workflow.WORKFLOW_ID
       AND item.PRESCRIPTIONNUMBER = prescription.PRESCRIPTIONNUMBER
      LEFT JOIN dbo.TBLPACKAGEMASTER AS package
        ON package.PACKAGE_ID = item.PACKAGE_ID
      ORDER BY workflow.VISITDATETIME DESC, workflow.CREATED_AT DESC,
        prescription.PRESCRIPTIONNUMBER, item.ITEMSEQ;
    `);
    return this.groupWorkflowRows(result.recordset);
  }

  async findWorkflow(workflowId: string): Promise<PackageWorkflowResponse> {
    const request = this.databaseService.createRequest();
    request.input('workflowId', sql.UniqueIdentifier, workflowId);
    const result = await request.query<WorkflowQueryRow>(`
      SELECT
        workflow.WORKFLOW_ID, workflow.WORKFLOW_PUBLIC_ID,
        workflow.VISITDATETIME, workflow.VISITNUMBER, workflow.PATIENTID,
        workflow.PATIENT_NAME, workflow.WORKFLOW_RUN_NO,
        workflow.CASE_STATUS, workflow.IS_ACTIVE, workflow.QUEUE_NO,
        workflow.BLOCK_REASON_CODE, workflow.BLOCK_REASON_TEXT,
        workflow.PAYMENT_STATUS, workflow.CREATED_AT, workflow.UPDATED_AT,
        workflow.ROW_VERSION, workflow.VERIFY_LOCK_TOKEN,
        workflow.VERIFY_LOCK_SESSION, workflow.VERIFY_LOCK_OWNER,
        workflow.VERIFY_LOCK_WORKSTATION, workflow.VERIFY_LOCKED_AT,
        workflow.VERIFY_LOCK_EXPIRES_AT, activePackage.PACKAGE_ID AS ACTIVE_PACKAGE_ID,
        prescription.PACKAGE_PRESCRIPTION_ID, prescription.PRESCRIPTIONNUMBER,
        prescription.VERIFY_STATUS, prescription.VERIFIED_AT,
        prescription.SOURCE_HASH, item.PRESCRIPTIONNUMBER AS ITEM_PRESCRIPTIONNUMBER,
        item.MEDICINECODE AS ITEM_MEDICINECODE, item.ITEMSEQ,
        package.PACKAGE_ID, package.PACKAGE_NUMBER, package.PACKAGE_PRIORITY,
        package.PAGE_NOW, package.PACKAGE_STATUS,
        package.DISPENSING_PICKUP_STATUS
      FROM dbo.TBLWORKFLOWMASTER AS workflow
      OUTER APPLY (
        SELECT TOP (1) active.PACKAGE_ID
        FROM dbo.TBLPACKAGEMASTER AS active
        WHERE active.WORKFLOW_ID = workflow.WORKFLOW_ID AND active.IS_ACTIVE = 1
      ) AS activePackage
      LEFT JOIN dbo.TBLPACKAGEPRESCRIPTIONS AS prescription
        ON prescription.WORKFLOW_ID = workflow.WORKFLOW_ID
      LEFT JOIN dbo.TBLPACKAGEITEMS AS item
        ON item.WORKFLOW_ID = workflow.WORKFLOW_ID
       AND item.PRESCRIPTIONNUMBER = prescription.PRESCRIPTIONNUMBER
      LEFT JOIN dbo.TBLPACKAGEMASTER AS package
        ON package.PACKAGE_ID = item.PACKAGE_ID
      WHERE workflow.WORKFLOW_ID = @workflowId
      ORDER BY prescription.PRESCRIPTIONNUMBER, item.ITEMSEQ;
    `);
    const workflow = this.groupWorkflowRows(result.recordset)[0];
    if (!workflow) throw new NotFoundException('Package workflow was not found');
    return workflow;
  }

  async findPackages(query: PackagesQueryDto): Promise<PackageResponse[]> {
    this.validateDateRange(query.fromDate, query.toDate);
    const conditions = ['1 = 1'];
    const request = this.databaseService.createRequest();
    request.input('limit', sql.Int, query.limit);
    if (query.pageNow) {
      conditions.push('package.PAGE_NOW = @pageNow');
      request.input('pageNow', sql.VarChar(32), query.pageNow);
    }
    if (query.patientId) {
      conditions.push('workflow.PATIENTID = @patientId');
      request.input('patientId', sql.VarChar(15), query.patientId);
    }
    if (query.visitNumber) {
      conditions.push('workflow.VISITNUMBER = @visitNumber');
      request.input('visitNumber', sql.VarChar(10), query.visitNumber);
    }
    if (query.fromDate && query.toDate) {
      conditions.push('workflow.VISITDATETIME >= @fromDate');
      conditions.push('workflow.VISITDATETIME < DATEADD(DAY, 1, @toDate)');
      request.input('fromDate', sql.Date, query.fromDate);
      request.input('toDate', sql.Date, query.toDate);
    }
    const result = await request.query<PackageQueryRow>(`
      WITH FilteredPackages AS (
        SELECT TOP (@limit) package.PACKAGE_ID
        FROM dbo.TBLPACKAGEMASTER AS package
        JOIN dbo.TBLWORKFLOWMASTER AS workflow
          ON workflow.WORKFLOW_ID = package.WORKFLOW_ID
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY package.UPDATED_AT DESC
      )
      SELECT
        package.PACKAGE_ID, package.WORKFLOW_ID, package.PACKAGE_NUMBER,
        package.BATCH_NO, package.PACKAGE_PRIORITY, package.PAGE_NOW,
        package.PACKAGE_STATUS, package.IS_ACTIVE, package.VERIFY_NOTE,
        package.DISPENSING_PICKUP_STATUS, package.CALL_COUNT,
        package.LAST_CALLED_AT, package.RECEIVED_AT,
        package.CREATED_AT AS PACKAGE_CREATED_AT,
        package.UPDATED_AT AS PACKAGE_UPDATED_AT, package.ROW_VERSION,
        workflow.VISITDATETIME, workflow.VISITNUMBER, workflow.PATIENTID,
        workflow.PATIENT_NAME, workflow.PAYMENT_STATUS,
        item.PACKAGE_ITEM_ID, item.PRESCRIPTIONNUMBER, item.ITEMSEQ,
        item.MEDICINECODE, item.COMMERCIALNAME, item.ORDERQTY,
        item.ORDERUNITCODE, item.DOSEMEMO_TH, item.SOURCE_URGENCY_CODE,
        item.PICKING_STATUS, item.MATCHING_STATUS, item.CHECKING_STATUS,
        item.MATCHED_AT, item.CHECKED_AT, item.LABEL_PUBLIC_ID,
        item.QR_TOKEN, item.LABEL_STATUS, item.PRINT_COUNT, item.PRINTED_AT
      FROM FilteredPackages AS selected
      JOIN dbo.TBLPACKAGEMASTER AS package
        ON package.PACKAGE_ID = selected.PACKAGE_ID
      JOIN dbo.TBLWORKFLOWMASTER AS workflow
        ON workflow.WORKFLOW_ID = package.WORKFLOW_ID
      LEFT JOIN dbo.TBLPACKAGEITEMS AS item
        ON item.PACKAGE_ID = package.PACKAGE_ID
      ORDER BY package.UPDATED_AT DESC, item.PRESCRIPTIONNUMBER, item.ITEMSEQ;
    `);
    return this.groupPackageRows(result.recordset);
  }

  async findPackage(packageId: string): Promise<PackageResponse> {
    const request = this.databaseService.createRequest();
    request.input('packageId', sql.UniqueIdentifier, packageId);
    const result = await request.query<PackageQueryRow>(`
      SELECT
        package.PACKAGE_ID, package.WORKFLOW_ID, package.PACKAGE_NUMBER,
        package.BATCH_NO, package.PACKAGE_PRIORITY, package.PAGE_NOW,
        package.PACKAGE_STATUS, package.IS_ACTIVE, package.VERIFY_NOTE,
        package.DISPENSING_PICKUP_STATUS, package.CALL_COUNT,
        package.LAST_CALLED_AT, package.RECEIVED_AT,
        package.CREATED_AT AS PACKAGE_CREATED_AT,
        package.UPDATED_AT AS PACKAGE_UPDATED_AT, package.ROW_VERSION,
        workflow.VISITDATETIME, workflow.VISITNUMBER, workflow.PATIENTID,
        workflow.PATIENT_NAME, workflow.PAYMENT_STATUS,
        item.PACKAGE_ITEM_ID, item.PRESCRIPTIONNUMBER, item.ITEMSEQ,
        item.MEDICINECODE, item.COMMERCIALNAME, item.ORDERQTY,
        item.ORDERUNITCODE, item.DOSEMEMO_TH, item.SOURCE_URGENCY_CODE,
        item.PICKING_STATUS, item.MATCHING_STATUS, item.CHECKING_STATUS,
        item.MATCHED_AT, item.CHECKED_AT, item.LABEL_PUBLIC_ID,
        item.QR_TOKEN, item.LABEL_STATUS, item.PRINT_COUNT, item.PRINTED_AT
      FROM dbo.TBLPACKAGEMASTER AS package
      JOIN dbo.TBLWORKFLOWMASTER AS workflow
        ON workflow.WORKFLOW_ID = package.WORKFLOW_ID
      LEFT JOIN dbo.TBLPACKAGEITEMS AS item ON item.PACKAGE_ID = package.PACKAGE_ID
      WHERE package.PACKAGE_ID = @packageId
      ORDER BY item.PRESCRIPTIONNUMBER, item.ITEMSEQ;
    `);
    const packageResponse = this.groupPackageRows(result.recordset)[0];
    if (!packageResponse) throw new NotFoundException('Package was not found');
    return packageResponse;
  }

  async claimVerifyLock(
    body: ClaimVerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    const source = await this.getSourceVisit(body.visitDate, body.visitNumber);
    const workflowId = await this.ensureWorkflow(source);
    await this.databaseService.withTransaction(async (createRequest) => {
      const lockRequest = createRequest();
      lockRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
      const lockResult = await lockRequest.query<WorkflowIdentityRow>(`
        SELECT WORKFLOW_ID, VISITDATETIME, VISITNUMBER, CASE_STATUS,
          VERIFY_LOCK_TOKEN, VERIFY_LOCK_SESSION, VERIFY_LOCK_EXPIRES_AT
        FROM dbo.TBLWORKFLOWMASTER WITH (UPDLOCK, HOLDLOCK)
        WHERE WORKFLOW_ID = @workflowId;
      `);
      const workflow = lockResult.recordset[0];
      if (!workflow) throw new NotFoundException('Package workflow was not found');
      if (workflow.CASE_STATUS !== 'VERIFY') {
        throw new ConflictException('Workflow is not available for Verify');
      }

      const activeRequest = createRequest();
      activeRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
      const active = await activeRequest.query<{ PACKAGE_ID: string }>(`
        SELECT PACKAGE_ID FROM dbo.TBLPACKAGEMASTER
        WHERE WORKFLOW_ID = @workflowId AND IS_ACTIVE = 1;
      `);
      if (active.recordset[0]) {
        throw new ConflictException('VN นี้มี Package ที่กำลังทำงานอยู่');
      }

      const now = Date.now();
      const expiresAt = workflow.VERIFY_LOCK_EXPIRES_AT
        ? new Date(workflow.VERIFY_LOCK_EXPIRES_AT).getTime()
        : 0;
      if (
        workflow.VERIFY_LOCK_TOKEN &&
        expiresAt > now &&
        workflow.VERIFY_LOCK_SESSION !== body.sessionId
      ) {
        throw new ConflictException('VN นี้กำลังถูกตรวจสอบโดยผู้ใช้อื่น');
      }

      const token =
        workflow.VERIFY_LOCK_SESSION === body.sessionId &&
        workflow.VERIFY_LOCK_TOKEN &&
        expiresAt > now
          ? workflow.VERIFY_LOCK_TOKEN
          : randomUUID();
      const updateRequest = createRequest();
      updateRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
      updateRequest.input('token', sql.UniqueIdentifier, token);
      updateRequest.input('sessionId', sql.VarChar(100), body.sessionId);
      updateRequest.input('ownerName', sql.NVarChar(150), body.ownerName ?? 'MVP user');
      updateRequest.input('workstationCode', sql.VarChar(100), body.workstationCode ?? null);
      updateRequest.input('lockMinutes', sql.Int, VERIFY_LOCK_MINUTES);
      await updateRequest.query(`
        UPDATE dbo.TBLWORKFLOWMASTER
        SET VERIFY_LOCK_TOKEN = @token,
            VERIFY_LOCK_SESSION = @sessionId,
            VERIFY_LOCK_OWNER = @ownerName,
            VERIFY_LOCK_WORKSTATION = @workstationCode,
            VERIFY_LOCKED_AT = CASE WHEN VERIFY_LOCK_SESSION = @sessionId
              THEN COALESCE(VERIFY_LOCKED_AT, SYSUTCDATETIME())
              ELSE SYSUTCDATETIME() END,
            VERIFY_LOCK_HEARTBEAT_AT = SYSUTCDATETIME(),
            VERIFY_LOCK_EXPIRES_AT = DATEADD(MINUTE, @lockMinutes, SYSUTCDATETIME()),
            UPDATED_AT = SYSUTCDATETIME()
        WHERE WORKFLOW_ID = @workflowId;

        INSERT INTO dbo.TBLPACKAGEEVENTS (
          WORKFLOW_ID, EVENT_TYPE, RESULT, ACTOR_NAME, WORKSTATION_CODE
        ) VALUES (
          @workflowId, 'VERIFY_LOCK_CLAIMED', 'SUCCESS', @ownerName, @workstationCode
        );
      `);
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return this.findWorkflow(workflowId);
  }

  async heartbeatVerifyLock(
    workflowId: string,
    body: VerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    const request = this.databaseService.createRequest();
    request.input('workflowId', sql.UniqueIdentifier, workflowId);
    request.input('token', sql.UniqueIdentifier, body.lockToken);
    request.input('sessionId', sql.VarChar(100), body.sessionId);
    request.input('lockMinutes', sql.Int, VERIFY_LOCK_MINUTES);
    const result = await request.query(`
      UPDATE dbo.TBLWORKFLOWMASTER
      SET VERIFY_LOCK_HEARTBEAT_AT = SYSUTCDATETIME(),
          VERIFY_LOCK_EXPIRES_AT = DATEADD(MINUTE, @lockMinutes, SYSUTCDATETIME()),
          UPDATED_AT = SYSUTCDATETIME()
      WHERE WORKFLOW_ID = @workflowId
        AND VERIFY_LOCK_TOKEN = @token
        AND VERIFY_LOCK_SESSION = @sessionId
        AND VERIFY_LOCK_EXPIRES_AT > SYSUTCDATETIME();
    `);
    if ((result.rowsAffected[0] ?? 0) === 0) {
      throw new ConflictException('Verify lock หมดอายุหรือถูกปล่อยแล้ว');
    }
    return this.findWorkflow(workflowId);
  }

  async releaseVerifyLock(
    workflowId: string,
    body: VerifyLockDto,
  ): Promise<PackageWorkflowResponse> {
    await this.databaseService.withTransaction(async (createRequest) => {
      const request = createRequest();
      request.input('workflowId', sql.UniqueIdentifier, workflowId);
      request.input('token', sql.UniqueIdentifier, body.lockToken);
      request.input('sessionId', sql.VarChar(100), body.sessionId);
      await request.query(`
        UPDATE dbo.TBLWORKFLOWMASTER
        SET VERIFY_LOCK_TOKEN = NULL, VERIFY_LOCK_SESSION = NULL,
            VERIFY_LOCK_OWNER = NULL, VERIFY_LOCK_WORKSTATION = NULL,
            VERIFY_LOCKED_AT = NULL, VERIFY_LOCK_HEARTBEAT_AT = NULL,
            VERIFY_LOCK_EXPIRES_AT = NULL, UPDATED_AT = SYSUTCDATETIME()
        WHERE WORKFLOW_ID = @workflowId
          AND VERIFY_LOCK_TOKEN = @token
          AND VERIFY_LOCK_SESSION = @sessionId;

        IF @@ROWCOUNT > 0
          INSERT INTO dbo.TBLPACKAGEEVENTS (WORKFLOW_ID, EVENT_TYPE, RESULT)
          VALUES (@workflowId, 'VERIFY_LOCK_RELEASED', 'SUCCESS');
      `);
    });
    return this.findWorkflow(workflowId);
  }

  async verifyPrescription(
    workflowId: string,
    body: VerifyPackageDto,
  ): Promise<VerifyPackageResponse> {
    const workflowBefore = await this.findWorkflow(workflowId);
    const source = await this.getSourceVisit(
      workflowBefore.VISITDATETIME,
      workflowBefore.VISITNUMBER,
    );
    const sourcePrescription = source.PRESCRIPTIONS.find(
      (prescription) =>
        prescription.PRESCRIPTIONNUMBER === body.prescriptionNumber,
    );
    if (!sourcePrescription) {
      throw new NotFoundException('Prescription was not found in source data');
    }

    const transactionResult = await this.databaseService.withTransaction(
      async (createRequest) => {
        const lockRequest = createRequest();
        lockRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
        const lockResult = await lockRequest.query<WorkflowIdentityRow>(`
          SELECT WORKFLOW_ID, VISITDATETIME, VISITNUMBER, CASE_STATUS,
            VERIFY_LOCK_TOKEN, VERIFY_LOCK_SESSION, VERIFY_LOCK_EXPIRES_AT
          FROM dbo.TBLWORKFLOWMASTER WITH (UPDLOCK, HOLDLOCK)
          WHERE WORKFLOW_ID = @workflowId AND IS_ACTIVE = 1;
        `);
        const locked = lockResult.recordset[0];
        if (!locked) throw new NotFoundException('Active workflow was not found');

        const idempotencyRequest = createRequest();
        idempotencyRequest.input('idempotencyKey', sql.VarChar(100), body.idempotencyKey);
        idempotencyRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
        const existing = await idempotencyRequest.query<{ PACKAGE_ID: string }>(`
          SELECT PACKAGE_ID FROM dbo.TBLPACKAGEMASTER
          WHERE IDEMPOTENCY_KEY = @idempotencyKey
            AND WORKFLOW_ID = @workflowId;
        `);
        if (existing.recordset[0]) {
          return { packageId: existing.recordset[0].PACKAGE_ID, packageCreated: true };
        }
        this.assertVerifyLock(locked, body);

        await this.synchronizePrescriptionRows(createRequest, workflowId, source);

        const activeRequest = createRequest();
        activeRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
        const active = await activeRequest.query<{ PACKAGE_ID: string }>(`
          SELECT PACKAGE_ID FROM dbo.TBLPACKAGEMASTER
          WHERE WORKFLOW_ID = @workflowId AND IS_ACTIVE = 1;
        `);
        if (active.recordset[0]) {
          throw new ConflictException('VN นี้มี Package ที่กำลังทำงานอยู่');
        }

        if (body.mode === VerifyModeDto.URGENT) {
          const selected = this.selectUrgentItems(sourcePrescription, body);
          await this.assertItemsAreUnpackaged(createRequest, workflowId, [
            { prescription: sourcePrescription, items: selected },
          ]);
          const packageId = await this.createPackage(
            createRequest,
            workflowId,
            source,
            [{ prescription: sourcePrescription, items: selected }],
            PackagePriorityDto.URGENT,
            body,
          );
          await this.updatePrescriptionStatus(
            createRequest,
            workflowId,
            body.prescriptionNumber,
            'PARTIAL',
            body.actorName,
            this.hashPrescription(sourcePrescription),
          );
          return { packageId, packageCreated: true };
        }

        await this.updatePrescriptionStatus(
          createRequest,
          workflowId,
          body.prescriptionNumber,
          'VERIFIED_WAITING',
          body.actorName,
          this.hashPrescription(sourcePrescription),
        );
        await this.insertEvent(createRequest, {
          workflowId,
          eventType: 'PRESCRIPTION_VERIFIED',
          result: 'SUCCESS',
          actorName: body.actorName,
          eventData: JSON.stringify({ prescriptionNumber: body.prescriptionNumber }),
        });

        const waitingRequest = createRequest();
        waitingRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
        const waiting = await waitingRequest.query<{ WAITING_COUNT: number | string }>(`
          SELECT COUNT(*) AS WAITING_COUNT
          FROM dbo.TBLPACKAGEPRESCRIPTIONS
          WHERE WORKFLOW_ID = @workflowId
            AND VERIFY_STATUS NOT IN ('VERIFIED_WAITING','PACKAGED');
        `);
        if (Number(waiting.recordset[0]?.WAITING_COUNT ?? 0) > 0) {
          await this.clearVerifyLock(createRequest, workflowId);
          return { packageId: null, packageCreated: false };
        }

        const remainingGroups = await this.findRemainingSourceItems(
          createRequest,
          workflowId,
          source,
        );
        if (remainingGroups.length === 0) {
          await this.clearVerifyLock(createRequest, workflowId);
          return { packageId: null, packageCreated: false };
        }
        const packageId = await this.createPackage(
          createRequest,
          workflowId,
          source,
          remainingGroups,
          PackagePriorityDto.NORMAL,
          body,
        );
        const packagedRequest = createRequest();
        packagedRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
        await packagedRequest.query(`
          UPDATE dbo.TBLPACKAGEPRESCRIPTIONS
          SET VERIFY_STATUS = 'PACKAGED', UPDATED_AT = SYSUTCDATETIME()
          WHERE WORKFLOW_ID = @workflowId AND VERIFY_STATUS = 'VERIFIED_WAITING';
        `);
        return { packageId, packageCreated: true };
      },
      sql.ISOLATION_LEVEL.SERIALIZABLE,
    );

    const workflow = await this.findWorkflow(workflowId);
    const waitingPrescriptions = workflow.PRESCRIPTIONS
      .filter(
        (prescription) =>
          !['VERIFIED_WAITING', 'PACKAGED'].includes(
            prescription.VERIFY_STATUS,
          ),
      )
      .map((prescription) => prescription.PRESCRIPTIONNUMBER);
    return {
      PACKAGE_CREATED: transactionResult.packageCreated,
      WAITING_PRESCRIPTIONS: waitingPrescriptions,
      WORKFLOW: workflow,
      PACKAGE: transactionResult.packageId
        ? await this.findPackage(transactionResult.packageId)
        : null,
    };
  }

  async setPending(body: SetPackagePendingDto): Promise<PackageWorkflowResponse> {
    const source = await this.getSourceVisit(body.visitDate, body.visitNumber);
    const workflowId = await this.ensureWorkflow(source);
    await this.databaseService.withTransaction(async (createRequest) => {
      await this.assertNoActivePackage(createRequest, workflowId);
      const lockRequest = createRequest();
      lockRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
      const lockResult = await lockRequest.query<{
        VERIFY_LOCK_TOKEN: string | null;
        VERIFY_LOCK_EXPIRES_AT: Date | string | null;
      }>(`
        SELECT VERIFY_LOCK_TOKEN, VERIFY_LOCK_EXPIRES_AT
        FROM dbo.TBLWORKFLOWMASTER WITH (UPDLOCK, HOLDLOCK)
        WHERE WORKFLOW_ID = @workflowId;
      `);
      const verifyLock = lockResult.recordset[0];
      if (
        verifyLock?.VERIFY_LOCK_TOKEN &&
        verifyLock.VERIFY_LOCK_EXPIRES_AT &&
        new Date(verifyLock.VERIFY_LOCK_EXPIRES_AT).getTime() > Date.now()
      ) {
        throw new ConflictException('VN นี้กำลังถูกตรวจสอบอยู่ ไม่สามารถส่ง Pending ได้');
      }
      const request = createRequest();
      request.input('workflowId', sql.UniqueIdentifier, workflowId);
      request.input('reasonCode', sql.VarChar(80), body.reasonCode ?? 'MANUAL_PENDING');
      request.input('reasonText', sql.NVarChar(1000), body.reasonText ?? 'ส่งไปหน้า Pending');
      request.input('actorName', sql.NVarChar(150), body.actorName ?? 'MVP user');
      await request.query(`
        UPDATE dbo.TBLWORKFLOWMASTER
        SET CASE_STATUS = 'PENDING', BLOCK_REASON_CODE = @reasonCode,
            BLOCK_REASON_TEXT = @reasonText, UPDATED_AT = SYSUTCDATETIME(),
            VERIFY_LOCK_TOKEN = NULL, VERIFY_LOCK_SESSION = NULL,
            VERIFY_LOCK_OWNER = NULL, VERIFY_LOCK_WORKSTATION = NULL,
            VERIFY_LOCKED_AT = NULL, VERIFY_LOCK_HEARTBEAT_AT = NULL,
            VERIFY_LOCK_EXPIRES_AT = NULL
        WHERE WORKFLOW_ID = @workflowId;

        INSERT INTO dbo.TBLPACKAGEEVENTS (
          WORKFLOW_ID, EVENT_TYPE, FROM_PAGE, TO_PAGE, RESULT,
          ACTOR_NAME, EVENT_DATA
        ) VALUES (
          @workflowId, 'CASE_PENDING', 'VERIFY', 'PENDING', 'SUCCESS',
          @actorName, CONCAT('{"reason":"', STRING_ESCAPE(@reasonText, 'json'), '"}')
        );
      `);
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return this.findWorkflow(workflowId);
  }

  async returnToVerify(
    workflowId: string,
    actorName?: string,
  ): Promise<PackageWorkflowResponse> {
    await this.databaseService.withTransaction(async (createRequest) => {
      await this.assertNoActivePackage(createRequest, workflowId);
      const request = createRequest();
      request.input('workflowId', sql.UniqueIdentifier, workflowId);
      request.input('actorName', sql.NVarChar(150), actorName ?? 'MVP user');
      const result = await request.query(`
        UPDATE dbo.TBLWORKFLOWMASTER
        SET CASE_STATUS = 'VERIFY', BLOCK_REASON_CODE = NULL,
            BLOCK_REASON_TEXT = NULL, UPDATED_AT = SYSUTCDATETIME()
        WHERE WORKFLOW_ID = @workflowId AND CASE_STATUS = 'PENDING';

        IF @@ROWCOUNT > 0
          INSERT INTO dbo.TBLPACKAGEEVENTS (
            WORKFLOW_ID, EVENT_TYPE, FROM_PAGE, TO_PAGE, RESULT, ACTOR_NAME
          ) VALUES (
            @workflowId, 'CASE_RETURN_VERIFY', 'PENDING', 'VERIFY', 'SUCCESS', @actorName
          );
      `);
      if ((result.rowsAffected[0] ?? 0) === 0) {
        throw new ConflictException('Workflow is not in Pending');
      }
    });
    return this.findWorkflow(workflowId);
  }

  async transitionPackage(
    packageId: string,
    body: PackageTransitionDto,
  ): Promise<PackageResponse> {
    await this.databaseService.withTransaction(async (createRequest) => {
      const packageRow = await this.lockPackage(createRequest, packageId);
      const actorName = body.actorName ?? 'MVP user';
      if (
        body.action === PackageTransitionActionDto.SEND_TO_MATCHING &&
        packageRow.PAGE_NOW === 'PICKING'
      ) {
        const request = createRequest();
        request.input('packageId', sql.UniqueIdentifier, packageId);
        request.input('actorName', sql.NVarChar(150), actorName);
        await request.query(`
          UPDATE dbo.TBLPACKAGEITEMS
          SET PICKING_STATUS = 'COMPLETED', PICKED_BY = @actorName,
              PICKED_AT = SYSUTCDATETIME(), UPDATED_AT = SYSUTCDATETIME()
          WHERE PACKAGE_ID = @packageId;
          UPDATE dbo.TBLPACKAGEMASTER
          SET PAGE_NOW = 'MATCHING', PICKED_BY = @actorName,
              PICKING_COMPLETED_AT = SYSUTCDATETIME(), UPDATED_AT = SYSUTCDATETIME()
          WHERE PACKAGE_ID = @packageId;
        `);
        await this.insertTransitionEvent(
          createRequest,
          packageRow,
          'MATCHING',
          body,
        );
        return;
      }

      if (
        body.action === PackageTransitionActionDto.SEND_TO_CHECKING &&
        packageRow.PAGE_NOW === 'MATCHING'
      ) {
        await this.assertAllPackageItemsComplete(
          createRequest,
          packageId,
          'MATCHING_STATUS',
        );
        const request = createRequest();
        request.input('packageId', sql.UniqueIdentifier, packageId);
        request.input('actorName', sql.NVarChar(150), actorName);
        await request.query(`
          UPDATE dbo.TBLPACKAGEMASTER
          SET PAGE_NOW = 'CHECKING', MATCHED_BY = @actorName,
              MATCHING_COMPLETED_AT = SYSUTCDATETIME(), UPDATED_AT = SYSUTCDATETIME()
          WHERE PACKAGE_ID = @packageId;
        `);
        await this.insertTransitionEvent(
          createRequest,
          packageRow,
          'CHECKING',
          body,
        );
        return;
      }

      if (
        body.action === PackageTransitionActionDto.SEND_TO_DISPENSING &&
        packageRow.PAGE_NOW === 'CHECKING'
      ) {
        await this.assertAllPackageItemsComplete(
          createRequest,
          packageId,
          'CHECKING_STATUS',
        );
        const request = createRequest();
        request.input('packageId', sql.UniqueIdentifier, packageId);
        request.input('actorName', sql.NVarChar(150), actorName);
        await request.query(`
          UPDATE package
          SET PAGE_NOW = CASE WHEN workflow.PAYMENT_STATUS IN ('PAID','BYPASSED')
                THEN 'DISPENSING' ELSE 'AWAITING_DISPENSING' END,
              CHECKED_BY = @actorName,
              CHECKING_COMPLETED_AT = SYSUTCDATETIME(),
              DISPENSING_PICKUP_STATUS = CASE
                WHEN workflow.PAYMENT_STATUS IN ('PAID','BYPASSED') THEN 'WAITING_CALL'
                ELSE NULL END,
              UPDATED_AT = SYSUTCDATETIME()
          FROM dbo.TBLPACKAGEMASTER AS package
          JOIN dbo.TBLWORKFLOWMASTER AS workflow
            ON workflow.WORKFLOW_ID = package.WORKFLOW_ID
          WHERE package.PACKAGE_ID = @packageId;
        `);
        await this.insertTransitionEvent(
          createRequest,
          packageRow,
          'DISPENSING',
          body,
        );
        return;
      }

      throw new ConflictException(
        `Action ${body.action} is not allowed from ${packageRow.PAGE_NOW}`,
      );
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return this.findPackage(packageId);
  }

  async scanMatchingMedicine(
    packageId: string,
    body: MatchingPackageScanDto,
  ): Promise<PackageResponse> {
    const matched = await this.databaseService.withTransaction(
      async (createRequest) => {
        const packageRow = await this.lockPackage(createRequest, packageId);
        if (packageRow.PAGE_NOW !== 'MATCHING') {
          throw new ConflictException('Package is not in Matching');
        }
        const itemRequest = createRequest();
        itemRequest.input('packageId', sql.UniqueIdentifier, packageId);
        itemRequest.input('medicineCode', sql.VarChar(30), body.medicineCode);
        const result = await itemRequest.query<PackageItemIdentityRow>(`
          SELECT TOP (1) PACKAGE_ITEM_ID, MEDICINECODE, QR_TOKEN
          FROM dbo.TBLPACKAGEITEMS WITH (UPDLOCK, HOLDLOCK)
          WHERE PACKAGE_ID = @packageId AND MEDICINECODE = @medicineCode
            AND MATCHING_STATUS = 'WAITING'
          ORDER BY ITEMSEQ;
        `);
        const item = result.recordset[0];
        if (!item) {
          await this.insertEvent(createRequest, {
            workflowId: packageRow.WORKFLOW_ID,
            packageId,
            eventType: 'MATCHING_SCAN',
            scanType: 'MEDICINE_CODE',
            scannedValue: body.medicineCode,
            result: 'MISMATCHED',
            failureReason: 'รหัสยาไม่อยู่ใน Package หรือสแกนผ่านแล้ว',
            actorName: body.actorName,
            workstationCode: body.workstationCode,
          });
          return false;
        }
        const updateRequest = createRequest();
        updateRequest.input('itemId', sql.UniqueIdentifier, item.PACKAGE_ITEM_ID);
        updateRequest.input('actorName', sql.NVarChar(150), body.actorName ?? 'MVP user');
        await updateRequest.query(`
          UPDATE dbo.TBLPACKAGEITEMS
          SET MATCHING_STATUS = 'COMPLETED', MATCHED_BY = @actorName,
              MATCHED_AT = SYSUTCDATETIME(), LABEL_STATUS = 'PRINTED',
              PRINT_COUNT = PRINT_COUNT + 1, PRINTED_AT = SYSUTCDATETIME(),
              UPDATED_AT = SYSUTCDATETIME()
          WHERE PACKAGE_ITEM_ID = @itemId;
        `);
        await this.insertEvent(createRequest, {
          workflowId: packageRow.WORKFLOW_ID,
          packageId,
          packageItemId: item.PACKAGE_ITEM_ID,
          eventType: 'MATCHING_SCAN',
          scanType: 'MEDICINE_CODE',
          scannedValue: body.medicineCode,
          expectedValue: item.MEDICINECODE,
          result: 'MATCHED',
          actorName: body.actorName,
          workstationCode: body.workstationCode,
        });
        await this.insertEvent(createRequest, {
          workflowId: packageRow.WORKFLOW_ID,
          packageId,
          packageItemId: item.PACKAGE_ITEM_ID,
          eventType: 'LABEL_PRINT',
          result: 'SUCCESS',
          actorName: body.actorName,
          workstationCode: body.workstationCode,
        });
        return true;
      },
      sql.ISOLATION_LEVEL.SERIALIZABLE,
    );
    if (!matched) {
      throw new BadRequestException('รหัสยาไม่อยู่ใน Package หรือสแกนผ่านแล้ว');
    }
    return this.findPackage(packageId);
  }

  async validateCheckingPair(
    packageId: string,
    body: CheckingPackagePairDto,
  ): Promise<CheckingPairResponse> {
    const matched = await this.databaseService.withTransaction(
      async (createRequest) => {
        const packageRow = await this.lockPackage(createRequest, packageId);
        if (packageRow.PAGE_NOW !== 'CHECKING') {
          throw new ConflictException('Package is not in Checking');
        }
        const itemRequest = createRequest();
        itemRequest.input('packageId', sql.UniqueIdentifier, packageId);
        itemRequest.input('qrToken', sql.VarChar(100), body.labelQrToken);
        const result = await itemRequest.query<PackageItemIdentityRow>(`
          SELECT PACKAGE_ITEM_ID, MEDICINECODE, QR_TOKEN
          FROM dbo.TBLPACKAGEITEMS WITH (UPDLOCK, HOLDLOCK)
          WHERE PACKAGE_ID = @packageId AND QR_TOKEN = @qrToken
            AND LABEL_STATUS IN ('PRINTED','CHECKED')
            AND CHECKING_STATUS = 'WAITING';
        `);
        const item = result.recordset[0];
        const isMatched = Boolean(
          item && item.MEDICINECODE === body.medicineCode,
        );
        await this.insertEvent(createRequest, {
          workflowId: packageRow.WORKFLOW_ID,
          packageId,
          packageItemId: item?.PACKAGE_ITEM_ID,
          eventType: 'CHECKING_SCAN',
          scanType: 'MEDICINE_AND_QR',
          scannedValue: `${body.medicineCode}|${body.labelQrToken}`,
          expectedValue: item?.MEDICINECODE,
          result: isMatched ? 'MATCHED' : 'MISMATCHED',
          failureReason: isMatched
            ? undefined
            : 'รหัสยาไม่ตรงกับ QR ฉลากหรือฉลากไม่อยู่ใน Package',
          actorName: body.actorName,
          workstationCode: body.workstationCode,
        });
        if (isMatched && item) {
          const updateRequest = createRequest();
          updateRequest.input('itemId', sql.UniqueIdentifier, item.PACKAGE_ITEM_ID);
          updateRequest.input('actorName', sql.NVarChar(150), body.actorName ?? 'MVP user');
          await updateRequest.query(`
            UPDATE dbo.TBLPACKAGEITEMS
            SET CHECKING_STATUS = 'COMPLETED', CHECKED_BY = @actorName,
                CHECKED_AT = SYSUTCDATETIME(), LABEL_STATUS = 'CHECKED',
                LABEL_CHECKED_AT = SYSUTCDATETIME(), UPDATED_AT = SYSUTCDATETIME()
            WHERE PACKAGE_ITEM_ID = @itemId;
          `);
        }
        return isMatched;
      },
      sql.ISOLATION_LEVEL.SERIALIZABLE,
    );
    return {
      MATCHED: matched,
      MESSAGE: matched
        ? 'รหัสยาและ QR ฉลากตรงกัน'
        : 'รหัสยาไม่ตรงกับ QR ฉลากหรือฉลากไม่อยู่ใน Package',
      PACKAGE: matched ? await this.findPackage(packageId) : null,
    };
  }

  async updateDispensingStatus(
    packageId: string,
    body: DispensingStatusDto,
  ): Promise<PackageResponse> {
    await this.databaseService.withTransaction(async (createRequest) => {
      const packageRow = await this.lockPackage(createRequest, packageId);
      if (packageRow.PAGE_NOW !== 'DISPENSING') {
        throw new ConflictException('Package is not in Dispensing');
      }
      const actorName = body.actorName ?? 'MVP user';
      if (body.status === DispensingPickupStatusDto.CALLED_WAITING) {
        if (
          packageRow.DISPENSING_PICKUP_STATUS !== 'WAITING_CALL' &&
          packageRow.DISPENSING_PICKUP_STATUS !== 'CALLED_WAITING'
        ) {
          throw new ConflictException('Package cannot call the patient now');
        }
        const request = createRequest();
        request.input('packageId', sql.UniqueIdentifier, packageId);
        request.input('actorName', sql.NVarChar(150), actorName);
        await request.query(`
          UPDATE dbo.TBLPACKAGEMASTER
          SET DISPENSING_PICKUP_STATUS = 'CALLED_WAITING',
              CALL_COUNT = CALL_COUNT + 1, LAST_CALLED_AT = SYSUTCDATETIME(),
              DISPENSED_BY = @actorName, UPDATED_AT = SYSUTCDATETIME()
          WHERE PACKAGE_ID = @packageId;
        `);
        await this.insertEvent(createRequest, {
          workflowId: packageRow.WORKFLOW_ID,
          packageId,
          eventType: 'PATIENT_CALLED',
          result: 'SUCCESS',
          actorName,
          workstationCode: body.workstationCode,
        });
        return;
      }

      if (packageRow.DISPENSING_PICKUP_STATUS !== 'CALLED_WAITING') {
        throw new ConflictException('ต้องเรียกผู้ป่วยก่อนบันทึกรับยา');
      }
      const receiveRequest = createRequest();
      receiveRequest.input('packageId', sql.UniqueIdentifier, packageId);
      receiveRequest.input('workflowId', sql.UniqueIdentifier, packageRow.WORKFLOW_ID);
      receiveRequest.input('actorName', sql.NVarChar(150), actorName);
      receiveRequest.input('visitDate', sql.Date, this.toDateOnly(packageRow.VISITDATETIME));
      receiveRequest.input('visitNumber', sql.VarChar(10), packageRow.VISITNUMBER);
      await receiveRequest.query(`
        UPDATE dbo.TBLPACKAGEMASTER
        SET DISPENSING_PICKUP_STATUS = 'RECEIVED', PAGE_NOW = 'COMPLETE',
            PACKAGE_STATUS = 'COMPLETED', IS_ACTIVE = 0,
            RECEIVED_AT = SYSUTCDATETIME(), DISPENSING_COMPLETED_AT = SYSUTCDATETIME(),
            DISPENSED_BY = @actorName, UPDATED_AT = SYSUTCDATETIME()
        WHERE PACKAGE_ID = @packageId;

        DECLARE @remainingItems int = (
          SELECT COUNT(*)
          FROM dbo.TBLORXITEMS AS sourceItem
          WHERE sourceItem.VISITDATETIME = @visitDate
            AND sourceItem.VISITNUMBER = @visitNumber
            AND ISNULL(sourceItem.IS_DELETED, 0) = 0
            AND ISNULL(sourceItem.CANCELSTATUS, '') <> 'Y'
            AND NOT EXISTS (
              SELECT 1 FROM dbo.TBLPACKAGEITEMS AS packagedItem
              WHERE packagedItem.WORKFLOW_ID = @workflowId
                AND packagedItem.PRESCRIPTIONNUMBER = sourceItem.PRESCRIPTIONNUMBER
                AND packagedItem.MEDICINECODE = sourceItem.MEDICINECODE
                AND packagedItem.ITEMSEQ = sourceItem.ITEMSEQ
            )
        );

        UPDATE prescription
        SET VERIFY_STATUS = CASE
              WHEN EXISTS (
                SELECT 1 FROM dbo.TBLORXITEMS AS sourceItem
                WHERE sourceItem.VISITDATETIME = @visitDate
                  AND sourceItem.VISITNUMBER = @visitNumber
                  AND sourceItem.PRESCRIPTIONNUMBER = prescription.PRESCRIPTIONNUMBER
                  AND ISNULL(sourceItem.IS_DELETED, 0) = 0
                  AND ISNULL(sourceItem.CANCELSTATUS, '') <> 'Y'
                  AND NOT EXISTS (
                    SELECT 1 FROM dbo.TBLPACKAGEITEMS AS packagedItem
                    WHERE packagedItem.WORKFLOW_ID = @workflowId
                      AND packagedItem.PRESCRIPTIONNUMBER = sourceItem.PRESCRIPTIONNUMBER
                      AND packagedItem.MEDICINECODE = sourceItem.MEDICINECODE
                      AND packagedItem.ITEMSEQ = sourceItem.ITEMSEQ
                  )
              ) THEN CASE WHEN prescription.VERIFY_STATUS = 'VERIFIED_WAITING'
                THEN 'VERIFIED_WAITING' ELSE 'PARTIAL' END
              ELSE 'PACKAGED' END,
            UPDATED_AT = SYSUTCDATETIME()
        FROM dbo.TBLPACKAGEPRESCRIPTIONS AS prescription
        WHERE prescription.WORKFLOW_ID = @workflowId;

        UPDATE dbo.TBLWORKFLOWMASTER
        SET CASE_STATUS = CASE WHEN @remainingItems > 0 THEN 'VERIFY' ELSE 'COMPLETE' END,
            IS_ACTIVE = CASE WHEN @remainingItems > 0 THEN 1 ELSE 0 END,
            COMPLETED_AT = CASE WHEN @remainingItems = 0 THEN SYSUTCDATETIME() ELSE NULL END,
            UPDATED_AT = SYSUTCDATETIME()
        WHERE WORKFLOW_ID = @workflowId;
      `);
      await this.insertEvent(createRequest, {
        workflowId: packageRow.WORKFLOW_ID,
        packageId,
        eventType: 'PATIENT_RECEIVED',
        fromPage: 'DISPENSING',
        toPage: 'COMPLETE',
        result: 'SUCCESS',
        actorName,
        workstationCode: body.workstationCode,
      });
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return this.findPackage(packageId);
  }

  private async ensureWorkflow(source: VerifyPrescriptionPatient): Promise<string> {
    const first = source.PRESCRIPTIONS[0];
    if (!first) throw new NotFoundException('Visit prescriptions were not found');
    return this.databaseService.withTransaction(async (createRequest) => {
      const lookupRequest = createRequest();
      lookupRequest.input('visitDate', sql.Date, first.VISITDATETIME);
      lookupRequest.input('visitNumber', sql.VarChar(10), first.VISITNUMBER);
      const lookup = await lookupRequest.query<{ WORKFLOW_ID: string }>(`
        SELECT WORKFLOW_ID
        FROM dbo.TBLWORKFLOWMASTER WITH (UPDLOCK, HOLDLOCK)
        WHERE VISITDATETIME = @visitDate AND VISITNUMBER = @visitNumber
          AND IS_ACTIVE = 1;
      `);
      let workflowId = lookup.recordset[0]?.WORKFLOW_ID;
      if (!workflowId) {
        workflowId = randomUUID();
        const insertRequest = createRequest();
        insertRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
        insertRequest.input('publicId', sql.VarChar(48), `WF-${randomUUID()}`);
        insertRequest.input('visitDate', sql.Date, first.VISITDATETIME);
        insertRequest.input('visitNumber', sql.VarChar(10), first.VISITNUMBER);
        insertRequest.input('patientId', sql.VarChar(15), source.PATIENTID);
        insertRequest.input('patientName', sql.NVarChar(200), source.FULLNAME_TH);
        await insertRequest.query(`
          DECLARE @runNo int = (
            SELECT ISNULL(MAX(WORKFLOW_RUN_NO), 0) + 1
            FROM dbo.TBLWORKFLOWMASTER
            WHERE VISITDATETIME = @visitDate AND VISITNUMBER = @visitNumber
          );
          INSERT INTO dbo.TBLWORKFLOWMASTER (
            WORKFLOW_ID, WORKFLOW_PUBLIC_ID, VISITDATETIME, VISITNUMBER,
            PATIENTID, PATIENT_NAME, WORKFLOW_RUN_NO, PAYMENT_STATUS
          ) VALUES (
            @workflowId, @publicId, @visitDate, @visitNumber,
            @patientId, @patientName, @runNo, 'BYPASSED'
          );
          INSERT INTO dbo.TBLPACKAGEEVENTS (
            WORKFLOW_ID, EVENT_TYPE, TO_PAGE, RESULT, ACTOR_NAME
          ) VALUES (
            @workflowId, 'WORKFLOW_INITIALIZED', 'VERIFY', 'SUCCESS', 'MVP system'
          );
        `);
      }
      await this.synchronizePrescriptionRows(createRequest, workflowId, source);
      return workflowId;
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
  }

  private async synchronizePrescriptionRows(
    createRequest: () => sql.Request,
    workflowId: string,
    source: VerifyPrescriptionPatient,
  ): Promise<void> {
    for (const prescription of source.PRESCRIPTIONS) {
      const request = createRequest();
      request.input('workflowId', sql.UniqueIdentifier, workflowId);
      request.input('prescriptionNumber', sql.VarChar(16), prescription.PRESCRIPTIONNUMBER);
      request.input('sourceHash', sql.VarChar(64), this.hashPrescription(prescription));
      await request.query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.TBLPACKAGEPRESCRIPTIONS
          WHERE WORKFLOW_ID = @workflowId AND PRESCRIPTIONNUMBER = @prescriptionNumber
        )
        BEGIN
          INSERT INTO dbo.TBLPACKAGEPRESCRIPTIONS (
            WORKFLOW_ID, PRESCRIPTIONNUMBER, SOURCE_HASH
          ) VALUES (@workflowId, @prescriptionNumber, @sourceHash);
        END
        ELSE
        BEGIN
          UPDATE dbo.TBLPACKAGEPRESCRIPTIONS
          SET VERIFY_STATUS = CASE
                WHEN SOURCE_HASH IS NOT NULL AND SOURCE_HASH <> @sourceHash
                  AND VERIFY_STATUS IN ('VERIFIED_WAITING','PARTIAL')
                  THEN 'SOURCE_CHANGED'
                ELSE VERIFY_STATUS END,
              SOURCE_HASH = @sourceHash,
              UPDATED_AT = SYSUTCDATETIME()
          WHERE WORKFLOW_ID = @workflowId
            AND PRESCRIPTIONNUMBER = @prescriptionNumber;
        END;
      `);
    }
  }

  private async createPackage(
    createRequest: () => sql.Request,
    workflowId: string,
    source: VerifyPrescriptionPatient,
    groups: Array<{ prescription: VerifyPrescriptionListItem; items: VerifyItem[] }>,
    priority: PackagePriorityDto,
    body: VerifyPackageDto,
  ): Promise<string> {
    const packageId = randomUUID();
    const packageRequest = createRequest();
    packageRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
    const batch = await packageRequest.query<{ BATCH_NO: number }>(`
      SELECT ISNULL(MAX(BATCH_NO), 0) + 1 AS BATCH_NO
      FROM dbo.TBLPACKAGEMASTER WITH (UPDLOCK, HOLDLOCK)
      WHERE WORKFLOW_ID = @workflowId;
    `);
    const batchNo = Number(batch.recordset[0]?.BATCH_NO ?? 1);
    const packageNumber = `PKG-${workflowId.slice(0, 8)}-${String(batchNo).padStart(2, '0')}`;
    const insertRequest = createRequest();
    insertRequest.input('packageId', sql.UniqueIdentifier, packageId);
    insertRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
    insertRequest.input('packageNumber', sql.VarChar(60), packageNumber);
    insertRequest.input('batchNo', sql.Int, batchNo);
    insertRequest.input('priority', sql.VarChar(16), priority);
    insertRequest.input('note', sql.NVarChar(1000), body.note ?? null);
    insertRequest.input('idempotencyKey', sql.VarChar(100), body.idempotencyKey);
    insertRequest.input('actorName', sql.NVarChar(150), body.actorName ?? 'MVP user');
    await insertRequest.query(`
      INSERT INTO dbo.TBLPACKAGEMASTER (
        PACKAGE_ID, WORKFLOW_ID, PACKAGE_NUMBER, BATCH_NO,
        PACKAGE_PRIORITY, PAGE_NOW, VERIFY_NOTE, IDEMPOTENCY_KEY,
        VERIFIED_BY
      ) VALUES (
        @packageId, @workflowId, @packageNumber, @batchNo,
        @priority, 'PICKING', @note, @idempotencyKey, @actorName
      );
      UPDATE dbo.TBLWORKFLOWMASTER
      SET CASE_STATUS = 'IN_PROGRESS', UPDATED_AT = SYSUTCDATETIME(),
          VERIFY_LOCK_TOKEN = NULL, VERIFY_LOCK_SESSION = NULL,
          VERIFY_LOCK_OWNER = NULL, VERIFY_LOCK_WORKSTATION = NULL,
          VERIFY_LOCKED_AT = NULL, VERIFY_LOCK_HEARTBEAT_AT = NULL,
          VERIFY_LOCK_EXPIRES_AT = NULL
      WHERE WORKFLOW_ID = @workflowId;
    `);

    for (const group of groups) {
      for (const item of group.items) {
        const itemRequest = createRequest();
        const packageItemId = randomUUID();
        const labelPublicId = `LBL-${randomUUID()}`;
        const qrToken = `QR-${randomUUID()}`;
        itemRequest.input('packageItemId', sql.UniqueIdentifier, packageItemId);
        itemRequest.input('packageId', sql.UniqueIdentifier, packageId);
        itemRequest.input('workflowId', sql.UniqueIdentifier, workflowId);
        itemRequest.input('visitDate', sql.Date, group.prescription.VISITDATETIME);
        itemRequest.input('visitNumber', sql.VarChar(10), group.prescription.VISITNUMBER);
        itemRequest.input('prescriptionNumber', sql.VarChar(16), group.prescription.PRESCRIPTIONNUMBER);
        itemRequest.input('medicineCode', sql.VarChar(30), item.MEDICINECODE);
        itemRequest.input('itemSeq', sql.Int, item.ITEMSEQ);
        itemRequest.input('sourceCreatedAt', sql.DateTime2(3), this.toDateOrNull(item.CREATEDATETIME));
        itemRequest.input('sourceHash', sql.VarChar(64), this.hashSourceItem(group.prescription, item));
        itemRequest.input('commercialName', sql.NVarChar(300), item.COMMERCIALNAME);
        itemRequest.input('orderQty', sql.Decimal(18, 2), item.ORDERQTY);
        itemRequest.input('orderUnitCode', sql.VarChar(32), item.ORDERUNITCODE);
        itemRequest.input('doseMemoTh', sql.NVarChar(sql.MAX), item.DOSEMEMO_TH);
        itemRequest.input('labelPublicId', sql.VarChar(60), labelPublicId);
        itemRequest.input('qrToken', sql.VarChar(100), qrToken);
        itemRequest.input(
          'labelPayload',
          sql.NVarChar(sql.MAX),
          JSON.stringify({
            packageNumber,
            prescriptionNumber: group.prescription.PRESCRIPTIONNUMBER,
            itemSeq: item.ITEMSEQ,
            medicineCode: item.MEDICINECODE,
            medicineName: item.COMMERCIALNAME,
            quantity: item.ORDERQTY,
            unit: item.ORDERUNITCODE,
            doseMemoTh: item.DOSEMEMO_TH,
            templateVersion: 1,
          }),
        );
        await itemRequest.query(`
          INSERT INTO dbo.TBLPACKAGEITEMS (
            PACKAGE_ITEM_ID, PACKAGE_ID, WORKFLOW_ID,
            VISITDATETIME, VISITNUMBER, PRESCRIPTIONNUMBER,
            MEDICINECODE, ITEMSEQ, SOURCE_CREATED_AT, SOURCE_HASH,
            COMMERCIALNAME, ORDERQTY, ORDERUNITCODE, DOSEMEMO_TH,
            LABEL_PUBLIC_ID, QR_TOKEN, LABEL_PAYLOAD
          ) VALUES (
            @packageItemId, @packageId, @workflowId,
            @visitDate, @visitNumber, @prescriptionNumber,
            @medicineCode, @itemSeq, @sourceCreatedAt, @sourceHash,
            @commercialName, @orderQty, @orderUnitCode, @doseMemoTh,
            @labelPublicId, @qrToken, @labelPayload
          );
        `);
      }
    }
    await this.insertEvent(createRequest, {
      workflowId,
      packageId,
      eventType: 'PACKAGE_CREATED',
      fromPage: 'VERIFY',
      toPage: 'PICKING',
      result: 'SUCCESS',
      actorName: body.actorName,
      eventData: JSON.stringify({
        packageNumber,
        priority,
        itemCount: groups.reduce((count, group) => count + group.items.length, 0),
        patientId: source.PATIENTID,
      }),
    });
    return packageId;
  }

  private selectUrgentItems(
    source: VerifyPrescriptionListItem,
    body: VerifyPackageDto,
  ): VerifyItem[] {
    if (!body.selectedItems?.length) {
      throw new BadRequestException('Urgent Verify requires selectedItems');
    }
    const requested = new Set(
      body.selectedItems.map((item) => `${item.itemSeq}|${item.medicineCode}`),
    );
    const selected = source.ITEMS.filter((item) =>
      requested.has(`${item.ITEMSEQ}|${item.MEDICINECODE}`),
    );
    if (selected.length !== requested.size) {
      throw new BadRequestException('Some selected medicines were not found');
    }
    return selected;
  }

  private async findRemainingSourceItems(
    createRequest: () => sql.Request,
    workflowId: string,
    source: VerifyPrescriptionPatient,
  ): Promise<Array<{ prescription: VerifyPrescriptionListItem; items: VerifyItem[] }>> {
    const request = createRequest();
    request.input('workflowId', sql.UniqueIdentifier, workflowId);
    const existing = await request.query<{
      PRESCRIPTIONNUMBER: string;
      MEDICINECODE: string;
      ITEMSEQ: number;
    }>(`
      SELECT PRESCRIPTIONNUMBER, MEDICINECODE, ITEMSEQ
      FROM dbo.TBLPACKAGEITEMS WHERE WORKFLOW_ID = @workflowId;
    `);
    const keys = new Set(
      existing.recordset.map(
        (item) => `${item.PRESCRIPTIONNUMBER}|${item.MEDICINECODE}|${item.ITEMSEQ}`,
      ),
    );
    return source.PRESCRIPTIONS.map((prescription) => ({
      prescription,
      items: prescription.ITEMS.filter(
        (item) =>
          !keys.has(
            `${prescription.PRESCRIPTIONNUMBER}|${item.MEDICINECODE}|${item.ITEMSEQ}`,
          ),
      ),
    })).filter((group) => group.items.length > 0);
  }

  private async assertItemsAreUnpackaged(
    createRequest: () => sql.Request,
    workflowId: string,
    groups: Array<{ prescription: VerifyPrescriptionListItem; items: VerifyItem[] }>,
  ): Promise<void> {
    const remaining = await this.findRemainingSourceItems(
      createRequest,
      workflowId,
      {
        PATIENTID: '',
        FULLNAME_TH: null,
        PRESCRIPTIONS: groups.map((group) => ({
          ...group.prescription,
          ITEMS: group.items,
        })),
      },
    );
    const remainingCount = remaining.reduce(
      (count, group) => count + group.items.length,
      0,
    );
    const selectedCount = groups.reduce(
      (count, group) => count + group.items.length,
      0,
    );
    if (remainingCount !== selectedCount) {
      throw new ConflictException('รายการยาบางรายการถูกส่งเข้า Package แล้ว');
    }
  }

  private async updatePrescriptionStatus(
    createRequest: () => sql.Request,
    workflowId: string,
    prescriptionNumber: string,
    status: string,
    actorName: string | undefined,
    sourceHash: string,
  ): Promise<void> {
    const request = createRequest();
    request.input('workflowId', sql.UniqueIdentifier, workflowId);
    request.input('prescriptionNumber', sql.VarChar(16), prescriptionNumber);
    request.input('status', sql.VarChar(24), status);
    request.input('actorName', sql.NVarChar(150), actorName ?? 'MVP user');
    request.input('sourceHash', sql.VarChar(64), sourceHash);
    await request.query(`
      UPDATE dbo.TBLPACKAGEPRESCRIPTIONS
      SET VERIFY_STATUS = @status, VERIFIED_BY = @actorName,
          VERIFIED_AT = SYSUTCDATETIME(), SOURCE_HASH = @sourceHash,
          UPDATED_AT = SYSUTCDATETIME()
      WHERE WORKFLOW_ID = @workflowId
        AND PRESCRIPTIONNUMBER = @prescriptionNumber;
    `);
  }

  private async assertNoActivePackage(
    createRequest: () => sql.Request,
    workflowId: string,
  ): Promise<void> {
    const request = createRequest();
    request.input('workflowId', sql.UniqueIdentifier, workflowId);
    const result = await request.query<{ PACKAGE_ID: string }>(`
      SELECT PACKAGE_ID FROM dbo.TBLPACKAGEMASTER WITH (UPDLOCK, HOLDLOCK)
      WHERE WORKFLOW_ID = @workflowId AND IS_ACTIVE = 1;
    `);
    if (result.recordset[0]) {
      throw new ConflictException('VN นี้มี Package ที่กำลังทำงานอยู่');
    }
  }

  private assertVerifyLock(
    workflow: WorkflowIdentityRow,
    body: VerifyLockDto,
  ): void {
    const expiresAt = workflow.VERIFY_LOCK_EXPIRES_AT
      ? new Date(workflow.VERIFY_LOCK_EXPIRES_AT).getTime()
      : 0;
    if (
      workflow.VERIFY_LOCK_TOKEN !== body.lockToken ||
      workflow.VERIFY_LOCK_SESSION !== body.sessionId ||
      expiresAt <= Date.now()
    ) {
      throw new ConflictException('Verify lock หมดอายุหรือไม่ได้เป็นของ session นี้');
    }
  }

  private async clearVerifyLock(
    createRequest: () => sql.Request,
    workflowId: string,
  ): Promise<void> {
    const request = createRequest();
    request.input('workflowId', sql.UniqueIdentifier, workflowId);
    await request.query(`
      UPDATE dbo.TBLWORKFLOWMASTER
      SET VERIFY_LOCK_TOKEN = NULL, VERIFY_LOCK_SESSION = NULL,
          VERIFY_LOCK_OWNER = NULL, VERIFY_LOCK_WORKSTATION = NULL,
          VERIFY_LOCKED_AT = NULL, VERIFY_LOCK_HEARTBEAT_AT = NULL,
          VERIFY_LOCK_EXPIRES_AT = NULL, UPDATED_AT = SYSUTCDATETIME()
      WHERE WORKFLOW_ID = @workflowId;
    `);
  }

  private async lockPackage(
    createRequest: () => sql.Request,
    packageId: string,
  ): Promise<PackageIdentityRow> {
    const request = createRequest();
    request.input('packageId', sql.UniqueIdentifier, packageId);
    const result = await request.query<PackageIdentityRow>(`
      SELECT package.PACKAGE_ID, package.WORKFLOW_ID, package.PAGE_NOW,
        package.DISPENSING_PICKUP_STATUS, workflow.VISITDATETIME,
        workflow.VISITNUMBER
      FROM dbo.TBLPACKAGEMASTER AS package WITH (UPDLOCK, HOLDLOCK)
      JOIN dbo.TBLWORKFLOWMASTER AS workflow
        ON workflow.WORKFLOW_ID = package.WORKFLOW_ID
      WHERE package.PACKAGE_ID = @packageId;
    `);
    const packageRow = result.recordset[0];
    if (!packageRow) throw new NotFoundException('Package was not found');
    return packageRow;
  }

  private async assertAllPackageItemsComplete(
    createRequest: () => sql.Request,
    packageId: string,
    statusColumn: 'MATCHING_STATUS' | 'CHECKING_STATUS',
  ): Promise<void> {
    const request = createRequest();
    request.input('packageId', sql.UniqueIdentifier, packageId);
    const result = await request.query<CountRow>(`
      SELECT COUNT(*) AS TOTAL_COUNT,
        SUM(CASE WHEN ${statusColumn} = 'COMPLETED' THEN 1 ELSE 0 END)
          AS COMPLETED_COUNT
      FROM dbo.TBLPACKAGEITEMS WHERE PACKAGE_ID = @packageId;
    `);
    const row = result.recordset[0];
    if (
      !row ||
      Number(row.TOTAL_COUNT) === 0 ||
      Number(row.TOTAL_COUNT) !== Number(row.COMPLETED_COUNT)
    ) {
      throw new ConflictException(`All package items must complete ${statusColumn}`);
    }
  }

  private async insertTransitionEvent(
    createRequest: () => sql.Request,
    packageRow: PackageIdentityRow,
    toPage: string,
    body: PackageTransitionDto,
  ): Promise<void> {
    await this.insertEvent(createRequest, {
      workflowId: packageRow.WORKFLOW_ID,
      packageId: packageRow.PACKAGE_ID,
      eventType: 'PAGE_TRANSITION',
      fromPage: packageRow.PAGE_NOW,
      toPage,
      result: 'SUCCESS',
      actorName: body.actorName,
      workstationCode: body.workstationCode,
    });
  }

  private async insertEvent(
    createRequest: () => sql.Request,
    event: {
      workflowId: string;
      packageId?: string;
      packageItemId?: string;
      eventType: string;
      fromPage?: string;
      toPage?: string;
      scanType?: string;
      scannedValue?: string;
      expectedValue?: string;
      result?: string;
      failureReason?: string;
      actorName?: string;
      workstationCode?: string;
      eventData?: string;
    },
  ): Promise<void> {
    const request = createRequest();
    request.input('workflowId', sql.UniqueIdentifier, event.workflowId);
    request.input('packageId', sql.UniqueIdentifier, event.packageId ?? null);
    request.input('packageItemId', sql.UniqueIdentifier, event.packageItemId ?? null);
    request.input('eventType', sql.VarChar(60), event.eventType);
    request.input('fromPage', sql.VarChar(32), event.fromPage ?? null);
    request.input('toPage', sql.VarChar(32), event.toPage ?? null);
    request.input('scanType', sql.VarChar(40), event.scanType ?? null);
    request.input('scannedValue', sql.VarChar(200), event.scannedValue ?? null);
    request.input('expectedValue', sql.VarChar(200), event.expectedValue ?? null);
    request.input('result', sql.VarChar(32), event.result ?? null);
    request.input('failureReason', sql.NVarChar(1000), event.failureReason ?? null);
    request.input('actorName', sql.NVarChar(150), event.actorName ?? 'MVP user');
    request.input('workstationCode', sql.VarChar(100), event.workstationCode ?? null);
    request.input('eventData', sql.NVarChar(sql.MAX), event.eventData ?? null);
    await request.query(`
      INSERT INTO dbo.TBLPACKAGEEVENTS (
        WORKFLOW_ID, PACKAGE_ID, PACKAGE_ITEM_ID, EVENT_TYPE,
        FROM_PAGE, TO_PAGE, SCAN_TYPE, SCANNED_VALUE, EXPECTED_VALUE,
        RESULT, FAILURE_REASON, ACTOR_NAME, WORKSTATION_CODE, EVENT_DATA
      ) VALUES (
        @workflowId, @packageId, @packageItemId, @eventType,
        @fromPage, @toPage, @scanType, @scannedValue, @expectedValue,
        @result, @failureReason, @actorName, @workstationCode, @eventData
      );
    `);
  }

  private async getSourceVisit(
    visitDate: string,
    visitNumber: string,
  ): Promise<VerifyPrescriptionPatient> {
    const patients = await this.verifyService.findVisitPrescriptions(
      visitDate,
      visitNumber,
    );
    const source = patients.find(
      (patient) => patient.PRESCRIPTIONS.some((prescription) => prescription.ITEMS.length > 0),
    );
    if (!source) throw new NotFoundException('Visit prescriptions were not found');
    return source;
  }

  private hashPrescription(prescription: VerifyPrescriptionListItem): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          prescriptionNumber: prescription.PRESCRIPTIONNUMBER,
          createdAt: prescription.CREATEDATETIME,
          items: prescription.ITEMS.map((item) => ({
            itemSeq: item.ITEMSEQ,
            medicineCode: item.MEDICINECODE,
            orderQty: item.ORDERQTY,
            orderUnitCode: item.ORDERUNITCODE,
            doseMemoTh: item.DOSEMEMO_TH,
          })),
        }),
      )
      .digest('hex');
  }

  private hashSourceItem(
    prescription: VerifyPrescriptionListItem,
    item: VerifyItem,
  ): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          visitDate: prescription.VISITDATETIME,
          visitNumber: prescription.VISITNUMBER,
          prescriptionNumber: prescription.PRESCRIPTIONNUMBER,
          item,
        }),
      )
      .digest('hex');
  }

  private groupWorkflowRows(rows: WorkflowQueryRow[]): PackageWorkflowResponse[] {
    const workflows = new Map<string, PackageWorkflowResponse>();
    const prescriptions = new Map<string, PackageWorkflowPrescriptionResponse>();
    const itemStates = new Set<string>();
    for (const row of rows) {
      let workflow = workflows.get(row.WORKFLOW_ID);
      if (!workflow) {
        const expiresAt = this.toIso(row.VERIFY_LOCK_EXPIRES_AT);
        workflow = {
          WORKFLOW_ID: row.WORKFLOW_ID,
          WORKFLOW_PUBLIC_ID: row.WORKFLOW_PUBLIC_ID,
          VISITDATETIME: this.toDateOnly(row.VISITDATETIME),
          VISITNUMBER: row.VISITNUMBER,
          PATIENTID: row.PATIENTID,
          PATIENT_NAME: row.PATIENT_NAME,
          WORKFLOW_RUN_NO: row.WORKFLOW_RUN_NO,
          CASE_STATUS: row.CASE_STATUS,
          IS_ACTIVE: Boolean(row.IS_ACTIVE),
          QUEUE_NO: row.QUEUE_NO,
          BLOCK_REASON_CODE: row.BLOCK_REASON_CODE,
          BLOCK_REASON_TEXT: row.BLOCK_REASON_TEXT,
          PAYMENT_STATUS: row.PAYMENT_STATUS,
          CREATED_AT: this.toIso(row.CREATED_AT) ?? '',
          UPDATED_AT: this.toIso(row.UPDATED_AT) ?? '',
          ROW_VERSION: Buffer.from(row.ROW_VERSION).toString('base64'),
          VERIFY_LOCK: {
            LOCK_TOKEN: row.VERIFY_LOCK_TOKEN,
            SESSION_ID: row.VERIFY_LOCK_SESSION,
            OWNER_NAME: row.VERIFY_LOCK_OWNER,
            WORKSTATION_CODE: row.VERIFY_LOCK_WORKSTATION,
            LOCKED_AT: this.toIso(row.VERIFY_LOCKED_AT),
            EXPIRES_AT: expiresAt,
            IS_LOCKED: Boolean(
              row.VERIFY_LOCK_TOKEN &&
              expiresAt &&
              new Date(expiresAt).getTime() > Date.now(),
            ),
          },
          PRESCRIPTIONS: [],
          ACTIVE_PACKAGE_ID: row.ACTIVE_PACKAGE_ID,
        };
        workflows.set(row.WORKFLOW_ID, workflow);
      }
      if (!row.PACKAGE_PRESCRIPTION_ID || !row.PRESCRIPTIONNUMBER) continue;
      let prescription = prescriptions.get(row.PACKAGE_PRESCRIPTION_ID);
      if (!prescription) {
        prescription = {
          PACKAGE_PRESCRIPTION_ID: row.PACKAGE_PRESCRIPTION_ID,
          PRESCRIPTIONNUMBER: row.PRESCRIPTIONNUMBER,
          VERIFY_STATUS: row.VERIFY_STATUS ?? 'WAITING',
          VERIFIED_AT: this.toIso(row.VERIFIED_AT),
          SOURCE_HASH: row.SOURCE_HASH,
          ITEM_STATES: [],
        };
        prescriptions.set(row.PACKAGE_PRESCRIPTION_ID, prescription);
        workflow.PRESCRIPTIONS.push(prescription);
      }
      if (
        !row.PACKAGE_ID ||
        !row.ITEM_PRESCRIPTIONNUMBER ||
        !row.ITEM_MEDICINECODE ||
        row.ITEMSEQ === null
      ) continue;
      const stateKey = `${row.PACKAGE_ID}|${row.ITEM_PRESCRIPTIONNUMBER}|${row.ITEM_MEDICINECODE}|${row.ITEMSEQ}`;
      if (itemStates.has(stateKey)) continue;
      prescription.ITEM_STATES.push({
        PRESCRIPTIONNUMBER: row.ITEM_PRESCRIPTIONNUMBER,
        MEDICINECODE: row.ITEM_MEDICINECODE,
        ITEMSEQ: row.ITEMSEQ,
        PACKAGE_ID: row.PACKAGE_ID,
        PACKAGE_NUMBER: row.PACKAGE_NUMBER ?? '',
        PACKAGE_PRIORITY: row.PACKAGE_PRIORITY ?? 'NORMAL',
        PAGE_NOW: row.PAGE_NOW ?? 'COMPLETE',
        PACKAGE_STATUS: row.PACKAGE_STATUS ?? 'COMPLETED',
        DISPENSING_PICKUP_STATUS: row.DISPENSING_PICKUP_STATUS,
      });
      itemStates.add(stateKey);
    }
    return Array.from(workflows.values());
  }

  private groupPackageRows(rows: PackageQueryRow[]): PackageResponse[] {
    const packages = new Map<string, PackageResponse>();
    for (const row of rows) {
      let packageResponse = packages.get(row.PACKAGE_ID);
      if (!packageResponse) {
        packageResponse = {
          PACKAGE_ID: row.PACKAGE_ID,
          WORKFLOW_ID: row.WORKFLOW_ID,
          PACKAGE_NUMBER: row.PACKAGE_NUMBER,
          BATCH_NO: row.BATCH_NO,
          PACKAGE_PRIORITY: row.PACKAGE_PRIORITY,
          PAGE_NOW: row.PAGE_NOW,
          PACKAGE_STATUS: row.PACKAGE_STATUS,
          IS_ACTIVE: Boolean(row.IS_ACTIVE),
          VERIFY_NOTE: row.VERIFY_NOTE,
          DISPENSING_PICKUP_STATUS: row.DISPENSING_PICKUP_STATUS,
          CALL_COUNT: row.CALL_COUNT,
          LAST_CALLED_AT: this.toIso(row.LAST_CALLED_AT),
          RECEIVED_AT: this.toIso(row.RECEIVED_AT),
          CREATED_AT: this.toIso(row.PACKAGE_CREATED_AT) ?? '',
          UPDATED_AT: this.toIso(row.PACKAGE_UPDATED_AT) ?? '',
          ROW_VERSION: Buffer.from(row.ROW_VERSION).toString('base64'),
          VISITDATETIME: this.toDateOnly(row.VISITDATETIME),
          VISITNUMBER: row.VISITNUMBER,
          PATIENTID: row.PATIENTID,
          PATIENT_NAME: row.PATIENT_NAME,
          PAYMENT_STATUS: row.PAYMENT_STATUS,
          ALLOWED_ACTIONS: [],
          ITEMS: [],
        };
        packages.set(row.PACKAGE_ID, packageResponse);
      }
      if (
        !row.PACKAGE_ITEM_ID ||
        !row.PRESCRIPTIONNUMBER ||
        row.ITEMSEQ === null ||
        !row.MEDICINECODE ||
        !row.LABEL_PUBLIC_ID ||
        !row.QR_TOKEN
      ) continue;
      const item: PackageItemResponse = {
        PACKAGE_ITEM_ID: row.PACKAGE_ITEM_ID,
        PRESCRIPTIONNUMBER: row.PRESCRIPTIONNUMBER,
        ITEMSEQ: row.ITEMSEQ,
        MEDICINECODE: row.MEDICINECODE,
        COMMERCIALNAME: row.COMMERCIALNAME,
        ORDERQTY: row.ORDERQTY,
        ORDERUNITCODE: row.ORDERUNITCODE,
        DOSEMEMO_TH: row.DOSEMEMO_TH,
        SOURCE_URGENCY_CODE: row.SOURCE_URGENCY_CODE,
        PICKING_STATUS: row.PICKING_STATUS ?? 'WAITING',
        MATCHING_STATUS: row.MATCHING_STATUS ?? 'WAITING',
        CHECKING_STATUS: row.CHECKING_STATUS ?? 'WAITING',
        MATCHED_AT: this.toIso(row.MATCHED_AT),
        CHECKED_AT: this.toIso(row.CHECKED_AT),
        LABEL: {
          LABEL_PUBLIC_ID: row.LABEL_PUBLIC_ID,
          QR_TOKEN: row.QR_TOKEN,
          LABEL_STATUS: row.LABEL_STATUS ?? 'READY_TO_PRINT',
          PRINT_COUNT: row.PRINT_COUNT ?? 0,
          PRINTED_AT: this.toIso(row.PRINTED_AT),
        },
      };
      packageResponse.ITEMS.push(item);
    }
    const result = Array.from(packages.values());
    result.forEach((packageResponse) => {
      packageResponse.ALLOWED_ACTIONS = this.allowedPackageActions(packageResponse);
    });
    return result;
  }

  private allowedPackageActions(packageResponse: PackageResponse): string[] {
    if (packageResponse.PAGE_NOW === 'PICKING') return ['SEND_TO_MATCHING'];
    if (packageResponse.PAGE_NOW === 'MATCHING') {
      const actions = ['SCAN_MEDICINE'];
      if (
        packageResponse.ITEMS.length > 0 &&
        packageResponse.ITEMS.every((item) => item.MATCHING_STATUS === 'COMPLETED')
      ) actions.push('SEND_TO_CHECKING');
      return actions;
    }
    if (packageResponse.PAGE_NOW === 'CHECKING') {
      const actions = ['VALIDATE_PAIR'];
      if (
        packageResponse.ITEMS.length > 0 &&
        packageResponse.ITEMS.every((item) => item.CHECKING_STATUS === 'COMPLETED')
      ) actions.push('SEND_TO_DISPENSING');
      return actions;
    }
    if (packageResponse.PAGE_NOW === 'DISPENSING') {
      if (packageResponse.DISPENSING_PICKUP_STATUS === 'WAITING_CALL') {
        return ['CALL_PATIENT'];
      }
      if (packageResponse.DISPENSING_PICKUP_STATUS === 'CALLED_WAITING') {
        return ['CALL_PATIENT', 'MARK_RECEIVED'];
      }
    }
    return [];
  }

  private validateDateRange(fromDate?: string, toDate?: string): void {
    if (Boolean(fromDate) !== Boolean(toDate)) {
      throw new BadRequestException('fromDate and toDate must be provided together');
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('fromDate must not be after toDate');
    }
  }

  private toDateOnly(value: Date | string): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  private toIso(value: Date | string | null): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private toDateOrNull(value: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
