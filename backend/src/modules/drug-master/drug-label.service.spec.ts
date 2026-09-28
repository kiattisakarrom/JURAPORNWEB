import 'reflect-metadata';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DrugLabelService } from './drug-label.service';

const rowVersion = Buffer.from('12345678');
const templateRow = (status: 'DRAFT' | 'ACTIVE') => ({
  TEMPLATE_ID: status === 'DRAFT' ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222',
  TEMPLATE_NAME: 'Default label', VERSION_NO: 1, TEMPLATE_STATUS: status,
  WIDTH_MM: 101.6, HEIGHT_MM: 76.2,
  DEFINITION_JSON: JSON.stringify({ schemaVersion: 1, elements: [{ id: 'name', type: 'field', dataKey: 'patientName', xMm: 1, yMm: 1, widthMm: 20, heightMm: 5, zIndex: 1 }] }),
  LOGO_MIME_TYPE: null, LOGO_DATA: null, UPDATED_BY: null,
  UPDATED_AT: new Date('2026-09-25T00:00:00.000Z'), PUBLISHED_AT: status === 'ACTIVE' ? new Date('2026-09-25T00:00:00.000Z') : null,
  ROW_VERSION: rowVersion,
});

describe('DrugLabelService', () => {
  it('rejects a structured element outside the label before touching SQL', async () => {
    const database = { withTransaction: jest.fn() } as unknown as DatabaseService;
    const service = new DrugLabelService(database);

    await expect(service.saveDraft({
      expectedRowVersion: rowVersion.toString('base64'), widthMm: 101.6, heightMm: 76.2,
      definition: { schemaVersion: 1, elements: [{ id: 'outside', type: 'text', xMm: 100, yMm: 1, widthMm: 10, heightMm: 5, zIndex: 1 }] },
    })).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(database.withTransaction).not.toHaveBeenCalled();
  });

  it('returns 409 when another workstation already changed the draft row version', async () => {
    const updateRequest = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ rowsAffected: [0] }) };
    const database = {
      withTransaction: jest.fn().mockImplementation(async (work) => work(() => updateRequest)),
    } as unknown as DatabaseService;
    const service = new DrugLabelService(database);

    await expect(service.saveDraft({
      expectedRowVersion: rowVersion.toString('base64'), widthMm: 101.6, heightMm: 76.2,
      definition: JSON.parse(templateRow('DRAFT').DEFINITION_JSON),
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the single Draft and Active templates with a safe local logo fallback', async () => {
    const request = { query: jest.fn().mockResolvedValue({ recordset: [templateRow('DRAFT'), templateRow('ACTIVE')] }) };
    const database = { createRequest: jest.fn().mockReturnValue(request) } as unknown as DatabaseService;
    const service = new DrugLabelService(database);

    const result = await service.current();

    expect(result.DRAFT.TEMPLATE_STATUS).toBe('DRAFT');
    expect(result.ACTIVE.TEMPLATE_STATUS).toBe('ACTIVE');
    expect(result.ACTIVE.LOGO_DATA_URL).toBe('/assets/juraporn-hospital-emblem.png');
    expect(result.DRAFT.ROW_VERSION).toBe(rowVersion.toString('base64'));
  });

  it('prints one matched package item with its assigned template and dash fallbacks', async () => {
    const itemRequest = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{
      PACKAGE_ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', PACKAGE_ITEM_ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      WORKFLOW_ID: 'cccccccc-cccc-cccc-cccc-cccccccccccc', PAGE_NOW: 'MATCHING', PRESCRIPTIONNUMBER: '01',
      ITEM_INDEX: 1, TOTAL_ITEMS: 2, MEDICINECODE: '1200000001', COMMERCIALNAME: 'Medicine A', ORDERQTY: 10,
      ORDERUNITCODE: 'TAB', DOSEMEMO_TH: null, LABEL_PAYLOAD: null,
      LABEL_TEMPLATE_ID: '22222222-2222-2222-2222-222222222222', QR_TOKEN: 'QR-001', MATCHING_STATUS: 'COMPLETED',
      PATIENTID: 'HN001', PATIENT_NAME: 'Patient A', VISITDATETIME: new Date('2026-09-25T00:00:00.000Z'),
      VISITNUMBER: 'VN001', LOCALDOCTORNAME: null,
    }] }) };
    const templateRequest = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [templateRow('ACTIVE')] }) };
    const printRequest = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ PRINT_COUNT: 2, PRINTED_AT: new Date('2026-09-25T01:00:00.000Z') }] }) };
    const requests = [itemRequest, templateRequest, printRequest];
    const database = { withTransaction: jest.fn().mockImplementation(async (work) => work(() => requests.shift())) } as unknown as DatabaseService;
    const service = new DrugLabelService(database);

    const result = await service.print(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      { actorName: 'Pharmacist' },
    );

    expect(templateRequest.input).toHaveBeenCalledWith('templateId', expect.anything(), '22222222-2222-2222-2222-222222222222');
    expect(result.PRINT_COUNT).toBe(2);
    expect(result.DATA.doctorName).toBe('—');
    expect(result.DATA.itemCounter).toBe('#1/2');
    expect(result.DATA.qrToken).toBe('QR-001');
  });
});
