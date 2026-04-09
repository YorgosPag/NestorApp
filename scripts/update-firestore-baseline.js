#!/usr/bin/env node
/**
 * Regenerates .firestore-companyid-baseline.json by scanning src/ for
 * Firestore query() calls with where() but without companyId.
 */
const { execSync } = require('child_process');
const fs = require('fs');

const files = execSync(
  'find src -type f \\( -name "*.ts" -o -name "*.tsx" \\) ! -path "*/__tests__/*" ! -path "*/node_modules/*" ! -name "*.test.*" ! -name "*.spec.*" ! -name "*.d.ts" ! -path "*/i18n/locales/*"',
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

const baseline = {};
let totalViolations = 0;
let totalFiles = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('query(') || !content.includes('where(')) continue;

  const lines = content.split('\n');
  let count = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes('query(')) continue;
    const block = lines.slice(i, i + 12).join('\n');
    if (block.includes('where(') && !block.includes('companyId')) {
      count++;
    }
  }

  if (count > 0) {
    const normalized = file.replace(/\\/g, '/');
    baseline[normalized] = count;
    totalViolations += count;
    totalFiles++;
  }
}

baseline['_meta'] = {
  description: 'Firestore queries without companyId filter — ratchet baseline',
  generated: new Date().toISOString().slice(0, 10),
  totalViolations,
  totalFiles,
};

fs.writeFileSync('.firestore-companyid-baseline.json', JSON.stringify(baseline, null, 2) + '\n');
console.log(`Baseline updated: ${totalViolations} violations in ${totalFiles} files`);
