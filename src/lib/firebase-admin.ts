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
  const hasServiceAccountKey = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const keyLength = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0;
  console.log(`🔑 DEBUG: FIREBASE_SERVICE_ACCOUNT_KEY exists: ${hasServiceAccountKey}, length: ${keyLength}`);

  try {
    // Check for required environment variables - fallback to client env if server env missing
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    
    if (!projectId) {
      console.warn('⚠️ No FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID found, skipping Firebase Admin initialization');
      return null;
    }

    // Initialize with service account if available
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: projectId
        });
        console.log('✅ Firebase Admin initialized with service account');
      } catch (parseError) {
        console.warn('⚠️ Failed to parse service account, falling back to default credentials');
        adminApp = initializeApp({ projectId });
      }
    } else {
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