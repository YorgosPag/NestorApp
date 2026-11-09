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

import type { ImportLineDecision, ImportLineOverride, ImportLineOverrideOrigin, ImportPageUnmappedLine } from '../types/catalog-import';
import { lineKeyOf, tableOverridesOf } from './page-line-overrides';

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
        // Η γραμμή χωρίς πεδίο τυπώνει και τη μονάδα· η ταυτότητα μόνο τις ετικέτες.
        label: source?.label || override.identity?.printed || null,
        values: source?.values ?? [],
        decision: override.decision,
        origin: override.origin ?? null,
      };
    })
    .sort((a, b) => a.line - b.line);
}
