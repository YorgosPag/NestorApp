/**
 * Οι **αποφασισμένες γραμμές** ενός πίνακα (ADR-923 §5.5.2 Β5.2). Καθαρό.
 *
 * 🔑 Γιατί υπάρχει: γραμμή που έγινε ιδιότητα ή τιμή **φεύγει** από τις «γραμμές χωρίς πεδίο» (`unmappedLines` κρατά μόνο όσες δεν
 *    πήραν πεδίο), και τα πεδία της πρότασης δεν ξέρουν τη γραμμή-πηγή τους. Χωρίς αυτή τη λίστα η απόφαση —του ανθρώπου ή της
 *    μνήμης— **δεν φαινόταν και δεν αναιρούνταν**. Πηγή αλήθειας είναι οι αποφάσεις της παρτίδας (`lineOverrides`), όχι η ανάγνωση.
 * 🔑 Η ετικέτα έρχεται από τη γραμμή χωρίς πεδίο (αγνόηση, με τη μονάδα) ή από την ταυτότητα της απόφασης (`identity.printed`)· καμία ⇒ `null` και
 *    η οθόνη λέει «γραμμή N». Ποτέ επινοημένο κείμενο.
 * @module subapps/catalog/import/decided-lines
 */

import type { ImportLineDecision, ImportLineOverride, ImportLineOverrideOrigin, ImportPageUnmappedLine, ImportProposalRow } from '../types/catalog-import';
import { IMPORT_LINE_MAX_TARGETS } from '../vocabulary/catalog-import';
import { decisionAttributeIds, lineKeyOf, tableOverridesOf } from './page-line-overrides';

export interface DecidedLine {
  readonly page: number;
  readonly table: string;
  readonly line: number;
  /** Οι ετικέτες όπως τυπώνονται· `null` = άγνωστες (παρτίδα παλαιότερη του Β5). */
  readonly label: string | null;
  /** Οι τιμές της γραμμής, όταν η γραμμή είναι ακόμη στις «χωρίς πεδίο» (αγνόηση)· αλλιώς κενό. */
  readonly values: readonly string[];
  readonly decision: ImportLineDecision;
  /** `null` = απόφαση ανθρώπου. */
  readonly origin: ImportLineOverrideOrigin | null;
}

/**
 * Η ετικέτα της γραμμής όπως **τυπώνεται** — ΕΝΑΣ κανόνας για τη λίστα αποφάσεων και τη στοίβα αναίρεσης (`review-history-line`).
 * Η γραμμή χωρίς πεδίο τυπώνει και τη μονάδα· η ταυτότητα της απόφασης μόνο τις ετικέτες. Καμία ⇒ `null` (ποτέ επινοημένο κείμενο).
 */
export const printedLineLabelOf = (
  source: Pick<ImportPageUnmappedLine, 'label'> | undefined,
  override: Pick<ImportLineOverride, 'identity'> | undefined,
): string | null => source?.label || override?.identity?.printed || null;

/** Οι αποφάσεις του πίνακα, στη σειρά των γραμμών του. */
export function decidedLinesOf(
  overrides: readonly ImportLineOverride[] | undefined,
  unmapped: readonly ImportPageUnmappedLine[],
  page: number,
  table: string,
): DecidedLine[] {
  const byKey = new Map(unmapped.map((line) => [lineKeyOf(line), line]));
  return tableOverridesOf(overrides, page, table)
    .map((override) => {
      const source = byKey.get(lineKeyOf(override));
      return {
        page,
        table,
        line: override.line,
        label: printedLineLabelOf(source, override),
        values: source?.values ?? [],
        decision: override.decision,
        origin: override.origin ?? null,
      };
    })
    .sort((a, b) => a.line - b.line);
}

/** §5.5.2 Β3 Γ13: χωράει η γραμμή «και σε άλλη ιδιότητα»; Μόνο αντιστοίχιση `attribute`, και κάτω από το όριο στόχων. */
export const canAddLineTarget = (decision: ImportLineDecision): boolean =>
  decision.kind === 'attribute' && decisionAttributeIds(decision).length < IMPORT_LINE_MAX_TARGETS;

/**
 * §5.5.2 Β3 Γ13: η αντιστοιχισμένη γραμμή **ως είσοδος του εργαλείου γραμμής** («και σε άλλη ιδιότητα»). Η γραμμή έχει φύγει από τις
 * «χωρίς πεδίο», άρα οι τιμές της έρχονται από τα πεδία της **κύριας** ιδιότητας στην πρόταση, στη σειρά των παραλλαγών — ό,τι διάβασε
 * ο ίδιος αγωγός, όχι επινοημένο κείμενο. Ετικέτα `null` ⇒ `null`: το εργαλείο δεν ανοίγει χωρίς τι να δείξει.
 */
export function decidedToolLineOf(entry: DecidedLine, rows: readonly ImportProposalRow[]): ImportPageUnmappedLine | null {
  if (entry.decision.kind !== 'attribute' || entry.label === null) return null;
  const main = entry.decision.attributeId;
  const values = rows.flatMap((row) => row.fields.flatMap((field) => (field.target.kind === 'attribute' && field.target.attributeId === main ? [field.sourceText] : [])));
  return { page: entry.page, table: entry.table, line: entry.line, label: entry.label, values };
}
