const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');

function parseArguments(argv) {
  let profile = process.env.DB_PROFILE ?? 'local';
  let sqlFile = 'sql/001_create_package_workflow_schema.sql';

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--profile') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value after --profile.');
      profile = value;
      index += 1;
      continue;
    }

    if (argument.startsWith('--profile=')) {
      profile = argument.slice('--profile='.length);
      continue;
    }

    if (argument.startsWith('-')) throw new Error(`Unknown option: ${argument}`);
    sqlFile = argument;
  }

  if (!/^[a-z0-9_-]+$/i.test(profile)) throw new Error(`Invalid DB profile: ${profile}`);
  return { profile, sqlFile };
}

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
  const { profile, sqlFile } = parseArguments(process.argv.slice(2));
  const envPath = path.resolve(process.cwd(), `.env.${profile}`);
  const sqlPath = path.resolve(process.cwd(), sqlFile);

  if (!fs.existsSync(envPath)) throw new Error(`Environment file was not found: ${envPath}`);
  if (!fs.existsSync(sqlPath)) throw new Error(`SQL file was not found: ${sqlPath}`);
  loadEnvFile(envPath);

  for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
    if (!process.env[key]) throw new Error(`Missing ${key} in ${path.basename(envPath)}.`);
  }

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
