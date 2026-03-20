/**
 * @file Versioning Types — Optimistic Concurrency Control
 * @module types/versioning
 *
 * 🏢 ENTERPRISE: SPEC-256A — Optimistic Versioning (Phase 1)
 *
 * Mixin interface + conflict response types for version-checked writes.
 * Documents acquire `_v` lazily on first update — no migration needed.
 *
 * @see src/lib/firestore/version-check.ts (server-side transaction)
 * @see src/hooks/useVersionedSave.ts (client-side hook)
 * @see src/components/shared/ConflictDialog.tsx (UI)
 */

import type { Firestore } from 'firebase-admin/firestore';

// ============================================
// DOCUMENT MIXIN
// ============================================

/**
 * Mixin for versioned Firestore documents.
 * Merged into entity interfaces when version tracking is active.
 */
export interface Versioned {
  /** Monotonic version counter. Missing = 0 (lazy migration). */
  _v: number;
  /** Server timestamp of last update */
  updatedAt: unknown; // FieldValue.serverTimestamp() | Timestamp
  /** UID of last updater */
  updatedBy: string;
}

// ============================================
// CONFLICT RESPONSE (Server → Client)
// ============================================

/**
 * 409 response body returned by API routes on version conflict.
 * The client uses this to populate ConflictDialog.
 *
 * Includes `error` + `errorCode` for enterprise-api-client compatibility
 * (the client parses these fields from error responses).
 */
export interface ConflictResponseBody {
  /** Discriminator for ApiClientError */
  code: 'VERSION_CONFLICT';
  /** Human-readable error message (for enterprise-api-client) */
  error: string;
  /** Error code (for enterprise-api-client error normalization) */
  errorCode: 'VERSION_CONFLICT';
  /** Current version in Firestore (what the server has) */
  currentVersion: number;
  /** Version the client sent (stale) */
  expectedVersion: number;
  /** ISO timestamp of last server update */
  updatedAt: string;
  /** Email or UID of last updater */
  updatedBy: string;
}

// ============================================
// SERVER-SIDE OPTIONS
// ============================================

/**
 * Options for `withVersionCheck()` transaction.
 */
export interface VersionCheckOptions {
  /** Admin Firestore instance */
  db: Firestore;
  /** Firestore collection path */
  collection: string;
  /** Document ID */
  docId: string;
  /** Version the client last read. `undefined` = force-write (backward compat). */
  expectedVersion?: number;
  /** Fields to write (excluding _v, updatedAt, updatedBy — injected by version-check) */
  updates: Record<string, unknown>;
  /** Authenticated user ID */
  userId: string;
}

/**
 * Successful result from `withVersionCheck()`.
 */
export interface VersionCheckResult {
  /** The new version number written to the document */
  newVersion: number;
  /** Document ID (echoed back for convenience) */
  docId: string;
}
