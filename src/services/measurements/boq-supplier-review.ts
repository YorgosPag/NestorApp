/**
 * Ο ΕΛΕΓΧΟΣ ΤΙΜΩΝ ΠΡΟΜΗΘΕΥΤΗ ΣΕ ΕΝΑ ΚΤΙΡΙΟ (ADR-923 §5.12 Δ9): καθαρή συναρμολόγηση πάνω στην κρίση του διακομιστή.
 *
 * 🔑 Μόνο **κρίνει**. Η εφαρμογή είναι ρητή πράξη, περνά από τον έναν γραφέα και πάνω από τον φράχτη θέλει επιβεβαίωση.
 * 🔑 Η επίπτωση σε € υπολογίζεται στη **μικτή** ποσότητα, όπως και το `cost-engine`.
 * 🔑 Ο επιλογέας ανοίγει μόνο πάνω σε γραμμή που **είναι αποθηκευμένη όπως τη βλέπει ο άνθρωπος**: ο διακομιστής τιμολογεί την
 *    αποθηκευμένη ποσότητα και μονάδα, άρα ανοιχτή αλλαγή στη φόρμα θα έδειχνε άλλη κλίμακα από αυτή που θα γραφτεί.
 *
 * @module services/measurements/boq-supplier-review
 */

import { majorFromMinor } from '@/lib/money/money';
import type { ForeignPrice } from '@/subapps/catalog/pricing/foreign-quote';
import type { SupplierDrift } from '@/subapps/catalog/pricing/supplier-drift';
import type { BoqSupplierDriftRow } from '@/subapps/catalog/types/supply-boq';
import type { BOQItem } from '@/types/boq';
import { countableBoqLines, isSummaryBoqLine } from './boq-line-role';
import { canApplyPrice } from './boq-price-source';
import { computeGrossQuantity } from './cost-engine';

export type SupplierPickerGate = 'ready' | 'unsaved' | 'locked';

/** Μπορεί αυτή η γραμμή, όπως είναι τώρα στη φόρμα, να πάρει τιμή προμηθευτή; */
export function supplierPickerGate(item: BOQItem | null, form: { readonly unit: string; readonly estimatedQuantity: string }): SupplierPickerGate {
  if (item === null) return 'unsaved';
  if (!canApplyPrice(item)) return 'locked';
  return form.unit === item.unit && Number(form.estimatedQuantity) === item.estimatedQuantity ? 'ready' : 'unsaved';
}

/** Η τιμή ανά μονάδα μιας ξένης απάντησης, σε €. */
export const foreignUnitPrice = (price: ForeignPrice): number => majorFromMinor(price.netAmount) / price.quantity;

const unitTotal = (item: BOQItem): number => item.materialUnitCost + item.laborUnitCost + item.equipmentUnitCost;

const reviewedLines = (items: readonly BOQItem[]): readonly BOQItem[] =>
  countableBoqLines(items).filter((item) => !isSummaryBoqLine(item) && item.priceSource?.authority === 'supplier');

/** Το κλειδί του ελέγχου: αλλάζει όταν αλλάξει γραμμή ή εφαρμοστεί νέα τιμή, όχι σε κάθε ανανέωση της λίστας. */
export function supplierReviewKey(items: readonly BOQItem[]): string {
  return reviewedLines(items).map((item) => `${item.id}:${item.priceSource?.appliedAt ?? ''}`).join('|');
}

export const supplierReviewIds = (items: readonly BOQItem[]): readonly string[] => reviewedLines(items).map((item) => item.id);

export interface BoqSupplierReviewRow {
  readonly item: BOQItem;
  readonly relationshipId: string;
  readonly variantId: string;
  readonly drift: Exclude<SupplierDrift, { kind: 'current' }>;
  /** Τι θα άλλαζε στο σύνολο της γραμμής σε €· `null` ⇒ δεν υπάρχει νέα τιμή. */
  readonly impact: number | null;
  readonly applicable: boolean;
}

function reviewRowOf(item: BOQItem, row: BoqSupplierDriftRow): BoqSupplierReviewRow | null {
  const { drift, relationshipId, variantId } = row;
  if (drift.kind === 'current') return null;
  const impact = drift.kind === 'changed'
    ? computeGrossQuantity(item.estimatedQuantity, item.wasteFactor) * (foreignUnitPrice(drift.price) - unitTotal(item))
    : null;
  return { item, relationshipId, variantId, drift, impact, applicable: drift.kind === 'changed' && canApplyPrice(item) };
}

export function supplierReviewRows(items: readonly BOQItem[], rows: readonly BoqSupplierDriftRow[]): readonly BoqSupplierReviewRow[] {
  const byId = new Map(rows.map((row) => [row.boqItemId, row]));
  return reviewedLines(items).flatMap((item) => {
    const row = byId.get(item.id);
    return (row === undefined ? null : reviewRowOf(item, row)) ?? [];
  });
}

const fenced = (row: BoqSupplierReviewRow): boolean => row.drift.kind === 'changed' && row.drift.exceedsFence;

export const hasFencedSupplierRow = (rows: readonly BoqSupplierReviewRow[]): boolean => rows.some((row) => row.applicable && fenced(row));

/** Οι γραμμές που εφαρμόζονται. Πάνω από τον φράχτη: μόνο μετά από ρητή επιβεβαίωση. */
export function applicableSupplierRows(rows: readonly BoqSupplierReviewRow[], fenceConfirmed: boolean): readonly BoqSupplierReviewRow[] {
  return rows.filter((row) => row.applicable && (fenceConfirmed || !fenced(row)));
}
