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
import type { RasterRectPx } from '../../types/coordinate-space';
import {
  inferBareIntegerUnit, unknownUnitSuffix, unknownUnitSuggestion, writtenLike, type BareIntegerUnit,
} from '../../bim/plan-recognition/reading/written-values';
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
  /**
   * Δ21 (δ) — διάσταση με **άγνωστη μονάδα**: η κατάληξη όπως διαβάστηκε («kh.»)· `null` = γνωστή ή καμία. Τιμή δεν υπάρχει
   * ποτέ τότε (`writtenLengthUnit`)· η γραμμή είναι «ύποπτη» από τον υπάρχοντα κανόνα «διάσταση χωρίς τιμή».
   */
  readonly unknownUnit: string | null;
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
  /**
   * Βήμα 7 — για τιμή σε σύγκρουση, η πρόταση της συνόρθωσης **ως κείμενο** όπως θα το έγραφε το σχέδιο («4,12»)· Δ21 (δ) —
   * για άγνωστη μονάδα, ο ίδιος αριθμός με τη μονάδα του σχεδίου («2,05 m», `unknownUnitSuggestion`)· `null` = καμία. Περνά
   * από τον ΙΔΙΟ δρόμο με κάθε διόρθωση (`correct`).
   */
  readonly suggestion: string | null;
  /**
   * Δ3 — υπάρχει κλίμακα στη σύντηξη (βαθμονόμηση · συναίνεση διαστάσεων · γραμμένη κλίμακα · εμβαδά). `false` ⇒ το
   * «σχέδιο − γραμμένο» μετρά μόνο τις αναλογίες του χαρτιού: πληροφορία, ΟΧΙ κρίση της γραμμένης τιμής.
   */
  readonly scaleKnown: boolean;
}

type RowFacts = Omit<PlanReadValueRow, 'priority' | 'suggestion'>;

/**
 * Βήμα 7 — η πρόταση για μια διάσταση σε σύγκρουση. Ο Baarda την απέρριψε, άρα στην **τελική** λύση έχει βάρος 0
 * (`adjustWithDataSnooping`): το `adjustedMm` είναι η απόσταση των παρειών όπως την ορίζουν **οι υπόλοιπες** διαστάσεις μαζί
 * με τις θέσεις των γραμμών — ποτέ η ίδια η απορριφθείσα τιμή. Γράφεται με την ακρίβεια γραφής του κειμένου (`writtenLike`).
 *
 * 🔑 Δ3 — **καμία πρόταση χωρίς κλίμακα** (`scaleKnown`). Μετρημένο live (DOC014, σκίτσο ~18 % παραμόρφωση, καμία συναίνεση
 * κλίμακας): η πρόταση ακολουθούσε τις αναλογίες του παραμορφωμένου χαρτιού (2,05 → 2,59, μετά 4,12 → 2,68) και οδηγούσε τον
 * άνθρωπο να αλλάξει **σωστές** γραμμένες τιμές. Χωρίς κλίμακα το σχέδιο δεν έχει μέτρο να κρίνει γραμμένο αριθμό — κατά
 * Δ21 οι γραμμένοι αριθμοί δίνουν τη γεωμετρία. Με κλίμακα (π.χ. τυπωμένη σάρωση) η πρόταση μένει: εκεί πιάνει λάθη OCR.
 */
function suggestionOf(
  text: PlanText,
  fused: FusedDimension | undefined,
  bareIntegerUnit: BareIntegerUnit,
  scaleKnown: boolean,
): string | null {
  if (!scaleKnown || fused?.status !== 'conflict' || fused.adjustedMm === null) return null;
  const suggestion = writtenLike(fused.adjustedMm, text.raw, bareIntegerUnit);
  return suggestion !== null && suggestion !== text.raw.trim() ? suggestion : null;
}

/** Τα δεδομένα του σχεδίου που χρειάζεται η πρόταση μιας γραμμής — κρίνονται μία φορά ανά λίστα. */
interface SuggestionContext {
  readonly bareIntegerUnit: BareIntegerUnit;
  readonly scaleKnown: boolean;
  /** Τα κείμενα-διαστάσεις του σχεδίου (για τη μονάδα που γράφει). */
  readonly dimensionRaws: readonly string[];
}

/** Δ21 (δ) — η πρόταση μιας γραμμής: άγνωστη μονάδα ⇒ η μονάδα του σχεδίου· αλλιώς η πρόταση της συνόρθωσης (βήμα 7). */
function rowSuggestion(
  text: PlanText, unknownUnit: string | null, fused: FusedDimension | undefined, ctx: SuggestionContext,
): string | null {
  if (unknownUnit !== null) return unknownUnitSuggestion(text.raw, ctx.dimensionRaws);
  return suggestionOf(text, fused, ctx.bareIntegerUnit, ctx.scaleKnown);
}

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

function rowOf(text: PlanText, valueMm: number | null, fused: FusedDimension | undefined, ctx: SuggestionContext): PlanReadValueRow {
  const measured = fused?.measuredMm ?? null;
  const unknownUnit = text.kind === 'dimension' ? unknownUnitSuffix(text.raw) : null;
  const facts: RowFacts = {
    textId: text.id,
    raw: text.raw,
    correctedFrom: text.correctedFrom ?? null,
    confirmed: text.confirmed === true,
    kind: text.kind,
    valueMm,
    unknownUnit,
    confidence: text.confidence.score,
    status: fused?.status ?? null,
    deviationMm: measured !== null && valueMm !== null ? measured - valueMm : null,
    w: fused?.w ?? null,
    scaleKnown: ctx.scaleKnown,
  };
  return { ...facts, priority: priorityOf(facts), suggestion: rowSuggestion(text, unknownUnit, fused, ctx) };
}

/** Οι γραμμές της λίστας, η πιο ύποπτη πρώτη. `reading` = η ανάγνωση που ισχύει (με τις διορθώσεις). */
export function planReadValueRows(
  reading: PlanReading,
  fusion: Pick<PlanFusionResult, 'dimensions' | 'scale'> | null,
): PlanReadValueRow[] {
  const valueById = new Map(reading.dimensions.map((d) => [d.textId, d.valueMm]));
  const fusedById = new Map((fusion?.dimensions ?? []).map((d) => [d.textId, d]));
  // Η μονάδα των σκέτων ακεραίων του σχεδίου: την ορίζουν τα κείμενα σε μέτρα, που έχουν πάντα τιμή ⇒ ίδια με του κανόνα.
  const rawById = new Map(reading.texts.map((t) => [t.id, t.raw]));
  const bareIntegerUnit = inferBareIntegerUnit(reading.dimensions.map((d) => rawById.get(d.textId) ?? ''));
  const ctx: SuggestionContext = {
    bareIntegerUnit,
    scaleKnown: (fusion?.scale ?? null) !== null,
    dimensionRaws: reading.texts.filter((t) => t.kind === 'dimension').map((t) => t.raw),
  };
  const rows = reading.texts.map((t, order) => ({ order, row: rowOf(t, valueById.get(t.id) ?? null, fusedById.get(t.id), ctx) }));
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

/**
 * Βήμα 1 · Δ5 — η μεγαλύτερη πλευρά μιας μικρογραφίας, σε px. Προβολή 64 CSS px ύψος (`h-16`) με αναλογία έως ~1,8 ⇒ ~115 CSS px
 * πλάτος ⇒ 2× οθόνη ≈ 230 px: τα 256 αρκούν (τα 192 ήταν για τα παλιά 32 px).
 */
export const PLAN_READ_THUMB_MAX_EDGE_PX = 256;

/** Βήμα 1 — περιθώριο γύρω από το κείμενο, ως κλάσμα του ύψους του (λίγο χαρτί γύρω, για να φαίνεται και η γραμμή). */
const THUMB_PAD_OF_HEIGHT = 0.35;

/** Βήμα 1 — η περιοχή της μικρογραφίας: το πλαίσιο του κειμένου με περιθώριο (το κόψιμο στα όρια το κάνει ο provider). */
export function planReadThumbRect(rect: RasterRectPx): RasterRectPx {
  const pad = Math.max(2, (rect.maxY - rect.minY) * THUMB_PAD_OF_HEIGHT);
  return { minX: rect.minX - pad, minY: rect.minY - pad, maxX: rect.maxX + pad, maxY: rect.maxY + pad };
}
