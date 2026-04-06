/**
 * @fileoverview Firebase Admin SDK Types & Error Classes
 * @version 1.0.0
 *
 * Extracted from firebaseAdmin.ts (ADR-065 Phase 6).
 *
 * @module lib/firebaseAdmin-types
 */

import type { RuntimeEnvironment } from '@/config/environment-security-config';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Which credential source was used for initialization */
export type CredentialSource = 'B64' | 'JSON' | 'APPLICATION_DEFAULT' | 'NONE';

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
