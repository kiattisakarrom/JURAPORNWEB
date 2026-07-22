import { Injectable, NotFoundException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import { PatientResponse, PatientVitalSign } from './interfaces/patient-response.interface';

interface PatientQueryRow {
  PATIENTID: string;
  FULLNAME_TH: string | null;
}

interface VitalSignQueryRow {
  BODYWEIGHT: number | null;
  HEIGHT: number | null;
  BPSYSTOLIC: number | null;
  BPDIASTOLIC: number | null;
  TEMPERATURE: number | null;
  PULSERATE: number | null;
  RESPIRATIONRATE: number | null;
  O2SAT: number | null;
  CREATEDATETIME: Date | string;
}

@Injectable()
export class PatientService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findPatient(
    patientId: string,
    vitalSignLimit: number,
  ): Promise<PatientResponse> {
    const patientRequest = this.databaseService.createRequest();
    patientRequest.input('patientId', sql.VarChar(15), patientId);
    const patientResult = await patientRequest.query<PatientQueryRow>(`
      SELECT
        p.PATIENTID,
        p.FULLNAME_TH
      FROM dbo.TBLPATIENT AS p
      WHERE p.PATIENTID = @patientId;
    `);

    const patient = patientResult.recordset[0];
    if (!patient) {
      throw new NotFoundException('Patient was not found');
    }

    const vitalSignRequest = this.databaseService.createRequest();
    vitalSignRequest.input('patientId', sql.VarChar(50), patientId);
    vitalSignRequest.input('vitalSignLimit', sql.Int, vitalSignLimit);
    const vitalSignResult = await vitalSignRequest.query<VitalSignQueryRow>(`
      SELECT TOP (@vitalSignLimit)
        v.BODYWEIGHT,
        v.HEIGHT,
        v.BPSYSTOLIC,
        v.BPDIASTOLIC,
        v.TEMPERATURE,
        v.PULSERATE,
        v.RESPIRATIONRATE,
        v.O2SAT,
        v.CREATEDATETIME
      FROM dbo.VitalSign AS v
      WHERE v.PATIENTID = @patientId
      ORDER BY v.CREATEDATETIME DESC, v.Id DESC;
    `);

    return {
      PATIENTID: patient.PATIENTID,
      FULLNAME_TH: patient.FULLNAME_TH,
      VITALSIGNS: vitalSignResult.recordset.map(
        (vitalSign): PatientVitalSign => ({
          BODYWEIGHT: vitalSign.BODYWEIGHT,
          HEIGHT: vitalSign.HEIGHT,
          BPSYSTOLIC: vitalSign.BPSYSTOLIC,
          BPDIASTOLIC: vitalSign.BPDIASTOLIC,
          TEMPERATURE: vitalSign.TEMPERATURE,
          PULSERATE: vitalSign.PULSERATE,
          RESPIRATIONRATE: vitalSign.RESPIRATIONRATE,
          O2SAT: vitalSign.O2SAT,
          CREATEDATETIME: this.toIsoDateTime(vitalSign.CREATEDATETIME),
        }),
      ),
    };
  }

  private toIsoDateTime(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return new Date(value).toISOString();
  }
}
