const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sql = require('mssql');

const backendRoot = path.resolve(__dirname, '..');
const sourceTables = [
  'TBLORX',
  'TBLORXITEMS',
  'TBLPATIENT',
  'TBLMEDITEMSINFO',
  'TBLDOCTOR',
  'TBLDEPT',
  'TBLALLERGY',
  'DrugInteraction',
];
const trackedSourceTables = sourceTables.slice(0, 6);

function loadEnvFile(filePath) {
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function quoteIdentifier(value) {
  return `[${String(value).replaceAll(']', ']]')}]`;
}

function connectionConfig(database) {
  return {
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 1433),
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 15000),
    requestTimeout: Math.max(Number(process.env.DB_REQUEST_TIMEOUT_MS ?? 30000), 120000),
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE).toLowerCase() !== 'false',
      enableArithAbort: true,
      appName: 'juraporn-installer-test',
    },
  };
}

async function primaryKeyColumns(pool, tableName) {
  const request = pool.request();
  request.input('tableName', sql.NVarChar(128), tableName);
  const result = await request.query(`
    SELECT column_info.name AS COLUMN_NAME
    FROM sys.indexes AS index_info
    JOIN sys.index_columns AS index_column
      ON index_column.object_id = index_info.object_id
     AND index_column.index_id = index_info.index_id
    JOIN sys.columns AS column_info
      ON column_info.object_id = index_column.object_id
     AND column_info.column_id = index_column.column_id
    WHERE index_info.object_id = OBJECT_ID(N'dbo.' + @tableName)
      AND index_info.is_primary_key = 1
    ORDER BY index_column.key_ordinal;
  `);
  return result.recordset.map((row) => row.COLUMN_NAME);
}

async function executeSqlFile(pool, sqlPath) {
  const batches = fs
    .readFileSync(sqlPath, 'utf8')
    .split(/^\s*GO\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean);
  for (const batch of batches) await pool.request().batch(batch);
}

async function main() {
  const envPath = path.join(backendRoot, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error(`Local environment file was not found: ${envPath}`);
  loadEnvFile(envPath);

  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!process.env[key]) throw new Error(`Missing ${key} in .env.local.`);
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(String(process.env.DB_HOST).toLowerCase())) {
    throw new Error('Fresh installer test is restricted to a localhost SQL Server.');
  }

  const generator = spawnSync(process.execPath, [path.join(__dirname, 'build-sql-bundle.js')], {
    cwd: backendRoot,
    stdio: 'inherit',
  });
  if (generator.status !== 0) process.exit(generator.status ?? 1);

  const sourceDatabase = process.env.DB_NAME;
  const testDatabase = `JurapornWeb_InstallTest_${process.pid}_${Date.now()}`;
  const sourcePool = await new sql.ConnectionPool(connectionConfig(sourceDatabase)).connect();
  const primaryKeys = new Map();
  let masterPool;
  let testPool;
  let databaseCreated = false;

  try {
    for (const tableName of trackedSourceTables) {
      const columns = await primaryKeyColumns(sourcePool, tableName);
      if (columns.length === 0) throw new Error(`Source table dbo.${tableName} has no Primary Key.`);
      primaryKeys.set(tableName, columns);
    }

    masterPool = await new sql.ConnectionPool(connectionConfig('master')).connect();
    await masterPool.request().batch(`CREATE DATABASE ${quoteIdentifier(testDatabase)};`);
    databaseCreated = true;

    for (const tableName of sourceTables) {
      await masterPool.request().batch(
        `SELECT TOP (0) * INTO ${quoteIdentifier(testDatabase)}.dbo.${quoteIdentifier(tableName)} ` +
          `FROM ${quoteIdentifier(sourceDatabase)}.dbo.${quoteIdentifier(tableName)};`,
      );
    }

    for (const [tableName, columns] of primaryKeys) {
      const columnSql = columns.map(quoteIdentifier).join(', ');
      await masterPool.request().batch(
        `ALTER TABLE ${quoteIdentifier(testDatabase)}.dbo.${quoteIdentifier(tableName)} ` +
          `ADD CONSTRAINT ${quoteIdentifier(`PK_InstallTest_${tableName}`)} PRIMARY KEY (${columnSql});`,
      );
    }

    testPool = await new sql.ConnectionPool(connectionConfig(testDatabase)).connect();
    const installerPath = path.join(backendRoot, 'sql', 'JurapornWeb_install_fullstack.sql');
    await executeSqlFile(testPool, installerPath);
    await executeSqlFile(testPool, installerPath);

    console.log(`Fresh database and second-run installer test passed: ${testDatabase}`);
  } finally {
    await testPool?.close().catch(() => undefined);
    await sourcePool.close().catch(() => undefined);
    if (databaseCreated && masterPool) {
      await masterPool.request().batch(
        `ALTER DATABASE ${quoteIdentifier(testDatabase)} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; ` +
          `DROP DATABASE ${quoteIdentifier(testDatabase)};`,
      );
      console.log(`Removed disposable installer test database: ${testDatabase}`);
    }
    await masterPool?.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
