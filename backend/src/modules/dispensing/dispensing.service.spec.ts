import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { DispensingService } from './dispensing.service';

type QueryResult = { recordset: unknown[]; rowsAffected?: number[] };

function fakeDatabase(handler: (statement: string) => QueryResult) {
  const statements: string[] = [];
  const createRequest = () => ({
    input: jest.fn().mockReturnThis(),
    query: jest.fn(async (statement: string) => {
      statements.push(statement);
      return handler(statement);
    }),
  });
  const database = {
    withTransaction: jest.fn(async (work: (request: typeof createRequest) => Promise<unknown>) => work(createRequest)),
    createRequest,
  } as unknown as DatabaseService;
  const config = {
    get: jest.fn((key: string) => ({
      DISPENSING_ADMIN_USERNAME: 'admin',
      DISPENSING_ADMIN_PASSWORD: 'test-password',
    })[key]),
  } as unknown as ConfigService;
  return { service: new DispensingService(database, config), statements, database };
}

describe('DispensingService', () => {
  const token = '4b5dce1c-3d22-4c8e-a87e-faef0cc6d309';

  it('rejects a second claimant but lets the same tab restore its channel', async () => {
    let occupied = false;
    const ownHash = createHash('sha256').update(token).digest();
    const { service } = fakeDatabase(statement => {
      if (statement.includes('SELECT CHANNEL_NO, CLAIM_TOKEN_HASH')) {
        return { recordset: occupied ? [{ CHANNEL_NO: 1, CLAIM_TOKEN_HASH: ownHash }] : [] };
      }
      if (statement.includes('INSERT INTO dbo.TBLDISPENSINGCHANNELCLAIMS')) occupied = true;
      return { recordset: [] };
    });
    await expect(service.claim(1, token)).resolves.toMatchObject({ CLAIMED: true });
    await expect(service.claim(1, token)).resolves.toMatchObject({ CLAIMED: true });
    await expect(service.claim(1, 'another-tab')).rejects.toThrow(ConflictException);
    await expect(service.claim(9, token)).rejects.toThrow();
  });

  it('does not let a stale tab reclaim a channel after DBA release', async () => {
    const { service } = fakeDatabase(statement => {
      if (statement.includes('SELECT TOP (1) CLAIM_ID FROM dbo.TBLDISPENSINGCHANNELCLAIMS')) {
        return { recordset: [{ CLAIM_ID: token }] };
      }
      return { recordset: [] };
    });
    await expect(service.claim(1, token)).rejects.toThrow(ConflictException);
  });

  it('reports a force-released claim as no longer valid', async () => {
    let active = true;
    const { service } = fakeDatabase(statement => {
      if (statement.includes('SELECT CLAIM_ID FROM dbo.TBLDISPENSINGCHANNELCLAIMS')) {
        return { recordset: active ? [{ CLAIM_ID: token }] : [] };
      }
      return { recordset: [] };
    });
    await expect(service.validateClaim(1, token)).resolves.toEqual({ CHANNEL_NO: 1, CLAIMED: true });
    active = false;
    await expect(service.validateClaim(1, token)).rejects.toThrow(ConflictException);
  });

  it('does not transfer a package after another machine changed its revision', async () => {
    const packageId = 'b7fcb90a-79d5-49d1-a1ce-3f3708f1cc91';
    const { service, statements } = fakeDatabase(statement => {
      if (statement.includes('FROM dbo.TBLPACKAGEMASTER AS p WITH (UPDLOCK,HOLDLOCK)')) {
        return { recordset: [{ PACKAGE_ID: packageId, WORKFLOW_ID: token,
          PAGE_NOW: 'DISPENSING', DISPENSING_PICKUP_STATUS: 'WAITING_CALL',
          DISPENSING_CHANNEL: 1, ROW_VERSION: Buffer.from('current') }] };
      }
      return { recordset: [] };
    });
    await expect(service.transfer(packageId, 2, {
      claimToken: token, actionId: token, expectedRowVersion: Buffer.from('stale').toString('base64'),
    })).rejects.toThrow(ConflictException);
    expect(statements.some(statement => statement.includes('SET DISPENSING_CHANNEL=@channel'))).toBe(false);
  });

  it('stores readiness before Checking and scopes lookup to visit date and VN', async () => {
    const { service, statements } = fakeDatabase(statement => {
      if (statement.includes('SELECT FIRST_READY_AT,APPLIED_WORKFLOW_ID')) return { recordset: [] };
      if (statement.includes('SELECT TOP (1) p.PACKAGE_ID,p.WORKFLOW_ID')) return { recordset: [] };
      if (statement.includes('SELECT TOP (1) WORKFLOW_ID')) return { recordset: [] };
      return { recordset: [] };
    });
    await expect(service.receiveReady(' 0883 ', '2026-09-20')).resolves.toMatchObject({
      success: true, data: { vn: '0883', visit_date: '2026-09-20', step_id: '04' },
    });
    expect(statements.some(statement => statement.includes('INSERT INTO dbo.TBLHOSPITALQUEUESTEP(VISIT_DATE,VN,STEP_ID)'))).toBe(true);
    expect(statements.some(statement => statement.includes('w.VISITDATETIME=@date AND w.VISITNUMBER=@vn'))).toBe(true);
    expect(statements.some(statement => statement.includes("UPDATE p SET PAGE_NOW='DISPENSING'"))).toBe(false);
  });

  it('activates a waiting package when the 04 callback arrives after Checking', async () => {
    const { service, statements } = fakeDatabase(statement => {
      if (statement.includes('SELECT FIRST_READY_AT,APPLIED_WORKFLOW_ID')) return { recordset: [] };
      if (statement.includes('SELECT TOP (1) p.PACKAGE_ID,p.WORKFLOW_ID')) {
        return { recordset: [{ PACKAGE_ID: token, WORKFLOW_ID: token }] };
      }
      if (statement.includes('SELECT TOP (1) WORKFLOW_ID')) return { recordset: [{ WORKFLOW_ID: token }] };
      return { recordset: [] };
    });
    await service.receiveReady('0883', '2026-09-20');
    expect(statements.some(statement => statement.includes("UPDATE p SET PAGE_NOW='DISPENSING'"))).toBe(true);
    expect(statements.some(statement => statement.includes('APPLIED_WORKFLOW_ID=@workflowId'))).toBe(true);
  });

  it('force-releases an occupied channel only with configured admin credentials', async () => {
    let releaseReason: string | undefined;
    const { service, database } = fakeDatabase(statement => {
      if (statement.includes('UPDATE dbo.TBLDISPENSINGCHANNELCLAIMS')) {
        return { recordset: [], rowsAffected: [1] };
      }
      return { recordset: [] };
    });
    const transaction = (database as unknown as { withTransaction: jest.Mock }).withTransaction;
    const forceRequest = {
      input: jest.fn(),
      query: jest.fn(async () => ({ recordset: [], rowsAffected: [1] })),
    };
    forceRequest.input.mockImplementation((name: string, _type: unknown, value: string) => {
        if (name === 'reason') releaseReason = value;
        return forceRequest;
      });
    transaction.mockImplementationOnce(async work => work(() => forceRequest));

    await expect(service.forceRelease(2, {
      username: 'admin', password: 'wrong', reason: 'เครื่องเดิมดับ',
    })).rejects.toThrow('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    await expect(service.forceRelease(2, {
      username: 'admin', password: 'test-password', reason: 'เครื่องเดิมดับ',
    })).resolves.toEqual({ CHANNEL_NO: 2, CLAIMED: false });
    expect(releaseReason).toContain('เครื่องเดิมดับ');
  });
});
