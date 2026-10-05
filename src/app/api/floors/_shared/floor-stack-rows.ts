import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { DEFAULT_FLOOR_HEIGHT_M, isBuildingStorey, type FloorKind } from '@/utils/floor-naming';

/**
 * **Η στοίβα ορόφων ενός κτιρίου, όπως τη διαβάζουν οι αλυσίδες** — μία ανάγνωση για όλες.
 *
 * Η ώθηση σταθμών (`floor-elevation-cascade`) και η ανασύνταξη (`floor-stack-reconcile`) έκαναν η καθεμία
 * το ίδιο ερώτημα και την ίδια κανονικοποίηση (N.0.2 · CHECK 3.28, 2026-10-05). Δύο αναγνώσεις της ίδιας
 * στοίβας που αποκλίνουν σε μία προεπιλογή δίνουν δύο διαφορετικά κτίρια στο ίδιο αίτημα.
 *
 * Όλα σε ΜΕΤΡΑ (ADR-369 §1). Ταξινομημένα κατά `number`, από κάτω προς τα πάνω.
 */

/** Ό,τι χρειάζεται μια αλυσίδα από έναν όροφο. */
export interface FloorStackRow {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly elevation: number | null;
  readonly height: number;
  /** ADR-461 — Revit-style classification; special levels are stacking satellites. */
  readonly kind?: FloorKind;
}

export interface FloorStack {
  readonly rows: FloorStackRow[];
  readonly refById: Map<string, DocumentReference>;
}

/** True when this floor is a special level (foundation/roof/stair-penthouse). */
export function isSpecialLevel(row: Pick<FloorStackRow, 'kind'>): boolean {
  return row.kind !== undefined && !isBuildingStorey(row.kind);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Οι όροφοι του κτιρίου στον ενοικιαστή του (CHECK 3.10/3.35), κανονικοποιημένοι και ταξινομημένοι. */
export async function readFloorStack(db: Firestore, buildingId: string, companyId: string): Promise<FloorStack> {
  const snap = await db.collection(COLLECTIONS.FLOORS)
    .where('companyId', '==', companyId)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
    .get();

  const refById = new Map(snap.docs.map((d) => [d.id, d.ref] as const));
  const rows: FloorStackRow[] = snap.docs
    .map((d) => ({
      id: d.id,
      name: (d.data().name as string) ?? d.id,
      number: finite(d.data().number, 0),
      elevation: finiteOrNull(d.data().elevation),
      height: finite(d.data().height, DEFAULT_FLOOR_HEIGHT_M),
      kind: d.data().kind as FloorKind | undefined,
    }))
    .sort((a, b) => a.number - b.number);

  return { rows, refById };
}
