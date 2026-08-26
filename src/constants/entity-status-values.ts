/**
 * 🏢 ENTERPRISE ENTITY STATUS VALUES
 *
 * Single source of truth για status string values ανά domain.
 * Αποτρέπει typo bugs σε .where() clauses, === comparisons, και assignments.
 *
 * ADR-245B: Hardcoded Strings Audit — Phase C
 *
 * ALREADY CENTRALIZED (do NOT duplicate here):
 * - Property statuses → src/constants/property-statuses-enterprise.ts
 * - Triage statuses   → src/constants/triage-statuses.ts
 * - Pipeline states   → src/types/ai-pipeline.ts (PipelineState)
 *
 * @module constants/entity-status-values
 */

// ============================================================================
// GENERIC ENTITY STATUS — Used across projects, contacts, companies, relationships
// ============================================================================

/**
 * Generic entity lifecycle status values.
 * Used when an entity can be active, archived, or inactive.
 */
export const ENTITY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
  SUSPENDED: 'suspended',
} as const;

export type EntityStatus = typeof ENTITY_STATUS[keyof typeof ENTITY_STATUS];

// ============================================================================
// PROJECT STATUS — ΔΕΝ ΖΕΙ ΕΔΩ (ADR-812)
// ============================================================================
//
// 🔴 Εδώ υπήρχε ένα `PROJECT_STATUS` με τιμές
// `active · archived · completed · suspended · construction` — ΜΙΑ κοινή λέξη
// με το κανονικό λεξιλόγιο. Μετρήθηκε 2026-08-26 με ΤΕΣΣΕΡΑ ανεξάρτητα όργανα
// (AST μεταβατικά μέσω barrels · AST ακμές εισαγωγής · `git grep` σε όλο το
// δέντρο · οι jest mocks) και είχε **ΜΗΔΕΝ καταναλωτές**: δεν ήταν «άλλη γλώσσα
// που εξυπηρετεί άλλο πράγμα» — δεν το ζητούσε κανείς. Άφησε όμως ίχνος στα
// δεδομένα: το `ProjectDetailsHeader.tsx` φέρει ήδη repair path για έργα που
// βρέθηκαν με `status: 'active'`.
//
// Το κανονικό λεξιλόγιο κατάστασης έργου ζει σε ΕΝΑ σπίτι:
//     src/constants/project-statuses.ts   (ADR-287 · ADR-812)
//
// ⚠️ ΜΗΝ το ξαναφέρεις εδώ. Αυτό το αρχείο κρατά ΓΕΝΙΚΟ lifecycle οντότητας
// (`ENTITY_STATUS`, 7 καταναλωτές) και καταστάσεις ουράς (`QUEUE_STATUS`, 5) —
// και τα δύο ζωντανά και σωστά. Το CHECK 3.73 μπλοκάρει την επιστροφή του.

// ============================================================================
// QUEUE STATUS — Email ingestion, AI pipeline, and other async queues
// ============================================================================

/**
 * Shared queue status values.
 * Both EmailIngestionQueueStatus and PipelineQueueStatus use these same values.
 */
export const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD_LETTER: 'dead_letter',
} as const;

export type QueueStatus = typeof QUEUE_STATUS[keyof typeof QUEUE_STATUS];
