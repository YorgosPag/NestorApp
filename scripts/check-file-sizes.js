#!/usr/bin/env node
'use strict';
/**
 * CHECK 4 — File Size Limits (Google SRP)
 *
 * JS equivalent of the _check_file_sizes bash function that was previously
 * inlined in the pre-commit hook. Runs as a worker thread in run-checks-parallel.js.
 *
 * Blocks commit if any staged .ts/.tsx file exceeds its type-specific line limit.
 *
 * Limits (lines):
 *   Component (tsx in /components/ or /ui/)  500
 *   Hook (useXxx.ts)                         500
 *   Service (*.service.ts)                   500
 *   API Route (/api/[id]/route.ts)            300
 *   General                                  500
 *
 * Exempt (no limit): config, types, data, _registry, __tests__, docs, adrs,
 *   scripts/, i18n/locales/, -definitions, -schema, -constants,
 *   enterprise-id.service.ts, *.d.ts, *.test.*, *.spec.*, *.stories.*
 *
 * CLI:
 *   node scripts/check-file-sizes.js file1.ts file2.tsx ...
 *
 * Exit codes: 0 = pass, 1 = blocked.
 */

const fs   = require('fs');
const path = require('path');

const RED    = '\x1b[0;31m';
const GREEN  = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC     = '\x1b[0m';

// Exempt patterns — files matching any of these have no line limit.
// Mirrors the bash `get_max_lines` function in the original hook.
const EXEMPT_RE = new RegExp([
  /\.(config)\./,
  /\.d\.ts$/,
  /\.test\./,
  /\.spec\./,
  /\.stories\./,
  /\.qa\./,
  /(^|\/)scripts\//,
  /\/config\//,
  /\/types\//,
  /\/data\//,
  /\/_registry\//,
  /\/__tests__\//,
  /\/docs\//,
  /\/adrs\//,
  /\/i18n\/locales\//,
  /-definitions\./,
  /-schema/,
  /-constants/,
  /enterprise-id\.service\.ts/,
].map(r => r.source).join('|'));

function getLimit(filePath) {
  const f = filePath.replace(/\\/g, '/');
  if (EXEMPT_RE.test(f)) return 0;
  if (/\.tsx$/.test(f) && /(\/components\/|\/ui\/)/.test(f)) return 500;
  if (/\/use[A-Z][^/]*\.ts$/.test(f)) return 500;
  if (/\.service\.ts$/.test(f)) return 500;
  if (/\/api\/.*route\.ts$/.test(f)) return 300;
  return 500;
}

function getType(filePath) {
  const f = filePath.replace(/\\/g, '/');
  if (/\.tsx$/.test(f) && /(\/components\/|\/ui\/)/.test(f)) return 'Component';
  if (/\/use[A-Z][^/]*\.ts$/.test(f)) return 'Hook';
  if (/\.service\.ts$/.test(f)) return 'Service';
  if (/\/api\/.*route\.ts$/.test(f)) return 'API Route';
  return 'General';
}

const files = process.argv.slice(2).filter(Boolean);
const oversized = [];

for (const file of files) {
  if (!file || !fs.existsSync(file)) continue;
  const limit = getLimit(file);
  if (limit === 0) continue;
  const lineCount = fs.readFileSync(file, 'utf8').split('\n').length;
  if (lineCount > limit) {
    oversized.push({ file, lineCount, limit, type: getType(file) });
  }
}

if (oversized.length === 0) {
  console.log(`${GREEN}  ✅ File sizes OK${NC}`);
  process.exit(0);
}

console.log('');
console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}`);
console.log(`${RED}  🚫 COMMIT BLOCKED - File Size Exceeds Type-Specific Limit${NC}`);
console.log(`${RED}═══════════════════════════════════════════════════════════════${NC}`);
console.log('');
console.log(`${YELLOW}Limits: Component 500 | Hook 500 | Service 500 | API 300 | General 500${NC}`);
for (const { file, lineCount, limit, type } of oversized) {
  console.log(`  ❌ ${file} (${lineCount}/${limit} lines — ${type})`);
}
console.log('');
console.log(`${YELLOW}Fix: Split into smaller, focused modules (Single Responsibility).${NC}`);
console.log(`${YELLOW}Exempt: config/, types/, data/, tests, definitions, schemas, i18n${NC}`);
console.log('');
process.exit(1);
