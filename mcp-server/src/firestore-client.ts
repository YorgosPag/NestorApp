/**
 * Firebase Admin SDK Initialization — MCP Server
 *
 * Credential chain (adapted from src/lib/firebaseAdmin.ts — ADR-077):
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY_B64 (base64)
 * 2. FIREBASE_SERVICE_ACCOUNT_KEY (JSON string)
 * 3. GOOGLE_APPLICATION_CREDENTIALS (file path → ADC)
 * 4. Application Default Credentials (gcloud)
 */

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { ServiceAccountCredential, CredentialSource } from './types.js';

// ============================================================================
// SINGLETON
// ============================================================================

let _firestore: Firestore | null = null;
let _credentialSource: CredentialSource = 'NONE';

// ============================================================================
// HELPERS
// ============================================================================

function sanitizeEnvJson(raw: string): string {
  let value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    const inner = value.slice(1, -1);
    if (inner.startsWith('{')) value = inner;
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    const inner = value.slice(1, -1);
    if (inner.startsWith('{')) value = inner;
  }
  return value;
}

function parseServiceAccount(raw: string, source: CredentialSource): {
  serviceAccount: { projectId: string; clientEmail: string; privateKey: string };
  projectId: string;
} {
  const sanitized = sanitizeEnvJson(raw);
  const parsed = JSON.parse(sanitized) as Record<string, unknown>;

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('project_id' in parsed) ||
    !('private_key' in parsed) ||
    !('client_email' in parsed)
  ) {
    throw new Error(`Service account from ${source} missing required fields`);
  }

  const sa = parsed as unknown as ServiceAccountCredential;
  let privateKey = sa.private_key;
  if (typeof privateKey === 'string' && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  return {
    serviceAccount: {
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey,
    },
    projectId: sa.project_id,
  };
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeWithCredentialChain(): App {
  // Reuse existing app (HMR / multi-init safety)
  const existing = getApps();
  if (existing.length > 0) {
    const app = existing[0];
    if (!app) throw new Error('Firebase app array non-empty but first element undefined');
    _credentialSource = 'JSON';
    return app;
  }

  // PRIORITY 1: Base64-encoded service account
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (b64) {
    const decoded = Buffer.from(sanitizeEnvJson(b64), 'base64').toString('utf-8');
    const { serviceAccount, projectId } = parseServiceAccount(decoded, 'B64');
    _credentialSource = 'B64';
    console.error(`[MCP-Firestore] Initialized with B64 credential (project: ${projectId})`);
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  // PRIORITY 2: Plain JSON service account
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (json) {
    const { serviceAccount, projectId } = parseServiceAccount(json, 'JSON');
    _credentialSource = 'JSON';
    console.error(`[MCP-Firestore] Initialized with JSON credential (project: ${projectId})`);
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  // PRIORITY 3: File path (GOOGLE_APPLICATION_CREDENTIALS handled by ADC)
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    _credentialSource = 'ADC';
    console.error(`[MCP-Firestore] Initialized with ADC (project: ${projectId})`);
    return initializeApp({ projectId });
  }

  throw new Error(
    'All credential sources exhausted. Set FIREBASE_SERVICE_ACCOUNT_KEY_B64, ' +
    'FIREBASE_SERVICE_ACCOUNT_KEY, or configure Application Default Credentials.'
  );
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function getDb(): Firestore {
  if (!_firestore) {
    initializeWithCredentialChain();
    _firestore = getFirestore();
  }
  return _firestore;
}

export function getCredentialSource(): CredentialSource {
  return _credentialSource;
}
