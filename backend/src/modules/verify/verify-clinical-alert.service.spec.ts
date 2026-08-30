import { DatabaseService } from '../../database/database.service';
import {
  createVerifyAlertItemKey,
  VerifyAlertItemScope,
  VerifyClinicalAlertService,
} from './verify-clinical-alert.service';

describe('VerifyClinicalAlertService', () => {
  const stockScope: VerifyAlertItemScope = {
    PATIENTID: 'HN0001',
    VISITDATETIME: '2026-08-27',
    VISITNUMBER: 'VN0001',
    PRESCRIPTIONNUMBER: 'PN01',
    ITEMSEQ: 1,
    MEDICINECODE: '1200000001',
  };
  const withScope: VerifyAlertItemScope = {
    ...stockScope,
    PRESCRIPTIONNUMBER: 'PN02',
    ITEMSEQ: 2,
    MEDICINECODE: '1400000002',
  };

  it('maps DI and AI rows to their exact prescription items and removes duplicates', async () => {
    const interactionRow = {
      ...stockScope,
      TYPE: 'DI' as const,
      STOCK_CODE: '1200000001',
      STOCK_NAME_EN: 'Medicine A',
      WITH_STOCK_CODE: '1400000002',
      WITH_STOCK_CODE_NAME_EN: 'Medicine B',
      SEVERITY_TYPE: 1,
      SEVERITY_TYPE_NAME: 'Major',
      LEVEL_TYPE_NAME: 'Established',
      EFFECTS_MEMO: 'Effect detail',
      MANAGEMENT_MEMO: 'Management detail',
      SIDE_EFFECT: null,
      ALLERGY_TYPE: null,
      ALLERGY_SEVERITY: null,
      REACTION: null,
      REMARKS: null,
    };
    const request = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [
          interactionRow,
          interactionRow,
          { ...interactionRow, ...withScope },
          {
            ...stockScope,
            TYPE: 'AI' as const,
            STOCK_CODE: null,
            STOCK_NAME_EN: null,
            WITH_STOCK_CODE: null,
            WITH_STOCK_CODE_NAME_EN: null,
            SEVERITY_TYPE: null,
            SEVERITY_TYPE_NAME: null,
            LEVEL_TYPE_NAME: null,
            EFFECTS_MEMO: null,
            MANAGEMENT_MEMO: null,
            SIDE_EFFECT: 'ผื่นแดง',
            ALLERGY_TYPE: 'Drug allergy',
            ALLERGY_SEVERITY: 'Severe',
            REACTION: 'Rash',
            REMARKS: 'หลีกเลี่ยงการใช้ยา',
          },
        ],
      }),
    };
    const databaseService = {
      createRequest: jest.fn().mockReturnValue(request),
    } as unknown as DatabaseService;
    const service = new VerifyClinicalAlertService(databaseService);

    const result = await service.findAlerts([stockScope, withScope]);

    expect(result.get(createVerifyAlertItemKey(stockScope))).toHaveLength(2);
    expect(result.get(createVerifyAlertItemKey(withScope))).toEqual([
      expect.objectContaining({
        TYPE: 'DI',
        STOCK_NAME_EN: 'Medicine A',
        WITH_STOCK_CODE_NAME_EN: 'Medicine B',
        SEVERITY_TYPE: 1,
        SEVERITY_TYPE_NAME: 'Major',
      }),
    ]);
    expect(request.input).toHaveBeenCalledWith(
      'selectedItemsJson',
      expect.anything(),
      JSON.stringify([stockScope, withScope]),
    );

    const queryText = request.query.mock.calls[0][0] as string;
    expect(queryText).toContain('OPENJSON(@selectedItemsJson)');
    expect(queryText).toContain("LEN(LTRIM(RTRIM(StockCode))) = 10");
    expect(queryText).toContain("IN (N'12', N'14')");
    expect(queryText).toContain('interactionMatch.WITH_PRESCRIPTIONNUMBER');
    expect(queryText).toContain('LTRIM(RTRIM(allergy.HN))');
    expect(queryText).toContain(
      'LTRIM(RTRIM(allergy.MEDICINECODE)) = selected.MEDICINECODE',
    );
  });

  it('does not query the database when there are no valid item scopes', async () => {
    const databaseService = {
      createRequest: jest.fn(),
    } as unknown as DatabaseService;
    const service = new VerifyClinicalAlertService(databaseService);

    await expect(service.findAlerts([])).resolves.toEqual(new Map());
    expect(databaseService.createRequest).not.toHaveBeenCalled();
  });
});
