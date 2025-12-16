/**
 * 🏢 ENTERPRISE BATCH SCRIPT: Fix Hardcoded Collection Names
 *
 * Αυτό το script κάνει μαζικές αλλαγές σε όλα τα αρχεία που έχουν
 * hardcoded collection names και τα αντικαθιστά με centralized configuration.
 *
 * Usage: node scripts/fix-collection-names.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Αντιστοιχίσεις hardcoded collection names προς centralized configuration
 */
const COLLECTION_MAPPINGS = {
  "'contacts'": "COLLECTIONS.CONTACTS",
  '"contacts"': "COLLECTIONS.CONTACTS",
  "`contacts`": "COLLECTIONS.CONTACTS",

  "'projects'": "COLLECTIONS.PROJECTS",
  '"projects"': "COLLECTIONS.PROJECTS",
  "`projects`": "COLLECTIONS.PROJECTS",

  "'buildings'": "COLLECTIONS.BUILDINGS",
  '"buildings"': "COLLECTIONS.BUILDINGS",
  "`buildings`": "COLLECTIONS.BUILDINGS",

  "'units'": "COLLECTIONS.UNITS",
  '"units"': "COLLECTIONS.UNITS",
  "`units`": "COLLECTIONS.UNITS",

  "'floors'": "COLLECTIONS.FLOORS",
  '"floors"': "COLLECTIONS.FLOORS",
  "`floors`": "COLLECTIONS.FLOORS",

  "'communications'": "COLLECTIONS.COMMUNICATIONS",
  '"communications"': "COLLECTIONS.COMMUNICATIONS",

  "'messages'": "COLLECTIONS.MESSAGES",
  '"messages"': "COLLECTIONS.MESSAGES",

  "'notifications'": "COLLECTIONS.NOTIFICATIONS",
  '"notifications"': "COLLECTIONS.NOTIFICATIONS",

  "'leads'": "COLLECTIONS.LEADS",
  '"leads"': "COLLECTIONS.LEADS",

  "'activities'": "COLLECTIONS.ACTIVITIES",
  '"activities"': "COLLECTIONS.ACTIVITIES",

  "'tasks'": "COLLECTIONS.TASKS",
  '"tasks"': "COLLECTIONS.TASKS",

  "'analytics'": "COLLECTIONS.ANALYTICS",
  '"analytics"': "COLLECTIONS.ANALYTICS",

  "'metrics'": "COLLECTIONS.METRICS",
  '"metrics"': "COLLECTIONS.METRICS",

  "'events'": "COLLECTIONS.EVENTS",
  '"events"': "COLLECTIONS.EVENTS",

  "'system'": "COLLECTIONS.SYSTEM",
  '"system"': "COLLECTIONS.SYSTEM",

  "'config'": "COLLECTIONS.CONFIG",
  '"config"': "COLLECTIONS.CONFIG",

  "'settings'": "COLLECTIONS.SETTINGS",
  '"settings"': "COLLECTIONS.SETTINGS",

  "'users'": "COLLECTIONS.USERS",
  '"users"': "COLLECTIONS.USERS",

  "'roles'": "COLLECTIONS.ROLES",
  '"roles"': "COLLECTIONS.ROLES",

  "'permissions'": "COLLECTIONS.PERMISSIONS",
  '"permissions"': "COLLECTIONS.PERMISSIONS",

  "'relationships'": "COLLECTIONS.RELATIONSHIPS",
  '"relationships"': "COLLECTIONS.RELATIONSHIPS",

  "'forms'": "COLLECTIONS.FORMS",
  '"forms"': "COLLECTIONS.FORMS",

  "'submissions'": "COLLECTIONS.SUBMISSIONS",
  '"submissions"': "COLLECTIONS.SUBMISSIONS",

  "'surveys'": "COLLECTIONS.SURVEYS",
  '"surveys"': "COLLECTIONS.SURVEYS",

  "'documents'": "COLLECTIONS.DOCUMENTS",
  '"documents"': "COLLECTIONS.DOCUMENTS",

  "'files'": "COLLECTIONS.FILES",
  '"files"': "COLLECTIONS.FILES",

  "'attachments'": "COLLECTIONS.ATTACHMENTS",
  '"attachments"': "COLLECTIONS.ATTACHMENTS",

  "'calendar'": "COLLECTIONS.CALENDAR",
  '"calendar"': "COLLECTIONS.CALENDAR",

  "'appointments'": "COLLECTIONS.APPOINTMENTS",
  '"appointments"': "COLLECTIONS.APPOINTMENTS",

  "'bookings'": "COLLECTIONS.BOOKINGS",
  '"bookings"': "COLLECTIONS.BOOKINGS",

  "'logs'": "COLLECTIONS.LOGS",
  '"logs"': "COLLECTIONS.LOGS",

  "'audit'": "COLLECTIONS.AUDIT",
  '"audit"': "COLLECTIONS.AUDIT",

  "'errors'": "COLLECTIONS.ERRORS",
  '"errors"': "COLLECTIONS.ERRORS",

  "'inventory'": "COLLECTIONS.INVENTORY",
  '"inventory"': "COLLECTIONS.INVENTORY",

  "'assets'": "COLLECTIONS.ASSETS",
  '"assets"': "COLLECTIONS.ASSETS",

  "'invoices'": "COLLECTIONS.INVOICES",
  '"invoices"': "COLLECTIONS.INVOICES",

  "'payments'": "COLLECTIONS.PAYMENTS",
  '"payments"': "COLLECTIONS.PAYMENTS",

  "'transactions'": "COLLECTIONS.TRANSACTIONS",
  '"transactions"': "COLLECTIONS.TRANSACTIONS",

  "'sessions'": "COLLECTIONS.SESSIONS",
  '"sessions"': "COLLECTIONS.SESSIONS",

  "'tokens'": "COLLECTIONS.TOKENS",
  '"tokens"': "COLLECTIONS.TOKENS",

  "'translations'": "COLLECTIONS.TRANSLATIONS",
  '"translations"': "COLLECTIONS.TRANSLATIONS",

  "'locales'": "COLLECTIONS.LOCALES",
  '"locales"': "COLLECTIONS.LOCALES"
};

/**
 * Αρχεία που πρέπει να παραλειφθούν από το batch processing
 */
const EXCLUDE_FILES = [
  'fix-collection-names.js', // Αυτό το script
  'firestore-collections.ts', // Το configuration αρχείο
  'contacts.service.ts', // Ήδη διορθωμένο
  'companies.service.ts', // Ήδη διορθωμένο
  'CommunicationsService.ts' // Ήδη διορθωμένο
];

/**
 * Directories που πρέπει να παραλειφθούν
 */
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build'
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Ελέγχει αν ένα αρχείο πρέπει να επεξεργαστεί
 */
function shouldProcessFile(filePath) {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName);

  // Μόνο TypeScript/JavaScript αρχεία
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return false;
  }

  // Exclude specific files
  if (EXCLUDE_FILES.some(excludeFile => fileName.includes(excludeFile))) {
    return false;
  }

  // Exclude specific directories
  if (EXCLUDE_DIRS.some(excludeDir => filePath.includes(excludeDir))) {
    return false;
  }

  return true;
}

/**
 * Ελέγχει αν ένα αρχείο χρειάζεται import statement
 */
function needsCollectionsImport(content) {
  // Αν περιέχει collection() calls με hardcoded names
  const hasCollectionCalls = /collection\(db,\s*['"`][a-zA-Z_][a-zA-Z0-9_]*['"`]\)/.test(content);

  // Αν δεν έχει ήδη το import
  const hasImport = content.includes("import { COLLECTIONS }") || content.includes("from '@/config/firestore-collections'");

  return hasCollectionCalls && !hasImport;
}

/**
 * Προσθέτει import statement στο αρχείο
 */
function addCollectionsImport(content) {
  // Βρίσκει την τελευταία import γραμμή
  const lines = content.split('\n');
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith('import{')) {
      lastImportIndex = i;
    }
  }

  // Προσθέτει το νέο import μετά το τελευταίο import
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, "import { COLLECTIONS } from '@/config/firestore-collections';");
  } else {
    // Αν δεν υπάρχουν imports, προσθέτει στην αρχή
    lines.unshift("import { COLLECTIONS } from '@/config/firestore-collections';");
  }

  return lines.join('\n');
}

/**
 * Αντικαθιστά hardcoded collection names με centralized references
 */
function replaceCollectionNames(content) {
  let modifiedContent = content;
  let replacementsCount = 0;

  // Pattern για collection(db, 'collection_name')
  const collectionPattern = /collection\(([^,]+),\s*(['"`])([a-zA-Z_][a-zA-Z0-9_]*)\2\)/g;

  modifiedContent = modifiedContent.replace(collectionPattern, (match, dbRef, quote, collectionName) => {
    const quotedName = `${quote}${collectionName}${quote}`;
    const replacement = COLLECTION_MAPPINGS[quotedName];

    if (replacement) {
      replacementsCount++;
      console.log(`    ✓ Replaced collection(${dbRef}, ${quotedName}) → collection(${dbRef}, ${replacement})`);
      return `collection(${dbRef}, ${replacement})`;
    }

    return match;
  });

  return { content: modifiedContent, count: replacementsCount };
}

/**
 * Επεξεργάζεται ένα αρχείο
 */
function processFile(filePath) {
  try {
    console.log(`\n📄 Processing: ${filePath}`);

    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let hasChanges = false;

    // 1. Προσθήκη import αν χρειάζεται
    if (needsCollectionsImport(content)) {
      console.log(`  📦 Adding COLLECTIONS import`);
      modifiedContent = addCollectionsImport(modifiedContent);
      hasChanges = true;
    }

    // 2. Αντικατάσταση collection names
    const result = replaceCollectionNames(modifiedContent);
    if (result.count > 0) {
      console.log(`  🔄 Made ${result.count} collection name replacements`);
      modifiedContent = result.content;
      hasChanges = true;
    }

    // 3. Αποθήκευση αν υπάρχουν αλλαγές
    if (hasChanges) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      console.log(`  ✅ File updated successfully`);
      return { processed: true, changes: result.count + (needsCollectionsImport(content) ? 1 : 0) };
    } else {
      console.log(`  ⏭️  No changes needed`);
      return { processed: false, changes: 0 };
    }

  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return { processed: false, changes: 0, error: error.message };
  }
}

/**
 * Βρίσκει όλα τα αρχεία σε έναν κατάλογο αναδρομικά
 */
function findFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !EXCLUDE_DIRS.includes(entry.name)) {
        files.push(...findFiles(fullPath));
      } else if (entry.isFile() && shouldProcessFile(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Cannot read directory ${dir}: ${error.message}`);
  }

  return files;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('🏢 ENTERPRISE BATCH SCRIPT: Fix Hardcoded Collection Names');
  console.log('================================================================\n');

  // Βρίσκει όλα τα αρχεία στο src directory
  const srcDir = path.join(process.cwd(), 'src');
  console.log(`🔍 Scanning directory: ${srcDir}\n`);

  const allFiles = findFiles(srcDir);
  console.log(`📋 Found ${allFiles.length} files to process\n`);

  // Στατιστικά
  let processedFiles = 0;
  let updatedFiles = 0;
  let totalChanges = 0;
  let errors = [];

  // Επεξεργασία αρχείων
  for (const file of allFiles) {
    const result = processFile(file);
    processedFiles++;

    if (result.processed) {
      updatedFiles++;
      totalChanges += result.changes;
    }

    if (result.error) {
      errors.push({ file, error: result.error });
    }
  }

  // Εμφάνιση αποτελεσμάτων
  console.log('\n================================================================');
  console.log('📊 BATCH PROCESSING COMPLETE');
  console.log('================================================================');
  console.log(`📁 Total files scanned: ${allFiles.length}`);
  console.log(`🔍 Total files processed: ${processedFiles}`);
  console.log(`✅ Total files updated: ${updatedFiles}`);
  console.log(`🔄 Total changes made: ${totalChanges}`);
  console.log(`❌ Total errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n📋 ERRORS:');
    errors.forEach(({ file, error }) => {
      console.log(`  ❌ ${file}: ${error}`);
    });
  }

  if (updatedFiles > 0) {
    console.log('\n🎯 SUCCESS: All collection names have been centralized!');
    console.log('   Next steps:');
    console.log('   1. Review the changes in your Git diff');
    console.log('   2. Test the application to ensure everything works');
    console.log('   3. Commit the changes');
  } else {
    console.log('\n✨ All files are already using centralized collection names!');
  }
}

// Εκτέλεση του script
if (require.main === module) {
  main();
}

module.exports = { main, processFile, findFiles };