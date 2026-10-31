/**
 * 🏢 ENTERPRISE: File lifecycle states — **η ΜΙΑ δήλωση** (ADR-032 Enterprise Trash System).
 *
 * 3-tier lifecycle pattern (Google Drive, Salesforce, Microsoft Purview): Active → Trashed → Archived → Purged
 *
 * - ACTIVE: Normal file, visible in UI, can be modified
 * - TRASHED: Soft deleted, in "Trash" view, can be restored
 * - ARCHIVED: Long-term retention, not in active views (legal hold, compliance)
 * - PURGED: Permanently deleted (Storage bytes gone; the record stays as a tombstone)
 *
 * 🔑 **Γιατί χωριστό αρχείο** (ADR-899 §2.2, 2026-10-31): ζούσε μέσα στο `domain-constants.ts`, και τα Cloud Functions
 * κρατούσαν **χειρόγραφο καθρέφτη** (`functions/src/index.ts` — «mirrored from domain-constants»). Ως **φύλλο** (μηδέν
 * imports) προβάλλεται αυτούσιο στα Functions (ADR-874 · CHECK 3.93)· το `domain-constants.ts` το **ξαναεξάγει** — κάθε
 * υπάρχων καταναλωτής μένει αμετάβλητος (ίδιο μοτίβο με το `lib/firestore/trashed-status.ts`).
 *
 * @module config/file-lifecycle-states
 */

export const FILE_LIFECYCLE_STATES = {
  /** Normal file, visible in UI */
  ACTIVE: 'active',
  /** Soft deleted, in Trash view, restorable */
  TRASHED: 'trashed',
  /** Archived for retention/compliance */
  ARCHIVED: 'archived',
  /** Permanently deleted — Storage bytes gone, the record stays as a tombstone */
  PURGED: 'purged',
} as const;

export type FileLifecycleState = typeof FILE_LIFECYCLE_STATES[keyof typeof FILE_LIFECYCLE_STATES];
