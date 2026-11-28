import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

function run(command, args, base) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, NVIDIA_API_KEY: '', NIM_BASE_URL: base, NIM_MODEL: 'demo' } });
    let stdout = '', stderr = '';
    child.stdout.on('data', (part) => { stdout += part; });
    child.stderr.on('data', (part) => { stderr += part; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}
async function serve(t, status) {
  const s = http.createServer((req, res) => {
    res.writeHead(status);
    res.end(JSON.stringify(req.url === '/models' ? { data: [{ id: 'demo' }] } : { choices: [{ message: { content: 'hi' } }] }));
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  t.after(() => { s.closeAllConnections(); s.close(); });
  return `http://127.0.0.1:${s.address().port}`;
}
for (const status of [401, 403]) test(`Node and curl show credential guidance for HTTP ${status}`, async (t) => {
  const base = await serve(t, status);
  for (const [command, args] of [[process.execPath, ['quickstart/node/quickstart.mjs']], ['bash', ['quickstart/curl.sh']]]) {
    const out = await run(command, args, base);
    assert.equal(out.code, 1); assert.match(out.stderr, new RegExp(`^${status}: Check NVIDIA_API_KEY or your server credentials`));
  }
});
test('curl succeeds without auth headers on local server under nounset', async (t) => {
  const out = await run('bash', ['quickstart/curl.sh'], await serve(t, 200));
  assert.equal(out.code, 0); assert.match(out.stdout, /hi/);
  const source = await readFile('quickstart/curl.sh', 'utf8');
  assert.equal(source.match(/\$\{auth\[@\]\+"\$\{auth\[@\]\}"\}/g)?.length, 2);
});
for (const status of [401, 403]) test(`SDK quickstarts handle credential status ${status}`, async () => {
  // Replace only the dependency with an offline status-error stub.
  const source = await readFile('quickstart/node/quickstart-openai-sdk.mjs', 'utf8');
  const stubbed = source.replace("await import('openai')", `await Promise.resolve({ default: class OpenAI { constructor() { throw Object.assign(new Error('refused'), {status:${status}}); } } })`);
  const node = await run(process.execPath, ['--input-type=module', '-e', stubbed], 'http://offline/v1');
  assert.equal(node.code, 1); assert.match(node.stderr, new RegExp(`^${status}: Check NVIDIA_API_KEY or your server credentials`));
  const stub = `import sys,types,runpy
m=types.ModuleType("openai")
class APIStatusError(Exception):
    status_code=${status}
def OpenAI(**kwargs): raise APIStatusError()
m.OpenAI=OpenAI
m.APIStatusError=APIStatusError
sys.modules["openai"]=m
runpy.run_path("quickstart/python/quickstart.py",run_name="__main__")`;
  const python = await run('python3', ['-c', stub], 'http://offline/v1');
  assert.equal(python.code, 1); assert.match(python.stderr, new RegExp(`^${status}: Check NVIDIA_API_KEY or your server credentials`));
});
