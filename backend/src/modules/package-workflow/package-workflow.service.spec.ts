import { DatabaseService } from '../../database/database.service';
import { VerifyService } from '../verify/verify.service';
import { PackageWorkflowService } from './package-workflow.service';

describe('PackageWorkflowService', () => {
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

