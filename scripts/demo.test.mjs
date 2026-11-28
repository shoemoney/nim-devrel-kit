import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';

function run(args) {
  const result = spawnSync('bash', ['scripts/demo.sh', ...args], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, NVIDIA_API_KEY: '', NIM_BASE_URL: '', DEMO_PAUSE: '0', MOCK_PORT: String(randomInt(20000, 60000)) },
    encoding: 'utf8',
    timeout: 2000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function assertUsage(output) {
  for (const text of ['Usage', '--offline', 'DEMO_PAUSE', 'MOCK_PORT']) {
    assert.ok(output.includes(text), `missing ${text} in ${output}`);
  }
  assert.doesNotMatch(output, /Act [1-5]/);
}

for (const args of [['--offlin'], ['unexpected'], [''], ['--offline', 'extra'], ['--offline', '--offline'], ['--help', 'extra'], ['-h', '--offline']]) {
  test(`demo rejects arguments ${JSON.stringify(args)} before running any act`, () => {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.startsWith(`Unknown argument: ${args.length > 1 ? args[1] : args[0]}\n`));
    assertUsage(result.stderr);
  });
}

for (const flag of ['--help', '-h']) {
  test(`demo ${flag} prints usage without running any act`, () => {
    const result = run([flag]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assertUsage(result.stdout);
  });
}
