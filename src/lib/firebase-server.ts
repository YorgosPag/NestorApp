// Server-side Firebase utilities για API routes
// 💡 DEVELOPMENT SOLUTION: Uses client Firebase SDK στις API routes

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('firebase-server');
import { getFirestore, Firestore, collection, doc, getDocs, getDoc as getFirestoreDoc, query, where, WhereFilterOp } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

// Firebase config (ίδιο με client)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase για API routes
function initializeFirebaseServer() {
  // Skip initialization during build time or test environment
  if (process.env.NODE_ENV === 'test') {
    logger.info('ENTERPRISE: Skipping Firebase initialization (test environment)');
    return null;
  }

  try {
    logger.info('ENTERPRISE: Starting Firebase initialization...');
    logger.info('ENTERPRISE DIAGNOSTIC: Environment variables check', {
      hasApiKey: !!firebaseConfig.apiKey,
      hasAuthDomain: !!firebaseConfig.authDomain,
      hasProjectId: !!firebaseConfig.projectId,
      nodeEnv: process.env.NODE_ENV,
      configComplete: !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId)
    });

    // Validate critical Firebase configuration
    if (!firebaseConfig.apiKey) {
      logger.error('ENTERPRISE ERROR: Firebase API Key is missing!');
      return null;
    }

    if (!firebaseConfig.projectId) {
      logger.error('ENTERPRISE ERROR: Firebase Project ID is missing!');
      return null;
    }

    // Initialize Firebase app
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
      logger.info('ENTERPRISE: Firebase Client (for API routes) initialized successfully');
    } else {
      app = getApp();
      logger.info('ENTERPRISE: Firebase Client (for API routes) reusing existing app');
    }

    const firestoreDB = getFirestore(app);
    logger.info('ENTERPRISE: Firestore database connection established');
    return firestoreDB;

  } catch (error) {
    logger.error('ENTERPRISE ERROR: Critical Firebase initialization failure', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
      config: {
        hasApiKey: !!firebaseConfig.apiKey,
        hasProjectId: !!firebaseConfig.projectId,
        hasAuthDomain: !!firebaseConfig.authDomain
      }
    });
    return null;
  }
}

// Initialize the database
db = initializeFirebaseServer();

// Export ready-to-use Firebase functions με επαγγελματικό client API
export const firebaseServer = {
  // Execute queries με real Firestore client instance
  async getDoc(collectionName: string, docId: string) {
    if (!db) {
      throw new Error('Firebase Client (API routes) not initialized');
    }
    const docRef = doc(db, collectionName, docId);
    return await getFirestoreDoc(docRef);
  },

  async getDocs(collectionName: string, queries: Array<{field: string, operator: WhereFilterOp, value: unknown}> = []) {
    if (!db) {
      throw new Error('Firebase Client (API routes) not initialized');
    }
    let queryRef = collection(db, collectionName);

    // Apply where clauses
    if (queries.length > 0) {
      const whereConditions = queries.map(q => where(q.field, q.operator, q.value));
      const finalQuery = query(queryRef, ...whereConditions);
      return await getDocs(finalQuery);
    }

    return await getDocs(queryRef);
  },

  // Get database instance for advanced operations
  getFirestore: () => db
};

export type FirebaseServer = typeof firebaseServer;