/**
 * 🔐 FIREBASE ADMIN SDK - UNIFIED LAZY INITIALIZATION
 *
 * ADR-077: Single source of truth for Firebase Admin SDK initialization.
 * Credential chain logic extracted to firebaseAdmin-credentials.ts (ADR-065 Phase 6).
 *
 * Architecture:
 * - Lazy singleton pattern (AWS SDK v3 / Google Cloud SDK)
 * - Credential chain: B64 -> JSON -> Application Default Credentials
 * - Zero module-load side effects (no eager getFirestore/getAuth)
 * - Backward-compatible const exports via ES getter (Phase 0)
 *
 * @module lib/firebaseAdmin
 * @enterprise Production-ready, zero `any`, zero `@ts-ignore`
 * @see docs/centralized-systems/reference/adrs/ADR-077-firebase-admin-unified-lazy-init.md
 */

import { getErrorMessage } from '@/lib/error-utils';
import { FieldValue, Timestamp, FieldPath, type Firestore } from 'firebase-admin/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { createModuleLogger } from '@/lib/telemetry';

import { initializeWithCredentialChain } from './firebaseAdmin-credentials';
import { FirebaseAdminInitError, type CredentialSource, type AdminDiagnosticReport } from './firebaseAdmin-types';

// Re-export types and errors for backward compatibility
export { FirebaseAdminInitError } from './firebaseAdmin-types';
export type { AdminDiagnosticReport, CredentialSource } from './firebaseAdmin-types';

const logger = createModuleLogger('firebaseAdmin');

// ============================================================================
// SINGLETON STATE (Module-scoped — NOT exported)
// ============================================================================

let _firestore: Firestore | null = null;
let _auth: Auth | null = null;
let _storage: Storage | null = null;
let _initAttempted = false;
let _initError: FirebaseAdminInitError | null = null;
let _credentialSource: CredentialSource = 'NONE';
let _projectId: string | null = null;

// ============================================================================
// LAZY INITIALIZATION (Google Cloud SDK Pattern)
// ============================================================================

/**
 * Ensure Firebase Admin SDK is initialized (runs once, cached).
 * @throws FirebaseAdminInitError if initialization fails
 */
function ensureInitialized(): void {
  if (_initAttempted) {
    if (_initError) {
      throw _initError;
    }
    return;
  }

  _initAttempted = true;

  try {
    const result = initializeWithCredentialChain(_credentialSource);
    _credentialSource = result.credentialSource;
    _projectId = result.projectId;
  } catch (err) {
    if (err instanceof FirebaseAdminInitError) {
      _initError = err;
    } else {
      _initError = new FirebaseAdminInitError(
        getErrorMessage(err, 'Unknown initialization error'),
        'NONE',
        getCurrentRuntimeEnvironment(),
        err instanceof Error ? err : undefined
      );
    }

    const environment = getCurrentRuntimeEnvironment();
    if (environment === 'production') {
      logger.error('[Firebase Admin] CRITICAL: SDK initialization failed in production');
      logger.error('[Firebase Admin] Error:', { error: _initError.message });
    } else {
      logger.warn('[Firebase Admin] SDK initialization failed in', { environment });
      logger.warn('[Firebase Admin] Error:', { error: _initError.message });
    }

    throw _initError;
  }
}

// ============================================================================
// PUBLIC API — LAZY FUNCTION EXPORTS
// ============================================================================

/**
 * Get the Admin Firestore instance (lazy singleton).
 *
 * @example
 * ```typescript
 * import { getAdminFirestore } from '@/lib/firebaseAdmin';
 * const db = getAdminFirestore();
 * ```
 */
export function getAdminFirestore(): Firestore {
  if (!_firestore) {
    ensureInitialized();
    _firestore = getFirestore();
  }
  return _firestore;
}

/**
 * Get the Admin Auth instance (lazy singleton).
 */
export function getAdminAuth(): Auth {
  if (!_auth) {
    ensureInitialized();
    _auth = getAuth();
  }
  return _auth;
}

/**
 * Get the Admin Storage instance (lazy singleton).
 */
export function getAdminStorage(): Storage {
  if (!_storage) {
    ensureInitialized();
    _storage = getStorage();
  }
  return _storage;
}

/**
 * Check if Firebase Admin SDK can be initialized (non-throwing).
 */
export function isFirebaseAdminAvailable(): boolean {
  if (_initAttempted && !_initError) {
    return true;
  }

  if (_initAttempted && _initError) {
    return false;
  }

  try {
    ensureInitialized();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get detailed diagnostics about the Admin SDK initialization state.
 * Never exposes credentials — only metadata.
 */
export function getAdminDiagnostics(): AdminDiagnosticReport {
  return {
    initialized: _initAttempted && !_initError,
    credentialSource: _credentialSource,
    environment: getCurrentRuntimeEnvironment(),
    projectId: _projectId,
    error: _initError?.message ?? null,
    timestamp: new Date().toISOString(),
    envVarsPresent: {
      FIREBASE_SERVICE_ACCOUNT_KEY_B64: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64,
      FIREBASE_SERVICE_ACCOUNT_KEY: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      GOOGLE_APPLICATION_CREDENTIALS: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    },
  };
}

/**
 * Safe database operation wrapper.
 * Returns fallback value if SDK is unavailable or operation fails.
 */
export async function safeFirestoreOperation<T>(
  operation: (db: Firestore) => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isFirebaseAdminAvailable()) {
    logger.warn('[Firebase Admin] SDK not available, returning fallback');
    return fallback;
  }

  try {
    const db = getAdminFirestore();
    return await operation(db);
  } catch (error) {
    logger.error('[Firebase Admin] Operation failed', {
      error: getErrorMessage(error)
    });
    return fallback;
  }
}

// ============================================================================
// LEGACY COMPAT EXPORTS
// ============================================================================

/**
 * @deprecated Use `getAdminDiagnostics()` instead
 */
export function getAdminInitializationStatus(): { initialized: boolean; environment: ReturnType<typeof getCurrentRuntimeEnvironment>; error?: string; timestamp: string } {
  const diag = getAdminDiagnostics();
  return {
    initialized: diag.initialized,
    environment: diag.environment,
    error: diag.error ?? undefined,
    timestamp: diag.timestamp,
  };
}

/**
 * @deprecated Use `getAdminFirestore()` directly — it throws if not initialized
 */
export function ensureAdminInitialized(): void {
  ensureInitialized();
}

// ============================================================================
// RE-EXPORTS (Convenience — avoids direct firebase-admin/firestore imports)
// ============================================================================

export { FieldValue, Timestamp, FieldPath };
export type { Firestore, Auth, Storage };
