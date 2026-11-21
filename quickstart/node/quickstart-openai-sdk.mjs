// Install once: npm install openai
// Node >= 20. Run: node quickstart-openai-sdk.mjs
const base = (process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const key = process.env.NVIDIA_API_KEY || '';
async function main() {
  if (new URL(base).hostname === 'integrate.api.nvidia.com' && !key) {
    throw new Error('Set NVIDIA_API_KEY first. Get a free key at https://build.nvidia.com.');
  }
  const { default: OpenAI } = await import('openai').catch(() => {
    throw new Error('Install the official SDK first: npm install openai');
  });
  const client = new OpenAI({ apiKey: key || 'not-needed', baseURL: base,
    timeout: Number(process.env.NIM_TIMEOUT_SECONDS || 120) * 1000, maxRetries: 0 });
  const catalog = await client.models.list();
  const ids = catalog.data.map(model => model.id);
  const preferred = ['nvidia/nemotron-3.5-bolt-e4b', 'nvidia/nemotron-3.5-lightning-30b-a3b',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning'];
  const model = process.env.NIM_MODEL || preferred.find(id => ids.includes(id));
  if (!model) throw new Error(`Set NIM_MODEL to a chat model from /v1/models. Catalog: ${ids.slice(0, 8).join(', ')}`);
  const start = performance.now();
  let first;
  const stream = await client.chat.completions.create({ model,
    messages: [{ role: 'user', content: 'Say hello in one short sentence.' }], max_tokens: 512, stream: true });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    const token = delta?.content || delta?.reasoning_content || '';
    if (token) { first ??= performance.now(); process.stdout.write(token); }
  }
  if (first === undefined) throw new Error('No text returned. Try another chat model or raise max_tokens for reasoning models.');
  console.log(`\nmodel=${model} ttft_ms=${Math.round(first - start)} total_ms=${Math.round(performance.now() - start)}`);
}
main().catch(error => {
  if (error.status === 410) console.error(`410: ${error.error?.detail || 'Model reached end of life.'} Pick another model from /v1/models.`);
  else if (error.status === 401) console.error('401: Check NVIDIA_API_KEY or your server credentials.');
  else if (error.status === 429) console.error('429: Rate limit reached. Wait before trying again.');
  else if (error.status === 404) console.error('404: Model not found. Pick a chat model from /v1/models.');
  else if (error.status) console.error(`HTTP ${error.status}: Request failed. Check the server and model.`);
  else if (['APIConnectionError', 'APIConnectionTimeoutError', 'TypeError'].includes(error.name)) console.error('Request failed. Check NIM_BASE_URL, connectivity and NIM_TIMEOUT_SECONDS.');
  else console.error(error.message);
  process.exitCode = 1;
});
