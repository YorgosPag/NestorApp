/**
 * Οι **αποφάσεις γραμμής** του ανθρώπου πάνω στην αντιστοίχιση του μοντέλου (ADR-923 §5.5.2 Β3 Γ1–Γ2). Καθαρό.
 *
 * 🔑 Η απόφαση είναι **διόρθωση της αντιστοίχισης**, όχι νέα ανάγνωση: η φυλαγμένη απάντηση (`RawTableMapping`) αλλάζει μόνο στις
 *    γραμμές που αποφάσισε ο άνθρωπος, με βεβαιότητα 1, και ο ίδιος αγωγός (`readPageTables`) ξαναδιαβάζει τις τιμές από τον πίνακα.
 * 🔑 Η «Αγνόηση» δεν αλλάζει την αντιστοίχιση: η γραμμή μένει χωρίς πεδίο, και απλώς λογίζεται **αποφασισμένη**.
 * 🔑 Κωδικός της απάντησης που δεν υπάρχει πια στο σχήμα δεν πέφτει σιωπηλά: επιστρέφεται ως `staleCodes`.
 * @module subapps/catalog/import/page-line-overrides
 */

import type { ImportLineDecision, ImportLineOverride, ImportPageUnmappedLine } from '../types/catalog-import';
import type { RawLineMapping, RawTableMapping } from './page-table-mapping';

/** Ο άνθρωπος είδε τη γραμμή και διάλεξε: καμία αμφιβολία να μεταφερθεί στο πεδίο. */
const HUMAN_CONFIDENCE = 1;

type LineAddress = Pick<ImportLineOverride, 'page' | 'table' | 'line'>;

export const lineKeyOf = ({ page, table, line }: LineAddress): string => `${page}\u0000${table}\u0000${line}`;

const sameLine = (a: LineAddress, b: LineAddress): boolean => a.page === b.page && a.table === b.table && a.line === b.line;

/** Η απόφαση της γραμμής, ή `null`. */
export function lineDecisionOf(overrides: readonly ImportLineOverride[] | undefined, address: LineAddress): ImportLineDecision | null {
  return overrides?.find((override) => sameLine(override, address))?.decision ?? null;
}

/** Ό,τι συνοδεύει μια απόφαση πέρα από τη σφραγίδα (§5.5.2 Β5): ταυτότητα για τη μάθηση, προέλευση όταν την έδωσε η μνήμη. */
export type LineOverrideExtras = Pick<ImportLineOverride, 'identity' | 'origin'>;

/** Μόνο τα πεδία που υπάρχουν: το Firestore δεν δέχεται `undefined`. */
const presentExtras = ({ identity, origin }: LineOverrideExtras): LineOverrideExtras => ({ ...(identity ? { identity } : {}), ...(origin ? { origin } : {}) });

/**
 * Νέα λίστα με την απόφαση της γραμμής αντικατεστημένη (`null` = αναίρεση). Ιδεμπότητη. Χωρίς `origin` η απόφαση είναι του
 * ανθρώπου: πάνω σε απόφαση της μνήμης την αντικαθιστά ολόκληρη.
 */
export function withLineOverride(
  overrides: readonly ImportLineOverride[],
  address: LineAddress,
  decision: ImportLineDecision | null,
  stamp: Pick<ImportLineOverride, 'by' | 'at'>,
  extras: LineOverrideExtras = {},
): ImportLineOverride[] {
  const rest = overrides.filter((override) => !sameLine(override, address));
  if (decision === null) return rest;
  return [...rest, { page: address.page, table: address.table, line: address.line, decision, ...stamp, ...presentExtras(extras) }];
}

/** Οι αποφάσεις ενός πίνακα μιας σελίδας. */
export const tableOverridesOf = (overrides: readonly ImportLineOverride[] | undefined, page: number, table: string): ImportLineOverride[] =>
  (overrides ?? []).filter((override) => override.page === page && override.table === table);

export interface OverriddenMapping {
  readonly mapping: RawTableMapping;
  /** Κωδικοί της απάντησης που δεν υπάρχουν πια στο σχήμα της οικογένειας. */
  readonly staleCodes: readonly string[];
  /** Αποφάσεις που δείχνουν ιδιότητα έξω από το σχήμα: δεν εφαρμόστηκαν. */
  readonly unknownAttributeIds: readonly string[];
  /** Γραμμές που ο άνθρωπος δήλωσε **τιμή** (§5.5.2 Β4): βγαίνουν από την αντιστοίχιση ιδιοτήτων, πάνε στην πρόταση τιμών. */
  readonly priceLines: readonly PagePriceLine[];
}

/** Γραμμή τιμής ενός πίνακα, με τη μονάδα που δήλωσε ο άνθρωπος. */
export interface PagePriceLine {
  readonly line: number;
  readonly unitCode: string;
}

/** Η γραμμή τιμής του πίνακα, αν υπάρχει: ο πίνακας έχει **μία** (`priceLineTaken`). */
export const priceLineOf = (overrides: readonly ImportLineOverride[]): ImportLineOverride | null =>
  overrides.find((override) => override.decision.kind === 'price') ?? null;

/**
 * Η απάντηση του μοντέλου με τις αποφάσεις από πάνω. Αντιστοίχιση ⇒ η γραμμή δείχνει την ιδιότητα με βεβαιότητα 1 (αντικαθιστά ό,τι
 * είχε πει το μοντέλο). Τιμή ⇒ η γραμμή φεύγει από την αντιστοίχιση ιδιοτήτων, ακόμη κι αν το μοντέλο της είχε δώσει ιδιότητα: ποτέ
 * τιμή ως ιδιότητα (§5.4). Αγνόηση ⇒ καμία αλλαγή.
 */
export function applyLineOverrides(
  mapping: RawTableMapping,
  overrides: readonly ImportLineOverride[],
  codeById: ReadonlyMap<string, string>,
  knownCodes: ReadonlySet<string>,
): OverriddenMapping {
  const chosen = new Map<number, RawLineMapping>();
  const priceLines: PagePriceLine[] = [];
  const unknownAttributeIds: string[] = [];
  for (const { line, decision } of overrides) {
    if (decision.kind === 'price') priceLines.push({ line, unitCode: decision.unitCode });
    if (decision.kind !== 'attribute') continue;
    const code = codeById.get(decision.attributeId);
    if (code === undefined) unknownAttributeIds.push(decision.attributeId);
    else chosen.set(line, { line, attribute: code, confidence: HUMAN_CONFIDENCE });
  }
  const priced = new Set(priceLines.map(({ line }) => line));
  const kept = mapping.lines.filter((entry) => !chosen.has(entry.line) && !priced.has(entry.line));
  const staleCodes = [...new Set(kept.flatMap((entry) => (entry.attribute !== null && !knownCodes.has(entry.attribute) ? [entry.attribute] : [])))];
  return { mapping: { ...mapping, lines: [...kept, ...chosen.values()] }, staleCodes, unknownAttributeIds, priceLines };
}

/** Οι γραμμές χωρίς πεδίο που περιμένουν ακόμη απόφαση: όσες δεν αγνοήθηκαν ρητά. */
export function pendingUnmappedLines(lines: readonly ImportPageUnmappedLine[], overrides: readonly ImportLineOverride[] | undefined): ImportPageUnmappedLine[] {
  return lines.filter((line) => lineDecisionOf(overrides, line)?.kind !== 'ignore');
}
