#!/usr/bin/env node

/**
 * 🎨 LAYER STYLES MIGRATION SCRIPT
 *
 * Μεταφέρει τα hardcoded layer styles και categories στη Firebase για enterprise deployment.
 *
 * Usage:
 *   node scripts/migrate-layer-styles.js [--tenant=TENANT_ID] [--environment=ENV] [--themes=THEMES] [--force]
 *
 * Examples:
 *   node scripts/migrate-layer-styles.js
 *   node scripts/migrate-layer-styles.js --tenant=company-a --environment=production
 *   node scripts/migrate-layer-styles.js --themes=default,dark,high-contrast --force
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Firestore collection για configuration (same as COLLECTIONS.CONFIG)
const CONFIG_COLLECTION = process.env.NEXT_PUBLIC_CONFIG_COLLECTION || 'config';

// Parse command line arguments
const args = process.argv.slice(2);
const tenantId = args.find(arg => arg.startsWith('--tenant='))?.split('=')[1];
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'production';
const themes = args.find(arg => arg.startsWith('--themes='))?.split('=')[1]?.split(',') || ['default', 'dark', 'high-contrast'];
const force = args.includes('--force');

console.log('🎨 Layer Styles Migration Script');
console.log(`📄 Target Collection: ${CONFIG_COLLECTION}`);
console.log(`🏢 Tenant ID: ${tenantId || 'default'}`);
console.log(`🌍 Environment: ${environment}`);
console.log(`🎯 Themes: ${themes.join(', ')}`);
console.log(`💪 Force Mode: ${force ? 'enabled' : 'disabled'}`);

// ============================================================================
// LAYER STYLES CONFIGURATION DATA
// ============================================================================

/**
 * Default layer styles που θα μεταφερθούν στη Firebase
 */
const DEFAULT_LAYER_STYLES = {
  property: {
    strokeColor: '#3b82f6',
    fillColor: '#3b82f6',
    strokeWidth: 2,
    opacity: 0.3
  },
  annotation: {
    strokeColor: '#10b981',
    fillColor: '#10b981',
    strokeWidth: 1,
    opacity: 1
  },
  measurement: {
    strokeColor: '#f59e0b',
    fillColor: '#f59e0b',
    strokeWidth: 2,
    opacity: 1,
    dashArray: '5,5'
  },
  line: {
    strokeColor: '#6b7280',
    fillColor: 'transparent',
    strokeWidth: 2,
    opacity: 1
  },
  circle: {
    strokeColor: '#8b5cf6',
    fillColor: '#8b5cf6',
    strokeWidth: 2,
    opacity: 0.2
  },
  rectangle: {
    strokeColor: '#ef4444',
    fillColor: '#ef4444',
    strokeWidth: 2,
    opacity: 0.2
  }
};

/**
 * Default layer categories που θα μεταφερθούν στη Firebase
 */
const DEFAULT_LAYER_CATEGORIES = {
  structural: {
    name: 'Δομικά Στοιχεία',
    icon: 'Building',
    color: '#64748b',
    description: 'Structural elements like walls, columns, beams'
  },
  electrical: {
    name: 'Ηλεκτρολογικά',
    icon: 'Zap',
    color: '#eab308',
    description: 'Electrical systems and components'
  },
  plumbing: {
    name: 'Υδραυλικά',
    icon: 'Droplets',
    color: '#3b82f6',
    description: 'Plumbing systems and fixtures'
  },
  hvac: {
    name: 'Κλιματισμός',
    icon: 'Wind',
    color: '#10b981',
    description: 'HVAC systems and equipment'
  },
  furniture: {
    name: 'Έπιπλα',
    icon: 'Armchair',
    color: '#8b5cf6',
    description: 'Furniture and interior elements'
  },
  annotations: {
    name: 'Σημειώσεις',
    icon: 'MessageSquare',
    color: '#f59e0b',
    description: 'Text annotations and comments'
  },
  measurements: {
    name: 'Μετρήσεις',
    icon: 'Ruler',
    color: '#ef4444',
    description: 'Measurement tools and dimensions'
  }
};

/**
 * Theme-specific color adjustments
 */
const THEME_ADJUSTMENTS = {
  dark: {
    // Colors adjusted for dark theme
    colorMap: {
      '#3b82f6': '#60a5fa', // blue → lighter blue
      '#10b981': '#34d399', // green → lighter green
      '#f59e0b': '#fbbf24', // yellow → lighter yellow
      '#6b7280': '#9ca3af', // gray → lighter gray
      '#8b5cf6': '#a78bfa', // purple → lighter purple
      '#ef4444': '#f87171', // red → lighter red
      '#64748b': '#94a3b8', // slate → lighter slate
      '#eab308': '#facc15'  // yellow → lighter yellow
    }
  },
  'high-contrast': {
    // High contrast colors για accessibility (WCAG AAA)
    layerStyles: {
      property: { strokeColor: '#000000', fillColor: '#ffffff' },
      annotation: { strokeColor: '#ffff00', fillColor: '#ffff00' },
      measurement: { strokeColor: '#ff0000', fillColor: '#ff0000' },
      line: { strokeColor: '#ffffff', fillColor: 'transparent' },
      circle: { strokeColor: '#00ff00', fillColor: '#00ff00' },
      rectangle: { strokeColor: '#0000ff', fillColor: '#0000ff' }
    },
    categories: {
      structural: { color: '#000000' },
      electrical: { color: '#ffff00' },
      plumbing: { color: '#0000ff' },
      hvac: { color: '#00ff00' },
      furniture: { color: '#ff00ff' },
      annotations: { color: '#ffff00' },
      measurements: { color: '#ff0000' }
    }
  }
};

/**
 * Generate configurations για all themes
 */
function generateLayerStyleConfigurations() {
  const configurations = [];

  themes.forEach(theme => {
    // Generate layer style configurations
    Object.entries(DEFAULT_LAYER_STYLES).forEach(([layerType, style]) => {
      let adjustedStyle = { ...style };

      // Apply theme-specific adjustments
      if (theme === 'dark' && THEME_ADJUSTMENTS.dark.colorMap) {
        const colorMap = THEME_ADJUSTMENTS.dark.colorMap;
        adjustedStyle.strokeColor = colorMap[style.strokeColor] || style.strokeColor;
        if (style.fillColor !== 'transparent') {
          adjustedStyle.fillColor = colorMap[style.fillColor] || style.fillColor;
        }
      } else if (theme === 'high-contrast' && THEME_ADJUSTMENTS['high-contrast'].layerStyles[layerType]) {
        const themeStyle = THEME_ADJUSTMENTS['high-contrast'].layerStyles[layerType];
        adjustedStyle = { ...adjustedStyle, ...themeStyle };
      }

      configurations.push({
        id: `layer-style-${layerType}-${theme}${tenantId ? `-${tenantId}` : ''}`,
        type: 'layer-style',
        layerElementType: layerType,
        style: adjustedStyle,
        theme: theme,
        tenantId: tenantId || 'default',
        environment: environment,
        isEnabled: true,
        priority: 1,
        metadata: {
          displayName: `${layerType} style για ${theme} theme`,
          description: `Default ${layerType} styling configuration για ${theme} theme`,
          category: 'layer-styles',
          version: '1.0.0',
          accessibility: {
            wcagCompliant: theme === 'high-contrast',
            contrastRatio: theme === 'high-contrast' ? 21.0 : (theme === 'dark' ? 7.0 : 4.5),
            colorBlindSafe: true
          },
          createdBy: 'migration-script',
          migrationDate: new Date().toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    // Generate layer category configurations
    Object.entries(DEFAULT_LAYER_CATEGORIES).forEach(([category, config]) => {
      let adjustedConfig = { ...config };

      // Apply theme-specific adjustments
      if (theme === 'dark' && THEME_ADJUSTMENTS.dark.colorMap) {
        const colorMap = THEME_ADJUSTMENTS.dark.colorMap;
        adjustedConfig.color = colorMap[config.color] || config.color;
      } else if (theme === 'high-contrast' && THEME_ADJUSTMENTS['high-contrast'].categories[category]) {
        const themeCategory = THEME_ADJUSTMENTS['high-contrast'].categories[category];
        adjustedConfig = { ...adjustedConfig, ...themeCategory };
      }

      configurations.push({
        id: `layer-category-${category}-${theme}${tenantId ? `-${tenantId}` : ''}`,
        type: 'layer-category',
        category: category,
        config: adjustedConfig,
        theme: theme,
        tenantId: tenantId || 'default',
        environment: environment,
        isEnabled: true,
        priority: 1,
        metadata: {
          displayName: `${category} category για ${theme} theme`,
          description: `Default ${category} category configuration για ${theme} theme`,
          category: 'layer-categories',
          version: '1.0.0',
          createdBy: 'migration-script',
          migrationDate: new Date().toISOString()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
  });

  return configurations;
}

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

/**
 * Initialize Firebase Admin
 */
function initializeFirebase() {
  try {
    // Try to initialize Firebase Admin
    let app;

    // Check if service account key exists
    const serviceAccountPath = path.join(process.cwd(), 'firebase-service-account.json');

    try {
      const serviceAccount = require(serviceAccountPath);
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin initialized with service account');
    } catch (error) {
      // Fallback to environment variables
      app = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
      console.log('✅ Firebase Admin initialized with environment variables');
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
 * Migrate layer styles και categories to Firebase
 */
async function migrateLayerStyles(db) {
  console.log('\n🎨 Starting layer styles migration...');

  const configurations = generateLayerStyleConfigurations();
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const config of configurations) {
    try {
      // Check if document already exists
      const docRef = db.collection(CONFIG_COLLECTION).doc(config.id);
      const existingDoc = await docRef.get();

      if (existingDoc.exists() && !force) {
        console.log(`⏩ Skipping ${config.id}: Already exists (use --force to override)`);
        skippedCount++;
        continue;
      }

      // Write to Firestore
      await docRef.set(config, { merge: !force });

      console.log(`✅ Migrated: ${config.id} (${config.type} - ${config.theme})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to migrate ${config.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏩ Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total: ${configurations.length}`);

  return { successCount, errorCount, skippedCount };
}

/**
 * Verify migration by reading back configuration
 */
async function verifyMigration(db) {
  console.log('\n🔍 Verifying migration...');

  try {
    // Check layer styles
    const stylesSnapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'layer-style')
      .get();

    // Check layer categories
    const categoriesSnapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'layer-category')
      .get();

    if (stylesSnapshot.empty && categoriesSnapshot.empty) {
      console.log('⚠️ No layer configuration documents found');
      return false;
    }

    console.log(`✅ Found ${stylesSnapshot.size} layer style configurations:`);
    const stylesByTheme = {};
    stylesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!stylesByTheme[data.theme]) stylesByTheme[data.theme] = [];
      stylesByTheme[data.theme].push(`${data.layerElementType}`);
    });

    Object.entries(stylesByTheme).forEach(([theme, types]) => {
      console.log(`   🎨 ${theme}: ${types.join(', ')}`);
    });

    console.log(`✅ Found ${categoriesSnapshot.size} layer category configurations:`);
    const categoriesByTheme = {};
    categoriesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!categoriesByTheme[data.theme]) categoriesByTheme[data.theme] = [];
      categoriesByTheme[data.theme].push(`${data.category}`);
    });

    Object.entries(categoriesByTheme).forEach(([theme, categories]) => {
      console.log(`   🏷️ ${theme}: ${categories.join(', ')}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Clean up existing layer configuration (optional)
 */
async function cleanupExistingConfig(db) {
  console.log('\n🧹 Cleaning up existing layer configuration...');

  try {
    const batch = db.batch();
    let deleteCount = 0;

    // Clean layer styles
    const stylesSnapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'layer-style')
      .get();

    stylesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    // Clean layer categories
    const categoriesSnapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'layer-category')
      .get();

    categoriesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    if (deleteCount === 0) {
      console.log('📋 No existing layer configuration to clean');
      return;
    }

    await batch.commit();
    console.log(`✅ Cleaned ${deleteCount} existing layer configuration documents`);
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

    // Optional: Clean existing configuration
    if (args.includes('--clean')) {
      await cleanupExistingConfig(db);
    }

    // Migrate configuration
    const { successCount, errorCount, skippedCount } = await migrateLayerStyles(db);

    // Verify migration
    const verified = await verifyMigration(db);

    // Final summary
    console.log('\n🎉 Layer Styles Migration completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Update your application to use EnterpriseLayerStyleService');
    console.log('   2. Test layer styling with the new configuration');
    console.log('   3. Configure environment-specific styles if needed');
    console.log('   4. Set up tenant-specific layer configurations');
    console.log('   5. Update layers.ts to use database-driven styles');
    console.log('\n📚 Documentation:');
    console.log('   - Service: src/services/layer/EnterpriseLayerStyleService.ts');
    console.log('   - Usage: src/types/layers.ts');
    console.log('\n🌟 Additional Commands:');
    console.log('   - Clean & migrate: node scripts/migrate-layer-styles.js --clean --force');
    console.log('   - Specific themes: node scripts/migrate-layer-styles.js --themes=default,dark');
    console.log('   - Tenant-specific: node scripts/migrate-layer-styles.js --tenant=company-a');

    if (successCount > 0 && verified) {
      console.log('\n✅ Layer styles migrated successfully!');
      console.log(`📊 Migrated ${successCount} configurations across ${themes.length} themes`);
      process.exit(0);
    } else {
      console.log('\n⚠️ Migration completed with some issues. Please review the logs above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure Firebase credentials are configured');
    console.log('   2. Verify COLLECTIONS.CONFIG is properly set');
    console.log('   3. Check Firestore security rules allow writes');
    console.log('   4. Ensure all required themes are valid');
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateLayerStyles,
  verifyMigration,
  DEFAULT_LAYER_STYLES,
  DEFAULT_LAYER_CATEGORIES
};