const fs = require('fs');
const path = require('path');

// 🏢 ENTERPRISE ADMIN COLLECTIONS FIXER
// Fixes hardcoded collections in admin routes that use adminDb

const ADMIN_COLLECTION_MAPPINGS = {
  "adminDb.collection('floors')": "adminDb.collection(COLLECTIONS.FLOORS)",
  "adminDb.collection('buildings')": "adminDb.collection(COLLECTIONS.BUILDINGS)",
  "adminDb.collection('projects')": "adminDb.collection(COLLECTIONS.PROJECTS)",
  "adminDb.collection('units')": "adminDb.collection(COLLECTIONS.UNITS)",
  "adminDb.collection('contacts')": "adminDb.collection(COLLECTIONS.CONTACTS)",
  "adminDb.collection('communications')": "adminDb.collection(COLLECTIONS.COMMUNICATIONS)",
  "adminDb.collection('activities')": "adminDb.collection(COLLECTIONS.ACTIVITIES)",
  "adminDb.collection('tasks')": "adminDb.collection(COLLECTIONS.TASKS)",
  "adminDb.collection('system')": "adminDb.collection(COLLECTIONS.SYSTEM)"
};

// Import statement to add
const COLLECTIONS_IMPORT = "import { COLLECTIONS } from '@/config/firestore-collections';";

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let newContent = content;

    // Check if file needs COLLECTIONS import
    const needsCollectionsImport = Object.keys(ADMIN_COLLECTION_MAPPINGS).some(pattern =>
      content.includes(pattern.replace(/'/g, "'"))
    );

    // Add import if needed and not already present
    if (needsCollectionsImport && !content.includes('COLLECTIONS')) {
      // Find the last import statement
      const lines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, COLLECTIONS_IMPORT);
        newContent = lines.join('\n');
        modified = true;
        console.log(`✅ Added COLLECTIONS import to ${filePath}`);
      }
    }

    // Replace hardcoded admin collection calls
    Object.keys(ADMIN_COLLECTION_MAPPINGS).forEach(pattern => {
      const replacement = ADMIN_COLLECTION_MAPPINGS[pattern];

      if (newContent.includes(pattern)) {
        newContent = newContent.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
        modified = true;
        console.log(`✅ Replaced ${pattern} → ${replacement} in ${filePath}`);
      }
    });

    // Write back if modified
    if (modified) {
      fs.writeFileSync(filePath, newContent);
      return true;
    }

    return false;

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findAdminFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir);

    entries.forEach(entry => {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findAdminFiles(fullPath));
      } else if ((entry.endsWith('.ts') || entry.endsWith('.tsx')) && fullPath.includes('/api/')) {
        files.push(fullPath);
      }
    });

  } catch (error) {
    console.error(`❌ Error reading directory ${dir}:`, error.message);
  }

  return files;
}

// Main execution
console.log('🏢 ENTERPRISE ADMIN COLLECTIONS FIXER - Starting...');
console.log('🎯 Target: Admin API routes with hardcoded adminDb.collection() calls');

const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
const files = findAdminFiles(apiDir);

console.log(`📁 Found ${files.length} API TypeScript files`);

let modifiedCount = 0;

files.forEach(file => {
  const wasModified = processFile(file);
  if (wasModified) {
    modifiedCount++;
  }
});

console.log('\n🎉 ENTERPRISE ADMIN COLLECTIONS FIXER - COMPLETED!');
console.log(`📊 Statistics:`);
console.log(`   • Files processed: ${files.length}`);
console.log(`   • Files modified: ${modifiedCount}`);
console.log(`   • Admin patterns mapped: ${Object.keys(ADMIN_COLLECTION_MAPPINGS).length}`);
console.log('\n✅ All admin routes now use centralized COLLECTIONS configuration!');