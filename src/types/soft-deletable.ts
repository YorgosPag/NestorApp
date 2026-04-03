/**
 * SoftDeletableFields — Mixin interface for soft-delete lifecycle
 *
 * Every entity that supports soft-delete intersects with this:
 *   export interface Property extends BaseProperty & SoftDeletableFields { ... }
 *
 * @module types/soft-deletable
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

/** Firestore-compatible timestamp (server | client | read) */
type FirestoreishTimestamp = Date | { toDate: () => Date };

/**
 * Fields added to every soft-deletable entity.
 * Present ONLY when status='deleted' (or after restore).
 */
export interface SoftDeletableFields {
  /** Timestamp when moved to trash */
  deletedAt?: FirestoreishTimestamp;
  /** UID of user who deleted it */
  deletedBy?: string;
  /** Status before deletion — used for restore */
  previousStatus?: string;
  /** Timestamp of last restore from trash */
  restoredAt?: FirestoreishTimestamp;
  /** UID of user who restored it */
  restoredBy?: string;
}

/** Entity types that support soft-delete lifecycle */
export type SoftDeletableEntityType =
  | "contact"
  | "property"
  | "building"
  | "project"
  | "parking"
  | "storage";
