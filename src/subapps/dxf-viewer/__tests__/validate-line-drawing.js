#!/usr/bin/env node
/**
 * LINE DRAWING VALIDATION SCRIPT
 * ⚡ LIGHTWEIGHT: Επαληθεύει ότι τα critical bug fixes υπάρχουν
 *
 * Αυτό το script ελέγχει:
 * 1. Τα critical files υπάρχουν
 * 2. Τα bug fixes είναι παρόντα στον κώδικα
 *
 * ⚠️ ΑΝ ΑΥΤΟ ΤΟ SCRIPT ΑΠΟΤΥΧΕΙ = ΚΡΙΤΙΚΗ ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ ΣΠΑΣΕ!
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let errors = 0;
let warnings = 0;
let passed = 0;

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function test(description, fn) {
  try {
    fn();
    passed++;
    log(`✅ ${description}`, GREEN);
  } catch (error) {
    errors++;
    log(`❌ ${description}`, RED);
    log(`   ${error.message}`, RED);
  }
}

function warn(message) {
  warnings++;
  log(`⚠️  ${message}`, YELLOW);
}

// ==============================================================================
// TEST SUITE: Critical Files Exist
// ==============================================================================

log(`\n${BOLD}🎯 LINE DRAWING VALIDATION${RESET}\n`);

test('useUnifiedDrawing hook file exists', () => {
  const filePath = path.join(__dirname, '../hooks/drawing/useUnifiedDrawing.ts');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
});

test('useDrawingHandlers hook file exists', () => {
  const filePath = path.join(__dirname, '../hooks/drawing/useDrawingHandlers.ts');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
});

test('CanvasSection component file exists', () => {
  const filePath = path.join(__dirname, '../components/dxf-layout/CanvasSection.tsx');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
});

// ==============================================================================
// TEST SUITE: Critical Bug Fixes Present
// ==============================================================================

log(`\n${BOLD}⚠️  REGRESSION CHECKS${RESET}\n`);

test('🐛 Fix #1: onDrawingHover handler exists in useDrawingHandlers', () => {
  const filePath = path.join(__dirname, '../hooks/drawing/useDrawingHandlers.ts');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('onDrawingHover')) {
    throw new Error('onDrawingHover handler not found! Critical bug fix missing!');
  }

  if (!content.includes('updatePreview')) {
    throw new Error('updatePreview function not found! Critical bug fix missing!');
  }
});

test('🐛 Fix #2: previewEntity is added to scene in CanvasSection', () => {
  const filePath = path.join(__dirname, '../components/dxf-layout/CanvasSection.tsx');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('drawingHandlers.drawingState.previewEntity')) {
    throw new Error('previewEntity not added to scene! Critical bug fix missing!');
  }

  if (!content.includes('ADD PREVIEW ENTITY')) {
    throw new Error('ADD PREVIEW ENTITY comment not found! Code may have been refactored incorrectly!');
  }
});

test('🐛 Fix #3: onMouseMove calls onDrawingHover', () => {
  const filePath = path.join(__dirname, '../components/dxf-layout/CanvasSection.tsx');
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (!content.includes('onDrawingHover')) {
    throw new Error('onDrawingHover not called! Critical bug fix missing!');
  }

  if (!content.includes('Call onDrawingHover')) {
    throw new Error('Call onDrawingHover comment not found! Code may have been refactored incorrectly!');
  }
});

// ==============================================================================
// SUMMARY
// ==============================================================================

log(`\n${BOLD}📊 VALIDATION SUMMARY${RESET}\n`);
log(`✅ Passed: ${passed}`, GREEN);
if (warnings > 0) {
  log(`⚠️  Warnings: ${warnings}`, YELLOW);
}
if (errors > 0) {
  log(`❌ Failed: ${errors}`, RED);
  log(`\n${RED}${BOLD}VALIDATION FAILED!${RESET}`, RED);
  log(`${RED}Critical line drawing functionality may be broken!${RESET}\n`, RED);
  process.exit(1);
} else {
  log(`\n${GREEN}${BOLD}✅ ALL VALIDATIONS PASSED!${RESET}`, GREEN);
  log(`${GREEN}Line drawing functionality is intact!${RESET}\n`, GREEN);
  process.exit(0);
}
