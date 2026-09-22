/**
 * =============================================================================
 * MATERIAL PRICE SYNC — the write, done exactly once (ADR-873 Φ1 Στάδιο 1)
 * =============================================================================
 *
 * One delivered purchase order line moves one material's `avgPrice`. This module owns
 * that single step, and it owns it **transactionally**.
 *
 * ## Why a transaction, and why the marker is inside it
 *
 * The previous shape was `ref.get()` → `ref.update()` (Ε-873.4). That loses updates **even
 * without duplicate events**: two purchase orders for the same material, delivered at the same
 * moment, both read the same `avgPrice` and the second write overwrites the first. Money
 * quietly wrong, nothing red anywhere.
 *
 * Adding a marker document in a *separate* write would not fix it, and would add the dual-write
 * problem on top: a crash between marker and effect either loses the work or does it twice. So
 * the marker and the new price commit **together** — the Idempotent Consumer pattern
 * (Azure Architecture Center · Kafka · Stripe), which exists precisely for at-least-once
 * delivery. Redelivery then either finds the marker and skips, or finds nothing because the
 * transaction never committed, and safely redoes the whole thing.
 *
 * ## 🔑 The key is the BUSINESS identity, not the event
 *
 * `businessSeed('price-sync', [companyId, poId, materialId, lineId])` — **not**
 * `firestoreChangeSeed`. Decision of Giorgio (2026-09-22): the same purchase order must not
 * enter the average twice **even from a completely different event** — someone flipping a PO
 * back to `ordered` and again to `delivered` is a NEW change with NEW commit times, and it must
 * still be refused. Per **line**, so a PO with two lines for the same material blends twice,
 * exactly as it does today.
 *
 * @module functions/procurement/material-price-sync-write
 * @enterprise ADR-873 Φάση 1 · βήμα 1.1 (ADR-330 Φ4.5 — the original trigger)
 */

import * as admin from 'firebase-admin';

import { COLLECTIONS } from '../config/firestore-collections';
import { businessSeed } from '../generated/lib/idempotency/event-claim';
import {
  readEventClaimInTransaction,
  writeEventClaimDoneInTransaction,
} from '../shared/event-idempotency';
import { computeNewAvgPrice } from './material-price-sync-pure';

/** The material fields this write reads. */
interface MaterialDoc {
  companyId: string;
  isDeleted: boolean;
  avgPrice: number | null;
}

/** One delivered line: everything needed to move one material's price, and nothing else. */
export interface DeliveredLine {
  readonly companyId: string;
  readonly poId: string;
  readonly materialId: string;
  /** `POItem.id` — stable per line, so two lines of one PO stay two events. */
  readonly lineId: string;
  readonly unitPrice: number;
  readonly deliveredAt: admin.firestore.Timestamp;
}

/**
 * Why a line did not move the price. Each reason is a different story, so they are not
 * collapsed into one `false`: `already-applied` is the system working, `claim-collision` is a
 * hash collision that must scream, and `tenant-mismatch` is a data problem.
 */
export type PriceSyncSkipReason =
  | 'already-applied'
  | 'claim-unknown'
  | 'claim-collision'
  | 'material-missing'
  | 'tenant-mismatch'
  | 'material-deleted';

export type PriceSyncResult =
  | { readonly kind: 'applied'; readonly avgPrice: number }
  | { readonly kind: 'skipped'; readonly reason: PriceSyncSkipReason }
  /** Another execution holds this line right now. The caller must throw so the platform retries. */
  | { readonly kind: 'retry' };

/** The identity of «this line of this order was already counted». */
export function materialPriceSyncSeed(line: DeliveredLine): string {
  return businessSeed('price-sync', [line.companyId, line.poId, line.materialId, line.lineId]);
}

const skip = (reason: PriceSyncSkipReason): PriceSyncResult => ({ kind: 'skipped', reason });

/**
 * Nothing happened, so nothing is claimed.
 *
 * ⚠️ Deliberate: the three material checks return **before** the marker is written. A material
 * that is missing right now may exist on the platform's retry (creation and delivery racing),
 * and a marker here would make that permanent.
 */
function inspectMaterial(
  snapshot: admin.firestore.DocumentSnapshot,
  line: DeliveredLine,
): PriceSyncResult | MaterialDoc {
  if (!snapshot.exists) return skip('material-missing');
  const material = snapshot.data() as MaterialDoc;
  if (material.companyId !== line.companyId) return skip('tenant-mismatch');
  if (material.isDeleted) return skip('material-deleted');
  return material;
}

const claimSkipReason = (reason: 'done' | 'unknown' | 'collision'): PriceSyncSkipReason =>
  reason === 'done' ? 'already-applied' : reason === 'unknown' ? 'claim-unknown' : 'claim-collision';

/**
 * Apply one delivered line to its material's rolling average — at most once, ever.
 *
 * @param nowMs injected so tests own the clock; production passes `Date.now()`.
 */
export async function syncMaterialPriceOnce(
  db: admin.firestore.Firestore,
  line: DeliveredLine,
  nowMs: number,
): Promise<PriceSyncResult> {
  const seed = materialPriceSyncSeed(line);

  return db.runTransaction(async (transaction) => {
    const claim = await readEventClaimInTransaction(transaction, db, seed, nowMs);
    if (claim.outcome.kind === 'in-flight') return { kind: 'retry' };
    if (claim.outcome.kind === 'skip') return skip(claimSkipReason(claim.outcome.reason));

    const materialRef = db.collection(COLLECTIONS.MATERIALS).doc(line.materialId);
    const inspected = inspectMaterial(await transaction.get(materialRef), line);
    if ('kind' in inspected) return inspected;

    const avgPrice = computeNewAvgPrice(inspected.avgPrice ?? null, line.unitPrice);

    writeEventClaimDoneInTransaction(transaction, claim, seed, nowMs);
    transaction.update(materialRef, {
      avgPrice,
      lastPrice: line.unitPrice,
      lastPurchaseDate: line.deliveredAt,
      updatedAt: admin.firestore.Timestamp.fromMillis(nowMs),
    });

    return { kind: 'applied', avgPrice };
  });
}
