/**
 * 🏢 ENTERPRISE CLEANUP SCRIPT: Fix Remaining Hardcoded Collection Names
 *
 * Αυτό το script βρίσκει και διορθώνει όλα τα υπόλοιπα hardcoded collection names
 * που δεν καλύφθηκαν από το πρώτο script.
 *
 * Usage: node scripts/fix-remaining-collections.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// ENHANCED PATTERNS & MAPPINGS
// ============================================================================

/**
 * Εκτεταμένες αντιστοιχίσεις για όλα τα collection names
 */
const COLLECTION_MAPPINGS = {
  // Core Collections
  "'contacts'": "COLLECTIONS.CONTACTS",
  '"contacts"': "COLLECTIONS.CONTACTS",
  "`contacts`": "COLLECTIONS.CONTACTS",

  "'companies'": "COLLECTIONS.COMPANIES",
  '"companies"': "COLLECTIONS.COMPANIES",
  "`companies`": "COLLECTIONS.COMPANIES",

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

  // Communication & Analytics
  "'communications'": "COLLECTIONS.COMMUNICATIONS",
  '"communications"': "COLLECTIONS.COMMUNICATIONS",

  "'email_analytics'": "COLLECTIONS.ANALYTICS",
  '"email_analytics"': "COLLECTIONS.ANALYTICS",

  "'messages'": "COLLECTIONS.MESSAGES",
  '"messages"': "COLLECTIONS.MESSAGES",

  "'notifications'": "COLLECTIONS.NOTIFICATIONS",
  '"notifications"': "COLLECTIONS.NOTIFICATIONS",

  // CRM & Tasks
  "'leads'": "COLLECTIONS.LEADS",
  '"leads"': "COLLECTIONS.LEADS",

  "'activities'": "COLLECTIONS.ACTIVITIES",
  '"activities"': "COLLECTIONS.ACTIVITIES",

  "'tasks'": "COLLECTIONS.TASKS",
  '"tasks"': "COLLECTIONS.TASKS",

  // Analytics & Metrics
  "'analytics'": "COLLECTIONS.ANALYTICS",
  '"analytics"': "COLLECTIONS.ANALYTICS",

  "'metrics'": "COLLECTIONS.METRICS",
  '"metrics"': "COLLECTIONS.METRICS",

  "'events'": "COLLECTIONS.EVENTS",
  '"events"': "COLLECTIONS.EVENTS",

  // System & Configuration
  "'system'": "COLLECTIONS.SYSTEM",
  '"system"': "COLLECTIONS.SYSTEM",

  "'config'": "COLLECTIONS.CONFIG",
  '"config"': "COLLECTIONS.CONFIG",

  "'settings'": "COLLECTIONS.SETTINGS",
  '"settings"': "COLLECTIONS.SETTINGS",

  // User Management
  "'users'": "COLLECTIONS.USERS",
  '"users"': "COLLECTIONS.USERS",

  "'roles'": "COLLECTIONS.ROLES",
  '"roles"': "COLLECTIONS.ROLES",

  "'permissions'": "COLLECTIONS.PERMISSIONS",
  '"permissions"': "COLLECTIONS.PERMISSIONS",

  // Relationships
  "'relationships'": "COLLECTIONS.RELATIONSHIPS",
  '"relationships"': "COLLECTIONS.RELATIONSHIPS",

  "'contact_relationships'": "COLLECTIONS.RELATIONSHIPS",
  '"contact_relationships"': "COLLECTIONS.RELATIONSHIPS",

  // Special Collections
  "'unit_floorplans'": "COLLECTIONS.DOCUMENTS", // Map to generic documents
  '"unit_floorplans"': "COLLECTIONS.DOCUMENTS",

  "'floorplans'": "COLLECTIONS.DOCUMENTS",
  '"floorplans"': "COLLECTIONS.DOCUMENTS",

  // Layer Collections
  "'layers'": "COLLECTIONS.LAYERS",
  '"layers"': "COLLECTIONS.LAYERS",

  "'layerGroups'": "COLLECTIONS.LAYER_GROUPS",
  '"layerGroups"': "COLLECTIONS.LAYER_GROUPS",

  // Storage Collections
  "'storageUnits'": "COLLECTIONS.STORAGE",
  '"storageUnits"': "COLLECTIONS.STORAGE",

  // Forms & Submissions
  "'forms'": "COLLECTIONS.FORMS",
  '"forms"': "COLLECTIONS.FORMS",

  "'submissions'": "COLLECTIONS.SUBMISSIONS",
  '"submissions"': "COLLECTIONS.SUBMISSIONS",

  "'surveys'": "COLLECTIONS.SURVEYS",
  '"surveys"': "COLLECTIONS.SURVEYS",

  // Documents & Files
  "'documents'": "COLLECTIONS.DOCUMENTS",
  '"documents"': "COLLECTIONS.DOCUMENTS",

  "'files'": "COLLECTIONS.FILES",
  '"files"': "COLLECTIONS.FILES",

  "'attachments'": "COLLECTIONS.ATTACHMENTS",
  '"attachments"': "COLLECTIONS.ATTACHMENTS",

  // Calendar & Scheduling
  "'calendar'": "COLLECTIONS.CALENDAR",
  '"calendar"': "COLLECTIONS.CALENDAR",

  "'appointments'": "COLLECTIONS.APPOINTMENTS",
  '"appointments"': "COLLECTIONS.APPOINTMENTS",

  "'bookings'": "COLLECTIONS.BOOKINGS",
  '"bookings"': "COLLECTIONS.BOOKINGS",

  // Logs & Audit
  "'logs'": "COLLECTIONS.LOGS",
  '"logs"': "COLLECTIONS.LOGS",

  "'audit'": "COLLECTIONS.AUDIT",
  '"audit"': "COLLECTIONS.AUDIT",

  "'errors'": "COLLECTIONS.ERRORS",
  '"errors"': "COLLECTIONS.ERRORS",

  // Inventory & Assets
  "'inventory'": "COLLECTIONS.INVENTORY",
  '"inventory"': "COLLECTIONS.INVENTORY",

  "'assets'": "COLLECTIONS.ASSETS",
  '"assets"': "COLLECTIONS.ASSETS",

  // Financial
  "'invoices'": "COLLECTIONS.INVOICES",
  '"invoices"': "COLLECTIONS.INVOICES",

  "'payments'": "COLLECTIONS.PAYMENTS",
  '"payments"': "COLLECTIONS.PAYMENTS",

  "'transactions'": "COLLECTIONS.TRANSACTIONS",
  '"transactions"': "COLLECTIONS.TRANSACTIONS",

  // Security
  "'sessions'": "COLLECTIONS.SESSIONS",
  '"sessions"': "COLLECTIONS.SESSIONS",

  "'tokens'": "COLLECTIONS.TOKENS",
  '"tokens"': "COLLECTIONS.TOKENS",

  // Localization
  "'translations'": "COLLECTIONS.TRANSLATIONS",
  '"translations"': "COLLECTIONS.TRANSLATIONS",

  "'locales'": "COLLECTIONS.LOCALES",
  '"locales"': "COLLECTIONS.LOCALES"
};

// ============================================================================
// ENHANCED PATTERN MATCHING
// ============================================================================

/**
 * Βελτιωμένη εύρεση και αντικατάσταση collection patterns
 */
function findAndReplaceCollections(content) {
  let modifiedContent = content;
  let replacementsCount = 0;
  const replacements = [];

  // Pattern 1: collection(db, 'collection_name')
  const pattern1 = /collection\(([^,]+),\s*(['"`])([a-zA-Z_][a-zA-Z0-9_]*)\2\)/g;
  modifiedContent = modifiedContent.replace(pattern1, (match, dbRef, quote, collectionName) => {
    const quotedName = `${quote}${collectionName}${quote}`;
    const replacement = COLLECTION_MAPPINGS[quotedName];

    if (replacement) {
      replacementsCount++;
      replacements.push(`collection(${dbRef}, ${quotedName}) → collection(${dbRef}, ${replacement})`);
      return `collection(${dbRef}, ${replacement})`;
    }

    return match;
  });

  // Pattern 2: doc(collection(db, 'collection_name'), ...)
  const pattern2 = /doc\(collection\(([^,]+),\s*(['"`])([a-zA-Z_][a-zA-Z0-9_]*)\2\)/g;
  modifiedContent = modifiedContent.replace(pattern2, (match, dbRef, quote, collectionName) => {
    const quotedName = `${quote}${collectionName}${quote}`;
    const replacement = COLLECTION_MAPPINGS[quotedName];

    if (replacement) {
      replacementsCount++;
      replacements.push(`doc(collection(${dbRef}, ${quotedName}) → doc(collection(${dbRef}, ${replacement})`);
      return `doc(collection(${dbRef}, ${replacement})`;
    }

    return match;
  });

  // Pattern 3: addDoc(collection(db, 'collection_name'), ...)
  const pattern3 = /addDoc\(collection\(([^,]+),\s*(['"`])([a-zA-Z_][a-zA-Z0-9_]*)\2\)/g;
  modifiedContent = modifiedContent.replace(pattern3, (match, dbRef, quote, collectionName) => {
    const quotedName = `${quote}${collectionName}${quote}`;
    const replacement = COLLECTION_MAPPINGS[quotedName];

    if (replacement) {
      replacementsCount++;
      replacements.push(`addDoc(collection(${dbRef}, ${quotedName}) → addDoc(collection(${dbRef}, ${replacement})`);
      return `addDoc(collection(${dbRef}, ${replacement})`;
    }

    return match;
  });

  // Pattern 4: query(collection(db, 'collection_name'), ...)
  const pattern4 = /query\(collection\(([^,]+),\s*(['"`])([a-zA-Z_][a-zA-Z0-9_]*)\2\)/g;
  modifiedContent = modifiedContent.replace(pattern4, (match, dbRef, quote, collectionName) => {
    const quotedName = `${quote}${collectionName}${quote}`;
    const replacement = COLLECTION_MAPPINGS[quotedName];

    if (replacement) {
      replacementsCount++;
      replacements.push(`query(collection(${dbRef}, ${quotedName}) → query(collection(${dbRef}, ${replacement})`);
      return `query(collection(${dbRef}, ${replacement})`;
    }

    return match;
  });

  return { content: modifiedContent, count: replacementsCount, replacements };
}

/**
 * Ελέγχει αν ένα αρχείο χρειάζεται COLLECTIONS import
 */
function needsCollectionsImport(content) {
  // Αν περιέχει COLLECTIONS.X references αλλά δεν έχει import
  const hasCollectionsRef = /COLLECTIONS\.[A-Z_]+/.test(content);
  const hasImport = content.includes("import { COLLECTIONS }") || content.includes("from '@/config/firestore-collections'");

  return hasCollectionsRef && !hasImport;
}

/**
 * Προσθέτει COLLECTIONS import
 */
function addCollectionsImport(content) {
  const lines = content.split('\n');
  let lastImportIndex = -1;

  // Βρίσκει την τελευταία import γραμμή
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') && !line.includes('//')) {
      lastImportIndex = i;
    }
  }

  // Προσθέτει το import
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, "import { COLLECTIONS } from '@/config/firestore-collections';");
  } else {
    // Προσθέτει στην αρχή του αρχείου
    lines.unshift("import { COLLECTIONS } from '@/config/firestore-collections';");
  }

  return lines.join('\n');
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
    let totalChanges = 0;

    // 1. Αντικατάσταση collection patterns
    const result = findAndReplaceCollections(modifiedContent);
    if (result.count > 0) {
      console.log(`  🔄 Made ${result.count} collection name replacements:`);
      result.replacements.forEach(replacement => {
        console.log(`    ✓ ${replacement}`);
      });
      modifiedContent = result.content;
      hasChanges = true;
      totalChanges += result.count;
    }

    // 2. Προσθήκη import αν χρειάζεται
    if (needsCollectionsImport(modifiedContent)) {
      console.log(`  📦 Adding COLLECTIONS import`);
      modifiedContent = addCollectionsImport(modifiedContent);
      hasChanges = true;
      totalChanges++;
    }

    // 3. Αποθήκευση αν υπάρχουν αλλαγές
    if (hasChanges) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      console.log(`  ✅ File updated successfully (${totalChanges} changes)`);
      return { processed: true, changes: totalChanges };
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
 * Βρίσκει προβληματικά αρχεία
 */
function findProblematicFiles() {
  const problematicFiles = [];
  const srcDir = path.join(process.cwd(), 'src');

  // Patterns προς αναζήτηση
  const patterns = [
    /collection\([^,]+,\s*['"`][a-zA-Z_][a-zA-Z0-9_]*['"`]\)/g,
    /doc\(collection\([^,]+,\s*['"`][a-zA-Z_][a-zA-Z0-9_]*['"`]\)/g,
    /addDoc\(collection\([^,]+,\s*['"`][a-zA-Z_][a-zA-Z0-9_]*['"`]\)/g,
    /query\(collection\([^,]+,\s*['"`][a-zA-Z_][a-zA-Z0-9_]*['"`]\)/g
  ];

  function scanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
          scanDirectory(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');

            // Έλεγχος αν το αρχείο έχει hardcoded collections
            for (const pattern of patterns) {
              if (pattern.test(content)) {
                problematicFiles.push(fullPath);
                break;
              }
            }
          } catch (error) {
            // Ignore read errors
          }
        }
      }
    } catch (error) {
      // Ignore directory read errors
    }
  }

  scanDirectory(srcDir);
  return problematicFiles;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function main() {
  console.log('🏢 ENTERPRISE CLEANUP SCRIPT: Fix Remaining Hardcoded Collection Names');
  console.log('=============================================================================\n');

  // Βρίσκει προβληματικά αρχεία
  console.log('🔍 Scanning for files with hardcoded collection names...\n');
  const problematicFiles = findProblematicFiles();

  console.log(`📋 Found ${problematicFiles.length} files with hardcoded collection names:\n`);

  if (problematicFiles.length === 0) {
    console.log('✨ No files with hardcoded collection names found!');
    console.log('🎉 All collection names are already centralized!');
    return;
  }

  // Εμφάνιση λίστας προβληματικών αρχείων
  problematicFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });

  console.log('\n📝 Processing files...\n');

  // Στατιστικά
  let processedFiles = 0;
  let updatedFiles = 0;
  let totalChanges = 0;
  let errors = [];

  // Επεξεργασία αρχείων
  for (const file of problematicFiles) {
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

  // Αποτελέσματα
  console.log('\n=============================================================================');
  console.log('📊 CLEANUP COMPLETE');
  console.log('=============================================================================');
  console.log(`📁 Problematic files found: ${problematicFiles.length}`);
  console.log(`🔍 Files processed: ${processedFiles}`);
  console.log(`✅ Files updated: ${updatedFiles}`);
  console.log(`🔄 Total changes made: ${totalChanges}`);
  console.log(`❌ Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n📋 ERRORS:');
    errors.forEach(({ file, error }) => {
      console.log(`  ❌ ${file}: ${error}`);
    });
  }

  if (updatedFiles > 0) {
    console.log('\n🎯 SUCCESS: All remaining hardcoded collection names have been fixed!');
    console.log('🔧 All collections are now using centralized configuration.');
  } else {
    console.log('\n⚠️  Some files might need manual review.');
    console.log('💡 Check the identified files for complex patterns.');
  }
}

// Εκτέλεση
if (require.main === module) {
  main();
}

module.exports = { main, processFile, findProblematicFiles };