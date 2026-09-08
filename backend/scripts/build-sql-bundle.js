const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const sqlDirectory = path.join(backendRoot, 'sql');
const outputPath = path.join(sqlDirectory, 'JurapornWeb_install_fullstack.sql');
const sourceFiles = [
  '001_create_package_workflow_schema.sql',
  '005_enable_realtime_sync.sql',
  '003_validate_package_workflow.sql',
  '006_validate_realtime_sync.sql',
];

const preflight = `SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() IN (N'master', N'model', N'msdb', N'tempdb')
  THROW 51000, 'Choose the copied hospital application database before installing JurapornWeb.', 1;

IF SCHEMA_ID(N'workflow') IS NOT NULL
  THROW 51000, 'Legacy schema [workflow] exists. Back up and review 002_drop_legacy_workflow_schema.sql separately before installation.', 1;

IF HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER') <> 1
  THROW 51000, 'Installer account requires ALTER permission on the selected database.', 1;
IF HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') <> 1
  THROW 51000, 'Installer account requires CREATE TABLE permission on the selected database.', 1;
IF HAS_PERMS_BY_NAME(N'dbo', 'SCHEMA', 'ALTER') <> 1
  THROW 51000, 'Installer account requires ALTER permission on schema dbo.', 1;

DECLARE @RequiredTables TABLE (TABLE_NAME sysname NOT NULL PRIMARY KEY);
INSERT INTO @RequiredTables (TABLE_NAME)
VALUES
  (N'TBLORX'), (N'TBLORXITEMS'), (N'TBLPATIENT'), (N'TBLMEDITEMSINFO'),
  (N'TBLDOCTOR'), (N'TBLDEPT'), (N'TBLALLERGY'), (N'DrugInteraction');

DECLARE @MissingTable sysname = (
  SELECT TOP (1) required.TABLE_NAME
  FROM @RequiredTables AS required
  WHERE OBJECT_ID(N'dbo.' + required.TABLE_NAME, N'U') IS NULL
  ORDER BY required.TABLE_NAME
);
IF @MissingTable IS NOT NULL
  THROW 51000, 'A required source table is missing. This installer requires the existing hospital database (TBLORX, TBLORXITEMS, patient, allergy and reference tables).', 1;

DECLARE @TrackedSourceTables TABLE (TABLE_NAME sysname NOT NULL PRIMARY KEY);
INSERT INTO @TrackedSourceTables (TABLE_NAME)
VALUES (N'TBLORX'), (N'TBLORXITEMS'), (N'TBLPATIENT'), (N'TBLMEDITEMSINFO'), (N'TBLDOCTOR'), (N'TBLDEPT');

DECLARE @MissingPrimaryKey sysname = (
  SELECT TOP (1) tracked.TABLE_NAME
  FROM @TrackedSourceTables AS tracked
  WHERE NOT EXISTS (
    SELECT 1
    FROM sys.indexes AS index_info
    WHERE index_info.object_id = OBJECT_ID(N'dbo.' + tracked.TABLE_NAME)
      AND index_info.is_primary_key = 1
  )
  ORDER BY tracked.TABLE_NAME
);
IF @MissingPrimaryKey IS NOT NULL
  THROW 51000, 'A source table required by Change Tracking has no Primary Key. No key is created automatically; ask the DBA to review the source schema.', 1;

DECLARE @RequiredColumns TABLE (TABLE_NAME sysname NOT NULL, COLUMN_NAME sysname NOT NULL, PRIMARY KEY (TABLE_NAME, COLUMN_NAME));
INSERT INTO @RequiredColumns (TABLE_NAME, COLUMN_NAME)
VALUES
  (N'TBLORX', N'VISITDATETIME'), (N'TBLORX', N'VISITNUMBER'),
  (N'TBLORX', N'PRESCRIPTIONNUMBER'), (N'TBLORX', N'PATIENTID'),
  (N'TBLORXITEMS', N'VISITDATETIME'), (N'TBLORXITEMS', N'VISITNUMBER'),
  (N'TBLORXITEMS', N'PRESCRIPTIONNUMBER'), (N'TBLORXITEMS', N'MEDICINECODE'),
  (N'TBLORXITEMS', N'ITEMSEQ'), (N'TBLORXITEMS', N'IS_DELETED'),
  (N'TBLORXITEMS', N'CANCELSTATUS'), (N'TBLPATIENT', N'PATIENTID'),
  (N'TBLMEDITEMSINFO', N'MEDICINECODE'), (N'TBLDOCTOR', N'DOCTORCODE'),
  (N'TBLDEPT', N'DEPTCODE'), (N'TBLALLERGY', N'HN'),
  (N'TBLALLERGY', N'MEDICINECODE'), (N'DrugInteraction', N'StockCode'),
  (N'DrugInteraction', N'WithStockCode');

DECLARE @MissingColumn nvarchar(260) = (
  SELECT TOP (1) required.TABLE_NAME + N'.' + required.COLUMN_NAME
  FROM @RequiredColumns AS required
  WHERE COL_LENGTH(N'dbo.' + required.TABLE_NAME, required.COLUMN_NAME) IS NULL
  ORDER BY required.TABLE_NAME, required.COLUMN_NAME
);
IF @MissingColumn IS NOT NULL
  THROW 51000, 'A required source column is missing. The copied hospital database is not compatible with this JurapornWeb installer.', 1;

PRINT 'JurapornWeb preflight passed for database [' + DB_NAME() + '].';`;

const header = `/*
  JurapornWeb Full-stack Database Installer
  GENERATED FILE - DO NOT EDIT DIRECTLY

  Regenerate with: npm run db:bundle
  Included: 001 package workflow, 005 realtime, 003/006 validation
  Excluded: 002 destructive cleanup, 004 test seed, 007 rollback, 008 already folded into 001

  Prerequisite: select an existing copied hospital database containing the source tables.
  This file is intentionally rerunnable and does not insert test data.
*/`;

function withBatchBoundary(contents) {
  const trimmed = contents.trim();
  return /^GO\s*$/im.test(trimmed.split(/\r?\n/).at(-1) ?? '') ? trimmed : `${trimmed}\nGO`;
}

function buildBundle() {
  const sections = [
    header,
    '-- ===== Preflight: no database changes occur before this batch passes =====',
    withBatchBoundary(preflight),
  ];

  for (const fileName of sourceFiles) {
    const sourcePath = path.join(sqlDirectory, fileName);
    if (!fs.existsSync(sourcePath)) throw new Error(`Bundle source was not found: ${sourcePath}`);
    sections.push(`-- ===== Source: ${fileName} =====`, withBatchBoundary(fs.readFileSync(sourcePath, 'utf8')));
  }

  sections.push("PRINT 'JurapornWeb full-stack database installation and validation completed successfully.';", 'GO', '');
  return sections.join('\n\n').replace(/\r\n/g, '\n');
}

function main() {
  const expected = buildBundle();
  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n') : '';
    if (actual !== expected) {
      console.error('SQL bundle is missing or stale. Run: npm run db:bundle');
      process.exitCode = 1;
      return;
    }
    console.log(`SQL bundle is current: ${path.basename(outputPath)}`);
    return;
  }

  fs.writeFileSync(outputPath, expected, 'utf8');
  console.log(`Generated ${path.relative(backendRoot, outputPath)} from ${sourceFiles.length} migration/validation files.`);
}

main();
