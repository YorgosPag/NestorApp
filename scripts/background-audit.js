#!/usr/bin/env node

/**
 * ============================================================================
 * 🔍 ENTERPRISE BACKGROUND CENTRALIZATION AUDIT SCRIPT
 * ============================================================================
 *
 * AGENT_D Quality Assurance Tool
 *
 * Purpose: Automated detection and reporting of background centralization violations
 * Usage: node scripts/background-audit.js
 * Output: Detailed report of remaining hardcoded patterns and migration progress
 *
 * Standards: Fortune 500 software quality assurance methodology
 *
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// 🎯 AUDIT CONFIGURATION
// ============================================================================

const AUDIT_CONFIG = {
  // Directories to scan
  scanPaths: [
    'src/components',
    'src/hooks',
    'src/subapps',
    'src/features',
    'packages'
  ],

  // File patterns to include
  includePatterns: ['*.tsx', '*.ts', '*.jsx', '*.js'],

  // Hardcoded background patterns to detect
  hardcodedPatterns: [
    'bg-white',
    'bg-gray-50', 'bg-gray-100', 'bg-gray-200', 'bg-gray-800', 'bg-gray-900',
    'bg-slate-50', 'bg-slate-100', 'bg-slate-200', 'bg-slate-800', 'bg-slate-900',
    'bg-blue-50', 'bg-blue-100', 'bg-blue-500', 'bg-blue-600', 'bg-blue-800', 'bg-blue-900',
    'bg-green-50', 'bg-green-100', 'bg-green-500', 'bg-green-600', 'bg-green-800',
    'bg-red-50', 'bg-red-100', 'bg-red-500', 'bg-red-600', 'bg-red-800',
    'bg-yellow-50', 'bg-yellow-100', 'bg-yellow-500', 'bg-yellow-600',
    'bg-orange-50', 'bg-orange-100', 'bg-orange-500',
    'bg-purple-50', 'bg-purple-100', 'bg-purple-500',
    'bg-indigo-50', 'bg-indigo-100', 'bg-indigo-500',
    'bg-pink-50', 'bg-pink-100', 'bg-pink-500'
  ],

  // Inline style patterns
  inlineStylePatterns: [
    'backgroundColor:',
    'style={{.*background',
    'style=".*background'
  ],

  // Approved centralized patterns (should INCREASE over time)
  centralizedPatterns: [
    'useSemanticColors',
    'useBackgroundTokens',
    'hsl(var(--bg-',
    'bg-\\[hsl\\(var\\(--bg-'
  ],

  // Exclude directories
  excludePaths: [
    'node_modules',
    '.next',
    'dist',
    '.git',
    '__tests__',
    'coverage'
  ]
};

// ============================================================================
// 🔍 AUDIT EXECUTION FUNCTIONS
// ============================================================================

/**
 * Execute grep search for patterns
 */
function searchForPatterns(patterns, type) {
  const results = [];

  for (const pattern of patterns) {
    try {
      const grepCommand = `grep -r -n --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" "${pattern}" src/ packages/ 2>/dev/null || true`;
      const output = execSync(grepCommand, { encoding: 'utf8' });

      if (output.trim()) {
        const matches = output.trim().split('\n').map(line => {
          const [file, lineNumber, content] = line.split(':', 3);
          return {
            file: file.trim(),
            lineNumber: parseInt(lineNumber),
            content: content.trim(),
            pattern,
            type
          };
        });
        results.push(...matches);
      }
    } catch (error) {
      // Grep returns non-zero exit code when no matches found - this is expected
      console.log(`No matches found for pattern: ${pattern}`);
    }
  }

  return results;
}

/**
 * Analyze file for multiple pattern violations
 */
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const violations = [];

    // Check for hardcoded patterns
    AUDIT_CONFIG.hardcodedPatterns.forEach(pattern => {
      const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      const matches = [...content.matchAll(regex)];

      matches.forEach(match => {
        const lines = content.substring(0, match.index).split('\n');
        violations.push({
          file: filePath,
          lineNumber: lines.length,
          pattern,
          type: 'hardcoded_background',
          context: lines[lines.length - 1].trim()
        });
      });
    });

    // Check for inline styles
    AUDIT_CONFIG.inlineStylePatterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'gi');
      const matches = [...content.matchAll(regex)];

      matches.forEach(match => {
        const lines = content.substring(0, match.index).split('\n');
        violations.push({
          file: filePath,
          lineNumber: lines.length,
          pattern,
          type: 'inline_style',
          context: lines[lines.length - 1].trim()
        });
      });
    });

    return violations;
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Generate audit report
 */
function generateAuditReport(violations, centralizedUsage) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalViolations: violations.length,
      filesByType: {},
      patternsByType: {},
      centralizedUsage: centralizedUsage.length
    },
    violations: violations,
    centralizedUsage: centralizedUsage,
    recommendations: []
  };

  // Group violations by type
  violations.forEach(violation => {
    if (!report.summary.filesByType[violation.type]) {
      report.summary.filesByType[violation.type] = new Set();
      report.summary.patternsByType[violation.type] = {};
    }

    report.summary.filesByType[violation.type].add(violation.file);

    if (!report.summary.patternsByType[violation.type][violation.pattern]) {
      report.summary.patternsByType[violation.type][violation.pattern] = 0;
    }
    report.summary.patternsByType[violation.type][violation.pattern]++;
  });

  // Convert Sets to arrays for JSON serialization
  Object.keys(report.summary.filesByType).forEach(type => {
    report.summary.filesByType[type] = Array.from(report.summary.filesByType[type]).length;
  });

  // Generate recommendations
  if (violations.length > 0) {
    report.recommendations.push({
      priority: 'HIGH',
      action: 'Migrate hardcoded bg- classes to useSemanticColors() hook',
      affectedFiles: violations.filter(v => v.type === 'hardcoded_background').length
    });
  }

  if (centralizedUsage.length < 10) {
    report.recommendations.push({
      priority: 'MEDIUM',
      action: 'Increase usage of centralized background systems',
      currentUsage: centralizedUsage.length,
      target: 50
    });
  }

  return report;
}

// ============================================================================
// 🎯 MAIN AUDIT EXECUTION
// ============================================================================

async function runBackgroundAudit() {
  console.log('🔍 ENTERPRISE BACKGROUND CENTRALIZATION AUDIT');
  console.log('='.repeat(50));
  console.log(`🕐 Started at: ${new Date().toLocaleString()}`);
  console.log('');

  // Step 1: Search for hardcoded background patterns
  console.log('📊 Detecting hardcoded background patterns...');
  const hardcodedViolations = searchForPatterns(AUDIT_CONFIG.hardcodedPatterns, 'hardcoded_background');

  // Step 2: Search for inline style patterns
  console.log('🎨 Detecting inline background styles...');
  const inlineStyleViolations = searchForPatterns(AUDIT_CONFIG.inlineStylePatterns, 'inline_style');

  // Step 3: Search for centralized pattern usage
  console.log('✅ Detecting centralized pattern usage...');
  const centralizedUsage = searchForPatterns(AUDIT_CONFIG.centralizedPatterns, 'centralized');

  // Combine all violations
  const allViolations = [...hardcodedViolations, ...inlineStyleViolations];

  // Step 4: Generate comprehensive report
  console.log('📋 Generating audit report...');
  const auditReport = generateAuditReport(allViolations, centralizedUsage);

  // Step 5: Display summary
  console.log('');
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(30));
  console.log(`🚨 Total Violations: ${auditReport.summary.totalViolations}`);
  console.log(`✅ Centralized Usage: ${auditReport.summary.centralizedUsage}`);
  console.log('');

  if (auditReport.summary.filesByType.hardcoded_background) {
    console.log(`🎯 Hardcoded Background Files: ${auditReport.summary.filesByType.hardcoded_background}`);
  }

  if (auditReport.summary.filesByType.inline_style) {
    console.log(`🎨 Inline Style Files: ${auditReport.summary.filesByType.inline_style}`);
  }

  // Step 6: Show top violation patterns
  console.log('');
  console.log('🔥 TOP VIOLATION PATTERNS:');
  if (auditReport.summary.patternsByType.hardcoded_background) {
    Object.entries(auditReport.summary.patternsByType.hardcoded_background)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([pattern, count]) => {
        console.log(`   ${pattern}: ${count} instances`);
      });
  }

  // Step 7: Save detailed report
  const reportPath = `background-audit-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2));
  console.log('');
  console.log(`📄 Detailed report saved: ${reportPath}`);

  // Step 8: Exit with appropriate code
  if (auditReport.summary.totalViolations > 0) {
    console.log('');
    console.log('🚨 AUDIT FAILED: Background centralization violations detected!');
    console.log('🎯 ACTION REQUIRED: Run migration scripts to fix violations');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ AUDIT PASSED: All backgrounds are properly centralized!');
    process.exit(0);
  }
}

// ============================================================================
// 🚀 SCRIPT EXECUTION
// ============================================================================

if (require.main === module) {
  runBackgroundAudit().catch(error => {
    console.error('❌ Audit script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  runBackgroundAudit,
  searchForPatterns,
  analyzeFile,
  generateAuditReport,
  AUDIT_CONFIG
};