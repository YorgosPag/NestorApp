/**
 * 🔐 FIREBASE ADMIN SDK - ENTERPRISE INITIALIZATION
 *
 * Server-side Firebase Admin SDK με enterprise error handling
 * Required environment variable: FIREBASE_SERVICE_ACCOUNT_KEY
 *
 * @module lib/firebaseAdmin
 * @enterprise Production-ready με diagnostic logging
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getCurrentRuntimeEnvironment, type RuntimeEnvironment } from '@/config/environment-security-config';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface AdminInitializationResult {
  initialized: boolean;
  environment: RuntimeEnvironment;
  error?: string;
  timestamp: string;
}

// ============================================================================
// INITIALIZATION STATE
// ============================================================================

let initializationResult: AdminInitializationResult | null = null;

// ============================================================================
// ADMIN SDK INITIALIZATION - ENTERPRISE PATTERN
// ============================================================================

// Αποφυγή διπλής αρχικοποίησης (σημαντικό σε Next.js)
if (!getApps().length) {
  const environment = getCurrentRuntimeEnvironment();
  const timestamp = new Date().toISOString();

  try {
    // 🔍 ENTERPRISE: Environment variable validation
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const errorMessage = `FIREBASE_SERVICE_ACCOUNT_KEY environment variable not found`;

      // 🚨 CRITICAL: Production requires Admin SDK
      if (environment === 'production') {
        console.error('❌ [Firebase Admin] CRITICAL:', errorMessage);
        console.error('📍 [Firebase Admin] Environment:', environment);
        console.error('🔧 [Firebase Admin] Required: Add FIREBASE_SERVICE_ACCOUNT_KEY to Vercel environment variables');
        console.error('📖 [Firebase Admin] See: https://vercel.com/docs/environment-variables');

        initializationResult = {
          initialized: false,
          environment,
          error: `${errorMessage} (CRITICAL in ${environment})`,
          timestamp
        };

        // ⚠️ ENTERPRISE: Non-blocking warning για development
      } else {
        console.warn('⚠️ [Firebase Admin] WARNING:', errorMessage);
        console.warn('📍 [Firebase Admin] Environment:', environment);
        console.warn('💡 [Firebase Admin] Add your service account JSON to .env.local');

        initializationResult = {
          initialized: false,
          environment,
          error: `${errorMessage} (non-critical in ${environment})`,
          timestamp
        };
      }

      // Exit early - no point continuing without service account
      // Admin SDK methods will fail gracefully
    } else {
      // 🔐 ENTERPRISE: Parse and validate service account JSON
      let serviceAccount: Record<string, unknown>;

      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      } catch (parseError) {
        const errorMessage = `Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON`;
        console.error('❌ [Firebase Admin]', errorMessage);
        console.error('📍 [Firebase Admin] Environment:', environment);
        console.error('🔧 [Firebase Admin] Check JSON formatting in environment variable');

        if (parseError instanceof Error) {
          console.error('📋 [Firebase Admin] Parse error:', parseError.message);
        }

        initializationResult = {
          initialized: false,
          environment,
          error: `${errorMessage}: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
          timestamp
        };

        throw new Error(errorMessage);
      }

      // 🏢 ENTERPRISE: Initialize Admin SDK with validated credentials
      initializeApp({
        credential: cert(serviceAccount),
      });

      console.log('✅ [Firebase Admin] SDK initialized successfully');
      console.log('📍 [Firebase Admin] Environment:', environment);
      console.log('🔐 [Firebase Admin] Project ID:', serviceAccount.project_id || 'unknown');

      initializationResult = {
        initialized: true,
        environment,
        timestamp
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ [Firebase Admin] SDK initialization failed');
    console.error('📍 [Firebase Admin] Environment:', environment);
    console.error('📋 [Firebase Admin] Error:', errorMessage);

    if (environment === 'production') {
      console.error('🚨 [Firebase Admin] CRITICAL: Production deployment requires working Admin SDK');
      console.error('🔧 [Firebase Admin] Action required: Fix FIREBASE_SERVICE_ACCOUNT_KEY configuration');
    } else {
      console.error('💡 [Firebase Admin] Check your FIREBASE_SERVICE_ACCOUNT_KEY in .env.local');
    }

    if (error instanceof Error && error.stack) {
      console.error('📚 [Firebase Admin] Stack trace:', error.stack);
    }

    initializationResult = {
      initialized: false,
      environment,
      error: errorMessage,
      timestamp
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * 🔐 Admin Firestore Database Instance
 * @enterprise Will be undefined if initialization failed
 */
export const adminDb = getFirestore();

/**
 * 🔐 Admin Firebase App Instance
 * @enterprise Will be undefined if initialization failed
 */
export const adminApp = getApps()[0];

/**
 * 🔍 Get Admin SDK initialization status
 * @enterprise Use this to check if Admin SDK is ready before operations
 */
export function getAdminInitializationStatus(): AdminInitializationResult {
  return initializationResult || {
    initialized: false,
    environment: getCurrentRuntimeEnvironment(),
    error: 'Initialization status not available',
    timestamp: new Date().toISOString()
  };
}

/**
 * 🚨 Check if Admin SDK is ready for operations
 * @enterprise Throws descriptive error if not initialized
 */
export function ensureAdminInitialized(): void {
  const status = getAdminInitializationStatus();

  if (!status.initialized) {
    const environment = getCurrentRuntimeEnvironment();
    throw new Error(
      `Firebase Admin SDK not initialized in ${environment} environment. ` +
      `Error: ${status.error || 'Unknown initialization failure'}. ` +
      `Required: FIREBASE_SERVICE_ACCOUNT_KEY environment variable must be set.`
    );
  }
}