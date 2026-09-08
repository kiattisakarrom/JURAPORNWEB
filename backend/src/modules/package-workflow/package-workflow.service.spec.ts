import { DatabaseService } from '../../database/database.service';
import { VerifyService } from '../verify/verify.service';
import { PackageWorkflowService } from './package-workflow.service';

describe('PackageWorkflowService', () => {
  it('auto-saves an empty Verify note as NULL for the active lock owner', async () => {
    const lockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{
          WORKFLOW_ID: '22222222-2222-2222-2222-222222222222',
          VISITDATETIME: new Date('2026-09-02T00:00:00.000Z'),
          VISITNUMBER: '240001',
          CASE_STATUS: 'VERIFY',
          VERIFY_LOCK_TOKEN: '11111111-1111-1111-1111-111111111111',
          VERIFY_LOCK_SESSION: 'session-1',
          VERIFY_LOCK_EXPIRES_AT: new Date(Date.now() + 60_000),
          VERIFY_NOTE_DRAFT: 'ข้อความเดิม',
        }],
      }),
    };
    const updateRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{
          WORKFLOW_ID: '22222222-2222-2222-2222-222222222222',
          VERIFY_NOTE_DRAFT: null,
          VERIFY_NOTE_UPDATED_AT: new Date('2026-09-02T01:00:00.000Z'),
        }],
      }),
    };
    const requests = [lockRequest, updateRequest];
    const databaseService = {
      withTransaction: jest.fn().mockImplementation(async (work) => work(() => requests.shift())),
    } as unknown as DatabaseService;
    const service = new PackageWorkflowService(databaseService, {} as VerifyService);

    const result = await service.saveVerifyNote(
      '22222222-2222-2222-2222-222222222222',
      {
        lockToken: '11111111-1111-1111-1111-111111111111',
        sessionId: 'session-1',
        note: '',
        actorName: 'Pharmacist',
      },
    );

    expect(updateRequest.input).toHaveBeenCalledWith('note', expect.anything(), null);
    expect(result).toEqual({
      WORKFLOW_ID: '22222222-2222-2222-2222-222222222222',
      VERIFY_NOTE_DRAFT: null,
      VERIFY_NOTE_UPDATED_AT: '2026-09-02T01:00:00.000Z',
    });
  });

  it('auto-saves a package note while the package is in Matching', async () => {
    const lockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{
          PACKAGE_ID: '11111111-1111-1111-1111-111111111111',
          WORKFLOW_ID: '22222222-2222-2222-2222-222222222222',
          PAGE_NOW: 'MATCHING',
          IS_ACTIVE: true,
          VERIFY_NOTE: 'ข้อความเดิม',
        }],
      }),
    };
    const updateRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{
          PACKAGE_ID: '11111111-1111-1111-1111-111111111111',
          VERIFY_NOTE: 'ข้อความใหม่',
          UPDATED_AT: new Date('2026-09-07T09:00:00.000Z'),
        }],
      }),
    };
    const eventRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    };
    const requests = [lockRequest, updateRequest, eventRequest];
    const databaseService = {
      withTransaction: jest.fn().mockImplementation(async (work) => work(() => requests.shift())),
    } as unknown as DatabaseService;
    const service = new PackageWorkflowService(databaseService, {} as VerifyService);

    const result = await service.savePackageNote(
      '11111111-1111-1111-1111-111111111111',
      { note: 'ข้อความใหม่', actorName: 'Pharmacist' },
    );

    expect(updateRequest.input).toHaveBeenCalledWith('note', expect.anything(), 'ข้อความใหม่');
    expect(result).toEqual({
      PACKAGE_ID: '11111111-1111-1111-1111-111111111111',
      VERIFY_NOTE: 'ข้อความใหม่',
      UPDATED_AT: '2026-09-07T09:00:00.000Z',
    });
  });

  it('does not allow editing a package note outside Matching or Checking', async () => {
    const lockRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{
          PACKAGE_ID: '11111111-1111-1111-1111-111111111111',
          WORKFLOW_ID: '22222222-2222-2222-2222-222222222222',
          PAGE_NOW: 'DISPENSING',
          IS_ACTIVE: true,
          VERIFY_NOTE: null,
        }],
      }),
    };
    const databaseService = {
      withTransaction: jest.fn().mockImplementation(async (work) => work(() => lockRequest)),
    } as unknown as DatabaseService;
    const service = new PackageWorkflowService(databaseService, {} as VerifyService);

    await expect(service.savePackageNote(
      '11111111-1111-1111-1111-111111111111',
      { note: 'ห้ามแก้' },
    )).rejects.toThrow('Package note can only be edited in Matching or Checking');
  });

  it('maps a Matching package and exposes scan action', async () => {
    const request = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [
          {
            PACKAGE_ID: '11111111-1111-1111-1111-111111111111',
            WORKFLOW_ID: '22222222-2222-2222-2222-222222222222',
            PACKAGE_NUMBER: 'PKG-test-01',
            BATCH_NO: 1,
            PACKAGE_PRIORITY: 'URGENT',
            PAGE_NOW: 'MATCHING',
            PACKAGE_STATUS: 'ACTIVE',
            IS_ACTIVE: true,
            VERIFY_NOTE: null,
            DISPENSING_PICKUP_STATUS: null,
            CALL_COUNT: 0,
            LAST_CALLED_AT: null,
            RECEIVED_AT: null,
            PACKAGE_CREATED_AT: new Date('2026-08-21T01:00:00.000Z'),
            PACKAGE_UPDATED_AT: new Date('2026-08-21T01:05:00.000Z'),
            ROW_VERSION: Buffer.from([1]),
            VISITDATETIME: new Date('2026-08-21T00:00:00.000Z'),
            VISITNUMBER: '240001',
            PATIENTID: 'HN001',
            PATIENT_NAME: 'Patient Test',
            PAYMENT_STATUS: 'BYPASSED',
            PACKAGE_ITEM_ID: '33333333-3333-3333-3333-333333333333',
            PRESCRIPTIONNUMBER: '01',
            ITEMSEQ: 1,
            MEDICINECODE: '1200000096',
            COMMERCIALNAME: 'Medicine A',
            ORDERQTY: 30,
            ORDERUNITCODE: 'TAB',
            DOSEMEMO_TH: 'รับประทานครั้งละ 1 เม็ด',
            SOURCE_URGENCY_CODE: null,
            PICKING_STATUS: 'COMPLETED',
            MATCHING_STATUS: 'WAITING',
            CHECKING_STATUS: 'WAITING',
            MATCHED_AT: null,
            CHECKED_AT: null,
            LABEL_PUBLIC_ID: 'LBL-test',
            QR_TOKEN: 'QR-test',
            LABEL_STATUS: 'READY_TO_PRINT',
            PRINT_COUNT: 0,
            PRINTED_AT: null,
          },
        ],
      }),
    };
    const databaseService = {
      createRequest: jest.fn().mockReturnValue(request),
    } as unknown as DatabaseService;
    const service = new PackageWorkflowService(
      databaseService,
      {} as VerifyService,
    );

    const result = await service.findPackages({ limit: 200 });

    expect(result).toHaveLength(1);
    expect(result[0].ITEMS[0].MEDICINECODE).toBe('1200000096');
    expect(result[0].ALLOWED_ACTIONS).toEqual(['SCAN_MEDICINE']);
  });
});
