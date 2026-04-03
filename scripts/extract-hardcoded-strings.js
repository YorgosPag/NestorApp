#!/usr/bin/env node

const path = require('path');

const {
  ROOT_DIR,
  scanHardcodedStringPatterns,
} = require('./_shared/i18n-governance');

function formatPath(filePath) {
  return path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
}

function main() {
  const failOnFindings = process.argv.includes('--fail-on-findings');
  const findings = scanHardcodedStringPatterns();
  const grouped = findings.reduce((acc, finding) => {
    const key = `${finding.kind}:${formatPath(finding.filePath)}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Hardcoded string audit findings: ${findings.length}`);

  Object.entries(grouped)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .forEach(([key, count]) => {
      console.log(`- ${key} (${count})`);
    });

  findings.slice(0, 50).forEach((finding) => {
    console.log(`${formatPath(finding.filePath)}:${finding.line} [${finding.kind}] ${finding.snippet}`);
  });

  if (failOnFindings && findings.length > 0) {
    process.exit(1);
  }
}

main();
