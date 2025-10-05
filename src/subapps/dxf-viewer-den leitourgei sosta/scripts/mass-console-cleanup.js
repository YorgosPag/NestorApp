const fs = require('fs');
const path = require('path');

/**
 * MASS CONSOLE.LOG CLEANUP SCRIPT
 * Removes all console.log statements from TypeScript/JavaScript files
 * Keeps only console.error and console.warn for critical logging
 */

const DXF_VIEWER_ROOT = path.join(__dirname, '..');

// Files to skip (important logs should remain)
const SKIP_FILES = [
  'utils/OptimizedLogger.ts',
  'utils/devlog.ts',
  'utils/DebugManager.ts',
  'scripts/',
  '.md',
  '.json',
  'worker.ts' // Keep worker logs for debugging
];

// Patterns to match console.log (but not console.error/warn)
const CONSOLE_LOG_PATTERNS = [
  /console\.log\([^)]*\);?\s*$/gm,           // Simple console.log calls
  /console\.log\([^)]*\);\s*\/\/.*$/gm,      // With comments
  /if\s*\([^)]*\)\s*console\.log\([^)]*\);?\s*$/gm, // Conditional logs
  /\s*console\.log\([^)]*\);\s*$/gm,         // With indentation
  /.*console\.log\(`[^`]*`[^)]*\);?\s*$/gm,  // Template literals
];

// Enhanced pattern to catch more variations
const ENHANCED_PATTERNS = [
  /^\s*console\.log\([^;]*\);\s*$/gm,
  /^\s*if\s*\([^)]+\)\s*console\.log\([^;]*\);\s*$/gm,
  /^\s*\/\/\s*console\.log\([^;]*\);\s*$/gm, // Already commented
  /console\.log\([^)]*\);\s*\/\/.*$/gm,
];

let totalFilesProcessed = 0;
let totalLogsRemoved = 0;

function shouldSkipFile(filePath) {
  return SKIP_FILES.some(skipPattern => filePath.includes(skipPattern));
}

function cleanConsoleLogsFromFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return 0;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let cleanedContent = content;
    let logsRemoved = 0;

    // Apply all patterns
    ENHANCED_PATTERNS.forEach(pattern => {
      const matches = cleanedContent.match(pattern);
      if (matches) {
        logsRemoved += matches.length;
        cleanedContent = cleanedContent.replace(pattern, '');
      }
    });

    // Remove empty lines left by removed console.logs
    cleanedContent = cleanedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

    if (logsRemoved > 0) {
      fs.writeFileSync(filePath, cleanedContent, 'utf8');
      totalLogsRemoved += logsRemoved;
    }

    totalFilesProcessed++;
    return logsRemoved;

  } catch (error) {
    console.error(`❌ ERROR processing ${filePath}:`, error.message);
    return 0;
  }
}

function processDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);

  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip certain directories
      if (['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
        return;
      }
      processDirectory(fullPath);
    } else if (stat.isFile()) {
      // Process TypeScript and JavaScript files
      if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx')) {
        cleanConsoleLogsFromFile(fullPath);
      }
    }
  });
}
processDirectory(DXF_VIEWER_ROOT);