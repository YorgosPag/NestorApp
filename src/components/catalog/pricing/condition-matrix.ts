/**
 * **Ο πίνακας συνθηκών** — ομάδα έκπτωσης × κοινό, με τον ισχύοντα κανόνα κάθε κελιού (ADR-923 §5.11 «3δ» Τμήμα 2).
 * @related subapps/catalog/pricing/pricing-keys.ts (`conditionSlotKey`: η ΙΔΙΑ υποδοχή με τον γραφέα) ·
 *   subapps/catalog/schema/validate-pricing.ts (`findAmbiguousConditions` · `conditionWindow`) · lib/pricing/validity.ts
 * @module components/catalog/pricing/condition-matrix
 *
 * SAP condition table (VK13, πίνακας «ομάδα έκπτωσης × ομάδα πελάτη»): **γραμμές** = «Όλες» + κάθε ομάδα έκπτωσης·
 * **στήλες** = τα κοινά με τη σειρά της ειδικότητάς τους (`AUDIENCE_KINDS`): ανώνυμοι · συνδεδεμένοι · **κάθε** ομάδα
 * πελατών · συνεργάτες (μία στήλη· κάθε συνεργάτης είναι δική του υποδοχή μέσα στο κελί).
 *
 * 🔑 **Κελί = όλες οι περίοδοί του**: τρέχουσα · μελλοντικές · ληγμένες (`validityAt` τη στιγμή της όψης), όχι μόνο «η
 *    τρέχουσα» — ο άνθρωπος βλέπει ότι η «−10% τον Νοέμβριο» **έρχεται**, πριν έρθει.
 * 🔑 **Ασάφεια ζωντανά, και με το πρόχειρο**: ο πίνακας χτίζεται πάνω στις συνθήκες **+ το πρόχειρο** του επεξεργαστή
 *    (που αντικαθιστά την αποθηκευμένη του) — το κελί κοκκινίζει **όσο πληκτρολογείς**, όχι μετά το 422.
 * 🔑 **Ισοπαλία ≠ «η πρώτη»**: σε ασάφεια σημειώνονται **και οι δύο** πλευρές (η μηχανή δεν διαλέγει, άρα ούτε η οθόνη).
 */

import { effectivePercent, isDiscountSteps, type BasisPoints, type DiscountRule } from '@/lib/pricing/discount-rule';
import { validityAt, type ValidityVerdict } from '@/lib/pricing/validity';
import { audienceIdentity } from '@/subapps/catalog/pricing/price-audience';
import { conditionSlotKey } from '@/subapps/catalog/pricing/pricing-keys';
import { conditionWindow, findAmbiguousConditions } from '@/subapps/catalog/schema/validate-pricing';
import type { DiscountConditionDefinition, PriceAudience } from '@/subapps/catalog/types/price-list';
import type { CustomerGroupWire, DiscountConditionWire, DiscountGroupWire } from '@/subapps/catalog/types/pricing-views';
import { AUDIENCE_KINDS, type AudienceKind } from '@/subapps/catalog/vocabulary/pricing';
import { conditionDefinitionOf } from './discount-condition-draft';

/** Η γραμμή «Όλες οι ομάδες» (`discountGroupId: null`) — ίδιο σύμβολο με την υποδοχή του γραφέα. */
export const ALL_GROUPS_ROW = '*';
/** Η μία στήλη των συνεργατών. */
export const PARTNER_COLUMN = 'partner';

export interface MatrixRow {
  readonly key: string;
  /** `null` = «Όλες οι ομάδες». */
  readonly group: DiscountGroupWire | null;
}

export type MatrixColumn =
  | { readonly key: string; readonly kind: Exclude<AudienceKind, 'customerGroup'> }
  | { readonly key: string; readonly kind: 'customerGroup'; readonly group: CustomerGroupWire };

export interface MatrixEntry {
  readonly id: string;
  readonly definition: DiscountConditionDefinition;
  readonly verdict: ValidityVerdict;
  readonly ambiguous: boolean;
  /** Είναι το πρόχειρο του επεξεργαστή (όχι αποθηκευμένο); */
  readonly isDraft: boolean;
}

export interface MatrixCell {
  readonly rowKey: string;
  readonly columnKey: string;
  /** Ισχύουσες πρώτα, μετά μελλοντικές (νωρίτερη πρώτη), μετά ληγμένες (πιο πρόσφατη πρώτη). */
  readonly entries: readonly MatrixEntry[];
  /** Όσες ισχύουν **τώρα** — μία ανά υποδοχή (στη στήλη συνεργατών: μία ανά συνεργάτη). */
  readonly current: readonly MatrixEntry[];
  readonly ambiguous: boolean;
}

export interface ConditionMatrix {
  readonly rows: readonly MatrixRow[];
  readonly columns: readonly MatrixColumn[];
  readonly cells: ReadonlyMap<string, MatrixCell>;
  /** Συνθήκες που δείχνουν σε ομάδα που δεν φαίνεται πια (π.χ. αισιόδοξα διαγραμμένη) — λέγονται, δεν χάνονται. */
  readonly unplaced: number;
}

export interface MatrixDraft {
  /**
   * Η ταυτότητα του επεξεργαστή — **και για νέα** συνθήκη: γεννιέται στον πελάτη (Δ3) και είναι ίδια σε αισιόδοξη και
   * αποθηκευμένη. Γι' αυτό το πρόχειρο **αντικαθιστά** την εγγραφή που μόλις έστειλε, αντί να κάθεται δίπλα της στο ίδιο
   * κελί ως «ασάφεια με τον εαυτό του» (Σ2, ζωντανή επαλήθευση — το παλιό `id: null` ⇒ σταθερό `'draft'` το επέτρεπε).
   */
  readonly id: string;
  readonly definition: DiscountConditionDefinition;
}

export interface ConditionMatrixInput {
  readonly discountGroups: readonly DiscountGroupWire[];
  readonly customerGroups: readonly CustomerGroupWire[];
  readonly conditions: readonly DiscountConditionWire[];
  readonly draft: MatrixDraft | null;
  readonly nowMs: number;
}

export const rowKeyOf = (discountGroupId: string | null): string => discountGroupId ?? ALL_GROUPS_ROW;

/** Η στήλη ενός κοινού: η ταυτότητά του, εκτός από τους συνεργάτες που μοιράζονται **μία** στήλη. */
export const columnKeyOf = (audience: PriceAudience): string => (audience.kind === 'partner' ? PARTNER_COLUMN : audienceIdentity(audience));

export const cellKeyOf = (rowKey: string, columnKey: string): string => `${rowKey}|${columnKey}`;

const byCode = <T extends { readonly code: string }>(items: readonly T[]): T[] => [...items].sort((a, b) => a.code.localeCompare(b.code));

/** Οι στήλες ανά είδος κοινού — `Record` στη ρίζα (CHECK 3.73): νέο κοινό χωρίς στήλη δεν μεταγλωττίζεται. */
const COLUMNS_OF: Readonly<Record<AudienceKind, (groups: readonly CustomerGroupWire[]) => MatrixColumn[]>> = {
  anonymous: () => [{ key: 'anonymous', kind: 'anonymous' }],
  signedIn: () => [{ key: 'signedIn', kind: 'signedIn' }],
  customerGroup: (groups) =>
    byCode(groups).map((group) => ({ key: columnKeyOf({ kind: 'customerGroup', customerGroupId: group.id }), kind: 'customerGroup', group })),
  partner: () => [{ key: PARTNER_COLUMN, kind: 'partner' }],
};

function matrixAxes(input: ConditionMatrixInput): Pick<ConditionMatrix, 'rows' | 'columns'> {
  const rows: MatrixRow[] = [{ key: ALL_GROUPS_ROW, group: null }, ...byCode(input.discountGroups).map((group) => ({ key: group.id, group }))];
  const columns = AUDIENCE_KINDS.flatMap((kind) => COLUMNS_OF[kind](input.customerGroups));
  return { rows, columns };
}

/** Οι συνθήκες όπως θα ήταν **αν αποθηκευόταν τώρα** το πρόχειρο: αντικαθιστά την αποθηκευμένη του, ή προστίθεται. */
function overlaid(input: ConditionMatrixInput): { readonly id: string; readonly definition: DiscountConditionDefinition; readonly isDraft: boolean }[] {
  const live = input.conditions.filter((condition) => !condition.isDeleted);
  const stored = live.map((condition) => ({ id: condition.id, definition: conditionDefinitionOf(condition), isDraft: false }));
  const { draft } = input;
  if (draft === null) return stored;
  return [...stored.filter((entry) => entry.id !== draft.id), { id: draft.id, definition: draft.definition, isDraft: true }];
}

/** Ποιες συνθήκες είναι σε ασάφεια — ανά υποδοχή (ίδιο κλειδί με τον γραφέα), **και οι δύο** πλευρές κάθε σύγκρουσης. */
function ambiguousIds(entries: readonly { readonly id: string; readonly definition: DiscountConditionDefinition }[]): ReadonlySet<string> {
  const slots = new Map<string, typeof entries[number][]>();
  for (const entry of entries) {
    const slot = conditionSlotKey(entry.definition);
    slots.set(slot, [...(slots.get(slot) ?? []), entry]);
  }
  const ambiguous = new Set<string>();
  for (const members of slots.values()) {
    for (const entry of members) {
      const others = members.filter((other) => other.id !== entry.id);
      if (findAmbiguousConditions(entry.definition, others).length > 0) ambiguous.add(entry.id);
    }
  }
  return ambiguous;
}

/** Ημερομηνία που δεν διαβάζεται (μόνο σε πρόχειρο — την ονομάζει η φόρμα) ⇒ ανοιχτό παράθυρο, ποτέ εξαφάνιση από τον πίνακα. */
function verdictOf(definition: DiscountConditionDefinition, nowMs: number): ValidityVerdict {
  return validityAt(conditionWindow(definition) ?? { fromMs: null, untilMs: null }, nowMs);
}

const VERDICT_ORDER: Readonly<Record<ValidityVerdict, number>> = { valid: 0, notYetValid: 1, expired: 2 };

function compareEntries(a: MatrixEntry, b: MatrixEntry): number {
  if (a.verdict !== b.verdict) return VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict];
  const [wa, wb] = [conditionWindow(a.definition), conditionWindow(b.definition)];
  if (a.verdict === 'expired') return (wb?.untilMs ?? 0) - (wa?.untilMs ?? 0);
  return (wa?.fromMs ?? Number.NEGATIVE_INFINITY) - (wb?.fromMs ?? Number.NEGATIVE_INFINITY);
}

function cellOf(rowKey: string, columnKey: string, entries: MatrixEntry[]): MatrixCell {
  const sorted = entries.sort(compareEntries);
  return { rowKey, columnKey, entries: sorted, current: sorted.filter((entry) => entry.verdict === 'valid'), ambiguous: sorted.some((entry) => entry.ambiguous) };
}

export function buildConditionMatrix(input: ConditionMatrixInput): ConditionMatrix {
  const axes = matrixAxes(input);
  const placed = new Set(axes.rows.flatMap((row) => axes.columns.map((column) => cellKeyOf(row.key, column.key))));
  const all = overlaid(input);
  const ambiguous = ambiguousIds(all);
  const grouped = new Map<string, MatrixEntry[]>();
  let unplaced = 0;
  for (const { id, definition, isDraft } of all) {
    const key = cellKeyOf(rowKeyOf(definition.discountGroupId), columnKeyOf(definition.audience));
    if (!placed.has(key)) { unplaced += 1; continue; }
    const entry: MatrixEntry = { id, definition, verdict: verdictOf(definition, input.nowMs), ambiguous: ambiguous.has(id), isDraft };
    grouped.set(key, [...(grouped.get(key) ?? []), entry]);
  }
  const cells = new Map<string, MatrixCell>();
  for (const [key, entries] of grouped) {
    const [rowKey, columnKey] = key.split('|');
    cells.set(key, cellOf(rowKey, columnKey, entries));
  }
  return { ...axes, cells, unplaced };
}

// ── Η ένδειξη ενός κανόνα ────────────────────────────────────────────────────

/**
 * **Το σχήμα του ποσοστού** — η ΜΙΑ απόφαση «πώς λέγεται» μια έκπτωση, για κελί, περιόδους και σύνδεσμο ασάφειας.
 * Μηδέν ⇒ `none` («Χωρίς έκπτωση», ποτέ «−0%») · ίδια άκρα ⇒ `single` (ποτέ «−5% … −5%») · κάτω άκρο 0 ⇒ `range`
 * με `lowest: 0`, που οι λέξεις λένε «έως −15%» (ποτέ «−0% … −15%»).
 */
export type DiscountFigure =
  | { readonly kind: 'none' }
  | { readonly kind: 'single'; readonly percent: number }
  | { readonly kind: 'range'; readonly lowest: number; readonly highest: number };

export function discountFigureOf(lowest: number, highest: number): DiscountFigure {
  if (highest <= 0) return { kind: 'none' };
  if (lowest === highest) return { kind: 'single', percent: highest };
  return { kind: 'range', lowest, highest };
}

export type RuleHeadline =
  | { readonly kind: 'chain'; readonly steps: readonly BasisPoints[]; readonly figure: DiscountFigure }
  | { readonly kind: 'tiers'; readonly count: number; readonly figure: DiscountFigure }
  | { readonly kind: 'unreadable' };

/**
 * Τι γράφει το κελί: «50 + 10 ⇒ −55%» (τα βήματα **πολλαπλασιάζονται** — `effectivePercent` της μηχανής) ή «3 κλίμακες,
 * −5% … −15%». Βήμα που δεν διαβάζεται (πρόχειρο) ⇒ `unreadable`, ποτέ `NaN%` στην οθόνη.
 */
export function ruleHeadline(rule: DiscountRule): RuleHeadline {
  if (rule.kind === 'chain') {
    if (!isDiscountSteps(rule.steps)) return { kind: 'unreadable' };
    const effective = effectivePercent(rule.steps);
    return { kind: 'chain', steps: rule.steps, figure: discountFigureOf(effective, effective) };
  }
  if (rule.tiers.length === 0 || !rule.tiers.every((tier) => isDiscountSteps(tier.steps))) return { kind: 'unreadable' };
  const percents = rule.tiers.map((tier) => effectivePercent(tier.steps));
  return { kind: 'tiers', count: rule.tiers.length, figure: discountFigureOf(Math.min(...percents), Math.max(...percents)) };
}
