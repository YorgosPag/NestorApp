#!/usr/bin/env node

/**
 * 🏢 COMPANY SETTINGS MIGRATION SCRIPT
 *
 * Μεταφέρει τα hardcoded company settings στη Firebase για enterprise deployment.
 *
 * Usage:
 *   node scripts/migrate-company-settings.js [--tenant=TENANT_ID] [--environment=ENV] [--force]
 *
 * Examples:
 *   node scripts/migrate-company-settings.js
 *   node scripts/migrate-company-settings.js --tenant=company-a --environment=production
 *   node scripts/migrate-company-settings.js --environment=development --force
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
const force = args.includes('--force');

console.log('🏢 Company Settings Migration Script');
console.log(`📄 Target Collection: ${CONFIG_COLLECTION}`);
console.log(`🏢 Tenant ID: ${tenantId || 'default'}`);
console.log(`🌍 Environment: ${environment}`);
console.log(`💪 Force Mode: ${force ? 'enabled' : 'disabled'}`);

// ============================================================================
// COMPANY SETTINGS CONFIGURATION DATA
// ============================================================================

/**
 * Enterprise company settings templates
 * These will be inserted into Firebase as configurable documents
 */
const COMPANY_SETTINGS_CONFIGURATIONS = [
  {
    id: 'company-basic-settings',
    type: 'company-settings',
    category: 'basic',
    tenantId: tenantId || 'default',
    environment: environment,
    isEnabled: true,
    priority: 1,
    settings: {
      // Basic company information
      companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Real Estate Company',
      legalName: process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME || 'Real Estate Company Ltd.',
      vatNumber: process.env.NEXT_PUBLIC_COMPANY_VAT || 'EL123456789',
      businessType: 'real-estate',

      // Contact information
      email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'info@realestate.gr',
      phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+30 210 1234567',
      mobile: process.env.NEXT_PUBLIC_COMPANY_MOBILE || '+30 694 1234567',
      fax: process.env.NEXT_PUBLIC_COMPANY_FAX || '+30 210 1234568',

      // Address
      address: {
        street: process.env.NEXT_PUBLIC_COMPANY_STREET || 'Main Street 123',
        city: process.env.NEXT_PUBLIC_COMPANY_CITY || 'Athens',
        postalCode: process.env.NEXT_PUBLIC_COMPANY_POSTAL_CODE || '10561',
        region: process.env.NEXT_PUBLIC_COMPANY_REGION || 'Attica',
        country: process.env.NEXT_PUBLIC_COMPANY_COUNTRY || 'Greece',
        countryCode: process.env.NEXT_PUBLIC_COMPANY_COUNTRY_CODE || 'GR'
      },

      // Website & Social
      website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || 'https://realestate.gr',
      socialMedia: {
        facebook: process.env.NEXT_PUBLIC_COMPANY_FACEBOOK || '',
        instagram: process.env.NEXT_PUBLIC_COMPANY_INSTAGRAM || '',
        linkedin: process.env.NEXT_PUBLIC_COMPANY_LINKEDIN || '',
        youtube: process.env.NEXT_PUBLIC_COMPANY_YOUTUBE || ''
      }
    },
    metadata: {
      description: 'Basic company settings for real estate business',
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    id: 'company-branding-settings',
    type: 'company-settings',
    category: 'branding',
    tenantId: tenantId || 'default',
    environment: environment,
    isEnabled: true,
    priority: 2,
    settings: {
      // Brand identity
      logo: process.env.NEXT_PUBLIC_COMPANY_LOGO || '/images/logo.png',
      favicon: process.env.NEXT_PUBLIC_COMPANY_FAVICON || '/favicon.ico',

      // Brand colors
      colors: {
        primary: process.env.NEXT_PUBLIC_BRAND_PRIMARY_COLOR || '#2563eb',
        secondary: process.env.NEXT_PUBLIC_BRAND_SECONDARY_COLOR || '#64748b',
        accent: process.env.NEXT_PUBLIC_BRAND_ACCENT_COLOR || '#f59e0b',
        background: process.env.NEXT_PUBLIC_BRAND_BG_COLOR || '#ffffff',
        text: process.env.NEXT_PUBLIC_BRAND_TEXT_COLOR || '#1e293b'
      },

      // Typography
      fonts: {
        primary: process.env.NEXT_PUBLIC_BRAND_FONT_PRIMARY || 'Inter',
        secondary: process.env.NEXT_PUBLIC_BRAND_FONT_SECONDARY || 'Inter'
      },

      // Marketing materials
      slogan: process.env.NEXT_PUBLIC_COMPANY_SLOGAN || 'Your Trusted Real Estate Partner',
      description: process.env.NEXT_PUBLIC_COMPANY_DESCRIPTION || 'Professional real estate services in Greece'
    },
    metadata: {
      description: 'Company branding and visual identity settings',
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    id: 'company-business-settings',
    type: 'company-settings',
    category: 'business',
    tenantId: tenantId || 'default',
    environment: environment,
    isEnabled: true,
    priority: 3,
    settings: {
      // Business operations
      workingHours: {
        monday: { open: '09:00', close: '18:00', isOpen: true },
        tuesday: { open: '09:00', close: '18:00', isOpen: true },
        wednesday: { open: '09:00', close: '18:00', isOpen: true },
        thursday: { open: '09:00', close: '18:00', isOpen: true },
        friday: { open: '09:00', close: '18:00', isOpen: true },
        saturday: { open: '10:00', close: '15:00', isOpen: true },
        sunday: { open: '10:00', close: '15:00', isOpen: false }
      },

      // Licensing & Certifications
      licenses: [
        {
          type: 'real-estate-broker',
          number: process.env.NEXT_PUBLIC_BROKER_LICENSE || 'BR123456',
          issuer: 'Hellenic Ministry of Development',
          expiryDate: '2025-12-31',
          isActive: true
        }
      ],

      // Service areas
      serviceAreas: [
        'Athens Center',
        'Piraeus',
        'Glyfada',
        'Kifisia',
        'Marousi'
      ],

      // Property specializations
      specializations: [
        'residential-sales',
        'residential-rentals',
        'commercial-properties',
        'luxury-properties',
        'new-developments'
      ],

      // Commission rates (for internal use)
      commissionRates: {
        sales: parseFloat(process.env.NEXT_PUBLIC_SALES_COMMISSION || '2.5'),
        rentals: parseFloat(process.env.NEXT_PUBLIC_RENTAL_COMMISSION || '1.0'),
        commercial: parseFloat(process.env.NEXT_PUBLIC_COMMERCIAL_COMMISSION || '3.0')
      }
    },
    metadata: {
      description: 'Business operations and service configuration',
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    id: 'company-communication-templates',
    type: 'company-settings',
    category: 'communication',
    tenantId: tenantId || 'default',
    environment: environment,
    isEnabled: true,
    priority: 4,
    settings: {
      // Email templates
      emailSignature: `
Best regards,
{{companyName}}

📧 {{companyEmail}}
📞 {{companyPhone}}
🌐 {{companyWebsite}}
📍 {{companyAddress}}
      `.trim(),

      // Template variables για communications
      templateVariables: {
        companyName: '{{companyName}}',
        companyEmail: '{{companyEmail}}',
        companyPhone: '{{companyPhone}}',
        companyMobile: '{{companyMobile}}',
        companyWebsite: '{{companyWebsite}}',
        companyAddress: '{{companyAddress}}',
        currentDate: '{{currentDate}}',
        currentTime: '{{currentTime}}',
        agentName: '{{agentName}}',
        agentEmail: '{{agentEmail}}',
        clientName: '{{clientName}}'
      },

      // Automated message templates
      autoResponders: {
        inquiryReceived: {
          subject: 'Thank you for your inquiry - {{companyName}}',
          content: `
Dear {{clientName}},

Thank you for your interest in our services. We have received your inquiry and one of our experienced agents will contact you within 24 hours.

{{emailSignature}}
          `.trim()
        },
        appointmentConfirmed: {
          subject: 'Appointment Confirmation - {{companyName}}',
          content: `
Dear {{clientName}},

Your appointment has been confirmed for {{appointmentDate}} at {{appointmentTime}}.

Meeting details:
- Agent: {{agentName}}
- Property: {{propertyAddress}}
- Contact: {{agentEmail}} / {{agentPhone}}

{{emailSignature}}
          `.trim()
        }
      }
    },
    metadata: {
      description: 'Communication templates and automated messaging',
      version: '1.0.0',
      createdBy: 'migration-script',
      migrationDate: new Date().toISOString()
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
 * Migrate company settings configuration to Firebase
 */
async function migrateCompanySettings(db) {
  console.log('\n🏢 Starting company settings migration...');

  let successCount = 0;
  let errorCount = 0;

  for (const config of COMPANY_SETTINGS_CONFIGURATIONS) {
    try {
      // Check if document already exists
      const docRef = db.collection(CONFIG_COLLECTION).doc(config.id);
      const existingDoc = await docRef.get();

      if (existingDoc.exists() && !force) {
        console.log(`⏩ Skipping ${config.id}: Already exists (use --force to override)`);
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

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📋 Total: ${COMPANY_SETTINGS_CONFIGURATIONS.length}`);

  return { successCount, errorCount };
}

/**
 * Verify migration by reading back configuration
 */
async function verifyMigration(db) {
  console.log('\n🔍 Verifying migration...');

  try {
    const snapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'company-settings')
      .get();

    if (snapshot.empty) {
      console.log('⚠️ No company settings documents found in configuration collection');
      return false;
    }

    console.log(`✅ Found ${snapshot.size} company settings documents:`);

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   🏢 ${doc.id}: ${data.category} - ${data.isEnabled ? 'enabled' : 'disabled'}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

/**
 * Clean up existing company settings (optional)
 */
async function cleanupExistingConfig(db) {
  console.log('\n🧹 Cleaning up existing company settings...');

  try {
    const snapshot = await db.collection(CONFIG_COLLECTION)
      .where('type', '==', 'company-settings')
      .get();

    if (snapshot.empty) {
      console.log('📋 No existing company settings to clean');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Cleaned ${snapshot.size} existing company settings documents`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

/**
 * Generate example environment variables file
 */
function generateEnvExample() {
  const envExample = `
# Company Settings Environment Variables Example
# Copy these to your .env.local file and customize the values

# Basic Company Information
NEXT_PUBLIC_COMPANY_NAME="Your Real Estate Company"
NEXT_PUBLIC_COMPANY_LEGAL_NAME="Your Real Estate Company Ltd."
NEXT_PUBLIC_COMPANY_VAT="EL123456789"

# Contact Information
NEXT_PUBLIC_COMPANY_EMAIL="info@yourcompany.gr"
NEXT_PUBLIC_COMPANY_PHONE="+30 210 1234567"
NEXT_PUBLIC_COMPANY_MOBILE="+30 694 1234567"
NEXT_PUBLIC_COMPANY_WEBSITE="https://yourcompany.gr"

# Address
NEXT_PUBLIC_COMPANY_STREET="Main Street 123"
NEXT_PUBLIC_COMPANY_CITY="Athens"
NEXT_PUBLIC_COMPANY_POSTAL_CODE="10561"
NEXT_PUBLIC_COMPANY_REGION="Attica"
NEXT_PUBLIC_COMPANY_COUNTRY="Greece"

# Branding
NEXT_PUBLIC_BRAND_PRIMARY_COLOR="#2563eb"
NEXT_PUBLIC_COMPANY_SLOGAN="Your Trusted Real Estate Partner"

# Business
NEXT_PUBLIC_BROKER_LICENSE="BR123456"
NEXT_PUBLIC_SALES_COMMISSION="2.5"
NEXT_PUBLIC_RENTAL_COMMISSION="1.0"
  `.trim();

  console.log('\n📝 Example Environment Variables:');
  console.log(envExample);
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

    // Show example environment variables
    if (args.includes('--env-example')) {
      generateEnvExample();
      return;
    }

    // Migrate configuration
    const { successCount, errorCount } = await migrateCompanySettings(db);

    // Verify migration
    const verified = await verifyMigration(db);

    // Final summary
    console.log('\n🎉 Company Settings Migration completed!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Update your application to use EnterpriseCompanySettingsService');
    console.log('   2. Test company settings loading with the new configuration');
    console.log('   3. Configure environment-specific settings if needed');
    console.log('   4. Set up tenant-specific company configurations');
    console.log('   5. Update CommunicationsService to use new template variables');
    console.log('\n📚 Documentation:');
    console.log('   - Service: src/services/company/EnterpriseCompanySettingsService.ts');
    console.log('   - Usage: src/lib/communications/CommunicationsService.ts');
    console.log('\n🌟 Additional Commands:');
    console.log('   - Generate env example: node scripts/migrate-company-settings.js --env-example');
    console.log('   - Force override: node scripts/migrate-company-settings.js --force');
    console.log('   - Clean & migrate: node scripts/migrate-company-settings.js --clean --force');

    if (successCount === COMPANY_SETTINGS_CONFIGURATIONS.length && verified) {
      console.log('\n✅ All company settings migrated successfully!');
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
    console.log('   4. Ensure environment variables are set (use --env-example)');
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  migrateCompanySettings,
  verifyMigration,
  COMPANY_SETTINGS_CONFIGURATIONS
};