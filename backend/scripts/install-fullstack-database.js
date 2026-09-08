const { spawnSync } = require('node:child_process');
const path = require('node:path');

const profile = process.argv[2];
if (!profile || !/^[a-z0-9_-]+$/i.test(profile)) {
  console.error('Usage: node scripts/install-fullstack-database.js <profile>');
  process.exit(1);
}

function run(scriptName, args = []) {
  const scriptPath = path.resolve(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('build-sql-bundle.js');
run('run-sql-file.js', ['--profile', profile, 'sql/JurapornWeb_install_fullstack.sql']);
