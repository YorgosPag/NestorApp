const fs = require('fs');
const path = require('path');

/**
 * MAGNIFIER ICON REPLACEMENT SCRIPT
 * Replaces 🔍 (magnifying glass) with 🔹 (blue diamond) across all files
 * This eliminates another common icon making the codebase unique
 */

const DXF_VIEWER_ROOT = path.join(__dirname, '..');

let totalFilesProcessed = 0;
let totalReplacements = 0;

function replaceIconInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Count occurrences before replacement
    const matches = content.match(/🔍/g);
    const replacementCount = matches ? matches.length : 0;

    if (replacementCount === 0) {
      return 0;
    }

    // Replace all 🔍 with 🔹
    const updatedContent = content.replace(/🔍/g, '🔹');

    // Write back to file
    fs.writeFileSync(filePath, updatedContent, 'utf8');

    console.log(`✨ UPDATED: ${filePath} (${replacementCount} replacements)`);
    totalReplacements += replacementCount;
    return replacementCount;

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
      if (['node_modules', '.git', '.next', 'dist', 'build', 'scripts'].includes(item)) {
        return;
      }
      processDirectory(fullPath);
    } else if (stat.isFile()) {
      // Process all text files
      if (item.endsWith('.ts') || item.endsWith('.tsx') ||
          item.endsWith('.js') || item.endsWith('.jsx') ||
          item.endsWith('.md') || item.endsWith('.txt') ||
          item.endsWith('.json')) {
        replaceIconInFile(fullPath);
        totalFilesProcessed++;
      }
    }
  });
}

console.log('🔹 Starting MAGNIFIER REPLACEMENT: 🔍 → 🔹');
console.log(`📂 Processing directory: ${DXF_VIEWER_ROOT}`);
console.log('🧹 Eliminating another common icon for unique codebase!');
console.log('');

processDirectory(DXF_VIEWER_ROOT);

console.log('');
console.log('✅ MAGNIFIER REPLACEMENT COMPLETE!');
console.log(`📊 Files processed: ${totalFilesProcessed}`);
console.log(`🔹 Total replacements: ${totalReplacements}`);
console.log('');
console.log('🎨 Icon Portfolio Summary:');
console.log('   🔺 = Precision/Targeting (replaced 🎯)');
console.log('   🔹 = Investigation/Details (replaced 🔍)');
console.log('');
console.log('🚀 Your codebase now has COMPLETELY UNIQUE iconography!');