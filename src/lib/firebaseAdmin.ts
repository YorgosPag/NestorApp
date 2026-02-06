/**
 * 🔐 FIREBASE ADMIN SDK - UNIFIED LAZY INITIALIZATION
 *
 * ADR-077: Single source of truth for Firebase Admin SDK initialization.
 * Replaces 3 competing systems with one enterprise-grade module.
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

import { getApps, initializeApp, cert, type App, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, FieldPath, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getCurrentRuntimeEnvironment, type RuntimeEnvironment } from '@/config/environment-security-config';

// ============================================================================
// TYPES & INTERFACES (Enterprise — zero `any`)
// ============================================================================

/**
 * Firebase Service Account credential structure
 * Matches the official Google Cloud service account JSON schema
 */
interface ServiceAccountCredential {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

/** Which credential source was used for initialization */
type CredentialSource = 'B64' | 'JSON' | 'APPLICATION_DEFAULT' | 'NONE';

/** Diagnostic report for debugging initialization issues */
export interface AdminDiagnosticReport {
  initialized: boolean;
  credentialSource: CredentialSource;
  environment: RuntimeEnvironment;
  projectId: string | null;
  error: string | null;
  timestamp: string;
  envVarsPresent: {
    FIREBASE_SERVICE_ACCOUNT_KEY_B64: boolean;
    FIREBASE_SERVICE_ACCOUNT_KEY: boolean;
    FIREBASE_PROJECT_ID: boolean;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: boolean;
    GOOGLE_APPLICATION_CREDENTIALS: boolean;
  };
}

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

/**
 * Enterprise error class for Firebase Admin initialization failures.
 * Provides structured context for debugging across environments.
 */
export class FirebaseAdminInitError extends Error {
  public readonly credentialSource: CredentialSource;
  public readonly environment: RuntimeEnvironment;
  public override readonly cause?: Error;

  constructor(
    message: string,
    credentialSource: CredentialSource,
    environment: RuntimeEnvironment,
    cause?: Error
  ) {
    super(message);
    this.name = 'FirebaseAdminInitError';
    this.credentialSource = credentialSource;
    this.environment = environment;
    this.cause = cause;
  }
}

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
// CREDENTIAL CHAIN (AWS SDK v3 Pattern)
// ============================================================================

/**
 * Resolve the Firebase project ID from environment variables.
 */
function resolveProjectId(): string | null {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    null
  );
}

/**
 * Sanitize environment variable JSON that may have been
 * wrapped in quotes by dotenv/Vercel CLI.
 *
 * Problem: Vercel CLI writes `.env.local` with outer double quotes:
 *   FIREBASE_SERVICE_ACCOUNT_KEY="{"type":"service_account",...}"
 *
 * dotenv reads this as `{"` because the second `"` (before `type`) closes
 * the quoted value. This function strips those outer quotes defensively.
 *
 * @param raw - The raw environment variable value
 * @returns Cleaned value suitable for JSON.parse()
 */
function sanitizeEnvJson(raw: string): string {
  let value = raw.trim();

  // Strip surrounding double quotes if the inner content starts with {
  if (value.startsWith('"') && value.endsWith('"')) {
    const inner = value.slice(1, -1);
    if (inner.startsWith('{')) {
      value = inner;
    }
  }

  // Strip surrounding single quotes
  if (value.startsWith("'") && value.endsWith("'")) {
    const inner = value.slice(1, -1);
    if (inner.startsWith('{')) {
      value = inner;
    }
  }

  return value;
}

/**
 * Create a masked preview of a credential value for safe logging.
 * Shows structure but replaces alphanumeric characters with asterisks.
 *
 * @param raw - The raw value to mask
 * @param maxLen - Maximum preview length (default 20)
 * @returns Masked preview string
 */
function maskedPreview(raw: string, maxLen = 20): string {
  return raw.substring(0, maxLen).replace(/[a-zA-Z0-9]/g, '*') + '...';
}

/**
 * Parse a service account JSON string with validation.
 * Returns Firebase Admin SDK ServiceAccount type for type-safe cert() usage.
 * @throws FirebaseAdminInitError if JSON is invalid or missing required fields
 */
function parseServiceAccount(raw: string, source: CredentialSource): { serviceAccount: ServiceAccount; projectId: string } {
  // Sanitize potential outer quotes from dotenv/Vercel CLI
  const sanitized = sanitizeEnvJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch (err) {
    const preview = maskedPreview(sanitized);
    throw new FirebaseAdminInitError(
      `Failed to parse service account JSON from ${source}. ` +
      `Value preview: ${preview} (length: ${sanitized.length})`,
      source,
      getCurrentRuntimeEnvironment(),
      err instanceof Error ? err : undefined
    );
  }

  // Validate it's an object with required fields (snake_case from Google)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('project_id' in parsed) ||
    !('private_key' in parsed) ||
    !('client_email' in parsed)
  ) {
    throw new FirebaseAdminInitError(
      `Service account from ${source} is missing required fields (project_id, private_key, client_email)`,
      source,
      getCurrentRuntimeEnvironment()
    );
  }

  const raw_sa = parsed as ServiceAccountCredential;

  // Fix escaped newlines in private_key (common in environment variables)
  let privateKey = raw_sa.private_key;
  if (typeof privateKey === 'string' && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Validate private key structure (must have PEM markers)
  if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
    throw new FirebaseAdminInitError(
      `Service account from ${source} has malformed private_key ` +
      `(missing BEGIN/END PEM markers). The key may be corrupted or truncated.`,
      source,
      getCurrentRuntimeEnvironment()
    );
  }

  // Map snake_case (Google JSON) → camelCase (Firebase Admin SDK ServiceAccount)
  const serviceAccount: ServiceAccount = {
    projectId: raw_sa.project_id,
    clientEmail: raw_sa.client_email,
    privateKey,
  };

  return { serviceAccount, projectId: raw_sa.project_id };
}

/**
 * Credential chain: Try B64, then JSON, then Application Default Credentials.
 * Returns the initialized App or throws FirebaseAdminInitError.
 */
function initializeWithCredentialChain(): App {
  const environment = getCurrentRuntimeEnvironment();
  const projectId = resolveProjectId();

  // Skip client-side initialization
  if (typeof window !== 'undefined') {
    throw new FirebaseAdminInitError(
      'Firebase Admin SDK cannot be initialized on the client side',
      'NONE',
      environment
    );
  }

  // Return existing app if already initialized (Next.js HMR safety)
  const existingApps = getApps();
  if (existingApps.length > 0) {
    const app = existingApps[0];
    // Determine credential source from existing app (best effort)
    _credentialSource = _credentialSource !== 'NONE' ? _credentialSource : 'JSON';
    _projectId = projectId;
    console.log('[Firebase Admin] Reusing existing app instance');
    return app;
  }

  // PRIORITY 1: Base64-encoded service account (Vercel-safe)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
    try {
      console.log('[Firebase Admin] Trying B64 credential...');
      const rawB64 = sanitizeEnvJson(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64);
      const decoded = Buffer.from(rawB64, 'base64').toString('utf-8');

      // Validate that decoded output looks like JSON before parsing
      if (!decoded.startsWith('{')) {
        const preview = maskedPreview(decoded);
        throw new FirebaseAdminInitError(
          `B64 decoded value is not valid JSON (starts with "${decoded.charAt(0)}", expected "{"). ` +
          `Preview: ${preview}. ` +
          `Ensure FIREBASE_SERVICE_ACCOUNT_KEY_B64 is actually base64-encoded JSON.`,
          'B64',
          environment
        );
      }

      const { serviceAccount, projectId: saProjectId } = parseServiceAccount(decoded, 'B64');

      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
        || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        || `${saProjectId}.appspot.com`;

      const app = initializeApp({
        credential: cert(serviceAccount),
        projectId: saProjectId,
        storageBucket,
      });

      _credentialSource = 'B64';
      _projectId = saProjectId;
      console.log(`[Firebase Admin] Initialized with B64 credential (project: ${_projectId})`);
      return app;
    } catch (err) {
      console.warn(
        '[Firebase Admin] B64 credential failed:',
        err instanceof Error ? err.message : String(err)
      );
      // Fall through to next priority
    }
  }

  // PRIORITY 2: Plain JSON service account
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      console.log('[Firebase Admin] Trying JSON credential...');
      const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const preview = maskedPreview(rawJson);
      console.log(`[Firebase Admin] JSON value preview: ${preview} (length: ${rawJson.length})`);

      const { serviceAccount, projectId: saProjectId } = parseServiceAccount(
        rawJson,
        'JSON'
      );

      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
        || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        || `${saProjectId}.appspot.com`;

      const app = initializeApp({
        credential: cert(serviceAccount),
        projectId: saProjectId,
        storageBucket,
      });

      _credentialSource = 'JSON';
      _projectId = saProjectId;
      console.log(`[Firebase Admin] Initialized with JSON credential (project: ${_projectId})`);
      return app;
    } catch (err) {
      console.warn(
        '[Firebase Admin] JSON credential failed:',
        err instanceof Error ? err.message : String(err)
      );
      // Fall through to next priority
    }
  }

  // PRIORITY 3: Application Default Credentials (development/CI)
  if (projectId) {
    try {
      console.log('[Firebase Admin] Trying Application Default Credentials...');
      const app = initializeApp({ projectId });

      _credentialSource = 'APPLICATION_DEFAULT';
      _projectId = projectId;
      console.log(`[Firebase Admin] Initialized with default credentials (project: ${_projectId})`);
      return app;
    } catch (err) {
      console.warn(
        '[Firebase Admin] Default credentials failed:',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // All credential sources exhausted
  throw new FirebaseAdminInitError(
    'All credential sources exhausted. Set FIREBASE_SERVICE_ACCOUNT_KEY_B64 (Vercel) ' +
    'or FIREBASE_SERVICE_ACCOUNT_KEY (JSON) or configure Application Default Credentials.',
    'NONE',
    environment
  );
}

// ============================================================================
// LAZY INITIALIZATION (Google Cloud SDK Pattern)
// ============================================================================

/**
 * Ensure Firebase Admin SDK is initialized (runs once, cached).
 * Called lazily on first access to Firestore or Auth.
 * @throws FirebaseAdminInitError if initialization fails
 */
function ensureInitialized(): void {
  if (_initAttempted) {
    if (_initError) {
      throw _initError;
    }
    return; // Already initialized successfully
  }

  _initAttempted = true;

  try {
    initializeWithCredentialChain();
  } catch (err) {
    if (err instanceof FirebaseAdminInitError) {
      _initError = err;
    } else {
      _initError = new FirebaseAdminInitError(
        err instanceof Error ? err.message : 'Unknown initialization error',
        'NONE',
        getCurrentRuntimeEnvironment(),
        err instanceof Error ? err : undefined
      );
    }

    const environment = getCurrentRuntimeEnvironment();
    if (environment === 'production') {
      console.error('[Firebase Admin] CRITICAL: SDK initialization failed in production');
      console.error('[Firebase Admin] Error:', _initError.message);
    } else {
      console.warn('[Firebase Admin] SDK initialization failed in', environment);
      console.warn('[Firebase Admin] Error:', _initError.message);
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
 * First call initializes the SDK via credential chain.
 * Subsequent calls return the cached instance.
 *
 * @returns Firestore instance
 * @throws FirebaseAdminInitError if SDK cannot be initialized
 *
 * @example
 * ```typescript
 * import { getAdminFirestore } from '@/lib/firebaseAdmin';
 *
 * export async function GET() {
 *   const db = getAdminFirestore();
 *   const snapshot = await db.collection('projects').get();
 *   // ...
 * }
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
 *
 * First call initializes the SDK via credential chain.
 * Subsequent calls return the cached instance.
 *
 * @returns Auth instance
 * @throws FirebaseAdminInitError if SDK cannot be initialized
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
 *
 * First call initializes the SDK via credential chain.
 * Subsequent calls return the cached instance.
 *
 * @returns Storage instance
 * @throws FirebaseAdminInitError if SDK cannot be initialized
 *
 * @example
 * ```typescript
 * import { getAdminStorage } from '@/lib/firebaseAdmin';
 *
 * export async function POST(req: NextRequest) {
 *   const bucket = getAdminStorage().bucket();
 *   await bucket.file('path/to/file').save(buffer);
 * }
 * ```
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
 *
 * Use this to conditionally skip operations when Admin SDK is unavailable,
 * without causing a crash.
 *
 * @returns true if SDK is initialized or can be initialized
 */
export function isFirebaseAdminAvailable(): boolean {
  // If already initialized, return true
  if (_initAttempted && !_initError) {
    return true;
  }

  // If init was attempted and failed, return false
  if (_initAttempted && _initError) {
    return false;
  }

  // Not yet attempted — try initialization
  try {
    ensureInitialized();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get detailed diagnostics about the Admin SDK initialization state.
 *
 * Use for health-check endpoints, debugging, and monitoring.
 * Never exposes credentials — only metadata.
 *
 * @returns AdminDiagnosticReport with initialization details
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
 *
 * Executes an operation with the Admin Firestore instance.
 * Returns fallback value if SDK is unavailable or operation fails.
 *
 * @param operation - Async function receiving Firestore instance
 * @param fallback - Value to return on failure
 * @returns Operation result or fallback
 */
export async function safeFirestoreOperation<T>(
  operation: (db: Firestore) => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isFirebaseAdminAvailable()) {
    console.warn('[Firebase Admin] SDK not available, returning fallback');
    return fallback;
  }

  try {
    const db = getAdminFirestore();
    return await operation(db);
  } catch (error) {
    console.error(
      '[Firebase Admin] Operation failed:',
      error instanceof Error ? error.message : String(error)
    );
    return fallback;
  }
}

// ============================================================================
// LEGACY COMPAT EXPORTS (Will be removed after full migration)
// ============================================================================

/**
 * @deprecated Use `getAdminDiagnostics()` instead
 */
export function getAdminInitializationStatus(): { initialized: boolean; environment: RuntimeEnvironment; error?: string; timestamp: string } {
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
// ADR-077: NO eager const exports here. All consumers use getAdminFirestore()/getAdminAuth()/getAdminStorage().

// ============================================================================
// RE-EXPORTS (Convenience — avoids direct firebase-admin/firestore imports)
// ============================================================================

export { FieldValue, Timestamp, FieldPath };
export type { Firestore, Auth, Storage };
