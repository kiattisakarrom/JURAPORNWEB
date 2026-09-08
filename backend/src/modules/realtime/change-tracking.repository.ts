import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import { sourceTables, workflowTables, type ChangeBatch, type Domain, type VisitKey } from './realtime.types';

@Injectable()
export class ChangeTrackingRepository {
  constructor(private readonly db: DatabaseService) {}

  async version(createRequest: () => sql.Request): Promise<string> {
    const result = await createRequest().query<{ version: string | null; ready: number; alertsReady: number }>(`
      SELECT CONVERT(varchar(30),CHANGE_TRACKING_CURRENT_VERSION()) AS version,
       (SELECT COUNT(*) FROM sys.change_tracking_tables WHERE object_id IN
        (${[...sourceTables, ...workflowTables].map(t => `OBJECT_ID('dbo.${t}')`).join(',')})) AS ready,
       (SELECT COUNT(*) FROM sys.triggers WHERE name IN ('TR_TBLALLERGY_Realtime','TR_DrugInteraction_Realtime') AND is_disabled=0) AS alertsReady;
    `);
    if (!result.recordset[0]?.version || result.recordset[0].ready !== sourceTables.length + workflowTables.length || result.recordset[0].alertsReady !== 2) {
      throw new ServiceUnavailableException('Realtime SQL is not installed. Run 005_enable_realtime_sync.sql on the selected database.');
    }
    return result.recordset[0].version;
  }

  async read(domain: Domain, since: string): Promise<ChangeBatch> {
    return this.db.withTransaction(async createRequest => {
      const version = await this.version(createRequest);
      const tables = domain === 'source' ? sourceTables : workflowTables;
      const request = createRequest();
      request.input('since', sql.BigInt, since);
      const validity = await request.query<{ invalid: number }>(`
        SELECT CASE WHEN @since > CHANGE_TRACKING_CURRENT_VERSION() OR EXISTS (
          SELECT 1 FROM sys.change_tracking_tables WHERE object_id IN (${tables.map(t => `OBJECT_ID('dbo.${t}')`).join(',')})
          AND @since < CHANGE_TRACKING_MIN_VALID_VERSION(object_id)
        ) THEN 1 ELSE 0 END AS invalid;
      `);
      if (validity.recordset[0].invalid) return { version, visits: [], lockIds: [], reset: true };
      if (version === since) return { version, visits: [], lockIds: [], reset: false };
      const changes = await request.query<{ VISITDATETIME: Date | string; VISITNUMBER: string }>(
        domain === 'source' ? this.sourceSql() : this.workflowSql(),
      );
      const visits: VisitKey[] = changes.recordsets[0].map((row: { VISITDATETIME: Date | string; VISITNUMBER: string }) => ({
        VISITDATETIME: row.VISITDATETIME instanceof Date ? row.VISITDATETIME.toISOString().slice(0, 10) : row.VISITDATETIME.slice(0, 10),
        VISITNUMBER: row.VISITNUMBER,
      }));
      const records = changes.recordsets as unknown as [unknown[], Array<{ WORKFLOW_ID: string }>, Array<{ reset: number }>];
      return { version, visits, lockIds: records[1]?.map(row => row.WORKFLOW_ID) ?? [], reset: records[2]?.some(row => Boolean(row.reset)) ?? false };
    }, sql.ISOLATION_LEVEL.SNAPSHOT);
  }

  private sourceSql(): string {
    return `
      WITH ChangedPatients AS (
        SELECT PATIENTID FROM CHANGETABLE(CHANGES dbo.TBLPATIENT,@since) c
        UNION SELECT CONVERT(varchar(15),SCOPE_KEY) FROM CHANGETABLE(CHANGES dbo.TBLREALTIMEINVALIDATIONS,@since) c WHERE SCOPE_TYPE='PATIENT'
      ), ChangedMedicines AS (
        SELECT MEDICINECODE FROM CHANGETABLE(CHANGES dbo.TBLMEDITEMSINFO,@since) c
        UNION SELECT CONVERT(varchar(30),SCOPE_KEY) FROM CHANGETABLE(CHANGES dbo.TBLREALTIMEINVALIDATIONS,@since) c WHERE SCOPE_TYPE='MEDICINE'
      ), Visits AS (
        SELECT VISITDATETIME,VISITNUMBER FROM CHANGETABLE(CHANGES dbo.TBLORX,@since) c
        UNION SELECT VISITDATETIME,VISITNUMBER FROM CHANGETABLE(CHANGES dbo.TBLORXITEMS,@since) c
        UNION SELECT o.VISITDATETIME,o.VISITNUMBER FROM dbo.TBLORX o JOIN ChangedPatients c ON c.PATIENTID=o.PATIENTID
        UNION SELECT i.VISITDATETIME,i.VISITNUMBER FROM dbo.TBLORXITEMS i JOIN ChangedMedicines c ON c.MEDICINECODE=i.MEDICINECODE
        UNION SELECT o.VISITDATETIME,o.VISITNUMBER FROM dbo.TBLORX o JOIN CHANGETABLE(CHANGES dbo.TBLDOCTOR,@since) c ON c.DOCTORCODE=o.DOCTORORDERCODE
        UNION SELECT o.VISITDATETIME,o.VISITNUMBER FROM dbo.TBLORX o JOIN CHANGETABLE(CHANGES dbo.TBLDEPT,@since) c ON c.DEPTCODE=o.CLINIC_CODE
      ) SELECT VISITDATETIME,VISITNUMBER FROM Visits ORDER BY VISITDATETIME,VISITNUMBER;
      SELECT CONVERT(varchar(36),NULL) AS WORKFLOW_ID WHERE 1=0;
      SELECT 1 AS reset FROM CHANGETABLE(CHANGES dbo.TBLREALTIMEINVALIDATIONS,@since) c WHERE SCOPE_TYPE='GLOBAL';
    `;
  }

  private workflowSql(): string {
    const business = ['VISITDATETIME','VISITNUMBER','PATIENTID','PATIENT_NAME','CASE_STATUS','IS_ACTIVE','WORKFLOW_RUN_NO','QUEUE_NO','BLOCK_REASON_CODE','BLOCK_REASON_TEXT','PAYMENT_STATUS','VERIFY_NOTE_DRAFT','VERIFY_NOTE_UPDATED_AT','VERIFY_NOTE_UPDATED_BY'];
    const isBusiness = `c.SYS_CHANGE_OPERATION<>'U' OR c.SYS_CHANGE_COLUMNS IS NULL OR ${business.map(col => `CHANGE_TRACKING_IS_COLUMN_IN_MASK(COLUMNPROPERTY(OBJECT_ID('dbo.TBLWORKFLOWMASTER'),'${col}','ColumnId'),c.SYS_CHANGE_COLUMNS)=1`).join(' OR ')}`;
    return `
      WITH ChangedWorkflows AS (
        SELECT c.WORKFLOW_ID FROM CHANGETABLE(CHANGES dbo.TBLWORKFLOWMASTER,@since) c WHERE ${isBusiness}
        UNION SELECT p.WORKFLOW_ID FROM CHANGETABLE(CHANGES dbo.TBLPACKAGEPRESCRIPTIONS,@since) c JOIN dbo.TBLPACKAGEPRESCRIPTIONS p ON p.PACKAGE_PRESCRIPTION_ID=c.PACKAGE_PRESCRIPTION_ID
        UNION SELECT p.WORKFLOW_ID FROM CHANGETABLE(CHANGES dbo.TBLPACKAGEMASTER,@since) c JOIN dbo.TBLPACKAGEMASTER p ON p.PACKAGE_ID=c.PACKAGE_ID
        UNION SELECT p.WORKFLOW_ID FROM CHANGETABLE(CHANGES dbo.TBLPACKAGEITEMS,@since) c JOIN dbo.TBLPACKAGEITEMS p ON p.PACKAGE_ITEM_ID=c.PACKAGE_ITEM_ID
      ) SELECT DISTINCT w.VISITDATETIME,w.VISITNUMBER FROM ChangedWorkflows c JOIN dbo.TBLWORKFLOWMASTER w ON w.WORKFLOW_ID=c.WORKFLOW_ID;
      SELECT CONVERT(varchar(36),c.WORKFLOW_ID) AS WORKFLOW_ID FROM CHANGETABLE(CHANGES dbo.TBLWORKFLOWMASTER,@since) c WHERE NOT (${isBusiness});
      -- A hard-deleted child has no surviving parent key in native CT. Explicitly
      -- invalidate the cursor instead of silently retaining an orphaned item.
      SELECT 1 AS reset WHERE ${workflowTables.map(t => `EXISTS(SELECT 1 FROM CHANGETABLE(CHANGES dbo.${t},@since) c WHERE c.SYS_CHANGE_OPERATION='D')`).join(' OR ')};
    `;
  }
}
