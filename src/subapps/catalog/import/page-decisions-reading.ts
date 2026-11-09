/**
 * Η **ανάγνωση σελίδας με τις αποφάσεις από πάνω** (ADR-923 §5.5.2 Β5, κλείνει το Μ5). Καθαρό.
 *
 * 🔑 **Ένα σημείο:** το καλούν **και** η πληρωμένη ανάγνωση (`import-page-flow`) **και** το ξαναχτίσιμο πίνακα (`import-table-rebuild`).
 *    Ως το Β5 μόνο το ξαναχτίσιμο εφάρμοζε τις αποφάσεις γραμμής, άρα νέα ανάγνωση μιας σελίδας που είχε αποτύχει τις αγνοούσε.
 * 🔑 Οι αποφάσεις (ανθρώπου ή μνήμης, ίδιο σχήμα `ImportLineOverride`) μπαίνουν ανά πίνακα με `applyLineOverrides`, οι γραμμές τιμής
 *    γίνονται `priceLinesByTable`, και διαβάζει ο **ένας** αγωγός (`readPageTables`).
 * @module subapps/catalog/import/page-decisions-reading
 */

import type { ImportLineOverride } from '../types/catalog-import';
import { applyLineOverrides, tableOverridesOf, type PagePriceLine } from './page-line-overrides';
import type { RawPageMapping } from './page-table-mapping';
import { readPageTables, type PageTableContext, type PageTableReading } from './page-table-reading';

/** Οι κωδικοί του σχήματος της οικογένειας: id → κωδικός (για τις αποφάσεις) και το σύνολο των κωδικών (για τη φυλαγμένη απάντηση). */
export interface DecisionSchema {
  readonly codeById: ReadonlyMap<string, string>;
  readonly knownCodes: ReadonlySet<string>;
}

export interface DecidedPageReading {
  readonly reading: PageTableReading;
  /** Κωδικοί της απάντησης που δεν υπάρχουν πια στο σχήμα (Μ17). */
  readonly staleCodes: readonly string[];
  /** Αποφάσεις που δείχνουν ιδιότητα έξω από το σχήμα: δεν εφαρμόστηκαν. */
  readonly unknownAttributeIds: readonly string[];
}

/** Η απάντηση του μοντέλου, κάθε πίνακας με τις δικές του αποφάσεις, μέσα από τον ίδιο αγωγό. */
export function readPageWithDecisions(
  mapping: RawPageMapping,
  context: Omit<PageTableContext, 'priceLinesByTable'>,
  overrides: readonly ImportLineOverride[],
  schema: DecisionSchema,
): DecidedPageReading {
  const applied = mapping.tables.map((answer) => applyLineOverrides(answer, tableOverridesOf(overrides, context.page, answer.table), schema.codeById, schema.knownCodes));
  const priceLinesByTable = new Map<string, readonly PagePriceLine[]>(applied.map((entry) => [entry.mapping.table, entry.priceLines]));
  const reading = readPageTables({ tables: applied.map((entry) => entry.mapping) }, { ...context, priceLinesByTable });
  return {
    reading,
    staleCodes: [...new Set(applied.flatMap((entry) => entry.staleCodes))],
    unknownAttributeIds: [...new Set(applied.flatMap((entry) => entry.unknownAttributeIds))],
  };
}
