import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import { GetVerifyPrescriptionsQueryDto } from './dto/get-verify-prescriptions-query.dto';
import { GetVerifyQueryDto } from './dto/get-verify-query.dto';
import {
  VerifyPrescriptionListItem,
  VerifyPrescriptionPatient,
  VerifyPrescriptionsResponse,
} from './interfaces/verify-prescriptions-response.interface';
import { VerifyItem, VerifyResponse } from './interfaces/verify-response.interface';
import {
  createVerifyAlertItemKey,
  VerifyAlertItemScope,
  VerifyClinicalAlertService,
} from './verify-clinical-alert.service';

interface VerifyQueryRow {
  PRESCRIPTION_CREATEDATETIME: Date | string | null;
  VISITDATETIME: Date | string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  CLINIC_CODE: string | null;
  LOCALWARDNAME: string | null;
  PATIENTID: string | null;
  FULLNAME_TH: string | null;
  DOCTORCODE: string | null;
  LOCALDOCTORNAME: string | null;
  ITEMSEQ: number | null;
  ITEM_CREATEDATETIME: Date | string | null;
  MEDICINECODE: string | null;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
}

interface VerifyPaginationCountRow {
  TOTAL_PATIENTS: number | string;
  TOTAL_VISITS: number | string;
}

interface VerifyPrescriptionListRow extends VerifyQueryRow {
  PATIENTID: string;
}

@Injectable()
export class VerifyService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly clinicalAlertService: VerifyClinicalAlertService,
  ) {}

  async findPrescription(query: GetVerifyQueryDto): Promise<VerifyResponse> {
    const request = this.databaseService.createRequest();
    request.input('visitDate', sql.Date, query.visitDate);
    request.input('visitNumber', sql.VarChar(10), query.visitNumber);
    request.input(
      'prescriptionNumber',
      sql.VarChar(16),
      query.prescriptionNumber,
    );

    const result = await request.query<VerifyQueryRow>(`
      SELECT
        o.CREATEDATETIME AS PRESCRIPTION_CREATEDATETIME,
        o.VISITDATETIME,
        o.VISITNUMBER,
        o.PRESCRIPTIONNUMBER,
        o.CLINIC_CODE,
        dept.LOCALWARDNAME,
        COALESCE(o.PATIENTID, oi.PATIENTID) AS PATIENTID,
        p.FULLNAME_TH,
        d.DOCTORCODE,
        d.LOCALDOCTORNAME,
        oi.ITEMSEQ,
        oi.CREATEDATETIME AS ITEM_CREATEDATETIME,
        oi.MEDICINECODE,
        m.COMMERCIALNAME,
        oi.ORDERQTY,
        oi.ORDERUNITCODE,
        oi.DOSEMEMO_TH
      FROM dbo.TBLORX AS o
      LEFT JOIN dbo.TBLORXITEMS AS oi
        ON oi.VISITDATETIME = o.VISITDATETIME
       AND oi.VISITNUMBER = o.VISITNUMBER
       AND oi.PRESCRIPTIONNUMBER = o.PRESCRIPTIONNUMBER
      LEFT JOIN dbo.TBLPATIENT AS p
        ON p.PATIENTID = COALESCE(o.PATIENTID, oi.PATIENTID)
      LEFT JOIN dbo.TBLMEDITEMSINFO AS m
        ON m.MEDICINECODE = oi.MEDICINECODE
      LEFT JOIN dbo.TBLDOCTOR AS d
        ON d.DOCTORCODE = o.DOCTORORDERCODE
      LEFT JOIN dbo.TBLDEPT AS dept
        ON dept.DEPTCODE = o.CLINIC_CODE
      WHERE o.VISITDATETIME = @visitDate
        AND o.VISITNUMBER = @visitNumber
        AND o.PRESCRIPTIONNUMBER = @prescriptionNumber
      ORDER BY oi.ITEMSEQ;
    `);

    if (result.recordset.length === 0) {
      throw new NotFoundException('Prescription was not found');
    }

    const firstRow = result.recordset[0];
    const alertMap = await this.clinicalAlertService.findAlerts(
      this.createAlertScopes(result.recordset),
    );
    const items = result.recordset.reduce<VerifyItem[]>((accumulator, row) => {
      if (row.ITEMSEQ !== null && row.MEDICINECODE !== null) {
        const scope = this.createAlertScope(row);
        accumulator.push({
          ITEMSEQ: row.ITEMSEQ,
          CREATEDATETIME: this.toIsoDateTime(row.ITEM_CREATEDATETIME),
          MEDICINECODE: row.MEDICINECODE,
          COMMERCIALNAME: row.COMMERCIALNAME,
          ORDERQTY: row.ORDERQTY,
          ORDERUNITCODE: row.ORDERUNITCODE,
          DOSEMEMO_TH: row.DOSEMEMO_TH,
          ALERTS: scope
            ? (alertMap.get(createVerifyAlertItemKey(scope)) ?? [])
            : [],
        });
      }

      return accumulator;
    }, []);

    return {
      CREATEDATETIME: this.toIsoDateTime(
        firstRow.PRESCRIPTION_CREATEDATETIME,
      ),
      VISITDATETIME: this.toDateOnly(firstRow.VISITDATETIME),
      VISITNUMBER: firstRow.VISITNUMBER,
      PRESCRIPTIONNUMBER: firstRow.PRESCRIPTIONNUMBER,
      CLINIC_CODE: firstRow.CLINIC_CODE,
      LOCALWARDNAME: firstRow.LOCALWARDNAME,
      PATIENT: {
        PATIENTID: firstRow.PATIENTID,
        FULLNAME_TH: firstRow.FULLNAME_TH,
      },
      DOCTOR: {
        DOCTORCODE: firstRow.DOCTORCODE,
        LOCALDOCTORNAME: firstRow.LOCALDOCTORNAME,
      },
      ITEMS: items,
    };
  }

  async findPrescriptions(
    query: GetVerifyPrescriptionsQueryDto,
  ): Promise<VerifyPrescriptionsResponse> {
    this.validateListFilters(query);

    const whereClause = this.buildListWhereClause(query);
    const countRequest = this.databaseService.createRequest();
    this.bindListFilters(countRequest, query);
    const countResult = await countRequest.query<VerifyPaginationCountRow>(`
      WITH FilteredVisits AS (
        SELECT
          o.PATIENTID,
          o.VISITDATETIME,
          o.VISITNUMBER
        FROM dbo.TBLORX AS o
        WHERE ${whereClause}
        GROUP BY o.PATIENTID, o.VISITDATETIME, o.VISITNUMBER
      )
      SELECT
        COUNT_BIG(DISTINCT PATIENTID) AS TOTAL_PATIENTS,
        COUNT_BIG(*) AS TOTAL_VISITS
      FROM FilteredVisits;
    `);
    const totalPatients = Number(
      countResult.recordset[0]?.TOTAL_PATIENTS ?? 0,
    );
    const totalVisits = Number(
      countResult.recordset[0]?.TOTAL_VISITS ?? 0,
    );

    const dataRequest = this.databaseService.createRequest();
    this.bindListFilters(dataRequest, query);
    dataRequest.input('offset', sql.Int, (query.page - 1) * query.limit);
    dataRequest.input('limit', sql.Int, query.limit);
    const dataResult = await dataRequest.query<VerifyPrescriptionListRow>(`
      WITH FilteredVisits AS (
        SELECT
          o.PATIENTID,
          o.VISITDATETIME,
          o.VISITNUMBER,
          MAX(o.CREATEDATETIME) AS LATEST_CREATEDATETIME
        FROM dbo.TBLORX AS o
        WHERE ${whereClause}
        GROUP BY o.PATIENTID, o.VISITDATETIME, o.VISITNUMBER
      ),
      PagedVisits AS (
        SELECT
          PATIENTID,
          VISITDATETIME,
          VISITNUMBER,
          LATEST_CREATEDATETIME
        FROM FilteredVisits
        ORDER BY
          LATEST_CREATEDATETIME DESC,
          VISITDATETIME DESC,
          VISITNUMBER,
          PATIENTID
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      )
      SELECT
        o.CREATEDATETIME AS PRESCRIPTION_CREATEDATETIME,
        o.VISITDATETIME,
        o.VISITNUMBER,
        o.PRESCRIPTIONNUMBER,
        o.CLINIC_CODE,
        dept.LOCALWARDNAME,
        o.PATIENTID,
        p.FULLNAME_TH,
        d.DOCTORCODE,
        d.LOCALDOCTORNAME,
        oi.ITEMSEQ,
        oi.CREATEDATETIME AS ITEM_CREATEDATETIME,
        oi.MEDICINECODE,
        m.COMMERCIALNAME,
        oi.ORDERQTY,
        oi.ORDERUNITCODE,
        oi.DOSEMEMO_TH
      FROM PagedVisits AS selectedVisits
      JOIN dbo.TBLORX AS o
        ON o.PATIENTID = selectedVisits.PATIENTID
       AND o.VISITDATETIME = selectedVisits.VISITDATETIME
       AND o.VISITNUMBER = selectedVisits.VISITNUMBER
      LEFT JOIN dbo.TBLPATIENT AS p
        ON p.PATIENTID = o.PATIENTID
      LEFT JOIN dbo.TBLORXITEMS AS oi
        ON oi.VISITDATETIME = o.VISITDATETIME
       AND oi.VISITNUMBER = o.VISITNUMBER
       AND oi.PRESCRIPTIONNUMBER = o.PRESCRIPTIONNUMBER
      LEFT JOIN dbo.TBLMEDITEMSINFO AS m
        ON m.MEDICINECODE = oi.MEDICINECODE
      LEFT JOIN dbo.TBLDOCTOR AS d
        ON d.DOCTORCODE = o.DOCTORORDERCODE
      LEFT JOIN dbo.TBLDEPT AS dept
        ON dept.DEPTCODE = o.CLINIC_CODE
      ORDER BY
        selectedVisits.LATEST_CREATEDATETIME DESC,
        selectedVisits.VISITDATETIME DESC,
        selectedVisits.VISITNUMBER,
        selectedVisits.PATIENTID,
        o.PRESCRIPTIONNUMBER,
        oi.ITEMSEQ,
        oi.MEDICINECODE;
    `);
    const alertMap = await this.clinicalAlertService.findAlerts(
      this.createAlertScopes(dataResult.recordset),
    );

    return {
      FILTER: {
        PATIENTID: query.patientId ?? null,
        VISITNUMBER: query.visitNumber ?? null,
        FROMDATE: query.fromDate ?? null,
        TODATE: query.toDate ?? null,
      },
      PAGINATION: {
        PAGE: query.page,
        LIMIT: query.limit,
        TOTAL_PATIENTS: totalPatients,
        TOTAL_VISITS: totalVisits,
        TOTAL_PAGES:
          totalVisits === 0 ? 0 : Math.ceil(totalVisits / query.limit),
      },
      PATIENTS: this.groupPrescriptionRows(dataResult.recordset, alertMap),
    };
  }

  async findVisitPrescriptions(
    visitDate: string,
    visitNumber: string,
  ): Promise<VerifyPrescriptionPatient[]> {
    const request = this.databaseService.createRequest();
    request.input('visitDate', sql.Date, visitDate);
    request.input('visitNumber', sql.VarChar(20), visitNumber);
    const result = await request.query<VerifyPrescriptionListRow>(`
      SELECT
        o.CREATEDATETIME AS PRESCRIPTION_CREATEDATETIME,
        o.VISITDATETIME,
        o.VISITNUMBER,
        o.PRESCRIPTIONNUMBER,
        o.CLINIC_CODE,
        dept.LOCALWARDNAME,
        o.PATIENTID,
        p.FULLNAME_TH,
        d.DOCTORCODE,
        d.LOCALDOCTORNAME,
        oi.ITEMSEQ,
        oi.CREATEDATETIME AS ITEM_CREATEDATETIME,
        oi.MEDICINECODE,
        m.COMMERCIALNAME,
        oi.ORDERQTY,
        oi.ORDERUNITCODE,
        oi.DOSEMEMO_TH
      FROM dbo.TBLORX AS o
      LEFT JOIN dbo.TBLPATIENT AS p
        ON p.PATIENTID = o.PATIENTID
      LEFT JOIN dbo.TBLORXITEMS AS oi
        ON oi.VISITDATETIME = o.VISITDATETIME
       AND oi.VISITNUMBER = o.VISITNUMBER
       AND oi.PRESCRIPTIONNUMBER = o.PRESCRIPTIONNUMBER
      LEFT JOIN dbo.TBLMEDITEMSINFO AS m
        ON m.MEDICINECODE = oi.MEDICINECODE
      LEFT JOIN dbo.TBLDOCTOR AS d
        ON d.DOCTORCODE = o.DOCTORORDERCODE
      LEFT JOIN dbo.TBLDEPT AS dept
        ON dept.DEPTCODE = o.CLINIC_CODE
      WHERE o.VISITDATETIME = @visitDate
        AND o.VISITNUMBER = @visitNumber
        AND o.PATIENTID IS NOT NULL
      ORDER BY o.PATIENTID, o.PRESCRIPTIONNUMBER, oi.ITEMSEQ, oi.MEDICINECODE;
    `);

    const alertMap = await this.clinicalAlertService.findAlerts(
      this.createAlertScopes(result.recordset),
    );
    return this.groupPrescriptionRows(result.recordset, alertMap);
  }

  private validateListFilters(query: GetVerifyPrescriptionsQueryDto): void {
    const hasFromDate = query.fromDate !== undefined;
    const hasToDate = query.toDate !== undefined;

    if (!query.patientId && !query.visitNumber && !hasFromDate && !hasToDate) {
      throw new BadRequestException(
        'Provide patientId, visitNumber, or both fromDate and toDate',
      );
    }

    if (hasFromDate !== hasToDate) {
      throw new BadRequestException(
        'fromDate and toDate must be provided together',
      );
    }

    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new BadRequestException('fromDate must not be after toDate');
    }
  }

  private buildListWhereClause(
    query: GetVerifyPrescriptionsQueryDto,
  ): string {
    const conditions = ['o.PATIENTID IS NOT NULL'];

    if (query.patientId) {
      conditions.push('o.PATIENTID = @patientId');
    }

    if (query.visitNumber) {
      conditions.push('o.VISITNUMBER = @visitNumber');
    }

    if (query.fromDate && query.toDate) {
      conditions.push('o.CREATEDATETIME >= @fromDate');
      conditions.push(
        'o.CREATEDATETIME < DATEADD(DAY, 1, @toDate)',
      );
    }

    return conditions.join('\n          AND ');
  }

  private bindListFilters(
    request: sql.Request,
    query: GetVerifyPrescriptionsQueryDto,
  ): void {
    if (query.patientId) {
      request.input('patientId', sql.VarChar(15), query.patientId);
    }

    if (query.visitNumber) {
      request.input('visitNumber', sql.VarChar(10), query.visitNumber);
    }

    if (query.fromDate && query.toDate) {
      request.input('fromDate', sql.Date, query.fromDate);
      request.input('toDate', sql.Date, query.toDate);
    }
  }

  private groupPrescriptionRows(
    rows: VerifyPrescriptionListRow[],
    alertMap: ReadonlyMap<string, VerifyItem['ALERTS']>,
  ): VerifyPrescriptionPatient[] {
    const patientMap = new Map<string, VerifyPrescriptionPatient>();
    const prescriptionMap = new Map<string, VerifyPrescriptionListItem>();

    for (const row of rows) {
      let patient = patientMap.get(row.PATIENTID);
      if (!patient) {
        patient = {
          PATIENTID: row.PATIENTID,
          FULLNAME_TH: row.FULLNAME_TH,
          PRESCRIPTIONS: [],
        };
        patientMap.set(row.PATIENTID, patient);
      }

      const visitDate = this.toDateOnly(row.VISITDATETIME);
      const prescriptionKey = [
        row.PATIENTID,
        visitDate,
        row.VISITNUMBER,
        row.PRESCRIPTIONNUMBER,
      ].join('|');
      let prescription = prescriptionMap.get(prescriptionKey);
      if (!prescription) {
        prescription = {
          CREATEDATETIME: this.toIsoDateTime(
            row.PRESCRIPTION_CREATEDATETIME,
          ),
          VISITDATETIME: visitDate,
          VISITNUMBER: row.VISITNUMBER,
          PRESCRIPTIONNUMBER: row.PRESCRIPTIONNUMBER,
          CLINIC_CODE: row.CLINIC_CODE,
          LOCALWARDNAME: row.LOCALWARDNAME,
          DOCTOR: {
            DOCTORCODE: row.DOCTORCODE,
            LOCALDOCTORNAME: row.LOCALDOCTORNAME,
          },
          ITEMS: [],
        };
        prescriptionMap.set(prescriptionKey, prescription);
        patient.PRESCRIPTIONS.push(prescription);
      }

      if (row.ITEMSEQ !== null && row.MEDICINECODE !== null) {
        const scope = this.createAlertScope(row);
        prescription.ITEMS.push({
          ITEMSEQ: row.ITEMSEQ,
          CREATEDATETIME: this.toIsoDateTime(row.ITEM_CREATEDATETIME),
          MEDICINECODE: row.MEDICINECODE,
          COMMERCIALNAME: row.COMMERCIALNAME,
          ORDERQTY: row.ORDERQTY,
          ORDERUNITCODE: row.ORDERUNITCODE,
          DOSEMEMO_TH: row.DOSEMEMO_TH,
          ALERTS: scope
            ? (alertMap.get(createVerifyAlertItemKey(scope)) ?? [])
            : [],
        });
      }
    }

    return Array.from(patientMap.values());
  }

  private createAlertScopes(rows: VerifyQueryRow[]): VerifyAlertItemScope[] {
    return rows.reduce<VerifyAlertItemScope[]>((scopes, row) => {
      const scope = this.createAlertScope(row);
      if (scope) scopes.push(scope);
      return scopes;
    }, []);
  }

  private createAlertScope(
    row: VerifyQueryRow,
  ): VerifyAlertItemScope | null {
    if (
      !row.PATIENTID ||
      row.ITEMSEQ === null ||
      !row.MEDICINECODE
    ) {
      return null;
    }

    return {
      PATIENTID: row.PATIENTID,
      VISITDATETIME: this.toDateOnly(row.VISITDATETIME),
      VISITNUMBER: row.VISITNUMBER,
      PRESCRIPTIONNUMBER: row.PRESCRIPTIONNUMBER,
      ITEMSEQ: row.ITEMSEQ,
      MEDICINECODE: row.MEDICINECODE,
    };
  }

  private toDateOnly(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return value.slice(0, 10);
  }

  private toIsoDateTime(value: Date | string | null): string | null {
    if (value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(value).toISOString();
  }
}
