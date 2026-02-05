/**
 * =============================================================================
 * 📧 SETUP EMAIL INBOUND ROUTING - One-time Script
 * =============================================================================
 *
 * Τρέξε αυτό το script για να ρυθμίσεις το email inbound routing στο Firestore.
 *
 * Usage:
 *   node scripts/setup-email-routing.js
 *
 * Prerequisites:
 *   - Firebase Admin SDK credentials configured
 *   - .env.local with FIREBASE_* variables
 *
 * @created 2026-02-05
 * @related ADR-070 Email & AI Ingestion System
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Load environment variables manually (no dotenv dependency)
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {
    // File doesn't exist, that's OK
  }
}

// Load env files
loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// =============================================================================
// CONFIGURATION - ΑΛΛΑΞΕ ΑΥΤΑ ΑΝ ΧΡΕΙΑΖΕΤΑΙ
// =============================================================================

/**
 * Email routing rules configuration
 *
 * Pattern types:
 *   - "inbound@example.com" - Exact email match
 *   - "@example.com" - Any email at domain
 *   - "example.com" - Any email at domain (shorthand)
 */
const EMAIL_ROUTING_RULES = [
  {
    pattern: 'inbound@nestorconstruct.gr',
    companyId: 'pzNUy8ksddGCtcQMqumR',
    isActive: true,
    description: 'Primary inbound email for Nestor Construct'
  },
  // Add more rules as needed:
  // {
  //   pattern: '@otherdomain.com',
  //   companyId: 'other-company-id',
  //   isActive: true,
  //   description: 'All emails from otherdomain.com'
  // }
];

// =============================================================================
// FIREBASE INIT
// =============================================================================

function initializeFirebase() {
  // Check if already initialized
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  // Try to use service account from environment
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccount) {
    try {
      const credentials = JSON.parse(serviceAccount);
      return admin.initializeApp({
        credential: admin.credential.cert(credentials),
        projectId: credentials.project_id
      });
    } catch (e) {
      console.error('Failed to parse service account:', e.message);
    }
  }

  // Try to use application default credentials
  try {
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
    });
  } catch (e) {
    console.error('Failed to initialize with default credentials:', e.message);
  }

  // Last resort: try with just project ID (for emulator)
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (projectId) {
    console.log('⚠️ Initializing without credentials (emulator mode)');
    return admin.initializeApp({ projectId });
  }

  throw new Error('Could not initialize Firebase Admin SDK');
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('📧 Setting up Email Inbound Routing...\n');

  try {
    // Initialize Firebase
    initializeFirebase();
    const db = admin.firestore();

    // Display rules to be configured
    console.log('📋 Routing Rules to Configure:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    EMAIL_ROUTING_RULES.forEach((rule, idx) => {
      console.log(`   ${idx + 1}. Pattern: ${rule.pattern}`);
      console.log(`      Company ID: ${rule.companyId}`);
      console.log(`      Active: ${rule.isActive ? 'Yes' : 'No'}`);
      if (rule.description) {
        console.log(`      Description: ${rule.description}`);
      }
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Prepare the routing configuration (strip description for storage)
    const routingConfig = EMAIL_ROUTING_RULES.map(rule => ({
      pattern: rule.pattern,
      companyId: rule.companyId,
      isActive: rule.isActive
    }));

    // Get settings document reference
    const settingsRef = db.collection('system').doc('settings');

    // Check if document exists
    const existing = await settingsRef.get();

    if (existing.exists) {
      // Update existing document (merge integrations section)
      await settingsRef.set({
        integrations: {
          emailInboundRouting: routingConfig,
          emailRoutingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          emailRoutingUpdatedBy: 'setup-script'
        }
      }, { merge: true });
      console.log('✅ Updated existing settings document with email routing');
    } else {
      // Create new document
      await settingsRef.set({
        integrations: {
          emailInboundRouting: routingConfig,
          emailRoutingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          emailRoutingUpdatedBy: 'setup-script'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'setup-script'
      });
      console.log('✅ Created new settings document with email routing');
    }

    // Verify
    const verify = await settingsRef.get();
    const savedRouting = verify.data()?.integrations?.emailInboundRouting;

    console.log('\n📋 Saved Configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (savedRouting && Array.isArray(savedRouting)) {
      savedRouting.forEach((rule, idx) => {
        console.log(`   ${idx + 1}. ${rule.pattern} → ${rule.companyId} (${rule.isActive ? 'active' : 'inactive'})`);
      });
    } else {
      console.log('   ⚠️ No routing rules found after save');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n🎉 Done! Email routing is now configured.\n');
    console.log('📌 Next Steps:');
    console.log('   1. Configure Mailgun receiving route in the Mailgun dashboard');
    console.log('   2. Forward to: https://nestor-app.vercel.app/api/communications/webhooks/mailgun/inbound');
    console.log('   3. Add MAILGUN_WEBHOOK_SIGNING_KEY to Vercel environment variables');
    console.log('   4. (Optional) Add OPENAI_API_KEY and set AI_PROVIDER=openai for AI analysis\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
