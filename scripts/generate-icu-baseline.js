#!/usr/bin/env node
/**
 * Generate ICU interpolation violations baseline
 * Scans locale files for {{variable}} (should be {variable} with i18next-icu)
 */
const fs = require('fs');
const path = require('path');

const pattern = /\{\{[a-zA-Z_]+\}\}/g;
const localeDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const files = {};
let total = 0;

// Scan el/ and en/ locale dirs
['el', 'en'].forEach(lang => {
  const langDir = path.join(localeDir, lang);
  if (!fs.existsSync(langDir)) return;

  fs.readdirSync(langDir).filter(f => f.endsWith('.json')).forEach(file => {
    const fullPath = path.join(langDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const relPath = `src/i18n/locales/${lang}/${file}`;
      files[relPath] = matches.length;
      total += matches.length;
    }
  });
});

const baseline = {
  _meta: {
    description: 'ICU interpolation violations baseline — {{var}} must be {var}',
    generated: new Date().toISOString().replace(/\.\d+Z/, 'Z'),
    totalViolations: total,
    totalFiles: Object.keys(files).length,
    rule: 'Counts can only decrease. New files = zero tolerance.'
  },
  files
};

fs.writeFileSync(
  path.join(__dirname, '..', '.icu-violations-baseline.json'),
  JSON.stringify(baseline, null, 2) + '\n'
);
console.log(`ICU baseline: ${total} violations in ${Object.keys(files).length} files`);
