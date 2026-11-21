#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { table } from '../router/nim-route.mjs';

export function render(record) {
  const { settings } = record;
  const base = record.base.includes('://') ? new URL(record.base).host : record.base;
  const oneLine = (value) => String(value).replace(/[\r\n]+/g, ' ');
  return [`## ${record.date} (${base})`, '', 'Settings', '',
    `- Runs: ${settings.runs}`, `- Max tokens: ${settings.maxTokens}`,
    `- Temperature: ${settings.temperature}`, `- Concurrency: ${settings.concurrency}`,
    `- Prompt: ${oneLine(settings.prompt)}`, `- Node version: ${record.node}`, `- Platform: ${record.platform}`,
    '', table(record.results), ''].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length < 3) throw new Error('Usage: node scripts/render-results.mjs file.json [more.json ...]');
    for (const path of process.argv.slice(2)) console.log(render(JSON.parse(await readFile(path, 'utf8'))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
