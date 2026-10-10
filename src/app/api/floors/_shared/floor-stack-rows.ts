import type { DocumentReference, Firestore, Query, QuerySnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { isCountedStorey } from '@/lib/floor/floor-stack-integrity';
import { DEFAULT_FLOOR_HEIGHT_M, type FloorKind } from '@/utils/floor-naming';

/**
 * **Η στοίβα ορόφων ενός κτιρίου, όπως τη διαβάζουν οι αλυσίδες** — μία ανάγνωση για όλες.
 *
 * Η ώθηση σταθμών (`floor-elevation-cascade`) και η ανασύνταξη (`floor-stack-reconcile`) έκαναν η καθεμία
 * το ίδιο ερώτημα και την ίδια κανονικοποίηση (N.0.2 · CHECK 3.28, 2026-10-05). Δύο αναγνώσεις της ίδιας
 * στοίβας που αποκλίνουν σε μία προεπιλογή δίνουν δύο διαφορετικά κτίρια στο ίδιο αίτημα.
 *
 * 🔑 Το ερώτημα ({@link floorStackQuery}) και η κανονικοποίηση ({@link toFloorStack}) είναι χωριστά, ώστε το σύνορο
 * της στοίβας (`floor-stack-authority.ts`) να διαβάζει **μέσα στη συναλλαγή του** με το ίδιο ακριβώς ερώτημα.
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
  return !isCountedStorey(row);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Το ΕΝΑ ερώτημα της στοίβας — οι όροφοι του κτιρίου στον ενοικιαστή του (CHECK 3.10/3.35). */
export function floorStackQuery(db: Firestore, buildingId: string, companyId: string): Query {
  return db.collection(COLLECTIONS.FLOORS)
    .where('companyId', '==', companyId)
    .where(FIELDS.BUILDING_ID, '==', buildingId);
}

/** Η ΜΙΑ κανονικοποίηση ενός ορόφου — και για έγγραφο που **δεν έχει γραφτεί ακόμη** (η γέννηση το κρίνει πριν υπάρξει). */
export function toFloorStackRow(id: string, data: Readonly<Record<string, unknown>>): FloorStackRow {
  return {
    id,
    name: (data.name as string) ?? id,
    number: finite(data.number, 0),
    elevation: finiteOrNull(data.elevation),
    height: finite(data.height, DEFAULT_FLOOR_HEIGHT_M),
    kind: data.kind as FloorKind | undefined,
  };
}

/** Ό,τι επέστρεψε το ερώτημα, κανονικοποιημένο και ταξινομημένο από κάτω προς τα πάνω. */
export function toFloorStack(snap: QuerySnapshot): FloorStack {
  const refById = new Map(snap.docs.map((d) => [d.id, d.ref] as const));
  const rows = snap.docs.map((d) => toFloorStackRow(d.id, d.data())).sort((a, b) => a.number - b.number);
  return { rows, refById };
}

/** Οι όροφοι του κτιρίου στον ενοικιαστή του, κανονικοποιημένοι και ταξινομημένοι. */
export async function readFloorStack(db: Firestore, buildingId: string, companyId: string): Promise<FloorStack> {
  return toFloorStack(await floorStackQuery(db, buildingId, companyId).get());
}
