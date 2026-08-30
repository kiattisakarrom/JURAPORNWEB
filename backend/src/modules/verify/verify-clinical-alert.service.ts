import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { DatabaseService } from '../../database/database.service';
import {
  VerifyClinicalAlert,
  VerifyDrugInteractionAlert,
} from './interfaces/verify-response.interface';

export interface VerifyAlertItemScope {
  PATIENTID: string;
  VISITDATETIME: string;
  VISITNUMBER: string;
  PRESCRIPTIONNUMBER: string;
  ITEMSEQ: number;
  MEDICINECODE: string;
}

interface VerifyClinicalAlertRow extends VerifyAlertItemScope {
  TYPE: 'DI' | 'AI';
  STOCK_CODE: string | null;
  STOCK_NAME_EN: string | null;
  WITH_STOCK_CODE: string | null;
  WITH_STOCK_CODE_NAME_EN: string | null;
  SEVERITY_TYPE: number | null;
  SEVERITY_TYPE_NAME: string | null;
  LEVEL_TYPE_NAME: string | null;
  EFFECTS_MEMO: string | null;
  MANAGEMENT_MEMO: string | null;
  SIDE_EFFECT: string | null;
  ALLERGY_TYPE: string | null;
  ALLERGY_SEVERITY: string | null;
  REACTION: string | null;
  REMARKS: string | null;
}

@Injectable()
export class VerifyClinicalAlertService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAlerts(
    itemScopes: VerifyAlertItemScope[],
  ): Promise<Map<string, VerifyClinicalAlert[]>> {
    const scopes = this.normalizeScopes(itemScopes);
    if (scopes.length === 0) return new Map();

    const request = this.databaseService.createRequest();
    request.input(
      'selectedItemsJson',
      sql.NVarChar(sql.MAX),
      JSON.stringify(scopes),
    );

    const result = await request.query<VerifyClinicalAlertRow>(`
      WITH SelectedItems AS (
        SELECT DISTINCT
          source.PATIENTID,
          source.VISITDATETIME,
          source.VISITNUMBER,
          source.PRESCRIPTIONNUMBER,
          source.ITEMSEQ,
          LTRIM(RTRIM(source.MEDICINECODE)) AS MEDICINECODE
        FROM OPENJSON(@selectedItemsJson)
        WITH (
          PATIENTID varchar(15) '$.PATIENTID',
          VISITDATETIME date '$.VISITDATETIME',
          VISITNUMBER varchar(20) '$.VISITNUMBER',
          PRESCRIPTIONNUMBER varchar(16) '$.PRESCRIPTIONNUMBER',
          ITEMSEQ int '$.ITEMSEQ',
          MEDICINECODE nvarchar(30) '$.MEDICINECODE'
        ) AS source
        WHERE NULLIF(LTRIM(RTRIM(source.PATIENTID)), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(source.MEDICINECODE)), '') IS NOT NULL
      ),
      SelectedVisits AS (
        SELECT DISTINCT PATIENTID, VISITDATETIME, VISITNUMBER
        FROM SelectedItems
      ),
      VisitItems AS (
        SELECT DISTINCT
          selectedVisit.PATIENTID,
          selectedVisit.VISITDATETIME,
          selectedVisit.VISITNUMBER,
          oi.PRESCRIPTIONNUMBER,
          oi.ITEMSEQ,
          LTRIM(RTRIM(CONVERT(nvarchar(30), oi.MEDICINECODE))) AS MEDICINECODE
        FROM SelectedVisits AS selectedVisit
        JOIN dbo.TBLORX AS o
          ON o.VISITDATETIME = selectedVisit.VISITDATETIME
         AND o.VISITNUMBER = selectedVisit.VISITNUMBER
         AND LTRIM(RTRIM(o.PATIENTID)) = LTRIM(RTRIM(selectedVisit.PATIENTID))
        JOIN dbo.TBLORXITEMS AS oi
          ON oi.VISITDATETIME = o.VISITDATETIME
         AND oi.VISITNUMBER = o.VISITNUMBER
         AND oi.PRESCRIPTIONNUMBER = o.PRESCRIPTIONNUMBER
        WHERE oi.ITEMSEQ IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(30), oi.MEDICINECODE))), '') IS NOT NULL
      ),
      ValidInteractions AS (
        SELECT DISTINCT
          LTRIM(RTRIM(StockCode)) AS STOCK_CODE,
          EnglishName AS STOCK_NAME_EN,
          LTRIM(RTRIM(WithStockCode)) AS WITH_STOCK_CODE,
          WithStockCodeNameEN AS WITH_STOCK_CODE_NAME_EN,
          SeverityType AS SEVERITY_TYPE,
          SeverityTypeName AS SEVERITY_TYPE_NAME,
          LevelTypeName AS LEVEL_TYPE_NAME,
          EffectsMemo AS EFFECTS_MEMO,
          ManagementMemo AS MANAGEMENT_MEMO
        FROM dbo.DrugInteraction
        WHERE LEN(LTRIM(RTRIM(StockCode))) = 10
          AND LTRIM(RTRIM(StockCode)) NOT LIKE N'%[^0-9]%'
          AND LEFT(LTRIM(RTRIM(StockCode)), 2) IN (N'12', N'14')
          AND LEN(LTRIM(RTRIM(WithStockCode))) = 10
          AND LTRIM(RTRIM(WithStockCode)) NOT LIKE N'%[^0-9]%'
          AND LEFT(LTRIM(RTRIM(WithStockCode)), 2) IN (N'12', N'14')
      ),
      InteractionMatches AS (
        SELECT
          stockItem.PATIENTID,
          stockItem.VISITDATETIME,
          stockItem.VISITNUMBER,
          stockItem.PRESCRIPTIONNUMBER AS STOCK_PRESCRIPTIONNUMBER,
          stockItem.ITEMSEQ AS STOCK_ITEMSEQ,
          withItem.PRESCRIPTIONNUMBER AS WITH_PRESCRIPTIONNUMBER,
          withItem.ITEMSEQ AS WITH_ITEMSEQ,
          interaction.STOCK_CODE,
          interaction.STOCK_NAME_EN,
          interaction.WITH_STOCK_CODE,
          interaction.WITH_STOCK_CODE_NAME_EN,
          interaction.SEVERITY_TYPE,
          interaction.SEVERITY_TYPE_NAME,
          interaction.LEVEL_TYPE_NAME,
          interaction.EFFECTS_MEMO,
          interaction.MANAGEMENT_MEMO
        FROM VisitItems AS stockItem
        JOIN ValidInteractions AS interaction
          ON interaction.STOCK_CODE = stockItem.MEDICINECODE
        JOIN VisitItems AS withItem
          ON withItem.PATIENTID = stockItem.PATIENTID
         AND withItem.VISITDATETIME = stockItem.VISITDATETIME
         AND withItem.VISITNUMBER = stockItem.VISITNUMBER
         AND withItem.MEDICINECODE = interaction.WITH_STOCK_CODE
        WHERE stockItem.PRESCRIPTIONNUMBER <> withItem.PRESCRIPTIONNUMBER
           OR stockItem.ITEMSEQ <> withItem.ITEMSEQ
      ),
      InteractionAlerts AS (
        SELECT
          selected.PATIENTID,
          selected.VISITDATETIME,
          selected.VISITNUMBER,
          selected.PRESCRIPTIONNUMBER,
          selected.ITEMSEQ,
          selected.MEDICINECODE,
          interactionMatch.STOCK_CODE,
          interactionMatch.STOCK_NAME_EN,
          interactionMatch.WITH_STOCK_CODE,
          interactionMatch.WITH_STOCK_CODE_NAME_EN,
          interactionMatch.SEVERITY_TYPE,
          interactionMatch.SEVERITY_TYPE_NAME,
          interactionMatch.LEVEL_TYPE_NAME,
          interactionMatch.EFFECTS_MEMO,
          interactionMatch.MANAGEMENT_MEMO
        FROM InteractionMatches AS interactionMatch
        JOIN SelectedItems AS selected
          ON selected.PATIENTID = interactionMatch.PATIENTID
         AND selected.VISITDATETIME = interactionMatch.VISITDATETIME
         AND selected.VISITNUMBER = interactionMatch.VISITNUMBER
         AND selected.PRESCRIPTIONNUMBER = interactionMatch.STOCK_PRESCRIPTIONNUMBER
         AND selected.ITEMSEQ = interactionMatch.STOCK_ITEMSEQ
         AND selected.MEDICINECODE = interactionMatch.STOCK_CODE

        UNION ALL

        SELECT
          selected.PATIENTID,
          selected.VISITDATETIME,
          selected.VISITNUMBER,
          selected.PRESCRIPTIONNUMBER,
          selected.ITEMSEQ,
          selected.MEDICINECODE,
          interactionMatch.STOCK_CODE,
          interactionMatch.STOCK_NAME_EN,
          interactionMatch.WITH_STOCK_CODE,
          interactionMatch.WITH_STOCK_CODE_NAME_EN,
          interactionMatch.SEVERITY_TYPE,
          interactionMatch.SEVERITY_TYPE_NAME,
          interactionMatch.LEVEL_TYPE_NAME,
          interactionMatch.EFFECTS_MEMO,
          interactionMatch.MANAGEMENT_MEMO
        FROM InteractionMatches AS interactionMatch
        JOIN SelectedItems AS selected
          ON selected.PATIENTID = interactionMatch.PATIENTID
         AND selected.VISITDATETIME = interactionMatch.VISITDATETIME
         AND selected.VISITNUMBER = interactionMatch.VISITNUMBER
         AND selected.PRESCRIPTIONNUMBER = interactionMatch.WITH_PRESCRIPTIONNUMBER
         AND selected.ITEMSEQ = interactionMatch.WITH_ITEMSEQ
         AND selected.MEDICINECODE = interactionMatch.WITH_STOCK_CODE
      ),
      AllergyAlerts AS (
        SELECT DISTINCT
          selected.PATIENTID,
          selected.VISITDATETIME,
          selected.VISITNUMBER,
          selected.PRESCRIPTIONNUMBER,
          selected.ITEMSEQ,
          selected.MEDICINECODE,
          allergy.SideEffect AS SIDE_EFFECT,
          allergy.ALLERGYTYPE AS ALLERGY_TYPE,
          allergy.severity AS ALLERGY_SEVERITY,
          COALESCE(
            NULLIF(LTRIM(RTRIM(allergy.adverseReactionsLocalDesc)), ''),
            NULLIF(LTRIM(RTRIM(allergy.adverseReactionsDesc)), '')
          ) AS REACTION,
          allergy.remarks AS REMARKS
        FROM SelectedItems AS selected
        JOIN dbo.TBLALLERGY AS allergy
          ON LTRIM(RTRIM(allergy.HN)) = LTRIM(RTRIM(selected.PATIENTID))
         AND LTRIM(RTRIM(allergy.MEDICINECODE)) = selected.MEDICINECODE
        WHERE NULLIF(LTRIM(RTRIM(allergy.HN)), '') IS NOT NULL
          AND NULLIF(LTRIM(RTRIM(allergy.MEDICINECODE)), '') IS NOT NULL
      )
      SELECT DISTINCT
        alerts.PATIENTID,
        alerts.VISITDATETIME,
        alerts.VISITNUMBER,
        alerts.PRESCRIPTIONNUMBER,
        alerts.ITEMSEQ,
        alerts.MEDICINECODE,
        alerts.TYPE,
        alerts.STOCK_CODE,
        alerts.STOCK_NAME_EN,
        alerts.WITH_STOCK_CODE,
        alerts.WITH_STOCK_CODE_NAME_EN,
        alerts.SEVERITY_TYPE,
        alerts.SEVERITY_TYPE_NAME,
        alerts.LEVEL_TYPE_NAME,
        alerts.EFFECTS_MEMO,
        alerts.MANAGEMENT_MEMO,
        alerts.SIDE_EFFECT,
        alerts.ALLERGY_TYPE,
        alerts.ALLERGY_SEVERITY,
        alerts.REACTION,
        alerts.REMARKS
      FROM (
        SELECT
          interaction.PATIENTID,
          interaction.VISITDATETIME,
          interaction.VISITNUMBER,
          interaction.PRESCRIPTIONNUMBER,
          interaction.ITEMSEQ,
          interaction.MEDICINECODE,
          CAST('DI' AS varchar(2)) AS TYPE,
          interaction.STOCK_CODE,
          interaction.STOCK_NAME_EN,
          interaction.WITH_STOCK_CODE,
          interaction.WITH_STOCK_CODE_NAME_EN,
          interaction.SEVERITY_TYPE,
          interaction.SEVERITY_TYPE_NAME,
          interaction.LEVEL_TYPE_NAME,
          interaction.EFFECTS_MEMO,
          interaction.MANAGEMENT_MEMO,
          CAST(NULL AS nvarchar(max)) AS SIDE_EFFECT,
          CAST(NULL AS varchar(20)) AS ALLERGY_TYPE,
          CAST(NULL AS varchar(100)) AS ALLERGY_SEVERITY,
          CAST(NULL AS nvarchar(100)) AS REACTION,
          CAST(NULL AS nvarchar(max)) AS REMARKS
        FROM InteractionAlerts AS interaction

        UNION ALL

        SELECT
          allergy.PATIENTID,
          allergy.VISITDATETIME,
          allergy.VISITNUMBER,
          allergy.PRESCRIPTIONNUMBER,
          allergy.ITEMSEQ,
          allergy.MEDICINECODE,
          CAST('AI' AS varchar(2)) AS TYPE,
          CAST(NULL AS nvarchar(50)) AS STOCK_CODE,
          CAST(NULL AS nvarchar(400)) AS STOCK_NAME_EN,
          CAST(NULL AS nvarchar(50)) AS WITH_STOCK_CODE,
          CAST(NULL AS nvarchar(200)) AS WITH_STOCK_CODE_NAME_EN,
          CAST(NULL AS tinyint) AS SEVERITY_TYPE,
          CAST(NULL AS nvarchar(100)) AS SEVERITY_TYPE_NAME,
          CAST(NULL AS nvarchar(100)) AS LEVEL_TYPE_NAME,
          CAST(NULL AS nvarchar(max)) AS EFFECTS_MEMO,
          CAST(NULL AS nvarchar(max)) AS MANAGEMENT_MEMO,
          allergy.SIDE_EFFECT,
          allergy.ALLERGY_TYPE,
          allergy.ALLERGY_SEVERITY,
          allergy.REACTION,
          allergy.REMARKS
        FROM AllergyAlerts AS allergy
      ) AS alerts
      ORDER BY
        alerts.PATIENTID,
        alerts.VISITDATETIME,
        alerts.VISITNUMBER,
        alerts.PRESCRIPTIONNUMBER,
        alerts.ITEMSEQ,
        alerts.TYPE,
        alerts.STOCK_CODE,
        alerts.WITH_STOCK_CODE;
    `);

    return this.groupAlerts(result.recordset);
  }

  private normalizeScopes(
    itemScopes: VerifyAlertItemScope[],
  ): VerifyAlertItemScope[] {
    const scopes = new Map<string, VerifyAlertItemScope>();
    for (const scope of itemScopes) {
      const normalized = {
        ...scope,
        PATIENTID: scope.PATIENTID.trim(),
        VISITDATETIME: scope.VISITDATETIME.slice(0, 10),
        VISITNUMBER: scope.VISITNUMBER.trim(),
        PRESCRIPTIONNUMBER: scope.PRESCRIPTIONNUMBER.trim(),
        MEDICINECODE: scope.MEDICINECODE.trim(),
      };
      if (!normalized.PATIENTID || !normalized.MEDICINECODE) continue;
      scopes.set(createVerifyAlertItemKey(normalized), normalized);
    }
    return Array.from(scopes.values());
  }

  private groupAlerts(
    rows: VerifyClinicalAlertRow[],
  ): Map<string, VerifyClinicalAlert[]> {
    const alertsByItem = new Map<string, VerifyClinicalAlert[]>();
    const alertKeysByItem = new Map<string, Set<string>>();

    for (const row of rows) {
      const itemKey = createVerifyAlertItemKey({
        ...row,
        VISITDATETIME: this.toDateOnly(row.VISITDATETIME),
      });
      const alert = this.mapAlert(row);
      if (!alert) continue;

      const alertKey = this.createAlertKey(alert);
      const existingKeys = alertKeysByItem.get(itemKey) ?? new Set<string>();
      if (existingKeys.has(alertKey)) continue;

      existingKeys.add(alertKey);
      alertKeysByItem.set(itemKey, existingKeys);
      const existingAlerts = alertsByItem.get(itemKey) ?? [];
      existingAlerts.push(alert);
      alertsByItem.set(itemKey, existingAlerts);
    }

    return alertsByItem;
  }

  private mapAlert(row: VerifyClinicalAlertRow): VerifyClinicalAlert | null {
    if (row.TYPE === 'DI' && row.STOCK_CODE && row.WITH_STOCK_CODE) {
      return {
        TYPE: 'DI',
        STOCK_CODE: row.STOCK_CODE.trim(),
        STOCK_NAME_EN: this.cleanText(row.STOCK_NAME_EN),
        WITH_STOCK_CODE: row.WITH_STOCK_CODE.trim(),
        WITH_STOCK_CODE_NAME_EN: this.cleanText(
          row.WITH_STOCK_CODE_NAME_EN,
        ),
        SEVERITY_TYPE: row.SEVERITY_TYPE,
        SEVERITY_TYPE_NAME: this.cleanText(row.SEVERITY_TYPE_NAME),
        LEVEL_TYPE_NAME: this.cleanText(row.LEVEL_TYPE_NAME),
        EFFECTS_MEMO: this.cleanText(row.EFFECTS_MEMO),
        MANAGEMENT_MEMO: this.cleanText(row.MANAGEMENT_MEMO),
      };
    }

    if (row.TYPE === 'AI') {
      return {
        TYPE: 'AI',
        SIDE_EFFECT: this.cleanText(row.SIDE_EFFECT),
        ALLERGY_TYPE: this.cleanText(row.ALLERGY_TYPE),
        SEVERITY: this.cleanText(row.ALLERGY_SEVERITY),
        REACTION: this.cleanText(row.REACTION),
        REMARKS: this.cleanText(row.REMARKS),
      };
    }

    return null;
  }

  private createAlertKey(alert: VerifyClinicalAlert): string {
    if (alert.TYPE === 'AI') return JSON.stringify(alert);

    const pair = [alert.STOCK_CODE, alert.WITH_STOCK_CODE].sort();
    const details: Omit<
      VerifyDrugInteractionAlert,
      'STOCK_CODE' | 'STOCK_NAME_EN' | 'WITH_STOCK_CODE' | 'WITH_STOCK_CODE_NAME_EN'
    > = {
      TYPE: 'DI',
      SEVERITY_TYPE: alert.SEVERITY_TYPE,
      SEVERITY_TYPE_NAME: alert.SEVERITY_TYPE_NAME,
      LEVEL_TYPE_NAME: alert.LEVEL_TYPE_NAME,
      EFFECTS_MEMO: alert.EFFECTS_MEMO,
      MANAGEMENT_MEMO: alert.MANAGEMENT_MEMO,
    };
    return JSON.stringify({ pair, details });
  }

  private cleanText(value: string | null): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private toDateOnly(value: Date | string): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value.slice(0, 10);
  }
}

export function createVerifyAlertItemKey(scope: VerifyAlertItemScope): string {
  return [
    scope.PATIENTID.trim(),
    scope.VISITDATETIME.slice(0, 10),
    scope.VISITNUMBER.trim(),
    scope.PRESCRIPTIONNUMBER.trim(),
    scope.ITEMSEQ,
    scope.MEDICINECODE.trim(),
  ].join('|');
}
