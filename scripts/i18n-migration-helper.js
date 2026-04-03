#!/usr/bin/env node

const path = require('path');

const {
  ROOT_DIR,
  readText,
  scanHardcodedStringPatterns,
} = require('./_shared/i18n-governance');

function resolveTargetFile() {
  const fileFlagIndex = process.argv.findIndex((arg) => arg === '--file');
  if (fileFlagIndex === -1) {
    return null;
  }

  const value = process.argv[fileFlagIndex + 1];
  if (!value) {
    return null;
  }

  return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
}

function main() {
  const targetFile = resolveTargetFile();

  if (!targetFile) {
    const findings = scanHardcodedStringPatterns();
    const defaultValueCount = findings.filter((finding) => finding.kind === 'defaultValue').length;
    const toastCount = findings.filter((finding) => finding.kind === 'toast-call').length;

    console.log('i18n migration helper summary');
    console.log(`- hardcoded defaultValue findings: ${defaultValueCount}`);
    console.log(`- raw toast string findings: ${toastCount}`);
    console.log('Use --file <path> for a per-file summary.');
    return;
  }

  const source = readText(targetFile);
  const defaultValueMatches = source.match(/defaultValue\s*:/g) ?? [];
  const namespaceMatches = source.match(/t\(\s*['"`]([a-z0-9-]+):/gi) ?? [];

  console.log(`Migration summary for ${path.relative(ROOT_DIR, targetFile).replace(/\\/g, '/')}`);
  console.log(`- defaultValue occurrences: ${defaultValueMatches.length}`);
  console.log(`- explicit namespace t() calls: ${namespaceMatches.length}`);
}

main();
