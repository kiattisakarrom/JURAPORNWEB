import { Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import { SearchDrugAllergyReferenceDto } from './drug-allergy.dto';
import {
  DrugAllergyHistoryItem,
  DrugAllergyHistoryResponse,
  DrugAllergyMedicineSearchResult,
  DrugAllergyPatientSearchResult,
} from './drug-allergy.interfaces';

@Injectable()
export class DrugAllergyService {
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

  private toIsoDateTime(value: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
  }
}
