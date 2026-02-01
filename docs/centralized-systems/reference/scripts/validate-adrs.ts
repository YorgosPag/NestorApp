/**
 * ADR Validation Script
 *
 * Validates that all ADR files follow the standard template and that the index is in sync.
 * Use this in CI to ensure ADR consistency.
 *
 * Usage: npx ts-node docs/centralized-systems/reference/scripts/validate-adrs.ts
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @date 2026-02-01
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const ADRS_FOLDER = path.join(__dirname, '..', 'adrs');
const ADR_INDEX_PATH = path.join(__dirname, '..', 'adr-index.md');

// Required metadata fields
const REQUIRED_FIELDS = ['Status', 'Date', 'Category'];

// Valid statuses
const VALID_STATUSES = [
  'APPROVED',
  'IMPLEMENTED',
  'COMPLETED',
  'PLANNING',
  'DEPRECATED',
  'SUPERSEDED',
];

// Valid categories
const VALID_CATEGORIES = [
  'UI Components',
  'Design System',
  'Canvas & Rendering',
  'Data & State',
  'Drawing System',
  'Security & Auth',
  'Backend Systems',
  'Infrastructure',
  'Performance',
  'Tools & Keyboard',
  'Entity Systems',
  'Filters & Search',
];

// =============================================================================
// TYPES
// =============================================================================

interface ValidationError {
  file: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  fileCount: number;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate ADR filename format
 */
function validateFilename(filename: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Should start with ADR-
  if (!filename.match(/^ADR-/i)) {
    errors.push({
      file: filename,
      message: 'Filename should start with "ADR-"',
      severity: 'error',
    });
  }

  // Should have a slug after the ID
  if (!filename.match(/^ADR-[\w.-]+-[\w-]+\.md$/i)) {
    errors.push({
      file: filename,
      message: 'Filename should follow pattern: ADR-NNN-short-description.md',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validate ADR content structure
 */
function validateContent(content: string, filename: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for title header
  const titleMatch = content.match(/^#\s*(ADR-[\w.-]+):\s*(.+)$/m);
  if (!titleMatch) {
    errors.push({
      file: filename,
      message: 'Missing or malformed title header (expected: # ADR-NNN: Title)',
      severity: 'error',
    });
  }

  // Check for metadata table
  if (!content.includes('| Metadata | Value |')) {
    errors.push({
      file: filename,
      message: 'Missing metadata table',
      severity: 'error',
    });
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    const fieldRegex = new RegExp(`\\|\\s*\\*\\*${field}\\*\\*\\s*\\|`, 'i');
    if (!fieldRegex.test(content)) {
      errors.push({
        file: filename,
        message: `Missing required field: ${field}`,
        severity: 'error',
      });
    }
  }

  // Validate status
  const statusMatch = content.match(/\|\s*\*\*Status\*\*\s*\|\s*([^|]+)\|/);
  if (statusMatch) {
    const status = statusMatch[1].trim().toUpperCase();
    if (!VALID_STATUSES.some(s => status.includes(s))) {
      errors.push({
        file: filename,
        message: `Invalid status: "${statusMatch[1].trim()}" (valid: ${VALID_STATUSES.join(', ')})`,
        severity: 'warning',
      });
    }
  }

  // Validate category
  const categoryMatch = content.match(/\|\s*\*\*Category\*\*\s*\|\s*([^|]+)\|/);
  if (categoryMatch) {
    const category = categoryMatch[1].trim();
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push({
        file: filename,
        message: `Unknown category: "${category}" (valid: ${VALID_CATEGORIES.join(', ')})`,
        severity: 'warning',
      });
    }
  }

  // Validate date format
  const dateMatch = content.match(/\|\s*\*\*Date\*\*\s*\|\s*([^|]+)\|/);
  if (dateMatch) {
    const date = dateMatch[1].trim();
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      errors.push({
        file: filename,
        message: `Invalid date format: "${date}" (expected: YYYY-MM-DD)`,
        severity: 'error',
      });
    }
  }

  // Check for horizontal rule separator
  if (!content.includes('---')) {
    errors.push({
      file: filename,
      message: 'Missing horizontal rule separator (---)',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validate index file contains all ADRs
 */
function validateIndex(adrFiles: string[]): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!fs.existsSync(ADR_INDEX_PATH)) {
    errors.push({
      file: 'adr-index.md',
      message: 'Index file not found',
      severity: 'error',
    });
    return errors;
  }

  const indexContent = fs.readFileSync(ADR_INDEX_PATH, 'utf-8');

  // Check each ADR file is linked in the index
  for (const file of adrFiles) {
    if (file.startsWith('_')) continue; // Skip template

    const linkPattern = `./adrs/${file}`;
    if (!indexContent.includes(linkPattern)) {
      errors.push({
        file: 'adr-index.md',
        message: `Missing link to: ${file}`,
        severity: 'warning',
      });
    }
  }

  // Check if index is auto-generated
  if (!indexContent.includes('AUTO-GENERATED FILE')) {
    errors.push({
      file: 'adr-index.md',
      message: 'Index file may be manually edited (missing AUTO-GENERATED marker)',
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Check for duplicate ADR IDs
 */
function checkDuplicates(adrFiles: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const idMap = new Map<string, string[]>();

  for (const file of adrFiles) {
    if (file.startsWith('_')) continue;

    // Extract ID from filename
    const idMatch = file.match(/^(ADR-[\w.-]+)/i);
    if (idMatch) {
      const id = idMatch[1].toUpperCase();
      const existing = idMap.get(id) || [];
      existing.push(file);
      idMap.set(id, existing);
    }
  }

  // Find duplicates
  for (const [id, files] of idMap) {
    if (files.length > 1) {
      errors.push({
        file: files.join(', '),
        message: `Duplicate ADR ID: ${id}`,
        severity: 'error',
      });
    }
  }

  return errors;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('📋 ADR Validation Script');
  console.log('========================\n');

  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    fileCount: 0,
  };

  // Check if adrs folder exists
  if (!fs.existsSync(ADRS_FOLDER)) {
    console.error(`❌ ADRS folder not found: ${ADRS_FOLDER}`);
    process.exit(1);
  }

  // Read all ADR files
  const files = fs.readdirSync(ADRS_FOLDER).filter(f => f.endsWith('.md'));
  result.fileCount = files.filter(f => !f.startsWith('_')).length;
  console.log(`📁 Found ${result.fileCount} ADR files\n`);

  // Validate each file
  for (const file of files) {
    if (file.startsWith('_')) continue; // Skip template

    const filepath = path.join(ADRS_FOLDER, file);
    const content = fs.readFileSync(filepath, 'utf-8');

    // Filename validation
    const filenameErrors = validateFilename(file);

    // Content validation
    const contentErrors = validateContent(content, file);

    // Collect errors
    for (const error of [...filenameErrors, ...contentErrors]) {
      if (error.severity === 'error') {
        result.errors.push(error);
        result.valid = false;
      } else {
        result.warnings.push(error);
      }
    }
  }

  // Check for duplicates
  const duplicateErrors = checkDuplicates(files);
  for (const error of duplicateErrors) {
    if (error.severity === 'error') {
      result.errors.push(error);
      result.valid = false;
    }
  }

  // Validate index
  const indexErrors = validateIndex(files);
  for (const error of indexErrors) {
    if (error.severity === 'error') {
      result.errors.push(error);
      result.valid = false;
    } else {
      result.warnings.push(error);
    }
  }

  // Print results
  console.log('📊 Validation Results');
  console.log('---------------------\n');

  if (result.errors.length > 0) {
    console.log('❌ ERRORS:');
    for (const error of result.errors) {
      console.log(`   [${error.file}] ${error.message}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('⚠️ WARNINGS:');
    for (const warning of result.warnings) {
      console.log(`   [${warning.file}] ${warning.message}`);
    }
    console.log('');
  }

  // Summary
  console.log('---------------------');
  console.log(`📊 Files checked: ${result.fileCount}`);
  console.log(`❌ Errors: ${result.errors.length}`);
  console.log(`⚠️ Warnings: ${result.warnings.length}`);
  console.log(`${result.valid ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED'}`);

  // Exit with appropriate code
  process.exit(result.valid ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
