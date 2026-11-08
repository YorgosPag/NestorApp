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

/** Νέα λίστα με την απόφαση της γραμμής αντικατεστημένη (`null` = αναίρεση). Ιδεμπότητη. */
export function withLineOverride(
  overrides: readonly ImportLineOverride[],
  address: LineAddress,
  decision: ImportLineDecision | null,
  stamp: Pick<ImportLineOverride, 'by' | 'at'>,
): ImportLineOverride[] {
  const rest = overrides.filter((override) => !sameLine(override, address));
  return decision === null ? rest : [...rest, { page: address.page, table: address.table, line: address.line, decision, ...stamp }];
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
}

/**
 * Η απάντηση του μοντέλου με τις αποφάσεις από πάνω. Αντιστοίχιση ⇒ η γραμμή δείχνει την ιδιότητα με βεβαιότητα 1 (αντικαθιστά ό,τι
 * είχε πει το μοντέλο). Αγνόηση ⇒ καμία αλλαγή.
 */
export function applyLineOverrides(
  mapping: RawTableMapping,
  overrides: readonly ImportLineOverride[],
  codeById: ReadonlyMap<string, string>,
  knownCodes: ReadonlySet<string>,
): OverriddenMapping {
  const chosen = new Map<number, RawLineMapping>();
  const unknownAttributeIds: string[] = [];
  for (const { line, decision } of overrides) {
    if (decision.kind !== 'attribute') continue;
    const code = codeById.get(decision.attributeId);
    if (code === undefined) unknownAttributeIds.push(decision.attributeId);
    else chosen.set(line, { line, attribute: code, confidence: HUMAN_CONFIDENCE });
  }
  const kept = mapping.lines.filter((entry) => !chosen.has(entry.line));
  const staleCodes = [...new Set(kept.flatMap((entry) => (entry.attribute !== null && !knownCodes.has(entry.attribute) ? [entry.attribute] : [])))];
  return { mapping: { ...mapping, lines: [...kept, ...chosen.values()] }, staleCodes, unknownAttributeIds };
}

/** Οι γραμμές χωρίς πεδίο που περιμένουν ακόμη απόφαση: όσες δεν αγνοήθηκαν ρητά. */
export function pendingUnmappedLines(lines: readonly ImportPageUnmappedLine[], overrides: readonly ImportLineOverride[] | undefined): ImportPageUnmappedLine[] {
  return lines.filter((line) => lineDecisionOf(overrides, line)?.kind !== 'ignore');
}
