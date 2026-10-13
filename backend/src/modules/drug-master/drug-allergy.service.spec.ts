import 'reflect-metadata';
import { DatabaseService } from '../../database/database.service';
import { DrugAllergyService } from './drug-allergy.service';

function requestWith(recordset: unknown[] = []) {
  return {
    input: jest.fn().mockReturnThis(),
    query: jest.fn().mockResolvedValue({ recordset, rowsAffected: [recordset.length] }),
  };
}

describe('DrugAllergyService', () => {
  it('searches patients with bound parameters instead of interpolating user input', async () => {
    const request = requestWith([{ PATIENTID: 'HN001', FULLNAME_TH: 'Patient A' }]);
    const database = { createRequest: jest.fn().mockReturnValue(request) } as unknown as DatabaseService;
    const service = new DrugAllergyService(database);

    const result = await service.searchPatients({ query: "HN001'; DROP TABLE x;--", limit: 20 });

    expect(result).toHaveLength(1);
    expect(request.input).toHaveBeenCalledWith('query', expect.anything(), "HN001'; DROP TABLE x;--");
    expect(request.query.mock.calls[0][0]).not.toContain('DROP TABLE x');
  });

  it('reads allergy history with a bound patient id and normalizes its timestamp', async () => {
    const patientRequest = requestWith([{ PATIENTID: 'HN001', FULLNAME_TH: 'Patient A' }]);
    const historyRequest = requestWith([{
      RECORD_KEY: 'record-1',
      CREATEDATETIME: new Date('2026-10-01T01:00:00.000Z'),
      HN: 'HN001',
      MEDICINECODE: '1400000001',
      COMMERCIALNAME: 'Medicine A',
      GENERICNAME: 'Generic A',
      SIDE_EFFECT: 'ผื่นคัน',
      ALLERGY_TYPE: 'Drug Allergy',
      SEVERITY: 'Moderate',
      ADVERSE_REACTION_LOCAL: null,
      ADVERSE_REACTION_ENGLISH: null,
      CORRELATION_LEVEL: 'Probable',
      CERTIFIED_BY: 'Hospital source',
      REMARKS: null,
    }]);
    const database = {
      createRequest: jest.fn()
        .mockReturnValueOnce(patientRequest)
        .mockReturnValueOnce(historyRequest),
    } as unknown as DatabaseService;
    const service = new DrugAllergyService(database);

    const result = await service.history(' HN001 ');

    expect(result.ITEMS[0].CREATEDATETIME).toBe('2026-10-01T01:00:00.000Z');
    expect(patientRequest.input).toHaveBeenCalledWith('patientId', expect.anything(), 'HN001');
    expect(historyRequest.input).toHaveBeenCalledWith('patientId', expect.anything(), 'HN001');
  });
});
