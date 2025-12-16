#!/usr/bin/env node

/**
 * 🎨 POLYGON STYLES MIGRATION SCRIPT
 *
 * Μεταφέρει τα hardcoded polygon styles στη Firebase για enterprise deployment.
 *
 * Usage:
 *   node scripts/migrate-polygon-styles.js [--tenant=TENANT_ID] [--environment=ENV]
 *
 * Examples:
 *   node scripts/migrate-polygon-styles.js
 *   node scripts/migrate-polygon-styles.js --tenant=company-a --environment=production
 *   node scripts/migrate-polygon-styles.js --themes=default,dark,high-contrast
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG_COLLECTION = process.env.NEXT_PUBLIC_CONFIG_COLLECTION || 'config';

// Parse command line arguments
const args = process.argv.slice(2);
const tenantId = args.find(arg => arg.startsWith('--tenant='))?.split('=')[1];
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'production';
const themes = args.find(arg => arg.startsWith('--themes='))?.split('=')[1]?.split(',') || ['default', 'dark', 'high-contrast'];

console.log('🎨 Polygon Styles Migration Script');
console.log(`📄 Target Collection: ${CONFIG_COLLECTION}`);
console.log(`🏢 Tenant ID: ${tenantId || 'default'}`);
console.log(`🌍 Environment: ${environment}`);
console.log(`🎯 Themes: ${themes.join(', ')}`);

// ============================================================================
// POLYGON STYLE DATA
// ============================================================================

/**
 * 🎨 Default polygon styles (WCAG AA compliant)
 */
const DEFAULT_POLYGON_STYLES = {
  simple: {
    strokeColor: '#1e40af',    // Enhanced blue (WCAG AA)
    fillColor: '#3b82f6',
    strokeWidth: 2,
    fillOpacity: 0.25,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#1d4ed8'
  },
  georeferencing: {
    strokeColor: '#d97706',    // Enhanced amber (WCAG AA)
    fillColor: '#f59e0b',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#b45309'
  },
  'alert-zone': {
    strokeColor: '#dc2626',    // Enhanced red (WCAG AA)
    fillColor: '#ef4444',
    strokeWidth: 3,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#b91c1c'
  },
  'real-estate': {
    strokeColor: '#0891b2',    // Enhanced cyan (WCAG AA)
    fillColor: '#06b6d4',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#0e7490'
  },
  measurement: {
    strokeColor: '#059669',    // Enhanced green (WCAG AA)
    fillColor: '#10b981',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#047857'
  },
  annotation: {
    strokeColor: '#7c3aed',    // Enhanced purple (WCAG AA)
    fillColor: '#8b5cf6',
    strokeWidth: 2,
    fillOpacity: 0.15,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#6d28d9'
  }
};

/**
 * 🌙 Dark theme polygon styles
 */
const DARK_THEME_STYLES = {
  simple: {
    strokeColor: '#60a5fa',
    fillColor: '#3b82f6',
    strokeWidth: 2,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#93c5fd'
  },
  georeferencing: {
    strokeColor: '#fbbf24',
    fillColor: '#f59e0b',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#fcd34d'
  },
  'alert-zone': {
    strokeColor: '#f87171',
    fillColor: '#ef4444',
    strokeWidth: 3,
    fillOpacity: 0.25,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#fca5a5'
  },
  'real-estate': {
    strokeColor: '#22d3ee',
    fillColor: '#06b6d4',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 5,
    pointColor: '#67e8f9'
  },
  measurement: {
    strokeColor: '#34d399',
    fillColor: '#10b981',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#6ee7b7'
  },
  annotation: {
    strokeColor: '#a78bfa',
    fillColor: '#8b5cf6',
    strokeWidth: 2,
    fillOpacity: 0.2,
    strokeOpacity: 1,
    pointRadius: 4,
    pointColor: '#c4b5fd'
  }
};

/**
 * ♿ High contrast theme (WCAG AAA compliant)
 */
const HIGH_CONTRAST_STYLES = {
  simple: {
    strokeColor: '#000000',
    fillColor: '#0066cc',
    strokeWidth: 3,
    fillOpacity: 0.4,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#000000'
  },
  georeferencing: {
    strokeColor: '#cc6600',
    fillColor: '#ff8800',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 8,
    pointColor: '#cc6600'
  },
  'alert-zone': {
    strokeColor: '#cc0000',
    fillColor: '#ff3333',
    strokeWidth: 4,
    fillOpacity: 0.4,
    strokeOpacity: 1,
    pointRadius: 7,
    pointColor: '#cc0000'
  },
  'real-estate': {
    strokeColor: '#006666',
    fillColor: '#00aaaa',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#006666'
  },
  measurement: {
    strokeColor: '#006600',
    fillColor: '#00aa00',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#006600'
  },
  annotation: {
    strokeColor: '#6600cc',
    fillColor: '#9933ff',
    strokeWidth: 3,
    fillOpacity: 0.3,
    strokeOpacity: 1,
    pointRadius: 6,
    pointColor: '#6600cc'
  }
};

/**
 * Theme configurations
 */
const THEME_CONFIGS = {
  default: {
    name: 'Default Theme',
    description: 'Standard polygon styling με WCAG AA compliance',
    styles: DEFAULT_POLYGON_STYLES,
    accessibility: {
      wcagLevel: 'AA',
      contrastRatio: 4.5,
      colorBlindFriendly: true
    },
    category: 'system'
  },
  dark: {
    name: 'Dark Theme',
    description: 'Dark mode polygon styling για low-light environments',
    styles: DARK_THEME_STYLES,
    accessibility: {
      wcagLevel: 'A',
      contrastRatio: 3.0,
      colorBlindFriendly: true
    },
    category: 'system'
  },
  'high-contrast': {
    name: 'High Contrast',
    description: 'Maximum contrast styling για accessibility (WCAG AAA)',
    styles: HIGH_CONTRAST_STYLES,
    accessibility: {
      wcagLevel: 'AAA',
      contrastRatio: 7.0,
      colorBlindFriendly: true
    },
    category: 'accessibility'
  }
};

/**
 * Polygon type metadata
 */
const POLYGON_TYPE_METADATA = {
  simple: {
    displayName: 'Simple Polygon',
    description: 'Basic polygon drawing for general use',
    category: 'drawing',
    defaultPriority: 1
  },
  georeferencing: {
    displayName: 'Georeferencing Points',
    description: 'Control points για geographic coordinate mapping',
    category: 'geospatial',
    defaultPriority: 2
  },
  'alert-zone': {
    displayName: 'Alert Zone',
    description: 'Critical alert and monitoring zones',
    category: 'monitoring',
    defaultPriority: 3
  },
  'real-estate': {
    displayName: 'Real Estate Zone',
    description: 'Property monitoring and analysis areas',
    category: 'business',
    defaultPriority: 4
  },
  measurement: {
    displayName: 'Measurement Tool',
    description: 'Area and distance measurement polygons',
    category: 'measurement',
    defaultPriority: 5
  },
  annotation: {
    displayName: 'Annotation',
    description: 'Notes and comments on drawings',
    category: 'documentation',
    defaultPriority: 6
  }
};

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

/**
 * Initialize Firebase Admin
 */
function initializeFirebase() {
  try {
    let app;

    // Try service account first
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

    try {
      const serviceAccount = require(serviceAccountPath);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin initialized με service account');
    } catch (error) {
      // Fallback to environment variables
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
      console.log('✅ Firebase Admin initialized με environment variables');
    }

    return getFirestore(app);
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// MIGRATION FUNCTIONS
// ============================================================================

/**
 * Migrate polygon style configurations to Firebase
 */
async function migratePolygonStyles(db) {
  console.log('\n🎨 Starting polygon styles migration...');

  let successCount = 0;
  let errorCount = 0;

  // Process each theme
  for (const themeName of themes) {
    const themeConfig = THEME_CONFIGS[themeName];

    if (!themeConfig) {
      console.warn(`⚠️ Unknown theme: ${themeName}, skipping`);
      continue;
    }

    console.log(`\n🎯 Processing theme: ${themeName}`);

    // Process each polygon type in the theme
    for (const [polygonType, style] of Object.entries(themeConfig.styles)) {
      try {
        const metadata = POLYGON_TYPE_METADATA[polygonType];
        const configId = `polygon-style-${polygonType}-${themeName}`;

        const styleConfig = {
          // Core config
          polygonType,
          style,
          theme: themeName,
          isEnabled: true,
          priority: metadata.defaultPriority,

          // Environment & tenant
          environment: environment === 'all' ? 'all' : environment,
          ...(tenantId && { tenantId }),

          // Metadata
          metadata: {
            displayName: `${metadata.displayName} - ${themeConfig.name}`,
            description: `${themeConfig.description} - ${metadata.description}`,
            category: themeConfig.category,
            accessibility: themeConfig.accessibility,
            polygonCategory: metadata.category,
            createdBy: 'migration-script',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };

        // Write to Firebase
        const docRef = db.collection(CONFIG_COLLECTION).doc(configId);
        await docRef.set(styleConfig, { merge: true });

        console.log(`  ✅ ${polygonType} (${themeName})`);
        successCount++;

      } catch (error) {
        console.error(`  ❌ Failed ${polygonType} (${themeName}):`, error.message);
        errorCount++;
      }
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total Configurations: ${themes.length * Object.keys(DEFAULT_POLYGON_STYLES).length}`);

  return { successCount, errorCount };
}

/**
 * Create theme metadata documents
 */
async function createThemeMetadata(db) {
  console.log('\n🎨 Creating theme metadata...');

  for (const themeName of themes) {
    const themeConfig = THEME_CONFIGS[themeName];

    if (!themeConfig) continue;

    try {
      const themeDocId = `polygon-theme-${themeName}`;

      const themeDoc = {
        id: themeName,
        name: themeConfig.name,
        displayName: themeConfig.name,
        description: themeConfig.description,
        isDefault: themeName === 'default',
        category: themeConfig.category,
        accessibility: themeConfig.accessibility,
        polygonTypes: Object.keys(themeConfig.styles),
        ...(tenantId && { tenantId }),
        environment: environment === 'all' ? 'all' : environment,
        metadata: {
          createdBy: 'migration-script',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };

      const docRef = db.collection(CONFIG_COLLECTION).doc(themeDocId);
      await docRef.set(themeDoc, { merge: true });

      console.log(`✅ Theme metadata: ${themeName}`);
    } catch (error) {
      console.error(`❌ Failed theme metadata ${themeName}:`, error);
    }
  }
}

/**
 * Verify migration results
 */
async function verifyMigration(db) {
  console.log('\n🔍 Verifying migration...');

  try {
    // Count polygon style configurations
    const styleQuery = db.collection(CONFIG_COLLECTION)
      .where('polygonType', '!=', null);

    const styleSnapshot = await styleQuery.get();
    console.log(`📄 Style configurations: ${styleSnapshot.size}`);

    // Count theme metadata
    const themeQuery = db.collection(CONFIG_COLLECTION)
      .where('id', '>=', 'polygon-theme-')
      .where('id', '<', 'polygon-theme-z');

    const themeSnapshot = await themeQuery.get();
    console.log(`🎨 Theme metadata: ${themeSnapshot.size}`);

    // Show sample configurations
    if (!styleSnapshot.empty) {
      console.log('\n📋 Sample configurations:');
      styleSnapshot.docs.slice(0, 3).forEach(doc => {
        const data = doc.data();
        console.log(`   📄 ${doc.id}: ${data.polygonType} (${data.theme || 'default'})`);
      });
    }

    return styleSnapshot.size > 0 && themeSnapshot.size > 0;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Clean existing polygon configurations
 */
async function cleanupExistingStyles(db) {
  console.log('\n🧹 Cleaning existing polygon style configurations...');

  try {
    // Delete existing polygon style configs
    const existingQuery = db.collection(CONFIG_COLLECTION)
      .where('polygonType', '!=', null);

    const snapshot = await existingQuery.get();

    if (snapshot.empty) {
      console.log('📋 No existing polygon configurations to clean');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Cleaned ${snapshot.size} existing polygon configurations`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('\n🚀 Initializing Firebase...');
    const db = initializeFirebase();

    // Optional cleanup
    if (args.includes('--clean')) {
      await cleanupExistingStyles(db);
    }

    // Create theme metadata first
    await createThemeMetadata(db);

    // Migrate polygon style configurations
    const { successCount, errorCount } = await migratePolygonStyles(db);

    // Verify migration
    const verified = await verifyMigration(db);

    // Final summary
    console.log('\n🎉 Polygon Styles Migration completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Update components to use EnterprisePolygonStyleService');
    console.log('   2. Test polygon rendering με the new styles');
    console.log('   3. Configure brand-specific themes if needed');
    console.log('   4. Set up tenant-specific styling');
    console.log('\n📚 Documentation:');
    console.log('   - Service: src/services/polygon/EnterprisePolygonStyleService.ts');
    console.log('   - Types: packages/core/polygon-system/types.ts');

    const totalExpected = themes.length * Object.keys(DEFAULT_POLYGON_STYLES).length;

    if (successCount === totalExpected && verified) {
      console.log('\n✅ All polygon styles migrated successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Migration completed with some issues. Please review the logs above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check Firebase credentials');
    console.log('   2. Verify COLLECTIONS.CONFIG collection exists');
    console.log('   3. Check Firestore security rules');
    console.log('   4. Ensure polygon types are valid');
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}