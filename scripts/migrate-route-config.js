#!/usr/bin/env node

/**
 * 🚀 ROUTE CONFIGURATION MIGRATION SCRIPT
 *
 * Μεταφέρει τη hardcoded route configuration στη Firebase για enterprise deployment.
 *
 * Usage:
 *   node scripts/migrate-route-config.js [--tenant=TENANT_ID] [--environment=ENV]
 *
 * Examples:
 *   node scripts/migrate-route-config.js
 *   node scripts/migrate-route-config.js --tenant=company-a --environment=production
 *   node scripts/migrate-route-config.js --environment=development
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

console.log('🚀 Route Configuration Migration Script');
console.log(`📄 Target Collection: ${CONFIG_COLLECTION}`);
console.log(`🏢 Tenant ID: ${tenantId || 'default'}`);
console.log(`🌍 Environment: ${environment}`);

// ============================================================================
// ROUTE CONFIGURATION DATA
// ============================================================================

/**
 * Enterprise route configuration templates
 * These will be inserted into Firebase as configurable documents
 */
const ROUTE_CONFIGURATIONS = [
  {
    id: 'buildings-critical',
    route: 'buildings',
    category: 'critical',
    priority: 1,
    requiredRoles: ['admin', 'agent', 'user'],
    isEnabled: true,
    preloadOnIdle: false,
    preloadOnHover: true,
    environment: 'all',
    order: 1,
    metadata: {
      description: 'Building management interface',
      estimatedLoadTime: 800,
      bundleSize: 120000,
      dependencies: ['@/components/building-management']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'contacts-critical',
    route: 'contacts',
    category: 'critical',
    priority: 2,
    requiredRoles: ['admin', 'agent', 'user'],
    isEnabled: true,
    preloadOnIdle: false,
    preloadOnHover: true,
    environment: 'all',
    order: 2,
    metadata: {
      description: 'Contact management interface',
      estimatedLoadTime: 600,
      bundleSize: 90000,
      dependencies: ['@/components/contacts']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'dxf-viewer-admin',
    route: 'dxf-viewer',
    category: 'admin',
    priority: 1,
    requiredRoles: ['admin'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: false,
    environment: 'all',
    order: 3,
    metadata: {
      description: 'CAD/DXF file viewer and editor',
      estimatedLoadTime: 2000,
      bundleSize: 450000,
      dependencies: ['@/subapps/dxf-viewer', 'three', 'dxf-parser']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'crm-dashboard-admin',
    route: 'crm-dashboard',
    category: 'admin',
    priority: 2,
    requiredRoles: ['admin', 'agent'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: true,
    environment: 'all',
    order: 4,
    metadata: {
      description: 'CRM analytics dashboard',
      estimatedLoadTime: 1200,
      bundleSize: 200000,
      dependencies: ['@/components/crm', 'recharts']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'properties-idle',
    route: 'properties',
    category: 'idle',
    priority: 1,
    requiredRoles: ['admin', 'agent', 'user'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: true,
    environment: 'all',
    order: 5,
    metadata: {
      description: 'Property listing and management',
      estimatedLoadTime: 900,
      bundleSize: 150000,
      dependencies: ['@/components/properties']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'obligations-new-admin',
    route: 'obligations-new',
    category: 'admin',
    priority: 3,
    requiredRoles: ['admin', 'agent'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: true,
    environment: 'all',
    order: 6,
    metadata: {
      description: 'New obligation document creation',
      estimatedLoadTime: 700,
      bundleSize: 80000,
      dependencies: ['@/components/obligations']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'obligations-edit-admin',
    route: 'obligations-edit',
    category: 'admin',
    priority: 4,
    requiredRoles: ['admin', 'agent'],
    isEnabled: true,
    preloadOnIdle: true,
    preloadOnHover: true,
    environment: 'all',
    order: 7,
    metadata: {
      description: 'Obligation document editing interface',
      estimatedLoadTime: 750,
      bundleSize: 85000,
      dependencies: ['@/components/obligations']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

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
 * Migrate route configuration to Firebase
 */
async function migrateRouteConfiguration(db) {
  console.log('\n📦 Starting route configuration migration...');

  let successCount = 0;
  let errorCount = 0;

  for (const config of ROUTE_CONFIGURATIONS) {
    try {
      // Add tenant ID if specified
      const configWithTenant = tenantId
        ? { ...config, tenantId }
        : config;

      // Add environment filter if specified
      if (environment && environment !== 'all') {
        configWithTenant.environment = environment;
      }

      // Write to Firestore
      const docRef = db.collection(CONFIG_COLLECTION).doc(config.id);
      await docRef.set(configWithTenant, { merge: true });

      console.log(`✅ Migrated: ${config.id} (${config.route})`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to migrate ${config.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total: ${ROUTE_CONFIGURATIONS.length}`);

  return { successCount, errorCount };
}

/**
 * Verify migration by reading back configuration
 */
async function verifyMigration(db) {
  console.log('\n🔍 Verifying migration...');

  try {
    const snapshot = await db.collection(CONFIG_COLLECTION).get();

    if (snapshot.empty) {
      console.log('⚠️ No documents found in configuration collection');
      return false;
    }

    console.log(`✅ Found ${snapshot.size} configuration documents:`);

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   📄 ${doc.id}: ${data.route} (${data.category}) - ${data.isEnabled ? 'enabled' : 'disabled'}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Clean up existing configuration (optional)
 */
async function cleanupExistingConfig(db) {
  console.log('\n🧹 Cleaning up existing configuration...');

  try {
    const snapshot = await db.collection(CONFIG_COLLECTION).get();

    if (snapshot.empty) {
      console.log('📋 No existing configuration to clean');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Cleaned ${snapshot.size} existing configuration documents`);
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
    const { successCount, errorCount } = await migrateRouteConfiguration(db);

    // Verify migration
    const verified = await verifyMigration(db);

    // Final summary
    console.log('\n🎉 Migration completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Update your application to use EnterpriseRouteConfigService');
    console.log('   2. Test route preloading with the new configuration');
    console.log('   3. Configure environment-specific routes if needed');
    console.log('   4. Set up tenant-specific configurations');
    console.log('\n📚 Documentation:');
    console.log('   - Service: src/services/routes/EnterpriseRouteConfigService.ts');
    console.log('   - Usage: src/utils/preloadRoutes.ts');

    if (successCount === ROUTE_CONFIGURATIONS.length && verified) {
      console.log('\n✅ All configurations migrated successfully!');
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
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}