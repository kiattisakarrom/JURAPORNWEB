const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

function loadEnvFile(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
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

async function main() {
  const profile = process.env.DB_PROFILE ?? 'local';
  const envPath = path.resolve(process.cwd(), `.env.${profile}`);
  const sqlPath = path.resolve(process.cwd(), process.argv[2] ?? 'sql/001_create_package_workflow_schema.sql');
  loadEnvFile(envPath);

  const pool = await sql.connect({
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 15000),
    requestTimeout: Number(process.env.DB_REQUEST_TIMEOUT_MS ?? 30000),
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE).toLowerCase() !== 'false',
      enableArithAbort: true,
      appName: 'juraporn-workflow-migration',
    },
  });

  try {
    const batches = fs.readFileSync(sqlPath, 'utf8').split(/^\s*GO\s*$/gim).map((batch) => batch.trim()).filter(Boolean);
    for (const batch of batches) await pool.request().batch(batch);
    console.log(`SQL file completed for DB_PROFILE=${profile}: ${path.basename(sqlPath)} (${batches.length} batches).`);
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
