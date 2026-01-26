#!/usr/bin/env node
/**
 * =============================================================================
 * ENTERPRISE: Console to Logger Migration Script
 * =============================================================================
 *
 * @enterprise SAP/Salesforce/Microsoft Pattern - Structured Logging Migration
 *
 * USAGE:
 *   node scripts/migrate-console-to-logger.js [options]
 *
 * OPTIONS:
 *   --dry-run       Show what would be changed without modifying files
 *   --file <path>   Migrate a specific file
 *   --dir <path>    Migrate all files in a directory
 *   --report        Generate a migration report
 *
 * EXAMPLES:
 *   node scripts/migrate-console-to-logger.js --dry-run --dir src/components
 *   node scripts/migrate-console-to-logger.js --file src/components/NotificationDrawer.tsx
 *   node scripts/migrate-console-to-logger.js --report
 *
 * @see src/lib/telemetry/Logger.ts - Canonical Logger implementation
 * @see eslint-rules/no-console-log.js - ESLint rule
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  srcDir: path.join(__dirname, '..', 'src'),
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  excludeDirs: ['node_modules', '.next', 'dist', '__tests__', 'test', 'spec'],
  excludeFiles: [
    'Logger.ts',           // Logger itself uses console
    'suppress-console.js', // Console suppression
  ],
};

// Console method mappings
const CONSOLE_TO_LOGGER = {
  'console.log': 'logger.debug',
  'console.info': 'logger.info',
  'console.warn': 'logger.warn',
  'console.debug': 'logger.debug',
  // console.error stays as is (for critical errors)
};

/**
 * Extract module name from file path
 */
function getModuleName(filePath) {
  const parts = filePath.split(path.sep);
  const srcIndex = parts.indexOf('src');

  if (srcIndex >= 0 && srcIndex < parts.length - 1) {
    const fileName = parts[parts.length - 1];
    const name = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');

    return name
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]/g, '_')
      .toUpperCase();
  }

  return 'MODULE';
}

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath) {
  const fileName = path.basename(filePath);

  if (CONFIG.excludeFiles.includes(fileName)) {
    return true;
  }

  for (const dir of CONFIG.excludeDirs) {
    if (filePath.includes(path.sep + dir + path.sep)) {
      return true;
    }
  }

  return false;
}

/**
 * Count console calls in a file
 */
function countConsoleCalls(content) {
  const counts = {
    log: 0,
    info: 0,
    warn: 0,
    debug: 0,
    error: 0,
    total: 0,
  };

  const patterns = [
    { method: 'log', regex: /console\.log\s*\(/g },
    { method: 'info', regex: /console\.info\s*\(/g },
    { method: 'warn', regex: /console\.warn\s*\(/g },
    { method: 'debug', regex: /console\.debug\s*\(/g },
    { method: 'error', regex: /console\.error\s*\(/g },
  ];

  for (const { method, regex } of patterns) {
    const matches = content.match(regex) || [];
    counts[method] = matches.length;
    counts.total += matches.length;
  }

  return counts;
}

/**
 * Generate migration for a file (dry-run)
 */
function analyzeMigration(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const counts = countConsoleCalls(content);

  if (counts.total === 0) {
    return null;
  }

  const moduleName = getModuleName(filePath);
  const relativePath = path.relative(CONFIG.srcDir, filePath);

  return {
    file: relativePath,
    moduleName,
    counts,
    hasLoggerImport: content.includes('@/lib/telemetry'),
    lines: content.split('\n').length,
  };
}

/**
 * Recursively find all files
 */
function findFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!CONFIG.excludeDirs.includes(item)) {
        findFiles(fullPath, files);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item);
      if (CONFIG.extensions.includes(ext) && !shouldExclude(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Generate full report
 */
function generateReport() {
  console.log('🔍 Scanning for console calls...\n');

  const files = findFiles(CONFIG.srcDir);
  const results = [];
  let totalCalls = 0;

  for (const file of files) {
    const analysis = analyzeMigration(file);
    if (analysis) {
      results.push(analysis);
      totalCalls += analysis.counts.total;
    }
  }

  // Sort by total calls (descending)
  results.sort((a, b) => b.counts.total - a.counts.total);

  // Print summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ENTERPRISE CONSOLE MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`📊 SUMMARY:`);
  console.log(`   Total files with console calls: ${results.length}`);
  console.log(`   Total console calls: ${totalCalls}`);
  console.log(`   Files already using Logger: ${results.filter(r => r.hasLoggerImport).length}\n`);

  console.log('📋 BREAKDOWN BY METHOD:');
  const totals = { log: 0, info: 0, warn: 0, debug: 0, error: 0 };
  for (const r of results) {
    totals.log += r.counts.log;
    totals.info += r.counts.info;
    totals.warn += r.counts.warn;
    totals.debug += r.counts.debug;
    totals.error += r.counts.error;
  }
  console.log(`   console.log:   ${totals.log} → logger.debug/info`);
  console.log(`   console.info:  ${totals.info} → logger.info`);
  console.log(`   console.warn:  ${totals.warn} → logger.warn`);
  console.log(`   console.debug: ${totals.debug} → logger.debug`);
  console.log(`   console.error: ${totals.error} (keep as is for critical errors)\n`);

  console.log('📁 TOP 20 FILES BY CONSOLE CALLS:');
  console.log('─────────────────────────────────────────────────────────────────');
  for (const r of results.slice(0, 20)) {
    const loggerIcon = r.hasLoggerImport ? '✅' : '❌';
    console.log(`   ${loggerIcon} [${r.counts.total.toString().padStart(3)}] ${r.file}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION STRATEGY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('1️⃣  PHASE 1: ESLint Rule (DONE)');
  console.log('    - custom/no-console-log rule active (warn mode)');
  console.log('    - All new code must use Logger\n');

  console.log('2️⃣  PHASE 2: Migrate on Touch');
  console.log('    - When editing a file, migrate console to Logger');
  console.log('    - Run: npx eslint --fix path/to/file.tsx\n');

  console.log('3️⃣  PHASE 3: Bulk Migration (optional)');
  console.log('    - Use this script with --file or --dir options');
  console.log('    - Manual review required\n');

  console.log('📝 LOGGER USAGE:');
  console.log(`   import { createModuleLogger } from '@/lib/telemetry';`);
  console.log(`   const logger = createModuleLogger('MODULE_NAME');`);
  console.log(`   logger.info('message', { metadata });`);

  return results;
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--report') || args.length === 0) {
  generateReport();
} else if (args.includes('--help')) {
  console.log(`
ENTERPRISE: Console to Logger Migration Script

USAGE:
  node scripts/migrate-console-to-logger.js [options]

OPTIONS:
  --report        Generate a migration report (default)
  --dry-run       Show what would be changed
  --help          Show this help message

EXAMPLES:
  node scripts/migrate-console-to-logger.js --report
  `);
} else {
  console.log('Use --report to generate migration report');
}
