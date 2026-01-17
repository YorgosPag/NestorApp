/**
 * @deprecated LEGACY MODULE - Use @/lib/firebaseAdmin instead
 *
 * **MIGRATION REQUIRED** (Enterprise Unification - BLOCKER #4)
 *
 * This module will be REMOVED in future versions.
 * - Canonical module: src/lib/firebaseAdmin.ts (42 files use this)
 * - Non-canonical: src/lib/firebase-admin.ts (16 files - MIGRATE THESE)
 *
 * **Migration Guide:**
 * ```diff
 * - import { db } from '@/lib/firebase-admin';
 * + import { adminDb } from '@/lib/firebaseAdmin';
 *
 * - const snapshot = await db().collection('...');
 * + const snapshot = await adminDb.collection('...');
 * ```
 *
 * **Tracked in**: Epic #TODO - Firebase Admin Canonicalization
 * **Files to migrate**: 16 endpoints (see git grep '@/lib/firebase-admin')
 */

// lib/firebase-admin.ts - Build-Safe Firebase Admin Configuration

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let db: Firestore | null = null;

// Initialize Firebase Admin with build safety
function initializeFirebaseAdmin() {
  // Skip initialization during build time
  if (typeof window !== 'undefined' || process.env.NODE_ENV === 'test') {
    console.log('⚠️ Skipping Firebase Admin initialization (client-side or test environment)');
    return null;
  }

  // Check if already initialized
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    db = getFirestore(adminApp);
    return db;
  }

  // DEBUG: Log env var status
  const hasB64Key = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  const hasJsonKey = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  console.log(`🔑 DEBUG: B64 key exists: ${hasB64Key}, JSON key exists: ${hasJsonKey}`);

  try {
    // Check for required environment variables - fallback to client env if server env missing
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!projectId) {
      console.warn('⚠️ No FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID found, skipping Firebase Admin initialization');
      return null;
    }

    // PRIORITY 1: Base64 encoded service account (Enterprise-safe for Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
      try {
        console.log('🔐 Using Base64 encoded service account...');
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf-8');
        const serviceAccount = JSON.parse(decoded);

        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: projectId
        });
        console.log('✅ Firebase Admin initialized with Base64 service account');
      } catch (b64Error) {
        console.error('❌ Base64 service account error:', b64Error instanceof Error ? b64Error.message : String(b64Error));
        // Continue to try other methods
      }
    }

    // PRIORITY 2: Plain JSON service account (fallback)
    if (!adminApp && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        console.log('🔄 Trying plain JSON service account...');
        const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        const serviceAccount = JSON.parse(rawKey);

        // Fix private_key newlines if needed
        if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: projectId
        });
        console.log('✅ Firebase Admin initialized with JSON service account');
      } catch (parseError) {
        console.error('❌ JSON service account parse error:', parseError instanceof Error ? parseError.message : String(parseError));
      }
    }

    // PRIORITY 3: Default credentials (development)
    if (!adminApp) {
      // Fallback to default credentials (for development)
      console.log('🔄 Trying to initialize Firebase Admin with default credentials...');
      try {
        // For development, try to use application default credentials
        adminApp = initializeApp({ projectId });
        console.log('✅ Firebase Admin initialized with default credentials');
      } catch (error) {
        console.warn('⚠️ Failed to initialize with default credentials:', error);
        console.log('💡 For development, you might need service account credentials');
        
        // Last resort: try to initialize without credentials (relies on environment)
        try {
          console.log('🔄 Trying minimal initialization...');
          adminApp = initializeApp({ 
            projectId,
            // Use the same config as client for development
            credential: undefined
          });
          console.log('✅ Firebase Admin initialized with minimal config');
        } catch (finalError) {
          console.error('❌ All initialization methods failed:', finalError);
          return null;
        }
      }
    }

    db = getFirestore(adminApp);
    return db;

  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error);
    return null;
  }
}

// Safe getter for database instance
function getDB(): Firestore | null {
  if (!db) {
    db = initializeFirebaseAdmin();
  }
  return db;
}

// Export with safe access
export { getDB as db, adminApp };

// Helper function to check if Firebase is available
export function isFirebaseAvailable(): boolean {
  return getDB() !== null;
}

// Safe database operations wrapper
export async function safeDbOperation<T>(
  operation: (db: Firestore) => Promise<T>,
  fallback: T
): Promise<T> {
  const database = getDB();
  if (!database) {
    console.warn('⚠️ Firebase not available, returning fallback value');
    return fallback;
  }

  try {
    return await operation(database);
  } catch (error) {
    console.error('❌ Database operation failed:', error);
    return fallback;
  }
}