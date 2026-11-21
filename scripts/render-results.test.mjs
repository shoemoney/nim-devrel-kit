import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from './render-results.mjs';

test('render includes date, host, settings and all result columns', () => {
  const output = render({ date: '2026-11-21T00:00:00Z', base: 'https://example.test/v1', node: 'v22.0.0', platform: 'linux',
    settings: { runs: 2, maxTokens: 64, temperature: 0.2, concurrency: 1, prompt: 'Hi\nthere' },
    results: [{ model: 'fixture', ok: 1, runs: 2, ttftMs: 10, ttftMinMs: 10, ttftMaxMs: 10,
      tokPerSec: 20, tokPerSecMin: 20, tokPerSecMax: 20, totalMs: 100, outTokens: 2,
      tokensEstimated: true, errors: [429] }] });
  assert.match(output, /## 2026-11-21T00:00:00Z \(example.test\)/);
  for (const setting of ['Runs: 2', 'Max tokens: 64', 'Temperature: 0.2', 'Concurrency: 1', 'Prompt: Hi there', 'Node version: v22.0.0', 'Platform: linux']) assert.ok(output.includes(setting));
  assert.match(output, /median total ms \| median out tokens \| errors/);
  assert.match(output, /fixture \| 1\/2 \| 10 \| 10 to 10 \| 20.0/);
  assert.match(output, /2.0 \(estimated\) \| 429/);
});
