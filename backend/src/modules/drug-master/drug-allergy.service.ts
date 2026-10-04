import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import {
  CreateDrugAllergyDto,
  SearchDrugAllergyReferenceDto,
} from './drug-allergy.dto';
import {
  DrugAllergyHistoryItem,
  DrugAllergyHistoryResponse,
  DrugAllergyMedicineSearchResult,
  DrugAllergyPatientSearchResult,
} from './drug-allergy.interfaces';

interface AllergyColumnMetadata {
  COLUMN_NAME: string;
  TYPE_NAME: string;
  MAX_LENGTH_BYTES: number;
}

interface AllergyInsertRow {
  CREATEDATETIME: Date | string;
  HN: string;
  MEDICINECODE: string;
  SIDE_EFFECT: string | null;
  ALLERGY_TYPE: string | null;
  SEVERITY: string | null;
  ADVERSE_REACTION_LOCAL: string | null;
  ADVERSE_REACTION_ENGLISH: string | null;
  CORRELATION_LEVEL: string | null;
  CERTIFIED_BY: string | null;
  REMARKS: string | null;
}

const requiredAllergyColumns = [
  'CREATEDATETIME',
  'HN',
  'MEDICINECODE',
  'SideEffect',
  'ALLERGYTYPE',
  'READDATETIME',
  'adverseReactionsDesc',
  'adverseReactionsLocalDesc',
  'severity',
  'correlationLevel',
  'certifiedBy',
  'remarks',
] as const;

@Injectable()
export class DrugAllergyService {
  private allergyColumnLengthsPromise: Promise<Map<string, number>> | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async searchPatients(
    body: SearchDrugAllergyReferenceDto,
  ): Promise<DrugAllergyPatientSearchResult[]> {
    const query = body.query.trim();
    const request = this.databaseService.createRequest();
    request.input('query', sql.NVarChar(100), query);
    request.input('limit', sql.Int, body.limit);
    const result = await request.query<DrugAllergyPatientSearchResult>(`
      SELECT TOP (@limit)
        LTRIM(RTRIM(CONVERT(varchar(15), patient.PATIENTID))) AS PATIENTID,
        patient.FULLNAME_TH
      FROM dbo.TBLPATIENT AS patient
      WHERE LTRIM(RTRIM(CONVERT(nvarchar(100), patient.PATIENTID))) = @query
         OR LEFT(LTRIM(RTRIM(CONVERT(nvarchar(100), patient.PATIENTID))), LEN(@query)) = @query
         OR CHARINDEX(@query, COALESCE(CONVERT(nvarchar(500), patient.FULLNAME_TH), N'')) > 0
      ORDER BY
        CASE WHEN LTRIM(RTRIM(CONVERT(nvarchar(100), patient.PATIENTID))) = @query THEN 0 ELSE 1 END,
        patient.PATIENTID;
    `);
    return result.recordset;
  }

  async searchMedicines(
    body: SearchDrugAllergyReferenceDto,
  ): Promise<DrugAllergyMedicineSearchResult[]> {
    const query = body.query.trim();
    const request = this.databaseService.createRequest();
    request.input('query', sql.NVarChar(100), query);
    request.input('limit', sql.Int, body.limit);
    const result = await request.query<DrugAllergyMedicineSearchResult>(`
      SELECT TOP (@limit)
        LTRIM(RTRIM(CONVERT(nvarchar(30), medicine.MEDICINECODE))) AS MEDICINECODE,
        medicine.COMMERCIALNAME,
        medicine.GENERICNAME,
        medicine.LOCALNAME,
        CONVERT(nvarchar(100), medicine.STRENGTH) AS STRENGTH
      FROM dbo.TBLMEDITEMSINFO AS medicine
      WHERE LTRIM(RTRIM(CONVERT(nvarchar(100), medicine.MEDICINECODE))) = @query
         OR LEFT(LTRIM(RTRIM(CONVERT(nvarchar(100), medicine.MEDICINECODE))), LEN(@query)) = @query
         OR CHARINDEX(@query, COALESCE(CONVERT(nvarchar(500), medicine.COMMERCIALNAME), N'')) > 0
         OR CHARINDEX(@query, COALESCE(CONVERT(nvarchar(500), medicine.GENERICNAME), N'')) > 0
         OR CHARINDEX(@query, COALESCE(CONVERT(nvarchar(500), medicine.LOCALNAME), N'')) > 0
      ORDER BY
        CASE WHEN LTRIM(RTRIM(CONVERT(nvarchar(100), medicine.MEDICINECODE))) = @query THEN 0 ELSE 1 END,
        medicine.MEDICINECODE;
    `);
    return result.recordset;
  }

  async history(patientId: string): Promise<DrugAllergyHistoryResponse> {
    const normalizedPatientId = patientId.trim();
    const patientRequest = this.databaseService.createRequest();
    patientRequest.input('patientId', sql.VarChar(15), normalizedPatientId);
    const patientResult = await patientRequest.query<DrugAllergyPatientSearchResult>(`
      SELECT TOP (1)
        LTRIM(RTRIM(CONVERT(varchar(15), patient.PATIENTID))) AS PATIENTID,
        patient.FULLNAME_TH
      FROM dbo.TBLPATIENT AS patient
      WHERE LTRIM(RTRIM(CONVERT(varchar(15), patient.PATIENTID))) = @patientId;
    `);
    const patient = patientResult.recordset[0];
    if (!patient) throw new NotFoundException('Patient was not found');

    const historyRequest = this.databaseService.createRequest();
    historyRequest.input('patientId', sql.VarChar(15), normalizedPatientId);
    const historyResult = await historyRequest.query<DrugAllergyHistoryItem>(`
      SELECT
        CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT(
          COALESCE(CONVERT(nvarchar(33), allergy.CREATEDATETIME, 126), N''), N'|',
          COALESCE(CONVERT(nvarchar(100), allergy.HN), N''), N'|',
          COALESCE(CONVERT(nvarchar(100), allergy.MEDICINECODE), N''), N'|',
          COALESCE(CONVERT(nvarchar(max), allergy.SideEffect), N''), N'|',
          COALESCE(CONVERT(nvarchar(max), allergy.ALLERGYTYPE), N''), N'|',
          COALESCE(CONVERT(nvarchar(max), allergy.severity), N''), N'|',
          COALESCE(CONVERT(nvarchar(max), allergy.remarks), N'')
        )), 2) AS RECORD_KEY,
        allergy.CREATEDATETIME,
        LTRIM(RTRIM(CONVERT(varchar(15), allergy.HN))) AS HN,
        LTRIM(RTRIM(CONVERT(nvarchar(30), allergy.MEDICINECODE))) AS MEDICINECODE,
        medicine.COMMERCIALNAME,
        medicine.GENERICNAME,
        allergy.SideEffect AS SIDE_EFFECT,
        allergy.ALLERGYTYPE AS ALLERGY_TYPE,
        allergy.severity AS SEVERITY,
        allergy.adverseReactionsLocalDesc AS ADVERSE_REACTION_LOCAL,
        allergy.adverseReactionsDesc AS ADVERSE_REACTION_ENGLISH,
        allergy.correlationLevel AS CORRELATION_LEVEL,
        allergy.certifiedBy AS CERTIFIED_BY,
        allergy.remarks AS REMARKS
      FROM dbo.TBLALLERGY AS allergy
      LEFT JOIN dbo.TBLMEDITEMSINFO AS medicine
        ON LTRIM(RTRIM(CONVERT(nvarchar(30), medicine.MEDICINECODE))) =
           LTRIM(RTRIM(CONVERT(nvarchar(30), allergy.MEDICINECODE)))
      WHERE LTRIM(RTRIM(CONVERT(varchar(15), allergy.HN))) = @patientId
      ORDER BY allergy.CREATEDATETIME DESC, allergy.MEDICINECODE;
    `);

    return {
      PATIENT: patient,
      ITEMS: historyResult.recordset.map((item) => ({
        ...item,
        CREATEDATETIME: this.toIsoDateTime(item.CREATEDATETIME),
      })),
    };
  }

  async create(body: CreateDrugAllergyDto): Promise<DrugAllergyHistoryItem> {
    const input = this.normalizeCreateInput(body);
    const columnLengths = await this.getAllergyColumnLengths();
    this.validateColumnLengths(input, columnLengths);

    const inserted = await this.databaseService.withTransaction(
      async (createRequest) => {
        const patientRequest = createRequest();
        patientRequest.input('patientId', sql.VarChar(15), input.patientId);
        const patientResult = await patientRequest.query<{ PATIENTID: string }>(`
          SELECT TOP (1) PATIENTID
          FROM dbo.TBLPATIENT WITH (UPDLOCK, HOLDLOCK)
          WHERE LTRIM(RTRIM(CONVERT(varchar(15), PATIENTID))) = @patientId;
        `);
        if (!patientResult.recordset[0]) {
          throw new NotFoundException('Patient was not found');
        }

        const medicineRequest = createRequest();
        medicineRequest.input('medicineCode', sql.NVarChar(30), input.medicineCode);
        const medicineResult = await medicineRequest.query<DrugAllergyMedicineSearchResult>(`
          SELECT TOP (1)
            LTRIM(RTRIM(CONVERT(nvarchar(30), MEDICINECODE))) AS MEDICINECODE,
            COMMERCIALNAME, GENERICNAME, LOCALNAME,
            CONVERT(nvarchar(100), STRENGTH) AS STRENGTH
          FROM dbo.TBLMEDITEMSINFO WITH (UPDLOCK, HOLDLOCK)
          WHERE LTRIM(RTRIM(CONVERT(nvarchar(30), MEDICINECODE))) = @medicineCode;
        `);
        const medicine = medicineResult.recordset[0];
        if (!medicine) throw new NotFoundException('Medicine was not found');

        const allergyRequest = createRequest();
        this.bindCreateInputs(allergyRequest, input);
        const result = await allergyRequest.query<AllergyInsertRow>(`
          IF EXISTS (
            SELECT 1
            FROM dbo.TBLALLERGY WITH (UPDLOCK, HOLDLOCK)
            WHERE LTRIM(RTRIM(CONVERT(varchar(15), HN))) = @patientId
              AND LTRIM(RTRIM(CONVERT(nvarchar(30), MEDICINECODE))) = @medicineCode
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), SideEffect))), N''), N'') = @sideEffect
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), ALLERGYTYPE))), N''), N'') = @allergyType
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), severity))), N''), N'') = @severity
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), adverseReactionsLocalDesc))), N''), N'') = COALESCE(@adverseReactionLocal, N'')
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), adverseReactionsDesc))), N''), N'') = COALESCE(@adverseReactionEnglish, N'')
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), correlationLevel))), N''), N'') = @correlationLevel
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), certifiedBy))), N''), N'') = @certifiedBy
              AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), remarks))), N''), N'') = COALESCE(@remarks, N'')
          )
            THROW 51020, 'DUPLICATE_DRUG_ALLERGY', 1;

          DECLARE @createdAt datetime2(3) = SYSDATETIME();

          INSERT INTO dbo.TBLALLERGY (
            CREATEDATETIME, HN, MEDICINECODE, SideEffect, ALLERGYTYPE,
            READDATETIME, adverseReactionsDesc, adverseReactionsLocalDesc,
            severity, correlationLevel, certifiedBy, remarks
          )
          VALUES (
            @createdAt, @patientId, @medicineCode, @sideEffect, @allergyType,
            @createdAt, @adverseReactionEnglish, @adverseReactionLocal,
            @severity, @correlationLevel, @certifiedBy, @remarks
          );

          SELECT
            @createdAt AS CREATEDATETIME,
            @patientId AS HN,
            @medicineCode AS MEDICINECODE,
            @sideEffect AS SIDE_EFFECT,
            @allergyType AS ALLERGY_TYPE,
            @severity AS SEVERITY,
            @adverseReactionLocal AS ADVERSE_REACTION_LOCAL,
            @adverseReactionEnglish AS ADVERSE_REACTION_ENGLISH,
            @correlationLevel AS CORRELATION_LEVEL,
            @certifiedBy AS CERTIFIED_BY,
            @remarks AS REMARKS;
        `);
        const row = result.recordset[0];
        return { row, medicine };
      },
      sql.ISOLATION_LEVEL.SERIALIZABLE,
    ).catch((error: unknown) => {
      if (this.isDuplicateError(error)) {
        throw new ConflictException('This allergy record already exists');
      }
      throw error;
    });

    const row = inserted.row;
    return {
      RECORD_KEY: this.createRecordKey(row),
      CREATEDATETIME: this.toIsoDateTime(row.CREATEDATETIME),
      HN: row.HN.trim(),
      MEDICINECODE: row.MEDICINECODE.trim(),
      COMMERCIALNAME: inserted.medicine.COMMERCIALNAME,
      GENERICNAME: inserted.medicine.GENERICNAME,
      SIDE_EFFECT: this.clean(row.SIDE_EFFECT),
      ALLERGY_TYPE: this.clean(row.ALLERGY_TYPE),
      SEVERITY: this.clean(row.SEVERITY),
      ADVERSE_REACTION_LOCAL: this.clean(row.ADVERSE_REACTION_LOCAL),
      ADVERSE_REACTION_ENGLISH: this.clean(row.ADVERSE_REACTION_ENGLISH),
      CORRELATION_LEVEL: this.clean(row.CORRELATION_LEVEL),
      CERTIFIED_BY: this.clean(row.CERTIFIED_BY),
      REMARKS: this.clean(row.REMARKS),
    };
  }

  private normalizeCreateInput(body: CreateDrugAllergyDto) {
    return {
      patientId: body.patientId.trim(),
      medicineCode: body.medicineCode.trim(),
      sideEffect: body.sideEffect.trim(),
      allergyType: body.allergyType.trim(),
      severity: body.severity.trim(),
      adverseReactionLocal: this.clean(body.adverseReactionLocal),
      adverseReactionEnglish: this.clean(body.adverseReactionEnglish),
      correlationLevel: body.correlationLevel.trim(),
      certifiedBy: body.certifiedBy.trim(),
      remarks: this.clean(body.remarks),
    };
  }

  private bindCreateInputs(
    request: sql.Request,
    input: ReturnType<DrugAllergyService['normalizeCreateInput']>,
  ): void {
    request.input('patientId', sql.VarChar(15), input.patientId);
    request.input('medicineCode', sql.NVarChar(30), input.medicineCode);
    request.input('sideEffect', sql.NVarChar(sql.MAX), input.sideEffect);
    request.input('allergyType', sql.NVarChar(sql.MAX), input.allergyType);
    request.input('severity', sql.NVarChar(sql.MAX), input.severity);
    request.input('adverseReactionLocal', sql.NVarChar(sql.MAX), input.adverseReactionLocal);
    request.input('adverseReactionEnglish', sql.NVarChar(sql.MAX), input.adverseReactionEnglish);
    request.input('correlationLevel', sql.NVarChar(sql.MAX), input.correlationLevel);
    request.input('certifiedBy', sql.NVarChar(sql.MAX), input.certifiedBy);
    request.input('remarks', sql.NVarChar(sql.MAX), input.remarks);
  }

  private async getAllergyColumnLengths(): Promise<Map<string, number>> {
    if (!this.allergyColumnLengthsPromise) {
      this.allergyColumnLengthsPromise = this.loadAllergyColumnLengths().catch((error) => {
        this.allergyColumnLengthsPromise = null;
        throw error;
      });
    }
    return this.allergyColumnLengthsPromise;
  }

  private async loadAllergyColumnLengths(): Promise<Map<string, number>> {
    const request = this.databaseService.createRequest();
    const result = await request.query<AllergyColumnMetadata>(`
      SELECT
        columnInfo.name AS COLUMN_NAME,
        typeInfo.name AS TYPE_NAME,
        columnInfo.max_length AS MAX_LENGTH_BYTES
      FROM sys.columns AS columnInfo
      JOIN sys.types AS typeInfo ON typeInfo.user_type_id = columnInfo.user_type_id
      WHERE columnInfo.object_id = OBJECT_ID(N'dbo.TBLALLERGY');
    `);
    const byName = new Map(result.recordset.map((column) => [column.COLUMN_NAME.toLowerCase(), column]));
    const missing = requiredAllergyColumns.filter((name) => !byName.has(name.toLowerCase()));
    if (missing.length > 0) {
      throw new ServiceUnavailableException(`TBLALLERGY is missing required columns: ${missing.join(', ')}`);
    }

    const lengths = new Map<string, number>();
    for (const column of result.recordset) {
      if (column.MAX_LENGTH_BYTES === -1 || ['text', 'ntext', 'xml'].includes(column.TYPE_NAME.toLowerCase())) {
        lengths.set(column.COLUMN_NAME.toLowerCase(), Number.POSITIVE_INFINITY);
        continue;
      }
      const divisor = ['nvarchar', 'nchar'].includes(column.TYPE_NAME.toLowerCase()) ? 2 : 1;
      lengths.set(column.COLUMN_NAME.toLowerCase(), Math.floor(column.MAX_LENGTH_BYTES / divisor));
    }
    return lengths;
  }

  private validateColumnLengths(
    input: ReturnType<DrugAllergyService['normalizeCreateInput']>,
    lengths: Map<string, number>,
  ): void {
    const values: Array<[string, string, string | null]> = [
      ['HN', 'patientId', input.patientId],
      ['MEDICINECODE', 'medicineCode', input.medicineCode],
      ['SideEffect', 'sideEffect', input.sideEffect],
      ['ALLERGYTYPE', 'allergyType', input.allergyType],
      ['severity', 'severity', input.severity],
      ['adverseReactionsLocalDesc', 'adverseReactionLocal', input.adverseReactionLocal],
      ['adverseReactionsDesc', 'adverseReactionEnglish', input.adverseReactionEnglish],
      ['correlationLevel', 'correlationLevel', input.correlationLevel],
      ['certifiedBy', 'certifiedBy', input.certifiedBy],
      ['remarks', 'remarks', input.remarks],
    ];
    for (const [column, field, value] of values) {
      const limit = lengths.get(column.toLowerCase());
      if (value !== null && limit !== undefined && value.length > limit) {
        throw new UnprocessableEntityException(`${field} exceeds the TBLALLERGY limit of ${limit} characters`);
      }
    }
  }

  private isDuplicateError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const candidate = error as Error & { number?: number; originalError?: { number?: number } };
    return candidate.number === 51020
      || candidate.originalError?.number === 51020
      || candidate.message.includes('DUPLICATE_DRUG_ALLERGY');
  }

  private createRecordKey(row: AllergyInsertRow): string {
    return createHash('sha256').update([
      this.toIsoDateTime(row.CREATEDATETIME),
      row.HN,
      row.MEDICINECODE,
      row.SIDE_EFFECT ?? '',
      row.ALLERGY_TYPE ?? '',
      row.SEVERITY ?? '',
    ].join('|')).digest('hex');
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned || null;
  }

  private toIsoDateTime(value: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
  }
}
