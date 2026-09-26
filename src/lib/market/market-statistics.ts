/**
 * @fileoverview **ΤΟ ΚΑΤΩΦΛΙ ΚΑΙ Η ΔΙΑΜΕΣΟΣ** — ο ένας τρόπος να συνοψίσεις τιμές μονάδας, για κάθε πηγή
 * τιμών (ADR-889 §5.4 · ADR-890 §5.3).
 * @related ADR-889 · ADR-890 · `scripts/lib/market-transactions/market-statistics.ts` (ο κανόνας συγκρισιμότητας του ΜΑΜΑ)
 * @module lib/market/market-statistics
 *
 * 🔑 **ΔΙΑΜΕΣΟΣ ΚΑΙ ΤΕΤΑΡΤΗΜΟΡΙΑ, ΠΟΤΕ ΜΕΣΟΣ ΟΡΟΣ.** Το ΜΑΜΑ έχει χιλιάδες πανομοιότυπες γραμμές (ADR-889 §3)
 * και οι αγγελίες έχουν ακραίες τιμές. Η διάμεσος τα αντέχει, ο μέσος όρος όχι. Ίδια επιλογή με το Redfin.
 *
 * 🔑 **ΤΟ ΚΑΤΩΦΛΙ ΕΙΝΑΙ ΕΝΑ, ΓΙΑ ΤΙΣ ΔΥΟ ΠΗΓΕΣ.** Γεννήθηκε στο `scripts/` (ADR-889 Φ1) και μετακόμισε εδώ στη Φ1
 * του ADR-890, ώστε ο γεννήτορας και η σελίδα περιοχής να ρωτούν την **ίδια** σταθερά.
 *
 * ⚠️ **Φύλλο χωρίς runtime εισαγωγές από `@/`**: το διαβάζει και ο γεννήτορας (`tsx`).
 */

/**
 * **Κάτω από τόσες τιμές, κανένας αριθμός.**
 *
 * Τεκμηρίωση: ONS, *House price statistics for small areas* QMI — «λιγότερες από πέντε εγγραφές ⇒ τα
 * στατιστικά δεν δημοσιεύονται· πέντε είναι το ελάχιστο για αξιόπιστη διάμεσο».
 */
export const MARKET_STAT_MIN_SAMPLE = 5;

/**
 * Ποσοστημόριο με **γραμμική παρεμβολή** (Hyndman–Fan τύπος 7): ό,τι δίνουν το `PERCENTILE.INC` του Excel
 * και το προεπιλεγμένο του numpy, ώστε κάθε αριθμός να επαληθεύεται σε λογιστικό φύλλο.
 * @param sorted αύξουσα σειρά, μη κενός
 */
export function quantile(sorted: readonly number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Κελί **κάτω** από το κατώφλι: μόνο το πλήθος. Ο αριθμός **δεν υπολογίζεται καν**. */
export interface SuppressedStatCell {
  readonly n: number;
}

/** Κελί που δημοσιεύεται: πλήθος, διάμεσος και ενδοτεταρτημοριακό εύρος. */
export interface ReportedStatCell {
  readonly n: number;
  readonly median: number;
  readonly p25: number;
  readonly p75: number;
}

export type StatCell = SuppressedStatCell | ReportedStatCell;

/** Δημοσιεύεται αυτό το κελί; */
export function isReportedStatCell(cell: StatCell): cell is ReportedStatCell {
  return 'median' in cell;
}

/** Σύνοψη τιμών μονάδας, στρογγυλεμένη στο ευρώ. */
export function summarize(values: readonly number[]): StatCell {
  if (values.length < MARKET_STAT_MIN_SAMPLE) return { n: values.length };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    median: Math.round(quantile(sorted, 0.5)),
    p25: Math.round(quantile(sorted, 0.25)),
    p75: Math.round(quantile(sorted, 0.75)),
  };
}
