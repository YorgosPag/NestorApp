/**
 * ADR-929 Δ21 (δ) — οι γραμμές της λίστας **«Τι διάβασα»**: κάθε κείμενο της ανάγνωσης που ισχύει (μηχανή + διορθώσεις),
 * με ό,τι χρειάζεται ο άνθρωπος για να κρίνει: όπως διαβάστηκε · ερμηνεία (τιμή σε mm ή είδος) · βεβαιότητα ανάγνωσης ·
 * κατάσταση στη σύντηξη · απόκλιση σχεδίου από γραμμένο · υπόλοιπο Baarda.
 *
 * 🔑 **Πιο ύποπτη πρώτη** (ο άνθρωπος ελέγχει από πάνω προς τα κάτω):
 *   1. σύγκρουση στη συνόρθωση (ο Baarda την απέρριψε) ·
 *   2. διάσταση χωρίς δέση, κείμενο-διάσταση χωρίς τιμή (η μονάδα δεν αποδεικνύεται), ή ανάγνωση κάτω από το επίπεδο
 *      «υψηλή» (`meetsConfidenceTier`, βήμα 4 — η βεβαιότητα ως σήμα ιεράρχησης, όπως Document AI / Content Understanding) ·
 *   3. οι υπόλοιπες διαστάσεις ·
 *   4. τα άλλα κείμενα.
 *   Μέσα σε κάθε ομάδα: μεγαλύτερο |w| πρώτα, μετά χαμηλότερη βεβαιότητα ανάγνωσης, μετά η σειρά της ανάγνωσης.
 * 🔑 Βήμα 4 — **ετικέτα προτεραιότητας** σε κάθε γραμμή (`priority`): «ύποπτη» · «ελέγχθηκε» · «εντάξει», από τον ΙΔΙΟ
 *   κανόνα με τη σειρά (`needsReview`), ώστε ετικέτα και θέση να μη διαφωνούν ποτέ. Ο έλεγχος του ανθρώπου νικά.
 * 🔑 Τα δεδομένα υπάρχουν ήδη (`PlanReading` + `FusedDimension`): εδώ μόνο συνδυάζονται, τίποτα δεν υπολογίζεται ξανά.
 *
 * ΚΑΘΑΡΟ — zero React/DOM/store.
 */

import type { FusedDimension, FusedDimensionStatus, PlanFusionResult } from '../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReading, PlanText, PlanTextKind } from '../../bim/plan-recognition/plan-recognition-types';
import { meetsConfidenceTier } from './plan-confidence';

/** Βήμα 4 — η ετικέτα προτεραιότητας μιας γραμμής. */
export type PlanReadValuePriority = 'suspect' | 'checked' | 'ok';

export interface PlanReadValueRow {
  readonly textId: string;
  /** Το κείμενο που ισχύει (διορθωμένο ή όπως το διάβασε η μηχανή). */
  readonly raw: string;
  /** Τι διάβασε η μηχανή, όταν ο άνθρωπος το διόρθωσε· `null` = όπως διαβάστηκε. */
  readonly correctedFrom: string | null;
  /** Βήμα 3 — ο άνθρωπος επιβεβαίωσε την ανάγνωση χωρίς αλλαγή («Σωστό ✓»). */
  readonly confirmed: boolean;
  readonly kind: PlanTextKind;
  /** Η τιμή σε mm, αν το κείμενο έγινε περιορισμός του λύτη. */
  readonly valueMm: number | null;
  /** Βεβαιότητα ανάγνωσης στο [0, 1]. */
  readonly confidence: number;
  /** Η κατάσταση στη σύντηξη· `null` = δεν μπήκε ως διάσταση. */
  readonly status: FusedDimensionStatus | null;
  /** Σχεδιασμένο μείον γραμμένο, σε mm· `null` όταν δεν μετρήθηκε. */
  readonly deviationMm: number | null;
  /** Τυποποιημένο υπόλοιπο Baarda· `null` όταν δεν ελέγχεται. */
  readonly w: number | null;
  /** Βήμα 4 — «ύποπτη» · «ελέγχθηκε» · «εντάξει». */
  readonly priority: PlanReadValuePriority;
}

type RowFacts = Omit<PlanReadValueRow, 'priority'>;

/** Θέλει έλεγχο: σύγκρουση · αδέτη · διάσταση χωρίς τιμή · ανάγνωση κάτω από «υψηλή». Ο ΕΝΑΣ κανόνας για σειρά και ετικέτα. */
function needsReview(row: RowFacts): boolean {
  return row.status === 'conflict' || row.status === 'unbound'
    || (row.kind === 'dimension' && row.valueMm === null)
    || !meetsConfidenceTier(row.confidence, 'high');
}

function priorityOf(row: RowFacts): PlanReadValuePriority {
  if (isHumanChecked(row)) return 'checked';
  return needsReview(row) ? 'suspect' : 'ok';
}

/** Ομάδα υποψίας: μικρότερη = πιο ύποπτη. */
function suspicionGroup(row: PlanReadValueRow): number {
  if (row.status === 'conflict') return 0;
  if (needsReview(row)) return 1;
  if (row.kind === 'dimension') return 2;
  return 3;
}

function rowOf(text: PlanText, valueMm: number | null, fused: FusedDimension | undefined): PlanReadValueRow {
  const measured = fused?.measuredMm ?? null;
  const facts: RowFacts = {
    textId: text.id,
    raw: text.raw,
    correctedFrom: text.correctedFrom ?? null,
    confirmed: text.confirmed === true,
    kind: text.kind,
    valueMm,
    confidence: text.confidence.score,
    status: fused?.status ?? null,
    deviationMm: measured !== null && valueMm !== null ? measured - valueMm : null,
    w: fused?.w ?? null,
  };
  return { ...facts, priority: priorityOf(facts) };
}

/** Οι γραμμές της λίστας, η πιο ύποπτη πρώτη. `reading` = η ανάγνωση που ισχύει (με τις διορθώσεις). */
export function planReadValueRows(reading: PlanReading, fusion: Pick<PlanFusionResult, 'dimensions'> | null): PlanReadValueRow[] {
  const valueById = new Map(reading.dimensions.map((d) => [d.textId, d.valueMm]));
  const fusedById = new Map((fusion?.dimensions ?? []).map((d) => [d.textId, d]));
  const rows = reading.texts.map((t, order) => ({
    order,
    row: rowOf(t, valueById.get(t.id) ?? null, fusedById.get(t.id)),
  }));
  rows.sort((a, b) =>
    suspicionGroup(a.row) - suspicionGroup(b.row)
    || Math.abs(b.row.w ?? 0) - Math.abs(a.row.w ?? 0)
    || a.row.confidence - b.row.confidence
    || a.order - b.order);
  return rows.map((r) => r.row);
}

/** Βήμα 3 — η γραμμή ελέγχθηκε από άνθρωπο: διορθώθηκε (και «δεν είναι διάσταση») ή επιβεβαιώθηκε. */
export function isHumanChecked(row: Pick<PlanReadValueRow, 'correctedFrom' | 'confirmed'>): boolean {
  return row.correctedFrom !== null || row.confirmed;
}

/** Βήμα 3 — η πρόοδος του ελέγχου: πόσες γραμμές ελέγχθηκαν από άνθρωπο, από πόσες. */
export function planReadValuesProgress(rows: readonly PlanReadValueRow[]): { readonly checked: number; readonly total: number } {
  return { checked: rows.filter(isHumanChecked).length, total: rows.length };
}
