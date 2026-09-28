import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import { PrintDrugLabelDto, PublishDrugLabelDraftDto, SaveDrugLabelDraftDto, SaveDrugLabelLogoDto } from './drug-label.dto';
import { DrugLabelPrintModelResponse, DrugLabelTemplatePairResponse, DrugLabelTemplateResponse } from './drug-label.interfaces';

type TemplateRow = {
  TEMPLATE_ID: string;
  TEMPLATE_NAME: string;
  VERSION_NO: number;
  TEMPLATE_STATUS: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  WIDTH_MM: number;
  HEIGHT_MM: number;
  DEFINITION_JSON: string;
  LOGO_MIME_TYPE: string | null;
  LOGO_DATA: Buffer | null;
  UPDATED_BY: string | null;
  UPDATED_AT: Date | string;
  PUBLISHED_AT: Date | string | null;
  ROW_VERSION: Buffer;
};

type PrintRow = {
  PACKAGE_ID: string;
  PACKAGE_ITEM_ID: string;
  WORKFLOW_ID: string;
  PAGE_NOW: string;
  PRESCRIPTIONNUMBER: string;
  ITEM_INDEX: number;
  TOTAL_ITEMS: number;
  MEDICINECODE: string;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
  LABEL_PAYLOAD: string | null;
  LABEL_TEMPLATE_ID: string | null;
  QR_TOKEN: string;
  MATCHING_STATUS: string;
  PATIENTID: string | null;
  PATIENT_NAME: string | null;
  VISITDATETIME: Date | string;
  VISITNUMBER: string;
  LOCALDOCTORNAME: string | null;
};

const allowedElementTypes = new Set(['text', 'field', 'qr', 'logo', 'line', 'box']);
const allowedDataKeys = new Set([
  'patientName', 'patientHn', 'visitVn', 'visitDateTime', 'doctorName', 'itemCounter',
  'medicineCode', 'medicineName', 'medicinePronunciation', 'quantity', 'doseMemo',
  'indication', 'qrToken', 'expiryDate', 'storageInstruction',
]);
const defaultLogoPath = '/assets/juraporn-hospital-emblem.png';

@Injectable()
export class DrugLabelService {
  constructor(private readonly db: DatabaseService) {}

  async current(): Promise<DrugLabelTemplatePairResponse> {
    const request = this.db.createRequest();
    const result = await request.query<TemplateRow>(`
      SELECT TEMPLATE_ID,TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,
        DEFINITION_JSON,LOGO_MIME_TYPE,LOGO_DATA,UPDATED_BY,UPDATED_AT,PUBLISHED_AT,ROW_VERSION
      FROM dbo.TBLDRUGLABELTEMPLATES
      WHERE TEMPLATE_STATUS IN ('DRAFT','ACTIVE');
    `);
    const draft = result.recordset.find(row => row.TEMPLATE_STATUS === 'DRAFT');
    const active = result.recordset.find(row => row.TEMPLATE_STATUS === 'ACTIVE');
    if (!draft || !active) throw new NotFoundException('Drug label template is not installed');
    return { DRAFT: this.toTemplate(draft), ACTIVE: this.toTemplate(active) };
  }

  async saveDraft(body: SaveDrugLabelDraftDto): Promise<DrugLabelTemplatePairResponse> {
    this.validateDefinition(body.definition, body.widthMm, body.heightMm);
    const definitionJson = JSON.stringify(body.definition);
    const expected = this.rowVersion(body.expectedRowVersion);
    await this.db.withTransaction(async createRequest => {
      const request = createRequest();
      request.input('widthMm', sql.Decimal(8, 2), body.widthMm);
      request.input('heightMm', sql.Decimal(8, 2), body.heightMm);
      request.input('definition', sql.NVarChar(sql.MAX), definitionJson);
      request.input('actor', sql.NVarChar(150), body.actorName?.trim() || 'MVP user');
      request.input('expected', sql.VarBinary(8), expected);
      const result = await request.query(`
        UPDATE dbo.TBLDRUGLABELTEMPLATES
        SET WIDTH_MM=@widthMm,HEIGHT_MM=@heightMm,DEFINITION_JSON=@definition,
          UPDATED_BY=@actor,UPDATED_AT=SYSUTCDATETIME()
        WHERE TEMPLATE_STATUS='DRAFT' AND ROW_VERSION=@expected;
      `);
      if (!result.rowsAffected[0]) throw new ConflictException('Draft was changed by another workstation; reload before saving');
    });
    return this.current();
  }

  async saveLogo(body: SaveDrugLabelLogoDto): Promise<DrugLabelTemplatePairResponse> {
    const data = this.decodeLogo(body.dataBase64, body.mimeType);
    const expected = this.rowVersion(body.expectedRowVersion);
    await this.db.withTransaction(async createRequest => {
      const request = createRequest();
      request.input('mimeType', sql.VarChar(40), body.mimeType);
      request.input('logo', sql.VarBinary(sql.MAX), data);
      request.input('actor', sql.NVarChar(150), body.actorName?.trim() || 'MVP user');
      request.input('expected', sql.VarBinary(8), expected);
      const result = await request.query(`
        UPDATE dbo.TBLDRUGLABELTEMPLATES
        SET LOGO_MIME_TYPE=@mimeType,LOGO_DATA=@logo,UPDATED_BY=@actor,UPDATED_AT=SYSUTCDATETIME()
        WHERE TEMPLATE_STATUS='DRAFT' AND ROW_VERSION=@expected;
      `);
      if (!result.rowsAffected[0]) throw new ConflictException('Draft was changed by another workstation; reload before uploading a logo');
    });
    return this.current();
  }

  async publish(body: PublishDrugLabelDraftDto): Promise<DrugLabelTemplatePairResponse> {
    const expected = this.rowVersion(body.expectedRowVersion);
    await this.db.withTransaction(async createRequest => {
      const draftRequest = createRequest();
      const draft = await draftRequest.query<TemplateRow>(`
        SELECT TEMPLATE_ID,TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,
          DEFINITION_JSON,LOGO_MIME_TYPE,LOGO_DATA,UPDATED_BY,UPDATED_AT,PUBLISHED_AT,ROW_VERSION
        FROM dbo.TBLDRUGLABELTEMPLATES WITH (UPDLOCK,HOLDLOCK)
        WHERE TEMPLATE_STATUS='DRAFT';
      `);
      const row = draft.recordset[0];
      if (!row || !row.ROW_VERSION.equals(expected)) {
        throw new ConflictException('Draft was changed by another workstation; reload before publishing');
      }
      const versionRequest = createRequest();
      const version = await versionRequest.query<{ NEXT_VERSION: number }>(`
        SELECT ISNULL(MAX(VERSION_NO),0)+1 AS NEXT_VERSION FROM dbo.TBLDRUGLABELTEMPLATES WITH (UPDLOCK,HOLDLOCK);
      `);
      const nextVersion = version.recordset[0]?.NEXT_VERSION ?? 1;
      const publishRequest = createRequest();
      publishRequest.input('draftId', sql.UniqueIdentifier, row.TEMPLATE_ID);
      publishRequest.input('version', sql.Int, nextVersion);
      publishRequest.input('actor', sql.NVarChar(150), body.actorName?.trim() || 'MVP user');
      await publishRequest.query(`
        UPDATE dbo.TBLDRUGLABELTEMPLATES
        SET TEMPLATE_STATUS='ARCHIVED',UPDATED_AT=SYSUTCDATETIME()
        WHERE TEMPLATE_STATUS='ACTIVE';

        INSERT INTO dbo.TBLDRUGLABELTEMPLATES(
          TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,DEFINITION_JSON,
          LOGO_MIME_TYPE,LOGO_DATA,UPDATED_BY,PUBLISHED_AT
        )
        SELECT TEMPLATE_NAME,@version,'ACTIVE',WIDTH_MM,HEIGHT_MM,DEFINITION_JSON,
          LOGO_MIME_TYPE,LOGO_DATA,@actor,SYSUTCDATETIME()
        FROM dbo.TBLDRUGLABELTEMPLATES WHERE TEMPLATE_ID=@draftId;

        UPDATE dbo.TBLDRUGLABELTEMPLATES
        SET VERSION_NO=@version,UPDATED_BY=@actor,UPDATED_AT=SYSUTCDATETIME()
        WHERE TEMPLATE_ID=@draftId;
      `);
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
    return this.current();
  }

  async print(packageId: string, itemId: string, body: PrintDrugLabelDto): Promise<DrugLabelPrintModelResponse> {
    return this.db.withTransaction(async createRequest => {
      const itemRequest = createRequest();
      itemRequest.input('packageId', sql.UniqueIdentifier, packageId);
      itemRequest.input('itemId', sql.UniqueIdentifier, itemId);
      const itemResult = await itemRequest.query<PrintRow>(`
        WITH RankedItems AS (
          SELECT item.*,
            ROW_NUMBER() OVER (PARTITION BY item.PACKAGE_ID ORDER BY item.PRESCRIPTIONNUMBER,item.ITEMSEQ,item.PACKAGE_ITEM_ID) AS ITEM_INDEX,
            COUNT(*) OVER (PARTITION BY item.PACKAGE_ID) AS TOTAL_ITEMS
          FROM dbo.TBLPACKAGEITEMS AS item
          WHERE item.PACKAGE_ID=@packageId
        )
        SELECT package.PACKAGE_ID,item.PACKAGE_ITEM_ID,item.WORKFLOW_ID,package.PAGE_NOW,
          item.PRESCRIPTIONNUMBER,item.ITEM_INDEX,item.TOTAL_ITEMS,item.MEDICINECODE,
          item.COMMERCIALNAME,item.ORDERQTY,item.ORDERUNITCODE,item.DOSEMEMO_TH,
          item.LABEL_PAYLOAD,item.LABEL_TEMPLATE_ID,item.QR_TOKEN,item.MATCHING_STATUS,
          workflow.PATIENTID,workflow.PATIENT_NAME,workflow.VISITDATETIME,workflow.VISITNUMBER,
          doctor.LOCALDOCTORNAME
        FROM RankedItems AS item
        JOIN dbo.TBLPACKAGEMASTER AS package ON package.PACKAGE_ID=item.PACKAGE_ID
        JOIN dbo.TBLWORKFLOWMASTER AS workflow ON workflow.WORKFLOW_ID=item.WORKFLOW_ID
        OUTER APPLY (
          SELECT TOP (1) d.LOCALDOCTORNAME
          FROM dbo.TBLORX AS rx
          LEFT JOIN dbo.TBLDOCTOR AS d ON d.DOCTORCODE=rx.DOCTORORDERCODE
          WHERE rx.VISITDATETIME=item.VISITDATETIME AND rx.VISITNUMBER=item.VISITNUMBER
            AND rx.PRESCRIPTIONNUMBER=item.PRESCRIPTIONNUMBER
        ) AS doctor
        WHERE item.PACKAGE_ITEM_ID=@itemId;
      `);
      const item = itemResult.recordset[0];
      if (!item) throw new NotFoundException('Package item was not found');
      if (item.PAGE_NOW !== 'MATCHING') throw new ConflictException('Labels can only be printed in Matching');
      if (item.MATCHING_STATUS !== 'COMPLETED') throw new ConflictException('Scan the medicine before printing its label');

      const templateRequest = createRequest();
      templateRequest.input('templateId', sql.UniqueIdentifier, item.LABEL_TEMPLATE_ID);
      const templateResult = await templateRequest.query<TemplateRow>(`
        SELECT TOP (1) TEMPLATE_ID,TEMPLATE_NAME,VERSION_NO,TEMPLATE_STATUS,WIDTH_MM,HEIGHT_MM,
          DEFINITION_JSON,LOGO_MIME_TYPE,LOGO_DATA,UPDATED_BY,UPDATED_AT,PUBLISHED_AT,ROW_VERSION
        FROM dbo.TBLDRUGLABELTEMPLATES WITH (UPDLOCK,HOLDLOCK)
        WHERE (@templateId IS NOT NULL AND TEMPLATE_ID=@templateId)
           OR (@templateId IS NULL AND TEMPLATE_STATUS='ACTIVE')
        ORDER BY CASE WHEN TEMPLATE_ID=@templateId THEN 0 ELSE 1 END,VERSION_NO DESC;
      `);
      const template = templateResult.recordset[0];
      if (!template) throw new ConflictException('No active drug label template is available');

      const printRequest = createRequest();
      printRequest.input('itemId', sql.UniqueIdentifier, itemId);
      printRequest.input('packageId', sql.UniqueIdentifier, packageId);
      printRequest.input('workflowId', sql.UniqueIdentifier, item.WORKFLOW_ID);
      printRequest.input('templateId', sql.UniqueIdentifier, template.TEMPLATE_ID);
      printRequest.input('templateVersion', sql.Int, template.VERSION_NO);
      printRequest.input('actor', sql.NVarChar(150), body.actorName?.trim() || 'MVP user');
      printRequest.input('workstation', sql.VarChar(100), body.workstationCode?.trim() || null);
      const printed = await printRequest.query<{ PRINT_COUNT: number; PRINTED_AT: Date }>(`
        UPDATE dbo.TBLPACKAGEITEMS
        SET LABEL_TEMPLATE_ID=COALESCE(LABEL_TEMPLATE_ID,@templateId),
          LABEL_TEMPLATE_VERSION=@templateVersion,LABEL_STATUS='PRINTED',
          PRINT_COUNT=PRINT_COUNT+1,PRINTED_AT=SYSUTCDATETIME(),UPDATED_AT=SYSUTCDATETIME()
        OUTPUT inserted.PRINT_COUNT,inserted.PRINTED_AT
        WHERE PACKAGE_ITEM_ID=@itemId;

        INSERT INTO dbo.TBLPACKAGEEVENTS(
          WORKFLOW_ID,PACKAGE_ID,PACKAGE_ITEM_ID,EVENT_TYPE,RESULT,ACTOR_NAME,WORKSTATION_CODE,EVENT_DATA
        ) VALUES (
          @workflowId,@packageId,@itemId,'LABEL_PRINT','SUCCESS',@actor,@workstation,
          CONCAT('{"templateVersion":',@templateVersion,'}')
        );
      `);
      const printState = printed.recordset[0];
      return {
        PACKAGE_ID: packageId,
        PACKAGE_ITEM_ID: itemId,
        TEMPLATE: this.toTemplate(template),
        DATA: this.printData(item),
        PRINT_COUNT: printState?.PRINT_COUNT ?? 1,
        PRINTED_AT: (printState?.PRINTED_AT ?? new Date()).toISOString(),
      };
    }, sql.ISOLATION_LEVEL.SERIALIZABLE);
  }

  private toTemplate(row: TemplateRow): DrugLabelTemplateResponse {
    return {
      TEMPLATE_ID: row.TEMPLATE_ID,
      TEMPLATE_NAME: row.TEMPLATE_NAME,
      VERSION_NO: row.VERSION_NO,
      TEMPLATE_STATUS: row.TEMPLATE_STATUS,
      WIDTH_MM: Number(row.WIDTH_MM),
      HEIGHT_MM: Number(row.HEIGHT_MM),
      DEFINITION: JSON.parse(row.DEFINITION_JSON) as Record<string, unknown>,
      LOGO_DATA_URL: row.LOGO_DATA && row.LOGO_MIME_TYPE
        ? `data:${row.LOGO_MIME_TYPE};base64,${row.LOGO_DATA.toString('base64')}`
        : defaultLogoPath,
      UPDATED_BY: row.UPDATED_BY,
      UPDATED_AT: this.iso(row.UPDATED_AT),
      PUBLISHED_AT: row.PUBLISHED_AT ? this.iso(row.PUBLISHED_AT) : null,
      ROW_VERSION: row.ROW_VERSION.toString('base64'),
    };
  }

  private printData(row: PrintRow): Record<string, string> {
    let saved: Record<string, unknown> = {};
    try { saved = row.LABEL_PAYLOAD ? JSON.parse(row.LABEL_PAYLOAD) as Record<string, unknown> : {}; } catch { saved = {}; }
    const value = (key: string, fallback: unknown) => String(saved[key] ?? fallback ?? '').trim() || '—';
    const quantity = [row.ORDERQTY === null ? null : Number(row.ORDERQTY).toLocaleString('th-TH'), row.ORDERUNITCODE]
      .filter(Boolean).join(' ');
    return {
      patientName: value('patientName', row.PATIENT_NAME),
      patientHn: value('patientHn', row.PATIENTID),
      visitVn: value('visitVn', row.VISITNUMBER),
      visitDateTime: value('visitDateTime', this.dateOnly(row.VISITDATETIME)),
      doctorName: value('doctorName', row.LOCALDOCTORNAME),
      itemCounter: `#${row.ITEM_INDEX}/${row.TOTAL_ITEMS}`,
      medicineCode: value('medicineCode', row.MEDICINECODE),
      medicineName: value('medicineName', row.COMMERCIALNAME),
      medicinePronunciation: value('medicinePronunciation', null),
      quantity: value('quantity', quantity),
      doseMemo: value('doseMemoTh', row.DOSEMEMO_TH),
      indication: value('indication', null),
      qrToken: value('qrToken', row.QR_TOKEN),
      expiryDate: value('expiryDate', null),
      storageInstruction: value('storageInstruction', null),
    };
  }

  private validateDefinition(definition: Record<string, unknown>, widthMm: number, heightMm: number) {
    if (definition.schemaVersion !== 1 || !Array.isArray(definition.elements) || definition.elements.length < 1 || definition.elements.length > 100) {
      throw new UnprocessableEntityException('Label definition must use schemaVersion 1 and contain 1-100 elements');
    }
    const ids = new Set<string>();
    for (const raw of definition.elements) {
      if (!raw || typeof raw !== 'object') throw new UnprocessableEntityException('Every label element must be an object');
      const element = raw as Record<string, unknown>;
      if (typeof element.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(element.id) || ids.has(element.id)) {
        throw new UnprocessableEntityException('Label element IDs must be unique safe identifiers');
      }
      ids.add(element.id);
      if (typeof element.type !== 'string' || !allowedElementTypes.has(element.type)) {
        throw new UnprocessableEntityException(`Unsupported label element type: ${String(element.type)}`);
      }
      const x = this.finite(element.xMm); const y = this.finite(element.yMm);
      const w = this.finite(element.widthMm); const h = this.finite(element.heightMm);
      if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > widthMm + 0.1 || y + h > heightMm + 0.1) {
        throw new UnprocessableEntityException(`Label element ${element.id} is outside the page`);
      }
      if (element.type === 'field' || element.type === 'qr') {
        if (typeof element.dataKey !== 'string' || !allowedDataKeys.has(element.dataKey)) {
          throw new UnprocessableEntityException(`Unsupported data field on element ${element.id}`);
        }
      }
      if (element.type === 'logo' && element.imageSrc !== undefined) {
        if (typeof element.imageSrc !== 'string' || !/^\/assets\/[a-zA-Z0-9._/-]+$/.test(element.imageSrc) || element.imageSrc.includes('..')) {
          throw new UnprocessableEntityException(`Logo image path is invalid on element ${element.id}`);
        }
      }
      if (typeof element.text === 'string' && element.text.length > 1000) {
        throw new UnprocessableEntityException(`Text is too long on element ${element.id}`);
      }
    }
  }

  private decodeLogo(dataBase64: string, mimeType: string) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64) || dataBase64.length % 4 !== 0) {
      throw new UnprocessableEntityException('Logo is not valid base64 data');
    }
    const data = Buffer.from(dataBase64, 'base64');
    if (data.length < 8 || data.length > 1_000_000) throw new UnprocessableEntityException('Logo must be between 8 bytes and 1 MB');
    const png = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9;
    if ((mimeType === 'image/png' && !png) || (mimeType === 'image/jpeg' && !jpeg)) {
      throw new UnprocessableEntityException('Logo content does not match its MIME type');
    }
    return data;
  }

  private rowVersion(value: string) {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== 8) throw new UnprocessableEntityException('ROW_VERSION is invalid');
    return decoded;
  }

  private finite(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new UnprocessableEntityException('Label coordinates must be finite numbers');
    return value;
  }

  private iso(value: Date | string) { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
  private dateOnly(value: Date | string) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
}
