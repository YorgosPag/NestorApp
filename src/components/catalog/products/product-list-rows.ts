/**
 * **Οι γραμμές του ενιαίου πλέγματος προϊόντων** — καθαρό, χωρίς React (ADR-923 §5.10.4 Β2).
 *
 * Akeneo Serenity: μοντέλα **και** απλά προϊόντα σε μία λίστα. Εδώ:
 * - η ένωση των δύο ζωντανών παραθύρων με **μέτωπο** (`mergeLiveWindows`) και συγκριτή ίδιο με το ερώτημα
 *   (το σπάσιμο ισοπαλίας ακολουθεί το έμμεσο `__name__` της Firestore: ίδια κατεύθυνση με το τελευταίο `orderBy`);
 * - πληρότητα για το επιλεγμένο κανάλι × γλώσσα: μοντέλο «5/7» (`derived.summary`), SKU ποσοστό;
 * - 🏆 «ταιριάζουν 3/7» για τα facets (Akeneo «Matches») από το ευρετήριο της ρίζας — χωρίς ανάγνωση παραλλαγών;
 * - μπαγιατίλα **αποδείξιμη στην ανάγνωση** (Δ7): SKU με άλλο `completenessHash` · έγγραφο χωρίς `sortKey` (παλιό).
 *
 * @module components/catalog/products/product-list-rows
 */

import type { HumanLanguage } from '@/i18n/languages';
import { mergeLiveWindows, type LiveWindow, type MergedWindows } from '@/lib/firestore/merge-live-windows';
import type { ProductModelRecord, ProductRecord } from '@/services/catalog/catalog-api.client';
import { completenessPercent } from '@/subapps/catalog/completeness/compute-completeness';
import { isCompletenessStale, type CompletenessHashInput } from '@/subapps/catalog/completeness/inputs-hash';
import type { CatalogListSort } from '@/subapps/catalog/list/catalog-list-query';
import type { CatalogChannel } from '@/subapps/catalog/vocabulary/channels';

export type CatalogListRow =
  | { readonly kind: 'model'; readonly id: string; readonly record: ProductModelRecord }
  | { readonly kind: 'product'; readonly id: string; readonly record: ProductRecord };

export const modelRow = (record: ProductModelRecord): CatalogListRow => ({ kind: 'model', id: record.id, record });
export const productRow = (record: ProductRecord): CatalogListRow => ({ kind: 'product', id: record.id, record });

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Η σειρά του ερωτήματος, με το έμμεσο `__name__` της Firestore ως σπάσιμο ισοπαλίας. */
export function listRowComparator(sort: CatalogListSort): (a: CatalogListRow, b: CatalogListRow) => number {
  if (sort === 'updated') return (a, b) => byText(b.record.updatedAt, a.record.updatedAt) || byText(b.id, a.id);
  return (a, b) => byText(a.record.derived.sortKey ?? '', b.record.derived.sortKey ?? '') || byText(a.id, b.id);
}

export function mergeListRows(
  models: LiveWindow<ProductModelRecord>,
  products: LiveWindow<ProductRecord>,
  sort: CatalogListSort,
): MergedWindows<CatalogListRow> {
  return mergeLiveWindows<CatalogListRow>(
    [{ items: models.items.map(modelRow), complete: models.complete }, { items: products.items.map(productRow), complete: products.complete }],
    listRowComparator(sort),
  );
}

/**
 * Ο κωδικός μιας εγγραφής: του μοντέλου · το αναγνωριστικό του SKU/απλού · `null` = δεν έχει ακόμη (η οθόνη λέει
 * «χωρίς κωδικό»). **Ένας** κανόνας για λίστα και breadcrumb — ζωντανά (ADR-923 §5.10.5) το breadcrumb έδειχνε UUID
 * και η λίστα κενό κελί για το ίδιο προϊόν.
 */
export function recordIdentifier(record: ProductModelRecord | ProductRecord): string | null {
  return 'code' in record ? record.code : record.derived?.identifier ?? null;
}

/** Ό,τι γράφεται στη στήλη «Κωδικός». */
export function rowIdentifier(row: CatalogListRow): string | null {
  return recordIdentifier(row.record);
}

export function rowLabel(row: CatalogListRow): string | null {
  return row.record.derived.label ?? null;
}

export type CompletenessTone = 'complete' | 'partial' | 'empty';

export type RowCompleteness =
  | { readonly kind: 'summary'; readonly complete: number; readonly total: number; readonly tone: CompletenessTone }
  | { readonly kind: 'percent'; readonly percent: number; readonly tone: CompletenessTone };

const toneOf = (ratio: number): CompletenessTone => (ratio >= 1 ? 'complete' : ratio > 0 ? 'partial' : 'empty');

/** Η πληρότητα για ένα κανάλι × γλώσσα — `null` όταν το κανάλι δεν έχει αυτή τη γλώσσα. */
export function rowCompleteness(row: CatalogListRow, channel: CatalogChannel, locale: HumanLanguage): RowCompleteness | null {
  if (row.kind === 'model') {
    const cell = row.record.derived.summary?.[channel]?.[locale];
    if (!cell) return null;
    return { kind: 'summary', complete: cell.complete, total: cell.total, tone: cell.total === 0 ? 'empty' : toneOf(cell.complete / cell.total) };
  }
  const cell = row.record.derived.completeness?.[channel]?.[locale];
  if (!cell) return null;
  const percent = completenessPercent(cell);
  return { kind: 'percent', percent, tone: toneOf(percent / 100) };
}

/** Πλήθος παραλλαγών (SKU) κάτω από ένα μοντέλο, από το ευρετήριο της ρίζας. */
export function rowVariantCount(row: CatalogListRow): number | null {
  if (row.kind !== 'model') return null;
  return Object.values(row.record.derived.descendants ?? {}).filter((entry) => entry.kind === 'product').length;
}

/**
 * 🏆 **«Ταιριάζουν 3/7»** — πόσα SKU ενός μοντέλου έχουν **όλα** τα επιλεγμένα facets (Akeneo «Matches» του consolidated
 * mode), από το ευρετήριο της ρίζας, χωρίς καμία ανάγνωση. SKU: 1/1 ή 0/1. Χωρίς facets ⇒ `null`.
 */
export function rowMatches(row: CatalogListRow, facetKeys: readonly string[]): { readonly matching: number; readonly total: number } | null {
  if (facetKeys.length === 0) return null;
  const sets = row.kind === 'model'
    ? Object.values(row.record.derived.descendants ?? {}).filter((entry) => entry.kind === 'product').map((entry) => entry.facetKeys)
    : [row.record.derived.facetKeys ?? []];
  const matching = sets.filter((keys) => facetKeys.every((key) => keys.includes(key))).length;
  return { matching, total: sets.length };
}

/** Ταιριάζει η γραμμή με όλα τα facets; (τα πέρα από το πρώτο φιλτράρονται μέσα στο παράθυρο) */
export function rowPassesFacets(row: CatalogListRow, facetKeys: readonly string[]): boolean {
  const matches = rowMatches(row, facetKeys);
  return matches === null || matches.matching > 0;
}

export type StaleReason = 'sortKey' | 'completeness';

/**
 * Μπαγιάτικο παράγωγο, **αποδείξιμο στην ανάγνωση** (Δ7). Παλιό έγγραφο χωρίς `sortKey` (γράφτηκε πριν το Β2 — το
 * `orderBy` θα το έκρυβε) · SKU-απλό με άλλο αποτύπωμα πληρότητας. Μοντέλα: η αλυσίδα θέλει τις αναθεωρήσεις όλων των
 * απογόνων ⇒ κρίνονται όταν ανοίξουν (δηλωμένο όριο).
 */
export function rowStaleReason(row: CatalogListRow, hashInput: Omit<CompletenessHashInput, 'chain'> | null): StaleReason | null {
  if (typeof row.record.derived.sortKey !== 'string') return 'sortKey';
  if (row.kind !== 'product' || row.record.modelId !== null || hashInput === null) return null;
  const chain = [{ id: row.id, kind: 'product' as const, revision: row.record.revision }];
  return isCompletenessStale(row.record.derived.completenessHash ?? null, { ...hashInput, chain }) ? 'completeness' : null;
}
