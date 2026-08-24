#!/usr/bin/env node
/**
 * File-size linter for gym-front. Enforces the ceilings documented in
 * ARCHITECTURE.md §2. Runs as `npm run lint:size` — invoked by CI.
 *
 * Exit codes: 0 = clean, 1 = at least one FAIL, 2 = warnings only.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const RULES = [
  { match: /\.service\.ts$/,                     warn: 120, fail: 180, kind: 'service' },
  { match: /\.store\.ts$/,                       warn: 120, fail: 180, kind: 'store' },
  { match: /\.api\.ts$/,                         warn: 120, fail: 180, kind: 'api' },
  { match: /\.page\.ts$/,                        warn: 180, fail: 250, kind: 'page component' },
  { match: /\.component\.ts$/,                   warn: 180, fail: 250, kind: 'component' },
  { match: /\.routes\.ts$/,                      warn: 60,  fail: 100, kind: 'routes' },
  { match: /\.guard\.ts$/,                       warn: 80,  fail: 120, kind: 'guard' },
  { match: /\.interceptor\.ts$/,                 warn: 100, fail: 150, kind: 'interceptor' },
  { match: /\.util\.ts$|\.utils\.ts$/,           warn: 150, fail: 200, kind: 'util' },
  { match: /\.(scss|css)$/,                      warn: 300, fail: 500, kind: 'stylesheet' },
];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.angular', 'ios', 'android'].includes(entry.name)) continue;
      out.push(...await walk(p));
    } else if (entry.isFile() && ['.ts', '.scss', '.css'].includes(extname(entry.name))) {
      out.push(p);
    }
  }
  return out;
}

function countLines(text) {
  // Skip blank lines and single-line comment-only lines from the LOC total.
  return text.split('\n').filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('//') && !t.startsWith('*') && t !== '/**' && t !== '*/';
  }).length;
}

const files = await walk(ROOT);
let fail = 0, warn = 0;

for (const file of files) {
  const rule = RULES.find((r) => r.match.test(file));
  if (!rule) continue;
  const text = await readFile(file, 'utf8');
  const loc = countLines(text);
  const rel = relative(process.cwd(), file);
  if (loc >= rule.fail) {
    console.error(`\x1b[31mFAIL\x1b[0m ${rel}: ${loc} LOC (${rule.kind} limit ${rule.fail}) — SPLIT NOW`);
    fail++;
  } else if (loc >= rule.warn) {
    console.warn(`\x1b[33mWARN\x1b[0m ${rel}: ${loc} LOC (${rule.kind} warn ${rule.warn}) — plan the split`);
    warn++;
  }
}

if (fail > 0) {
  console.error(`\n${fail} FAIL, ${warn} WARN — see ARCHITECTURE.md §2`);
  process.exit(1);
}
if (warn > 0) {
  console.log(`\n${warn} WARN — see ARCHITECTURE.md §2`);
  process.exit(2);
}
console.log(`\x1b[32mAll ${files.length} files within size ceilings.\x1b[0m`);
