import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HospitalCallbackTestDto } from './hospital-callback-test.dto';
import { HospitalCallbackTestService } from './hospital-callback-test.service';
import { DispensingService } from '../dispensing/dispensing.service';

describe('HospitalCallbackTestService', () => {
  function makeService(settings: Record<string, unknown> = {}) {
    const config = {
      get: jest.fn((key: string) => settings[key] ?? {
        HOSPITAL_CALLBACK_TEST_ENABLED: true,
        HOSPITAL_QUEUE_CALLBACK_ENABLED: false,
        PACKAGE_WORKFLOW_ENABLED: true,
        NODE_ENV: 'test',
        DB_PROFILE: 'local',
      }[key]),
    } as unknown as ConfigService;
    const dispensing = {
      receiveReady: jest.fn(async (vn: string, date: string) => ({ success: true, data: { vn: vn.trim(), visit_date: date, step_id: '04' } })),
      recent: jest.fn(async () => ({ success: true, data: [] })),
    } as unknown as DispensingService;
    return new HospitalCallbackTestService(config, dispensing);
  }

  it('rejects requests when disabled or in production', () => {
    expect(() => makeService({ HOSPITAL_CALLBACK_TEST_ENABLED: false }).assertEnabled())
      .toThrow(ServiceUnavailableException);
    expect(() => makeService({ NODE_ENV: 'production' }).assertEnabled())
      .toThrow(ServiceUnavailableException);
    expect(() => makeService({ DB_PROFILE: 'live' }).assertEnabled())
      .toThrow(ServiceUnavailableException);
    expect(() => makeService({ NODE_ENV: 'production', HOSPITAL_QUEUE_CALLBACK_ENABLED: true }).assertEnabled())
      .not.toThrow();
  });

  it('restricts the recent list to local viewers', () => {
    const service = makeService();
    service.assertLocalViewer('127.0.0.1');
    service.assertLocalViewer('::1');
    expect(() => service.assertLocalViewer('172.19.0.10')).toThrow(ForbiddenException);
  });

  it('delegates the 04 callback to persistent dispensing storage', async () => {
    const service = makeService();
    service.assertEnabled();
    const response = await service.receive({
      vn: ' 0883 ',
      visit_date: '2026-09-20',
      step_id: '04',
    });

    expect(response).toMatchObject({
      success: true,
      data: { vn: '0883', visit_date: '2026-09-20', step_id: '04' },
    });
    expect((await service.listRecent()).data).toEqual([]);
  });

  it('accepts only a real date, nonblank VN and step 04', () => {
    const valid = plainToInstance(HospitalCallbackTestDto, {
      vn: '0883', visit_date: '2026-09-20', step_id: '04',
    });
    const invalid = plainToInstance(HospitalCallbackTestDto, {
      vn: '   ', visit_date: '2026-02-30', step_id: '03',
    });
    expect(validateSync(valid)).toHaveLength(0);
    expect(validateSync(invalid)).toHaveLength(3);
  });
});
