#!/usr/bin/env node

/**
 * 👤 USER PREFERENCES MIGRATION SCRIPT
 *
 * Μεταφέρει τα hardcoded user preferences στη Firebase για personalized experiences.
 *
 * Usage:
 *   node scripts/migrate-user-preferences.js [--tenant=TENANT_ID] [--environment=ENV] [--users=USERS] [--force]
 *
 * Examples:
 *   node scripts/migrate-user-preferences.js
 *   node scripts/migrate-user-preferences.js --tenant=company-a --environment=production
 *   node scripts/migrate-user-preferences.js --users=admin,user1,user2 --force
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Firestore collections
const CONFIG_COLLECTION = process.env.NEXT_PUBLIC_CONFIG_COLLECTION || 'config';
const USER_PREFERENCES_COLLECTION = process.env.NEXT_PUBLIC_USER_PREFERENCES_COLLECTION || 'user_preferences';

// Parse command line arguments
const args = process.argv.slice(2);
const tenantId = args.find(arg => arg.startsWith('--tenant='))?.split('=')[1];
const environment = args.find(arg => arg.startsWith('--environment='))?.split('=')[1] || 'production';
const users = args.find(arg => arg.startsWith('--users='))?.split('=')[1]?.split(',') || ['admin', 'demo-user'];
const force = args.includes('--force');

console.log('👤 User Preferences Migration Script');
console.log(`📄 Target Collections: ${CONFIG_COLLECTION}, ${USER_PREFERENCES_COLLECTION}`);
console.log(`🏢 Tenant ID: ${tenantId || 'default'}`);
console.log(`🌍 Environment: ${environment}`);
console.log(`👥 Users: ${users.join(', ')}`);
console.log(`💪 Force Mode: ${force ? 'enabled' : 'disabled'}`);

// ============================================================================
// USER PREFERENCES CONFIGURATION DATA
// ============================================================================

/**
 * Default user preferences που θα μεταφερθούν στη Firebase
 */
const DEFAULT_USER_PREFERENCES = {
  propertyViewer: {
    defaultFilters: {
      searchTerm: '',
      project: [],
      building: [],
      floor: [],
      propertyType: [],
      status: [],
      priceRange: { min: null, max: null },
      areaRange: { min: null, max: null },
      features: []
    },
    defaultStats: {
      totalProperties: 0,
      availableProperties: 0,
      soldProperties: 0,
      totalValue: 0,
      totalArea: 0,
      averagePrice: 0,
      propertiesByStatus: {},
      propertiesByType: {},
      propertiesByFloor: {},
      totalStorageUnits: 0,
      availableStorageUnits: 0,
      soldStorageUnits: 0,
      uniqueBuildings: 0,
      reserved: 0
    },
    fallbackFloorId: process.env.NEXT_PUBLIC_DEFAULT_FLOOR_ID || 'floor-1',
    viewMode: 'grid',
    showGrid: true,
    snapToGrid: false,
    gridSize: 20,
    showMeasurements: true,
    scale: 1,
    showDashboard: true,
    autoSaveFilters: true,
    rememberLastView: true
  },
  editorTools: {
    defaultTool: 'select',
    showToolTips: true,
    keyboardShortcuts: {
      'ctrl+z': 'undo',
      'ctrl+y': 'redo',
      'delete': 'delete',
      'escape': 'deselect'
    },
    toolbarLayout: 'horizontal',
    showAdvancedTools: false
  },
  display: {
    theme: 'light',
    colorScheme: 'blue',
    fontSize: 'medium',
    density: 'comfortable',
    animations: true,
    highContrast: false,
    reduceMotion: false
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    soundEnabled: true,
    notificationTypes: {
      propertyUpdates: true,
      systemMessages: true,
      taskReminders: true,
      collaborationUpdates: false
    }
  },
  customSettings: {}
};

/**
 * Company default preferences templates
 */
const COMPANY_DEFAULT_PREFERENCES = [
  {
    id: `company-defaults-propertyViewer-${tenantId || 'default'}`,
    type: 'company-defaults',
    tenantId: tenantId || 'default',
    category: 'propertyViewer',
    defaults: {
      viewMode: environment === 'production' ? 'grid' : 'list', // Different defaults per environment
      showGrid: true,
      snapToGrid: environment === 'development', // Enable snap in dev για easier testing
      gridSize: 20,
      showMeasurements: true,
      autoSaveFilters: true,
      rememberLastView: true,
      defaultFilters: {
        // Company-specific default filters
        status: environment === 'production' ? ['available'] : [], // Show only available in prod
        propertyType: [], // No default property type filter
        features: [] // No default features filter
      }
    },
    isEnabled: true,
    priority: 1,
    environment: environment,
    metadata: {
      displayName: `Property Viewer defaults για ${tenantId || 'default'}`,
      description: `Company default preferences για property viewer functionality`,
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    id: `company-defaults-editorTools-${tenantId || 'default'}`,
    type: 'company-defaults',
    tenantId: tenantId || 'default',
    category: 'editorTools',
    defaults: {
      defaultTool: 'select',
      showToolTips: environment !== 'production', // Hide tooltips in production για cleaner UI
      toolbarLayout: 'horizontal',
      showAdvancedTools: environment === 'development', // Show advanced tools only in dev
      keyboardShortcuts: {
        'ctrl+z': 'undo',
        'ctrl+y': 'redo',
        'ctrl+shift+z': 'redo', // Alternative redo shortcut
        'delete': 'delete',
        'backspace': 'delete',
        'escape': 'deselect',
        'ctrl+a': 'selectAll',
        'ctrl+d': 'duplicate'
      }
    },
    isEnabled: true,
    priority: 1,
    environment: environment,
    metadata: {
      displayName: `Editor Tools defaults για ${tenantId || 'default'}`,
      description: `Company default preferences για editor tools και shortcuts`,
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    id: `company-defaults-display-${tenantId || 'default'}`,
    type: 'company-defaults',
    tenantId: tenantId || 'default',
    category: 'display',
    defaults: {
      theme: process.env.NEXT_PUBLIC_DEFAULT_THEME || 'light',
      colorScheme: process.env.NEXT_PUBLIC_DEFAULT_COLOR_SCHEME || 'blue',
      fontSize: 'medium',
      density: 'comfortable',
      animations: environment !== 'production', // Disable animations in prod για performance
      highContrast: false,
      reduceMotion: false
    },
    isEnabled: true,
    priority: 1,
    environment: environment,
    metadata: {
      displayName: `Display defaults για ${tenantId || 'default'}`,
      description: `Company default preferences για display και UI settings`,
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    id: `company-defaults-notifications-${tenantId || 'default'}`,
    type: 'company-defaults',
    tenantId: tenantId || 'default',
    category: 'notifications',
    defaults: {
      emailNotifications: environment === 'production', // Enable email in prod only
      pushNotifications: true,
      soundEnabled: environment !== 'production', // Disable sound in prod
      notificationTypes: {
        propertyUpdates: true,
        systemMessages: true,
        taskReminders: environment === 'production', // Task reminders only in prod
        collaborationUpdates: true
      }
    },
    isEnabled: true,
    priority: 1,
    environment: environment,
    metadata: {
      displayName: `Notification defaults για ${tenantId || 'default'}`,
      description: `Company default preferences για notifications και alerts`,
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * Generate user preferences configurations για all users
 */
function generateUserPreferencesConfigurations() {
  const configurations = [];

  users.forEach(userId => {
    // Customize preferences based on user role
    let userPrefs = { ...DEFAULT_USER_PREFERENCES };

    // Admin users get advanced settings
    if (userId === 'admin') {
      userPrefs.editorTools.showAdvancedTools = true;
      userPrefs.editorTools.showToolTips = true;
      userPrefs.propertyViewer.showDashboard = true;
      userPrefs.display.animations = true;
    }

    // Demo users get simplified settings
    if (userId.includes('demo')) {
      userPrefs.editorTools.showAdvancedTools = false;
      userPrefs.editorTools.showToolTips = true; // Keep tooltips για demo
      userPrefs.propertyViewer.viewMode = 'grid'; // Grid is more visual για demos
      userPrefs.notifications.emailNotifications = false; // No emails για demo users
    }

    const docId = `${userId}_${tenantId || 'default'}`;

    configurations.push({
      id: docId,
      userId: userId,
      tenantId: tenantId || 'default',
      preferences: userPrefs,
      isEnabled: true,
      version: '1.0.0',
      metadata: {
        displayName: `Preferences για user ${userId}`,
        description: `User-specific application preferences και settings`,
        lastSyncedAt: new Date(),
        deviceInfo: {
          deviceType: 'migration-script',
          browserInfo: 'Node.js',
          screenResolution: 'unknown'
        },
        migrationInfo: {
          migratedFrom: 'hardcoded-defaults',
          migrationDate: new Date()
        },
        createdBy: 'migration-script',
        createdAt: new Date(),
        updatedAt: new Date()
      }
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
 * Migrate company default preferences to Firebase
 */
async function migrateCompanyDefaults(db) {
  console.log('\n🏢 Starting company defaults migration...');

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const config of COMPANY_DEFAULT_PREFERENCES) {
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

      console.log(`✅ Migrated: ${config.id} (${config.category})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to migrate ${config.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Company Defaults Migration Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏩ Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total: ${COMPANY_DEFAULT_PREFERENCES.length}`);

  return { successCount, errorCount, skippedCount };
}

/**
 * Migrate user preferences to Firebase
 */
async function migrateUserPreferences(db) {
  console.log('\n👤 Starting user preferences migration...');

  const configurations = generateUserPreferencesConfigurations();
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const config of configurations) {
    try {
      // Check if document already exists
      const docRef = db.collection(USER_PREFERENCES_COLLECTION).doc(config.id);
      const existingDoc = await docRef.get();

      if (existingDoc.exists() && !force) {
        console.log(`⏩ Skipping ${config.id}: Already exists (use --force to override)`);
        skippedCount++;
        continue;
      }

      // Write to Firestore
      await docRef.set(config, { merge: !force });

      console.log(`✅ Migrated: ${config.id} (${config.userId})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to migrate ${config.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 User Preferences Migration Summary:`);
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
    // Check company defaults
    const defaultsSnapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'company-defaults')
      .get();

    // Check user preferences
    const preferencesSnapshot = await db.collection(USER_PREFERENCES_COLLECTION).get();

    if (defaultsSnapshot.empty && preferencesSnapshot.empty) {
      console.log('⚠️ No user preference documents found');
      return false;
    }

    console.log(`✅ Found ${defaultsSnapshot.size} company default configurations:`);
    const defaultsByCategory = {};
    defaultsSnapshot.forEach(doc => {
      const data = doc.data();
      if (!defaultsByCategory[data.category]) defaultsByCategory[data.category] = 0;
      defaultsByCategory[data.category]++;
    });

    Object.entries(defaultsByCategory).forEach(([category, count]) => {
      console.log(`   🏢 ${category}: ${count} configurations`);
    });

    console.log(`✅ Found ${preferencesSnapshot.size} user preference configurations:`);
    const usersByTenant = {};
    preferencesSnapshot.forEach(doc => {
      const data = doc.data();
      const tenant = data.tenantId || 'default';
      if (!usersByTenant[tenant]) usersByTenant[tenant] = [];
      usersByTenant[tenant].push(data.userId);
    });

    Object.entries(usersByTenant).forEach(([tenant, users]) => {
      console.log(`   👤 ${tenant}: ${users.join(', ')}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Clean up existing preferences (optional)
 */
async function cleanupExistingConfig(db) {
  console.log('\n🧹 Cleaning up existing preferences...');

  try {
    const batch = db.batch();
    let deleteCount = 0;

    // Clean company defaults
    const defaultsSnapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'company-defaults')
      .get();

    defaultsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    // Clean user preferences
    const preferencesSnapshot = await db.collection(USER_PREFERENCES_COLLECTION).get();

    preferencesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      deleteCount++;
    });

    if (deleteCount === 0) {
      console.log('📋 No existing preferences to clean');
      return;
    }

    await batch.commit();
    console.log(`✅ Cleaned ${deleteCount} existing preference documents`);
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

    // Migrate company defaults first
    const defaultsResult = await migrateCompanyDefaults(db);

    // Migrate user preferences
    const preferencesResult = await migrateUserPreferences(db);

    // Verify migration
    const verified = await verifyMigration(db);

    // Final summary
    console.log('\n🎉 User Preferences Migration completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Update your application to use EnterpriseUserPreferencesService');
    console.log('   2. Test user preferences loading with the new configuration');
    console.log('   3. Configure user-specific settings through the UI');
    console.log('   4. Set up company default preferences για new users');
    console.log('   5. Update usePropertyViewer hook to use database-driven preferences');
    console.log('\n📚 Documentation:');
    console.log('   - Service: src/services/user/EnterpriseUserPreferencesService.ts');
    console.log('   - Usage: src/hooks/usePropertyViewer.ts');
    console.log('\n🌟 Additional Commands:');
    console.log('   - Clean & migrate: node scripts/migrate-user-preferences.js --clean --force');
    console.log('   - Specific users: node scripts/migrate-user-preferences.js --users=admin,user1,user2');
    console.log('   - Tenant-specific: node scripts/migrate-user-preferences.js --tenant=company-a');

    const totalSuccess = defaultsResult.successCount + preferencesResult.successCount;
    const totalExpected = COMPANY_DEFAULT_PREFERENCES.length + users.length;

    if (totalSuccess > 0 && verified) {
      console.log('\n✅ User preferences migrated successfully!');
      console.log(`📊 Migrated ${totalSuccess}/${totalExpected} configurations`);
      process.exit(0);
    } else {
      console.log('\n⚠️ Migration completed with some issues. Please review the logs above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure Firebase credentials are configured');
    console.log('   2. Verify COLLECTIONS.CONFIG and USER_PREFERENCES are properly set');
    console.log('   3. Check Firestore security rules allow writes');
    console.log('   4. Ensure all required users are valid');
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateCompanyDefaults,
  migrateUserPreferences,
  verifyMigration,
  DEFAULT_USER_PREFERENCES,
  COMPANY_DEFAULT_PREFERENCES
};