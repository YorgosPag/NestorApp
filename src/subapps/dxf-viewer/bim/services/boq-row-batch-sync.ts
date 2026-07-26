'use client';

/**
 * @module bim/services/boq-row-batch-sync
 * @description SSoT για τον **action-scoped, batch** κύκλο ζωής των managed BOQ
 * γραμμών που γράφει ο `BimToBoqBridge` — ο αδελφός του single-row
 * `boq-firestore-sync`, ΟΧΙ αντίγραφό του.
 *
 * Δύο συμβόλαια, σκόπιμα διαφορετικά (βλ. NOTE στο `boq-firestore-sync`):
 *
 * | | `syncManagedBoqRow` (single) | αυτό το module (batch) |
 * |---|---|---|
 * | Ανάγνωση | ένα `getDoc` ανά κλήση, μέσα στο write queue | **pre-fetch όλων** των ids μία φορά |
 * | Detach guard | πάντα | **μόνο σε `action === 'updated'`** |
 * | Μηδενική ποσότητα | orphan cleanup | δεν ισχύει (ο bridge σβήνει αλλού) |
 *
 * Ο λόγος του pre-fetch: το group path (parent + per-layer/finish children)
 * χρειάζεται τα `createdAt` **όλων** των γραμμών ΠΡΙΝ χτιστεί οποιοδήποτε
 * payload — άρα read-modify-write ανά γραμμή δεν αρκεί.
 *
 * @see ./boq-firestore-sync.ts (single-row lifecycle)
 * @see ./boq-base-row.ts (row-payload SSoT)
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { isFrozenBaselineStatus } from '@/types/boq/units';
import { recordBaselineDrift } from './boq-firestore-sync';
import type { BuiltBoqRow } from './boq-base-row';
import type { ExistingCreatedAtMap } from './boq-multi-layer-builder';

const logger = createModuleLogger('BoqRowBatchSync');

/** Στιγμιότυπο της υπάρχουσας γραμμής, διαβασμένο ΜΙΑ φορά πριν χτιστούν τα payloads. */
export interface RowFetchResult {
  readonly exists: boolean;
  readonly detached: boolean;
  readonly createdAt: string | null;
  /** ADR-674 — πλήρες existing doc data (μόνο όταν `exists`), για frozen-baseline drift. */
  readonly raw?: Record<string, unknown>;
}

const NO_ROW_STATE: RowFetchResult = { exists: false, detached: false, createdAt: null };

/** Pre-fetch της κατάστασης όλων των υποψήφιων ids (network failure ανά id → «δεν υπάρχει», ποτέ throw). */
export async function fetchRowStates(
  ids: readonly string[],
): Promise<Map<string, RowFetchResult>> {
  const result = new Map<string, RowFetchResult>();
  const snaps = await Promise.all(
    ids.map((id) => getDoc(doc(db, COLLECTIONS.BOQ_ITEMS, id)).catch(() => null)),
  );
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!;
    const snap = snaps[i];
    if (!snap || !snap.exists()) {
      result.set(id, NO_ROW_STATE);
      continue;
    }
    const data = snap.data() as Record<string, unknown>;
    result.set(id, {
      exists: true,
      detached: data.detached === true,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      raw: data,
    });
  }
  return result;
}

/** Προβολή των pre-fetched states στον χάρτη `createdAt` που θέλει ο row builder. */
export function buildExistingCreatedAtMap(states: ReadonlyMap<string, RowFetchResult>): ExistingCreatedAtMap {
  const map = new Map<string, string | null>();
  for (const [id, state] of states) {
    map.set(id, state.createdAt);
  }
  return map;
}

async function upsertBoqRow(
  row: BuiltBoqRow,
  state: RowFetchResult,
  action: 'created' | 'updated',
): Promise<void> {
  if (action === 'updated' && state.detached) return;
  // ADR-674 — frozen-baseline guard: υπογεγραμμένο row (status ∉ draft/submitted)
  // ΠΟΤΕ δεν overwriteάρεται· καταγράφουμε μόνο την απόκλιση του live μοντέλου.
  if (state.exists && state.raw && isFrozenBaselineStatus(state.raw.status)) {
    const live = typeof row.payload.estimatedQuantity === 'number' ? row.payload.estimatedQuantity : 0;
    await recordBaselineDrift(doc(db, COLLECTIONS.BOQ_ITEMS, row.id), state.raw, live, 'BimToBoqBridge');
    return;
  }
  try {
    await setDoc(doc(db, COLLECTIONS.BOQ_ITEMS, row.id), row.payload);
  } catch (err) {
    logger.error('BimToBoqBridge: row upsert failed', { rowId: row.id, err });
  }
}

/**
 * Upsert a group parent + its per-layer/finish children, each with its own
 * detach guard via the pre-fetched `states` map. Shared tail of the
 * multi-layer-wall and finish paths.
 */
export async function upsertRowGroup(
  parent: BuiltBoqRow,
  children: readonly BuiltBoqRow[],
  states: ReadonlyMap<string, RowFetchResult>,
  action: 'created' | 'updated',
): Promise<void> {
  await upsertBoqRow(parent, states.get(parent.id) ?? NO_ROW_STATE, action);
  await Promise.all(
    children.map((child) => upsertBoqRow(child, states.get(child.id) ?? NO_ROW_STATE, action)),
  );
}
