const { spawn } = require('node:child_process');

const [profile, command, ...args] = process.argv.slice(2);

if (!profile || !/^[a-z0-9_-]+$/i.test(profile) || !command) {
  console.error('Usage: node scripts/run-profile-command.js <profile> <command> [...args]');
  process.exit(1);
}

let executable = command;
let commandArgs = args;

if (command === 'node') {
  executable = process.execPath;
} else if (command === 'nest') {
  executable = process.execPath;
  commandArgs = [require.resolve('@nestjs/cli/bin/nest.js'), ...args];
}

const child = spawn(executable, commandArgs, {
  env: { ...process.env, DB_PROFILE: profile },
  stdio: 'inherit',
  shell: false,
});

child.once('error', (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Command stopped by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
