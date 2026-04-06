/**
 * @fileoverview Firebase Admin SDK Credential Chain
 * @version 1.0.0
 *
 * Credential resolution logic extracted from firebaseAdmin.ts (ADR-065 Phase 6).
 * Implements AWS SDK v3 credential chain pattern:
 * B64 → JSON → Application Default Credentials
 *
 * @module lib/firebaseAdmin-credentials
 * @see docs/centralized-systems/reference/adrs/ADR-077-firebase-admin-unified-lazy-init.md
 */

import { getErrorMessage } from '@/lib/error-utils';
import { getApps, initializeApp, cert, type App, type ServiceAccount } from 'firebase-admin/app';
import { getCurrentRuntimeEnvironment } from '@/config/environment-security-config';
import { createModuleLogger } from '@/lib/telemetry';
import { FirebaseAdminInitError, type CredentialSource } from './firebaseAdmin-types';

const logger = createModuleLogger('firebaseAdmin');

// ============================================================================
// CREDENTIAL HELPERS
// ============================================================================

/**
 * Resolve the Firebase project ID from environment variables.
 */
export function resolveProjectId(): string | null {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    null
  );
}

/**
 * Sanitize environment variable JSON that may have been
 * wrapped in quotes by dotenv/Vercel CLI.
 */
export function sanitizeEnvJson(raw: string): string {
  let value = raw.trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    const inner = value.slice(1, -1);
    if (inner.startsWith('{')) {
      value = inner;
    }
  }

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
 */
export function maskedPreview(raw: string, maxLen = 20): string {
  return raw.substring(0, maxLen).replace(/[a-zA-Z0-9]/g, '*') + '...';
}

// ============================================================================
// SERVICE ACCOUNT PARSER
// ============================================================================

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

/**
 * Parse a service account JSON string with validation.
 * @throws FirebaseAdminInitError if JSON is invalid or missing required fields
 */
export function parseServiceAccount(raw: string, source: CredentialSource): { serviceAccount: ServiceAccount; projectId: string } {
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

  let privateKey = raw_sa.private_key;
  if (typeof privateKey === 'string' && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
    throw new FirebaseAdminInitError(
      `Service account from ${source} has malformed private_key ` +
      `(missing BEGIN/END PEM markers). The key may be corrupted or truncated.`,
      source,
      getCurrentRuntimeEnvironment()
    );
  }

  const serviceAccount: ServiceAccount = {
    projectId: raw_sa.project_id,
    clientEmail: raw_sa.client_email,
    privateKey,
  };

  return { serviceAccount, projectId: raw_sa.project_id };
}

// ============================================================================
// CREDENTIAL CHAIN (AWS SDK v3 Pattern)
// ============================================================================

export interface CredentialChainResult {
  app: App;
  credentialSource: CredentialSource;
  projectId: string | null;
}

/**
 * Credential chain: Try B64, then JSON, then Application Default Credentials.
 * @throws FirebaseAdminInitError if all credential sources are exhausted
 */
export function initializeWithCredentialChain(
  currentCredentialSource: CredentialSource
): CredentialChainResult {
  const environment = getCurrentRuntimeEnvironment();
  const projectId = resolveProjectId();

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
    const source = currentCredentialSource !== 'NONE' ? currentCredentialSource : 'JSON';
    logger.info('[Firebase Admin] Reusing existing app instance');
    return { app, credentialSource: source, projectId };
  }

  // PRIORITY 1: Base64-encoded service account (Vercel-safe)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64) {
    try {
      logger.info('[Firebase Admin] Trying B64 credential...');
      const rawB64 = sanitizeEnvJson(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64);
      const decoded = Buffer.from(rawB64, 'base64').toString('utf-8');

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

      logger.info(`[Firebase Admin] Initialized with B64 credential (project: ${saProjectId})`);
      return { app, credentialSource: 'B64', projectId: saProjectId };
    } catch (err) {
      logger.warn('[Firebase Admin] B64 credential failed', { error: getErrorMessage(err) });
    }
  }

  // PRIORITY 2: Plain JSON service account
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      logger.info('[Firebase Admin] Trying JSON credential...');
      const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const preview = maskedPreview(rawJson);
      logger.info(`[Firebase Admin] JSON value preview: ${preview} (length: ${rawJson.length})`);

      const { serviceAccount, projectId: saProjectId } = parseServiceAccount(rawJson, 'JSON');

      const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
        || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
        || `${saProjectId}.appspot.com`;

      const app = initializeApp({
        credential: cert(serviceAccount),
        projectId: saProjectId,
        storageBucket,
      });

      logger.info(`[Firebase Admin] Initialized with JSON credential (project: ${saProjectId})`);
      return { app, credentialSource: 'JSON', projectId: saProjectId };
    } catch (err) {
      logger.warn('[Firebase Admin] JSON credential failed', { error: getErrorMessage(err) });
    }
  }

  // PRIORITY 3: Application Default Credentials (development/CI)
  if (projectId) {
    try {
      logger.info('[Firebase Admin] Trying Application Default Credentials...');
      const app = initializeApp({ projectId });

      logger.info(`[Firebase Admin] Initialized with default credentials (project: ${projectId})`);
      return { app, credentialSource: 'APPLICATION_DEFAULT', projectId };
    } catch (err) {
      logger.warn('[Firebase Admin] Default credentials failed', { error: getErrorMessage(err) });
    }
  }

  throw new FirebaseAdminInitError(
    'All credential sources exhausted. Set FIREBASE_SERVICE_ACCOUNT_KEY_B64 (Vercel) ' +
    'or FIREBASE_SERVICE_ACCOUNT_KEY (JSON) or configure Application Default Credentials.',
    'NONE',
    environment
  );
}
