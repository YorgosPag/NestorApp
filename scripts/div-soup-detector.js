#!/usr/bin/env node

/**
 * 🔍 DIV-SOUP DETECTOR - ENTERPRISE AUTOMATED ANALYSIS
 *
 * Automated detection system για div-soup anti-patterns στο React codebase
 * Βασισμένο στα patterns που εντοπίσαμε κατά τη manual analysis
 *
 * Usage: node scripts/div-soup-detector.js [path]
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Thresholds για detection
  MAX_DIVS_PER_FILE: 15,
  MAX_NESTED_DIVS: 4,
  MAX_DIVS_PER_COMPONENT: 8,

  // File patterns να εξετάσουμε
  INCLUDE_PATTERNS: [
    'src/**/*.tsx',
    'src/**/*.jsx',
    '!src/**/*.test.tsx',
    '!src/**/*.stories.tsx',
    '!node_modules/**'
  ],

  // Semantic elements που προτιμούμε
  SEMANTIC_ELEMENTS: [
    'main', 'header', 'nav', 'section', 'article',
    'aside', 'footer', 'address', 'ul', 'ol', 'li'
  ],

  // Patterns που υποδηλώνουν semantic meaning
  SEMANTIC_PATTERNS: [
    /className.*header/i,
    /className.*nav/i,
    /className.*main/i,
    /className.*sidebar/i,
    /className.*content/i,
    /className.*card/i,
    /className.*list/i,
    /className.*item/i,
    /className.*contact/i,
    /className.*actions/i
  ]
};

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * 🔍 Count divs in file content
 */
function analyzeDivUsage(content, filePath) {
  const lines = content.split('\n');
  const divPattern = /<div[^>]*>/g;
  const closingDivPattern = /<\/div>/g;

  const divMatches = content.match(divPattern) || [];
  const closingDivMatches = content.match(closingDivPattern) || [];

  const analysis = {
    filePath,
    totalDivs: divMatches.length,
    divDensity: (divMatches.length / lines.length * 100).toFixed(2),
    issues: [],
    suggestions: [],
    severity: 'low'
  };

  // 🚨 HIGH SEVERITY: Excessive divs
  if (divMatches.length > CONFIG.MAX_DIVS_PER_FILE) {
    analysis.issues.push(`🔴 Excessive divs: ${divMatches.length} (max: ${CONFIG.MAX_DIVS_PER_FILE})`);
    analysis.severity = 'high';
  }

  // 🟡 MEDIUM SEVERITY: High div density
  if (analysis.divDensity > 20) {
    analysis.issues.push(`🟡 High div density: ${analysis.divDensity}% (>20% indicates potential div-soup)`);
    if (analysis.severity === 'low') analysis.severity = 'medium';
  }

  // 🔍 SEMANTIC ANALYSIS
  analyzeSemanticOpportunities(content, analysis);

  // 🏗️ NESTING ANALYSIS
  analyzeNestingDepth(content, analysis);

  return analysis;
}

/**
 * 🎯 Analyze semantic improvement opportunities
 */
function analyzeSemanticOpportunities(content, analysis) {
  const semanticOpportunities = [];

  CONFIG.SEMANTIC_PATTERNS.forEach(pattern => {
    const matches = content.match(new RegExp(`<div[^>]*${pattern.source}[^>]*>`, 'gi'));
    if (matches) {
      matches.forEach(match => {
        if (match.includes('header')) {
          semanticOpportunities.push('Consider <header> instead of div with header class');
        } else if (match.includes('nav')) {
          semanticOpportunities.push('Consider <nav> instead of div with nav class');
        } else if (match.includes('main')) {
          semanticOpportunities.push('Consider <main> instead of div with main class');
        } else if (match.includes('card')) {
          semanticOpportunities.push('Consider <article> instead of div with card class');
        } else if (match.includes('list')) {
          semanticOpportunities.push('Consider <ul> instead of div with list class');
        } else if (match.includes('contact')) {
          semanticOpportunities.push('Consider <address> instead of div with contact class');
        } else if (match.includes('actions')) {
          semanticOpportunities.push('Consider <nav> instead of div with actions class');
        }
      });
    }
  });

  if (semanticOpportunities.length > 0) {
    analysis.suggestions = semanticOpportunities;
    if (analysis.severity === 'low') analysis.severity = 'medium';
  }
}

/**
 * 🏗️ Analyze nesting depth
 */
function analyzeNestingDepth(content, analysis) {
  const lines = content.split('\n');
  let maxDepth = 0;
  let currentDepth = 0;
  let deepestLine = 0;

  lines.forEach((line, index) => {
    const openDivs = (line.match(/<div[^>]*>/g) || []).length;
    const closeDivs = (line.match(/<\/div>/g) || []).length;

    currentDepth += openDivs - closeDivs;

    if (currentDepth > maxDepth) {
      maxDepth = currentDepth;
      deepestLine = index + 1;
    }
  });

  if (maxDepth > CONFIG.MAX_NESTED_DIVS) {
    analysis.issues.push(`🟠 Deep nesting: ${maxDepth} levels at line ${deepestLine} (max: ${CONFIG.MAX_NESTED_DIVS})`);
    if (analysis.severity === 'low') analysis.severity = 'medium';
  }
}

/**
 * 📊 Generate summary statistics
 */
function generateSummary(results) {
  const summary = {
    totalFiles: results.length,
    filesWithIssues: results.filter(r => r.issues.length > 0).length,
    severityCounts: {
      high: results.filter(r => r.severity === 'high').length,
      medium: results.filter(r => r.severity === 'medium').length,
      low: results.filter(r => r.severity === 'low').length
    },
    totalDivs: results.reduce((sum, r) => sum + r.totalDivs, 0),
    averageDivDensity: (results.reduce((sum, r) => sum + parseFloat(r.divDensity), 0) / results.length).toFixed(2),
    mostProblematicFiles: results
      .filter(r => r.severity === 'high')
      .sort((a, b) => b.totalDivs - a.totalDivs)
      .slice(0, 5)
  };

  return summary;
}

/**
 * 🎨 Generate colored console output
 */
function generateReport(results, summary) {
  console.log('🔍 DIV-SOUP DETECTION REPORT');
  console.log('════════════════════════════════════════════════════════════════');
  console.log();

  // Summary statistics
  console.log('📊 SUMMARY STATISTICS:');
  console.log(`   📁 Total files analyzed: ${summary.totalFiles}`);
  console.log(`   ⚠️  Files with issues: ${summary.filesWithIssues}`);
  console.log(`   🔴 High severity: ${summary.severityCounts.high}`);
  console.log(`   🟡 Medium severity: ${summary.severityCounts.medium}`);
  console.log(`   🟢 Low/No issues: ${summary.severityCounts.low}`);
  console.log(`   📦 Total divs found: ${summary.totalDivs}`);
  console.log(`   📈 Average div density: ${summary.averageDivDensity}%`);
  console.log();

  // Most problematic files
  if (summary.mostProblematicFiles.length > 0) {
    console.log('🚨 MOST PROBLEMATIC FILES:');
    summary.mostProblematicFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${path.relative(process.cwd(), file.filePath)} (${file.totalDivs} divs, ${file.divDensity}% density)`);
    });
    console.log();
  }

  // Detailed issues
  const filesWithIssues = results.filter(r => r.issues.length > 0 || r.suggestions.length > 0);
  if (filesWithIssues.length > 0) {
    console.log('🔍 DETAILED ANALYSIS:');
    filesWithIssues.forEach(file => {
      const relativePath = path.relative(process.cwd(), file.filePath);
      const severityIcon = file.severity === 'high' ? '🔴' : file.severity === 'medium' ? '🟡' : '🟢';

      console.log(`\\n${severityIcon} ${relativePath} (${file.totalDivs} divs, ${file.divDensity}% density)`);

      if (file.issues.length > 0) {
        console.log('   Issues:');
        file.issues.forEach(issue => console.log(`     ${issue}`));
      }

      if (file.suggestions.length > 0) {
        console.log('   Suggestions:');
        file.suggestions.forEach(suggestion => console.log(`     💡 ${suggestion}`));
      }
    });
    console.log();
  }

  // Recommendations
  console.log('🎯 ENTERPRISE RECOMMENDATIONS:');
  if (summary.severityCounts.high > 0) {
    console.log('   1. 🚨 PRIORITY 1: Fix high-severity files immediately');
    console.log('   2. 📖 Review SEMANTIC_HTML_STYLE_GUIDE.md for best practices');
    console.log('   3. 🔄 Apply semantic element patterns from successful components');
  } else if (summary.severityCounts.medium > 0) {
    console.log('   1. ✨ PRIORITY 2: Progressive enhancement of medium-severity files');
    console.log('   2. 📋 Follow migration checklist from style guide');
  } else {
    console.log('   1. ✅ EXCELLENT: No critical div-soup detected!');
    console.log('   2. 🏆 Continue following semantic HTML best practices');
  }

  if (summary.averageDivDensity > 15) {
    console.log('   4. 📉 Focus on reducing overall div density across the codebase');
  }

  console.log();
  console.log('📚 See: src/docs/SEMANTIC_HTML_STYLE_GUIDE.md');
  console.log('════════════════════════════════════════════════════════════════');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const targetPath = process.argv[2] || 'src';

  console.log('🔍 Starting DIV-SOUP analysis...');
  console.log(`📂 Target path: ${targetPath}`);
  console.log();

  // Find all React files
  const files = glob.sync(CONFIG.INCLUDE_PATTERNS, {
    cwd: process.cwd(),
    ignore: ['node_modules/**', '**/*.test.*', '**/*.stories.*']
  });

  const results = [];

  for (const file of files) {
    if (file.includes(targetPath)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const analysis = analyzeDivUsage(content, file);
        results.push(analysis);
      } catch (error) {
        console.warn(`⚠️  Could not analyze ${file}: ${error.message}`);
      }
    }
  }

  // Generate summary and report
  const summary = generateSummary(results);
  generateReport(results, summary);

  // Exit with appropriate code
  const exitCode = summary.severityCounts.high > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  analyzeDivUsage,
  generateSummary,
  generateReport,
  CONFIG
};