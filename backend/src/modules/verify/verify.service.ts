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

interface VerifyQueryRow {
  VISITDATETIME: Date | string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  PATIENTID: string | null;
  FULLNAME_TH: string | null;
  DOCTORCODE: string | null;
  LOCALDOCTORNAME: string | null;
  ITEMSEQ: number | null;
  MEDICINECODE: string | null;
  COMMERCIALNAME: string | null;
  ORDERQTY: number | null;
  ORDERUNITCODE: string | null;
  DOSEMEMO_TH: string | null;
}

interface VerifyPatientCountRow {
  TOTAL_PATIENTS: number | string;
}

interface VerifyPrescriptionListRow extends VerifyQueryRow {
  PATIENTID: string;
}

@Injectable()
export class VerifyService {
  constructor(private readonly databaseService: DatabaseService) {}

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
        o.VISITDATETIME,
        o.VISITNUMBER,
        o.PRESCRIPTIONNUMBER,
        COALESCE(o.PATIENTID, oi.PATIENTID) AS PATIENTID,
        p.FULLNAME_TH,
        d.DOCTORCODE,
        d.LOCALDOCTORNAME,
        oi.ITEMSEQ,
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
      WHERE o.VISITDATETIME = @visitDate
        AND o.VISITNUMBER = @visitNumber
        AND o.PRESCRIPTIONNUMBER = @prescriptionNumber
      ORDER BY oi.ITEMSEQ;
    `);

    if (result.recordset.length === 0) {
      throw new NotFoundException('Prescription was not found');
    }

    const firstRow = result.recordset[0];
    const items = result.recordset.reduce<VerifyItem[]>((accumulator, row) => {
      if (row.ITEMSEQ !== null && row.MEDICINECODE !== null) {
        accumulator.push({
          ITEMSEQ: row.ITEMSEQ,
          MEDICINECODE: row.MEDICINECODE,
          COMMERCIALNAME: row.COMMERCIALNAME,
          ORDERQTY: row.ORDERQTY,
          ORDERUNITCODE: row.ORDERUNITCODE,
          DOSEMEMO_TH: row.DOSEMEMO_TH,
        });
      }

      return accumulator;
    }, []);

    return {
      VISITDATETIME: this.toDateOnly(firstRow.VISITDATETIME),
      VISITNUMBER: firstRow.VISITNUMBER,
      PRESCRIPTIONNUMBER: firstRow.PRESCRIPTIONNUMBER,
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
    const countResult = await countRequest.query<VerifyPatientCountRow>(`
      SELECT COUNT_BIG(*) AS TOTAL_PATIENTS
      FROM (
        SELECT DISTINCT o.PATIENTID
        FROM dbo.TBLORX AS o
        WHERE ${whereClause}
      ) AS filteredPatients;
    `);
    const totalPatients = Number(
      countResult.recordset[0]?.TOTAL_PATIENTS ?? 0,
    );

    const dataRequest = this.databaseService.createRequest();
    this.bindListFilters(dataRequest, query);
    dataRequest.input('offset', sql.Int, (query.page - 1) * query.limit);
    dataRequest.input('limit', sql.Int, query.limit);
    const dataResult = await dataRequest.query<VerifyPrescriptionListRow>(`
      WITH FilteredPatients AS (
        SELECT DISTINCT o.PATIENTID
        FROM dbo.TBLORX AS o
        WHERE ${whereClause}
      ),
      PagedPatients AS (
        SELECT PATIENTID
        FROM FilteredPatients
        ORDER BY PATIENTID
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      )
      SELECT
        o.VISITDATETIME,
        o.VISITNUMBER,
        o.PRESCRIPTIONNUMBER,
        o.PATIENTID,
        p.FULLNAME_TH,
        d.DOCTORCODE,
        d.LOCALDOCTORNAME,
        oi.ITEMSEQ,
        oi.MEDICINECODE,
        m.COMMERCIALNAME,
        oi.ORDERQTY,
        oi.ORDERUNITCODE,
        oi.DOSEMEMO_TH
      FROM PagedPatients AS selectedPatients
      JOIN dbo.TBLORX AS o
        ON o.PATIENTID = selectedPatients.PATIENTID
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
      WHERE ${whereClause}
      ORDER BY
        o.PATIENTID,
        o.VISITDATETIME DESC,
        o.VISITNUMBER,
        o.PRESCRIPTIONNUMBER,
        oi.ITEMSEQ,
        oi.MEDICINECODE;
    `);

    return {
      FILTER: {
        PATIENTID: query.patientId ?? null,
        FROMDATE: query.fromDate ?? null,
        TODATE: query.toDate ?? null,
      },
      PAGINATION: {
        PAGE: query.page,
        LIMIT: query.limit,
        TOTAL_PATIENTS: totalPatients,
        TOTAL_PAGES:
          totalPatients === 0 ? 0 : Math.ceil(totalPatients / query.limit),
      },
      PATIENTS: this.groupPrescriptionRows(dataResult.recordset),
    };
  }

  private validateListFilters(query: GetVerifyPrescriptionsQueryDto): void {
    const hasFromDate = query.fromDate !== undefined;
    const hasToDate = query.toDate !== undefined;

    if (!query.patientId && !hasFromDate && !hasToDate) {
      throw new BadRequestException(
        'Provide patientId or both fromDate and toDate',
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

    if (query.fromDate && query.toDate) {
      conditions.push('o.VISITDATETIME >= @fromDate');
      conditions.push(
        'o.VISITDATETIME < DATEADD(DAY, 1, @toDate)',
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

    if (query.fromDate && query.toDate) {
      request.input('fromDate', sql.Date, query.fromDate);
      request.input('toDate', sql.Date, query.toDate);
    }
  }

  private groupPrescriptionRows(
    rows: VerifyPrescriptionListRow[],
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
          VISITDATETIME: visitDate,
          VISITNUMBER: row.VISITNUMBER,
          PRESCRIPTIONNUMBER: row.PRESCRIPTIONNUMBER,
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
        prescription.ITEMS.push({
          ITEMSEQ: row.ITEMSEQ,
          MEDICINECODE: row.MEDICINECODE,
          COMMERCIALNAME: row.COMMERCIALNAME,
          ORDERQTY: row.ORDERQTY,
          ORDERUNITCODE: row.ORDERUNITCODE,
          DOSEMEMO_TH: row.DOSEMEMO_TH,
        });
      }
    }

    return Array.from(patientMap.values());
  }

  private toDateOnly(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    return value.slice(0, 10);
  }
}
