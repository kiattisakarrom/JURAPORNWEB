import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// load-nyc-config uses js-yaml.load(). Exercise that integration when its YAML
// dependency is overridden to v4 to remove argparse v1 / sprintf-js.
const requireDependency = createRequire(__filename);
const { loadNycConfig } = requireDependency('@istanbuljs/load-nyc-config') as {
  loadNycConfig(options: { cwd: string }): Promise<Record<string, unknown>>;
};

describe('Coverage YAML configuration', () => {
  it('loads YAML, resolves extends and normalizes scalar include patterns', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'juraporn-coverage-config-'));
    try {
      writeFileSync(join(directory, 'package.json'), '{}');
      writeFileSync(
        join(directory, 'base.yaml'),
        'all: true\nexclude:\n  - generated/**\n',
      );
      writeFileSync(
        join(directory, '.nycrc.yaml'),
        'extends: ./base.yaml\ninclude: src/**/*.ts\ncheck-coverage: true\n',
      );

      await expect(loadNycConfig({ cwd: directory })).resolves.toMatchObject({
        cwd: directory,
        all: true,
        exclude: ['generated/**'],
        include: ['src/**/*.ts'],
        checkCoverage: true,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
