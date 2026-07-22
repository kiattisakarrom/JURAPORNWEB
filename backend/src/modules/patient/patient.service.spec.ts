import { NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PatientService } from './patient.service';

describe('PatientService', () => {
  it('returns the patient with vital signs ordered by the query', async () => {
    const patientRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [
          {
            PATIENTID: 'HN0001',
            FULLNAME_TH: 'ผู้ป่วยทดสอบ',
          },
        ],
      }),
    };
    const vitalSignRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [
          {
            BODYWEIGHT: 60,
            HEIGHT: 170,
            BPSYSTOLIC: 120,
            BPDIASTOLIC: 80,
            TEMPERATURE: 36.5,
            PULSERATE: 72,
            RESPIRATIONRATE: 18,
            O2SAT: 99,
            CREATEDATETIME: new Date('2026-07-14T08:30:00.000Z'),
          },
        ],
      }),
    };
    const databaseService = {
      createRequest: jest
        .fn()
        .mockReturnValueOnce(patientRequest)
        .mockReturnValueOnce(vitalSignRequest),
    } as unknown as DatabaseService;
    const service = new PatientService(databaseService);

    const result = await service.findPatient('HN0001', 20);

    expect(result.PATIENTID).toBe('HN0001');
    expect(result.VITALSIGNS).toHaveLength(1);
    expect(result.VITALSIGNS[0].CREATEDATETIME).toBe(
      '2026-07-14T08:30:00.000Z',
    );
    expect(vitalSignRequest.input).toHaveBeenCalledTimes(2);
  });

  it('throws NotFoundException without querying vital signs', async () => {
    const patientRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    };
    const databaseService = {
      createRequest: jest.fn().mockReturnValue(patientRequest),
    } as unknown as DatabaseService;
    const service = new PatientService(databaseService);

    await expect(service.findPatient('UNKNOWN', 20)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(databaseService.createRequest).toHaveBeenCalledTimes(1);
  });
});
