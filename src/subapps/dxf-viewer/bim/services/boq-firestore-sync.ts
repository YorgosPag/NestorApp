'use client';

/**
 * @module bim/services/boq-firestore-sync
 * @description SSoT for the Firestore upsert/delete lifecycle every managed
 * BIM-generated BOQ row shares (ADR-634 follow-up).
 *
 * A "managed" row is one the BIM auto-sync owns via a deterministic id. Its
 * lifecycle is identical across sources (stair components, envelope zones, …):
 *
 *   1. Fetch the current doc (network failure → no-op, never throws).
 *   2. **Detach guard** — a row the user took ownership of (`detached === true`)
 *      is NEVER auto-touched: not overwritten, not zero-deleted.
 *   3. Zero / non-positive quantity → orphan cleanup (delete if it exists).
 *   4. Otherwise upsert, preserving the original `createdAt`.
 *
 * `stair-boq-sync`, `envelope-boq-sync` and `BimToBoqBridge` (delete path) each
 * inlined this block per row. This owns it once; callers pass the deterministic
 * id, the quantity, and a `buildPayload` closure (invoked only when a write is
 * actually needed).
 *
 * NOTE: `BimToBoqBridge.upsertSingleEntry` intentionally does NOT use
 * `syncManagedBoqRow` — its detach guard is action-scoped (`updated` only), a
 * different contract, so it keeps its bespoke lifecycle.
 *
 * @see ./boq-base-row.ts (the row-payload SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-634-boq-base-row-ssot.md
 */

import { deleteDoc, doc, getDoc, setDoc, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { isFrozenBaselineStatus } from '@/types/boq/units';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BoqFirestoreSync');

/** Extra fields merged into the telemetry payload on failure (e.g. `{ zone }`). */
type LogContext = Readonly<Record<string, unknown>>;

function isDetached(data: Record<string, unknown> | undefined): boolean {
  return data?.detached === true;
}

export interface SyncManagedBoqRowParams {
  /** Deterministic BOQ row id (`boq_bim_…`). */
  readonly id: string;
  /** Measured quantity; `<= 0` → orphan cleanup instead of write. */
  readonly quantity: number;
  /**
   * Build the Firestore payload. Called ONLY when a write is needed; receives
   * the preserved `createdAt` (`null` for a brand-new row).
   */
  readonly buildPayload: (existingCreatedAt: string | null) => Record<string, unknown>;
  /** Telemetry channel prefix (e.g. `'StairBoqSync'`). */
  readonly logLabel: string;
  /** Extra telemetry fields (e.g. `{ zone }` / `{ component }`). */
  readonly logContext?: LogContext;
}

/**
 * ADR-674 — SSoT για την καταγραφή απόκλισης live BIM μοντέλου από ΠΑΓΩΜΕΝΟ
 * υπογεγραμμένο baseline (row status ∉ draft/submitted). Γράφει ΜΟΝΟ drift
 * metadata (`liveQuantity` / `liveQuantitySyncedAt`) με merge — ΠΟΤΕ δεν αγγίζει
 * το `estimatedQuantity` (το baseline μένει αμετάβλητο) ούτε διαγράφει row.
 *
 * Idempotent (Google-level, χωρίς περιττά writes):
 *  - live === baseline (re-converged) → καθάρισε το badge αν υπήρχε drift, αλλιώς no-op.
 *  - live αμετάβλητο από την προηγούμενη καταγραφή → no-op.
 *  - αλλιώς → merge-write το νέο drift + ISO timestamp.
 */
export async function recordBaselineDrift(
  ref: DocumentReference,
  existing: Record<string, unknown>,
  liveQuantity: number,
  logLabel: string,
  logContext?: LogContext,
): Promise<void> {
  const baseline = typeof existing.estimatedQuantity === 'number' ? existing.estimatedQuantity : null;
  const prevLive = typeof existing.liveQuantity === 'number' ? existing.liveQuantity : null;

  let update: Record<string, unknown>;
  if (baseline !== null && liveQuantity === baseline) {
    // Re-converged με το baseline → καθάρισε το drift badge.
    if (prevLive === null) return; // already clean, no write
    update = { liveQuantity: null, liveQuantitySyncedAt: null };
  } else if (prevLive === liveQuantity) {
    return; // drift αμετάβλητο, no write
  } else {
    update = { liveQuantity, liveQuantitySyncedAt: nowISO() };
  }

  try {
    await setDoc(ref, update, { merge: true });
  } catch (err) {
    logger.error(`${logLabel}: baseline-drift record failed`, { rowId: ref.id, ...logContext, err });
  }
}

/**
 * Upsert-or-cleanup a single managed BOQ row (detach-guarded, createdAt-preserving).
 * Fire-and-forget: never throws, logs I/O failures.
 */
export async function syncManagedBoqRow(params: SyncManagedBoqRowParams): Promise<void> {
  const { id, quantity, buildPayload, logLabel, logContext } = params;
  const ref = doc(db, COLLECTIONS.BOQ_ITEMS, id);

  const snap = await getDoc(ref).catch(() => null);
  if (snap === null) return;

  const data = snap.exists() ? (snap.data() as Record<string, unknown>) : undefined;
  // Detach guard: a user-owned row is never auto-touched.
  if (isDetached(data)) return;

  // ADR-674 — frozen-baseline guard: a row που έφυγε από draft/submitted
  // (approved/certified/locked) είναι υπογεγραμμένο συμβατικό στιγμιότυπο. Ο
  // auto-sync ΠΟΤΕ δεν αγγίζει `estimatedQuantity` ούτε το διαγράφει — μόνο
  // καταγράφει την απόκλιση του live μοντέλου ως drift metadata (5D-BIM).
  if (data && isFrozenBaselineStatus(data.status)) {
    await recordBaselineDrift(ref, data, quantity, logLabel, logContext);
    return;
  }

  if (quantity <= 0) {
    if (snap.exists()) {
      try {
        await deleteDoc(ref);
      } catch (err) {
        logger.error(`${logLabel}: zero-quantity delete failed`, { rowId: id, ...logContext, err });
      }
    }
    return;
  }

  const existingCreatedAt = (data?.createdAt as string | undefined) ?? null;
  const payload = buildPayload(existingCreatedAt);

  try {
    await setDoc(ref, payload);
  } catch (err) {
    logger.error(`${logLabel}: upsert failed`, { rowId: id, ...logContext, err });
  }
}

/**
 * Delete a single managed BOQ row by deterministic id, honouring the detach
 * guard (a `detached === true` row is left untouched). Fire-and-forget.
 */
export async function deleteManagedBoqRow(
  id: string,
  logLabel: string,
  logContext?: LogContext,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.BOQ_ITEMS, id);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    if (isDetached(snap.data() as Record<string, unknown>)) return;
    await deleteDoc(ref);
  } catch (err) {
    logger.error(`${logLabel}: delete failed`, { rowId: id, ...logContext, err });
  }
}
