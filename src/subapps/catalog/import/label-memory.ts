/**
 * Η **μνήμη ετικετών γραμμής ανά προμηθευτή** (ADR-923 §5.5.2 Β5) — η καθαρή μηχανή: πότε εφαρμόζεται, τι εφαρμόζει, τι μαθαίνει.
 *
 * 🔑 **Μαθαίνει στην έγκριση**, όχι σε κάθε κλικ (Απόφαση 2): δοκιμαστικά κλικ και αναιρεμένα λάθη δεν γίνονται μνήμη.
 * 🔑 **Εφαρμόζεται ορατά** (Απόφαση 3): γίνεται `ImportLineOverride` με `origin: memory`, και περνά από τον **ίδιο** κριτή με κάθε
 *    απόφαση (`readPageWithDecisions`). Ανθρώπινη απόφαση στη γραμμή ⇒ η μνήμη δεν την αγγίζει.
 * 🔑 **Σύγκρουση ⇒ τίποτα** (Απόφαση 3): δύο διαφορετικές αποφάσεις στο ιστορικό του κλειδιού ⇒ καμία αυτόματη εφαρμογή. Η διόρθωση
 *    **δεν** σβήνει το παλιό ζεύγος (όπως το Akeneo), άρα η διόρθωση του ανθρώπου γυρίζει το κλειδί σε «ρώτα με».
 * 🔑 **Όρια:** η μνήμη δεν γεννά ιδιότητα ούτε δένει σε οικογένεια· ιδιότητα έξω από το σχήμα δεν εφαρμόζεται· τιμή χωρίς τιμοκατάλογο
 *    δεν εφαρμόζεται· ο πίνακας έχει **μία** γραμμή τιμής (`priceLineTaken`).
 * @module subapps/catalog/import/label-memory
 */

import type {
  ImportLabelMemoryDecision,
  ImportLabelMemoryDefinition,
  ImportLineDecision,
  ImportLineIdentity,
  ImportLineOverride,
  ImportPageUnmappedLine,
} from '../types/catalog-import';
import type { ImportMemoryHint, ImportMemoryHints } from '../types/catalog-import-requests';
import { IMPORT_LABEL_MEMORY_MAX_DECISIONS } from '../vocabulary/catalog-import';
import { labelMemoryKey, pageTableGroupKey } from './import-keys';
import { lineDecisionOf, tableOverridesOf } from './page-line-overrides';

/** Ίδια απόφαση: ίδιο είδος και ίδιος στόχος. */
export function sameLineDecision(a: ImportLineDecision, b: ImportLineDecision): boolean {
  if (a.kind === 'attribute') return b.kind === 'attribute' && a.attributeId === b.attributeId;
  if (a.kind === 'price') return b.kind === 'price' && a.unitCode === b.unitCode;
  return b.kind === 'ignore';
}

/** Ένα έγγραφο μνήμης με το id του (ντετερμινιστικό, από το `labelMemoryKey`). */
export interface LabelMemoryEntry extends Pick<ImportLabelMemoryDefinition, 'decisions'> {
  readonly id: string;
}

/** Η μνήμη που αφορά μια σελίδα: κλειδί (`labelMemoryKey`) → έγγραφο. Ό,τι λείπει δεν έχει ιστορικό. */
export type LabelMemoryBook = ReadonlyMap<string, LabelMemoryEntry>;

export const EMPTY_LABEL_MEMORY: LabelMemoryBook = new Map();

export type LabelMemoryVerdict =
  | { readonly kind: 'none' }
  | { readonly kind: 'conflict' }
  | { readonly kind: 'apply'; readonly decision: ImportLineDecision; readonly count: number; readonly sourceBatchId: string };

/** Μία διακριτή απόφαση στο ιστορικό ⇒ εφαρμογή· δύο ή περισσότερες ⇒ σύγκρουση· καμία ⇒ τίποτα. */
export function memoryVerdict(entry: Pick<ImportLabelMemoryDefinition, 'decisions'> | null | undefined): LabelMemoryVerdict {
  const decisions = entry?.decisions ?? [];
  if (decisions.length === 0) return { kind: 'none' };
  if (decisions.length > 1) return { kind: 'conflict' };
  const [only] = decisions;
  return { kind: 'apply', decision: only.decision, count: only.count, sourceBatchId: only.lastBatchId };
}

/** Ο προμηθευτής και η οικογένεια της παρτίδας: χωρίς προμηθευτή η μνήμη ούτε εφαρμόζεται ούτε μαθαίνει. */
export interface LabelMemoryScope {
  readonly supplierContactId: string;
  readonly familyId: string;
}

/** Ετικέτα χωρίς κείμενο (μόνο μονάδα, ή κενή) δεν λέει **ποια** γραμμή είναι: δεν μπαίνει ούτε στη μνήμη ούτε στην εφαρμογή. */
export const isMemorable = (identity: ImportLineIdentity | undefined): identity is ImportLineIdentity => identity !== undefined && identity.label !== '';

export const memoryKeyOf = (scope: LabelMemoryScope, identity: ImportLineIdentity): string => labelMemoryKey(scope.supplierContactId, scope.familyId, identity);

/** Τα κλειδιά μνήμης όσων γραμμών έχουν ταυτότητα: για ανάγνωση με γνωστά ids, χωρίς ερώτημα. */
export function memoryKeysOf(scope: LabelMemoryScope, identities: Iterable<ImportLineIdentity>): string[] {
  return [...new Set([...identities].filter(isMemorable).map((identity) => memoryKeyOf(scope, identity)))];
}

export interface MemoryTable {
  readonly page: number;
  readonly table: string;
  readonly identities: ReadonlyMap<number, ImportLineIdentity>;
}

export interface MemoryApplication {
  readonly scope: LabelMemoryScope;
  readonly book: LabelMemoryBook;
  /** Ιδιότητες του σχήματος της οικογένειας (ids). */
  readonly knownAttributeIds: ReadonlySet<string>;
  /** Η παρτίδα έχει πρόχειρο τιμοκατάλογο (§5.5.2 Β4 Δ1). */
  readonly pricesEnabled: boolean;
  readonly stamp: Pick<ImportLineOverride, 'by' | 'at'>;
}

function applicable(decision: ImportLineDecision, application: MemoryApplication): boolean {
  if (decision.kind === 'attribute') return application.knownAttributeIds.has(decision.attributeId);
  if (decision.kind === 'price') return application.pricesEnabled;
  return true;
}

function memoryOverrideOf(table: MemoryTable, line: number, identity: ImportLineIdentity, application: MemoryApplication): ImportLineOverride | null {
  const entry = application.book.get(memoryKeyOf(application.scope, identity));
  const verdict = memoryVerdict(entry);
  if (!entry || verdict.kind !== 'apply' || !applicable(verdict.decision, application)) return null;
  const origin = { kind: 'memory' as const, memoryId: entry.id, count: verdict.count, sourceBatchId: verdict.sourceBatchId };
  return { page: table.page, table: table.table, line, decision: verdict.decision, ...application.stamp, identity, origin };
}

/**
 * Οι αποφάσεις της μνήμης για έναν πίνακα: μόνο για γραμμές **χωρίς** απόφαση ανθρώπου. Δύο γραμμές τιμής από μνήμη, ή γραμμή τιμής
 * όταν ο πίνακας έχει ήδη, ⇒ καμία τιμή από μνήμη: ποτέ σιωπηλή επιλογή ανάμεσα σε δύο τιμές για το ίδιο SKU.
 */
export function memoryOverridesFor(table: MemoryTable, existing: readonly ImportLineOverride[], application: MemoryApplication): ImportLineOverride[] {
  const own = tableOverridesOf(existing, table.page, table.table);
  const decided = new Set(own.map(({ line }) => line));
  const found = [...table.identities].flatMap(([line, identity]) =>
    decided.has(line) || !isMemorable(identity) ? [] : (memoryOverrideOf(table, line, identity, application) ?? []));
  const prices = found.filter(({ decision }) => decision.kind === 'price');
  const priceTaken = own.some(({ decision }) => decision.kind === 'price');
  return prices.length > 1 || (prices.length === 1 && priceTaken) ? found.filter(({ decision }) => decision.kind !== 'price') : found;
}

/** Ποιος, πότε, από ποια παρτίδα: η σφραγίδα μιας έγκρισης. */
export interface LearningStamp {
  readonly batchId: string;
  readonly by: string;
  readonly at: string;
}

/** +1 στην απόφαση που εγκρίθηκε· οι άλλες μένουν (Akeneo). Πέρα από το όριο φεύγει η λιγότερο στηριγμένη. */
export function learnedDecisions(current: readonly ImportLabelMemoryDecision[], decision: ImportLineDecision, stamp: LearningStamp): ImportLabelMemoryDecision[] {
  const found = current.find((entry) => sameLineDecision(entry.decision, decision));
  const next: ImportLabelMemoryDecision = { decision, count: (found?.count ?? 0) + 1, lastBatchId: stamp.batchId, lastBy: stamp.by, lastAt: stamp.at };
  const kept = [...current.filter((entry) => entry !== found), next];
  return kept.sort((a, b) => b.count - a.count).slice(0, IMPORT_LABEL_MEMORY_MAX_DECISIONS);
}

/** Απόφαση γραμμής με ταυτότητα που μαθαίνεται. */
export type LearnableOverride = ImportLineOverride & { readonly identity: ImportLineIdentity };

/** Οι αποφάσεις ενός πίνακα που μαθαίνονται στην έγκρισή του: όσες έχουν ταυτότητα με κείμενο. */
export const learnableOverrides = (overrides: readonly ImportLineOverride[] | undefined, page: number, table: string): LearnableOverride[] =>
  tableOverridesOf(overrides, page, table).filter((override): override is LearnableOverride => isMemorable(override.identity));

/** Ο ορισμός του εγγράφου μνήμης μετά την έγκριση. */
export function learnedEntry(
  current: ImportLabelMemoryDefinition | null,
  scope: LabelMemoryScope,
  override: LearnableOverride,
  stamp: LearningStamp,
): ImportLabelMemoryDefinition {
  const { identity } = override;
  return {
    code: memoryKeyOf(scope, identity),
    supplierContactId: scope.supplierContactId,
    familyId: scope.familyId,
    label: identity.label,
    unitCode: identity.unitCode,
    printedLabel: identity.printed,
    decisions: learnedDecisions(current?.decisions ?? [], override.decision, stamp),
  };
}

/* ── §5.5.2 Β5.2: η μνήμη απέναντι σε υπάρχουσα παρτίδα (υποδείξεις, ρητή εφαρμογή, αναίρεση) ───────────────────────────────── */

/** Από πού ήρθε μια απόφαση γραμμής: η απουσία `origin` σημαίνει άνθρωπο. */
export const isMemoryOverride = (override: Pick<ImportLineOverride, 'origin'>): boolean => override.origin?.kind === 'memory';

/** Οι γραμμές κάθε πίνακα που η μνήμη **βλέπει**: όσες έχουν ταυτότητα (ίδιο σχήμα με το `tableLineIdentities` της ανάγνωσης). */
function identitiesByTable(lines: readonly ImportPageUnmappedLine[]): MemoryTable[] {
  const tables = new Map<string, { page: number; table: string; identities: Map<number, ImportLineIdentity> }>();
  for (const line of lines) {
    if (!line.identity) continue;
    const key = pageTableGroupKey(line.page, line.table);
    const entry = tables.get(key) ?? { page: line.page, table: line.table, identities: new Map<number, ImportLineIdentity>() };
    entry.identities.set(line.line, line.identity);
    tables.set(key, entry);
  }
  return [...tables.values()];
}

function hintOf(line: ImportPageUnmappedLine, application: MemoryApplication): ImportMemoryHint | null {
  if (!isMemorable(line.identity)) return null;
  const entry = application.book.get(memoryKeyOf(application.scope, line.identity));
  const verdict = memoryVerdict(entry);
  if (!entry || verdict.kind === 'none') return null;
  const options = entry.decisions.map(({ decision, count, lastBatchId }) => ({ decision, count, lastBatchId, usable: applicable(decision, application) }));
  return { page: line.page, table: line.table, line: line.line, memoryId: entry.id, verdict: verdict.kind, options };
}

/**
 * Τι ξέρει η μνήμη για τις **γραμμές χωρίς πεδίο** μιας παρτίδας που ήδη διαβάστηκε, χωρίς να το εφαρμόσει (Απόφαση 4). Υποδείξεις
 * μόνο για γραμμές χωρίς απόφαση· το `applicable` μετριέται με τον **ίδιο** κανόνα της εφαρμογής (`memoryOverridesFor`).
 * ⚠️ Δεν μετρά γραμμές που αντιστοίχισε το μοντέλο: η ταυτότητά τους βγαίνει μόνο από το PDF, άρα τις κρίνει η ρητή «Εφαρμογή
 *    μνήμης» (`import-memory-apply.server`), που αναφέρει μετά τι έκανε.
 */
export function memoryHintsFor(lines: readonly ImportPageUnmappedLine[], overrides: readonly ImportLineOverride[], application: MemoryApplication): ImportMemoryHints {
  const undecided = lines.filter((line) => lineDecisionOf(overrides, line) === null);
  const applicableCount = identitiesByTable(undecided).reduce((sum, table) => sum + memoryOverridesFor(table, overrides, application).length, 0);
  return {
    hints: undecided.flatMap((line) => hintOf(line, application) ?? []),
    applicable: applicableCount,
    legacyLines: undecided.filter((line) => line.identity === undefined).length,
    fromMemory: overrides.filter(isMemoryOverride).length,
  };
}

/**
 * Οι αποφάσεις ενός πίνακα μετά τη ρητή «Εφαρμογή μνήμης». Ό,τι υπήρχε μένει (πρώτα ο άνθρωπος). Οι αποφάσεις χωρίς ταυτότητα την
 * αποκτούν: είναι η «αποθήκευση» μιας παλιάς παρτίδας, κατά την πρακτική του Revit. Η μνήμη μπαίνει **μόνο** σε γραμμές που είναι
 * ακόμη χωρίς απόφαση τη στιγμή της εγγραφής. Ιδεμπότητη.
 */
export function withMemoryApplied(
  own: readonly ImportLineOverride[],
  found: readonly ImportLineOverride[],
  identities: ReadonlyMap<number, ImportLineIdentity>,
): ImportLineOverride[] {
  const enriched = own.map((override) => {
    const identity = identities.get(override.line);
    return identity && !override.identity ? { ...override, identity } : override;
  });
  const decided = new Set(own.map(({ line }) => line));
  return [...enriched, ...found.filter(({ line }) => !decided.has(line))];
}
