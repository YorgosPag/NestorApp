/**
 * =============================================================================
 * GCS BUCKET CONFIGURATION — SSoT
 * =============================================================================
 *
 * Single source of truth for all Google Cloud Storage bucket names and the
 * Firebase project ID fallback. Every service that needs a bucket name or
 * the project ID MUST import from here — no inline construction.
 *
 * Pattern mirrors firestore-collections.ts: env-var with hardcoded fallback.
 *
 * @module config/gcs-buckets
 */

// ---------------------------------------------------------------------------
// Project ID (SSoT)
// ---------------------------------------------------------------------------

/**
 * Firebase / GCP project ID.
 * Server-side: FIREBASE_PROJECT_ID.
 * Client-side: NEXT_PUBLIC_FIREBASE_PROJECT_ID.
 */
export const GCP_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  'pagonis-87766';

// ---------------------------------------------------------------------------
// Bucket names
// ---------------------------------------------------------------------------

/** Enterprise backup bucket (ADR-313). Stores NDJSON.gz + manifests. */
export const GCS_BACKUP_BUCKET =
  process.env.GCS_BACKUP_BUCKET ?? `${GCP_PROJECT_ID}-backups`;

/** Default Firebase Storage bucket. */
export const FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET ??
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  `${GCP_PROJECT_ID}.firebasestorage.app`;

// ---------------------------------------------------------------------------
// Bucket metadata (for auto-creation)
// ---------------------------------------------------------------------------

export const GCS_BACKUP_BUCKET_CONFIG = {
  location: 'EUROPE-WEST1',
  storageClass: 'STANDARD' as const,
} as const;
