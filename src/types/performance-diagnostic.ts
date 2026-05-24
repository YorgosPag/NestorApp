/**
 * Performance Diagnostics — Type Definitions
 *
 * Centralized types for the `performance_diagnostics` Firestore collection.
 * Used by API routes, client hooks, and super-admin dashboard.
 *
 * @module types/performance-diagnostic
 * @enterprise ADR-366 §B.5 + §C.7.Q2 + §C.7.Q4
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// TRIAGE FSM (ADR-366 §C.7.Q2)
// ============================================================================

/**
 * Triage states for super-admin review workflow.
 *
 * - `new`           default for fresh submissions
 * - `triaged`       super-admin acknowledged, no action yet
 * - `investigating` actively being reviewed
 * - `resolved`      issue addressed
 * - `wontfix`       acknowledged but no fix planned
 */
export type TriageStatus =
  | 'new'
  | 'triaged'
  | 'investigating'
  | 'resolved'
  | 'wontfix';

/**
 * One transition entry in the triage history audit chain.
 * Append-only; never mutated.
 */
export interface TriageHistoryEntry {
  /** State before transition. `null` only for the initial 'new' assignment. */
  from: TriageStatus | null;
  /** State after transition. */
  to: TriageStatus;
  /** UID of the super-admin who performed the transition. */
  by: string;
  /** ISO timestamp of the transition. */
  at: string;
  /** Optional super-admin note attached to the transition. */
  note?: string;
}

// ============================================================================
// FULL DIAGNOSTIC RECORD
// ============================================================================

/**
 * Performance diagnostic record as stored in Firestore.
 *
 * Base fields (§B.5) — written by `/api/performance-diagnostics` POST.
 * Triage fields (§C.7.Q2) — written by `/api/admin/bim-diagnostics/[id]` PATCH.
 * Notes (§C.7.Q2) — appended by `/api/admin/bim-diagnostics/[id]/notes` POST.
 */
export interface PerformanceDiagnostic {
  // ── Identity ──
  id: string;
  companyId: string;
  userId: string;

  // ── Context ──
  projectId: string | null;
  renderMode: string;
  metrics: Record<string, number | null>;
  screenshotUrl: string;
  comment: string | null;
  source: 'manual' | 'auto_submit';
  createdAt: Timestamp | string;

  // ── Triage (§C.7.Q2) ──
  status: TriageStatus;
  assignedSuperAdminId: string | null;
  internalNotes: string | null;
  triageHistory: TriageHistoryEntry[];
}
