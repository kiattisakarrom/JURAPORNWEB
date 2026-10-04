import 'reflect-metadata';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateDrugAllergyDto } from './drug-allergy.dto';
import { DrugAllergyService } from './drug-allergy.service';

const input: CreateDrugAllergyDto = {
  patientId: 'HN001',
  medicineCode: '1400000001',
  sideEffect: 'ผื่นคัน',
  allergyType: 'Drug Allergy',
  severity: 'Moderate',
  adverseReactionLocal: 'ผื่นแดงทั่วตัว',
  adverseReactionEnglish: 'Generalized rash',
  correlationLevel: 'Probable',
  certifiedBy: 'Pharmacist A',
  remarks: 'Confirmed by patient',
};

function metadata(maxLengthBytes = 8000) {
  return [
    'CREATEDATETIME', 'HN', 'MEDICINECODE', 'SideEffect', 'ALLERGYTYPE',
    'READDATETIME', 'adverseReactionsDesc', 'adverseReactionsLocalDesc',
    'severity', 'correlationLevel', 'certifiedBy', 'remarks',
  ].map((COLUMN_NAME) => ({
    COLUMN_NAME,
    TYPE_NAME: COLUMN_NAME.endsWith('DATETIME') ? 'datetime2' : 'nvarchar',
    MAX_LENGTH_BYTES: COLUMN_NAME.endsWith('DATETIME') ? 8 : maxLengthBytes,
  }));
}

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
    expect(request.query.mock.calls[0][0]).not.toContain("DROP TABLE x");
  });

  it('creates a coded allergy after validating the patient and medicine', async () => {
    const metadataRequest = requestWith(metadata());
    const patientRequest = requestWith([{ PATIENTID: 'HN001' }]);
    const medicineRequest = requestWith([{
      MEDICINECODE: '1400000001', COMMERCIALNAME: 'Medicine A', GENERICNAME: 'Generic A', LOCALNAME: null, STRENGTH: '10 mg',
    }]);
    const insertRequest = requestWith([{
      CREATEDATETIME: new Date('2026-10-01T01:00:00.000Z'), HN: 'HN001', MEDICINECODE: '1400000001',
      SIDE_EFFECT: 'ผื่นคัน', ALLERGY_TYPE: 'Drug Allergy', SEVERITY: 'Moderate',
      ADVERSE_REACTION_LOCAL: 'ผื่นแดงทั่วตัว', ADVERSE_REACTION_ENGLISH: 'Generalized rash',
      CORRELATION_LEVEL: 'Probable', CERTIFIED_BY: 'Pharmacist A', REMARKS: 'Confirmed by patient',
    }]);
    const requests = [patientRequest, medicineRequest, insertRequest];
    const database = {
      createRequest: jest.fn().mockReturnValue(metadataRequest),
      withTransaction: jest.fn().mockImplementation(async (work) => work(() => requests.shift())),
    } as unknown as DatabaseService;
    const service = new DrugAllergyService(database);

    const result = await service.create(input);

    expect(result.MEDICINECODE).toBe('1400000001');
    expect(result.COMMERCIALNAME).toBe('Medicine A');
    expect(result.CREATEDATETIME).toBe('2026-10-01T01:00:00.000Z');
    expect(insertRequest.input).toHaveBeenCalledWith('sideEffect', expect.anything(), 'ผื่นคัน');
    expect(database.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('maps a concurrent duplicate insert to 409 Conflict', async () => {
    const metadataRequest = requestWith(metadata());
    const patientRequest = requestWith([{ PATIENTID: 'HN001' }]);
    const medicineRequest = requestWith([{
      MEDICINECODE: '1400000001', COMMERCIALNAME: 'Medicine A', GENERICNAME: null, LOCALNAME: null, STRENGTH: null,
    }]);
    const duplicateRequest = requestWith();
    duplicateRequest.query.mockRejectedValue(Object.assign(new Error('DUPLICATE_DRUG_ALLERGY'), { number: 51020 }));
    const requests = [patientRequest, medicineRequest, duplicateRequest];
    const database = {
      createRequest: jest.fn().mockReturnValue(metadataRequest),
      withTransaction: jest.fn().mockImplementation(async (work) => work(() => requests.shift())),
    } as unknown as DatabaseService;
    const service = new DrugAllergyService(database);

    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects values longer than the selected database schema before writing', async () => {
    const metadataRequest = requestWith(metadata(4));
    const database = {
      createRequest: jest.fn().mockReturnValue(metadataRequest),
      withTransaction: jest.fn(),
    } as unknown as DatabaseService;
    const service = new DrugAllergyService(database);

    await expect(service.create(input)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(database.withTransaction).not.toHaveBeenCalled();
  });
});
