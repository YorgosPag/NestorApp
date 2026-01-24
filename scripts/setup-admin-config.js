/**
 * =============================================================================
 * 🔧 SETUP ADMIN CONFIG - One-time Script
 * =============================================================================
 *
 * Τρέξε αυτό το script για να ρυθμίσεις τον admin config στο Firestore.
 *
 * Usage:
 *   node scripts/setup-admin-config.js
 *
 * Prerequisites:
 *   - Firebase Admin SDK credentials configured
 *   - .env.local with FIREBASE_* variables
 *
 * @created 2026-01-24
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
// CONFIGURATION - ΑΛΛΑΞΕ ΑΥΤΑ
// =============================================================================

// Το email σου (για αναφορά)
const ADMIN_EMAIL = 'pagonis.oe@gmail.com';

// Αν ξέρεις το Firebase UID σου, βάλτο εδώ. Αλλιώς θα το βρούμε από το email.
const ADMIN_UID = process.env.ADMIN_UID || null;

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
  console.log('🔧 Setting up Admin Configuration...\n');

  try {
    // Initialize Firebase
    initializeFirebase();
    const db = admin.firestore();
    const auth = admin.auth();

    // Get admin UID
    let adminUid = ADMIN_UID;

    if (!adminUid) {
      console.log(`📧 Looking up UID for: ${ADMIN_EMAIL}`);
      try {
        const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
        adminUid = userRecord.uid;
        console.log(`✅ Found UID: ${adminUid}`);
      } catch (e) {
        console.error(`❌ Could not find user with email: ${ADMIN_EMAIL}`);
        console.log('\n💡 Tip: Make sure you have logged in to the app at least once with this email.');
        console.log('    Or set ADMIN_UID environment variable manually.\n');
        process.exit(1);
      }
    }

    // Prepare admin config
    const adminConfig = {
      primaryAdminUid: adminUid,
      adminEmail: ADMIN_EMAIL,
      additionalAdminUids: [],
      enableErrorReporting: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'setup-script'
    };

    // Save to Firestore
    const settingsRef = db.collection('system').doc('settings');

    // Check if exists
    const existing = await settingsRef.get();

    if (existing.exists) {
      // Update
      await settingsRef.set({ admin: adminConfig }, { merge: true });
      console.log('\n✅ Updated existing settings document');
    } else {
      // Create
      await settingsRef.set({
        admin: adminConfig,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'setup-script'
      });
      console.log('\n✅ Created new settings document');
    }

    // Verify
    const verify = await settingsRef.get();
    const savedConfig = verify.data()?.admin;

    console.log('\n📋 Saved Configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Primary Admin UID:    ${savedConfig?.primaryAdminUid}`);
    console.log(`   Admin Email:          ${savedConfig?.adminEmail}`);
    console.log(`   Error Reporting:      ${savedConfig?.enableErrorReporting ? 'Enabled' : 'Disabled'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n🎉 Done! Error notifications will now appear in your bell icon.\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
