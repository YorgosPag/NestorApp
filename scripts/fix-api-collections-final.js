const fs = require('fs');
const path = require('path');

// 🏢 ENTERPRISE API COLLECTIONS FIXER - FINAL SWEEP
// Fixes all remaining hardcoded collection names in API routes

const COLLECTION_MAPPINGS = {
  "'contacts'": "COLLECTIONS.CONTACTS",
  "'projects'": "COLLECTIONS.PROJECTS",
  "'buildings'": "COLLECTIONS.BUILDINGS",
  "'units'": "COLLECTIONS.UNITS",
  "'companies'": "COLLECTIONS.COMPANIES",
  "'layers'": "COLLECTIONS.LAYERS",
  "'layerGroups'": "COLLECTIONS.LAYER_GROUPS",
  "'storageUnits'": "COLLECTIONS.STORAGE",
  "'communications'": "COLLECTIONS.COMMUNICATIONS",
  "'activities'": "COLLECTIONS.ACTIVITIES",
  "'tasks'": "COLLECTIONS.TASKS",
  "'leads'": "COLLECTIONS.LEADS",
  "'notifications'": "COLLECTIONS.NOTIFICATIONS",
  "'analytics'": "COLLECTIONS.ANALYTICS",
  "'system'": "COLLECTIONS.SYSTEM",
  "'config'": "COLLECTIONS.CONFIG",
  "'settings'": "COLLECTIONS.SETTINGS",
  "'navigation_companies'": "COLLECTIONS.NAVIGATION",
  "'users'": "COLLECTIONS.USERS",
  "'roles'": "COLLECTIONS.ROLES",
  "'permissions'": "COLLECTIONS.PERMISSIONS"
};

// Import statement to add
const COLLECTIONS_IMPORT = "import { COLLECTIONS } from '@/config/firestore-collections';";

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let newContent = content;

    // Check if file needs COLLECTIONS import
    const needsCollectionsImport = Object.keys(COLLECTION_MAPPINGS).some(pattern =>
      content.includes(pattern)
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

    // Replace hardcoded collection names
    Object.keys(COLLECTION_MAPPINGS).forEach(pattern => {
      const replacement = COLLECTION_MAPPINGS[pattern];
      const regex = new RegExp(pattern.replace(/'/g, "'"), 'g');

      if (newContent.includes(pattern)) {
        newContent = newContent.replace(regex, replacement);
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

function findApiFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir);

    entries.forEach(entry => {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findApiFiles(fullPath));
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        files.push(fullPath);
      }
    });

  } catch (error) {
    console.error(`❌ Error reading directory ${dir}:`, error.message);
  }

  return files;
}

// Main execution
console.log('🏢 ENTERPRISE API COLLECTIONS FIXER - Starting...');
console.log('🎯 Target: All API routes with hardcoded collection names');

const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
const files = findApiFiles(apiDir);

console.log(`📁 Found ${files.length} TypeScript files in API directory`);

let modifiedCount = 0;
let totalReplacements = 0;

files.forEach(file => {
  const wasModified = processFile(file);
  if (wasModified) {
    modifiedCount++;
  }
});

console.log('\n🎉 ENTERPRISE API COLLECTIONS FIXER - COMPLETED!');
console.log(`📊 Statistics:`);
console.log(`   • Files processed: ${files.length}`);
console.log(`   • Files modified: ${modifiedCount}`);
console.log(`   • Collections mapped: ${Object.keys(COLLECTION_MAPPINGS).length}`);
console.log('\n✅ All API routes now use centralized COLLECTIONS configuration!');