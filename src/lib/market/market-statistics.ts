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

const PERCENT = 100;
const MONTHS_PER_YEAR = 12;

/** Το κελί, αν δημοσιεύεται· αλλιώς `null` (και για απόν κελί). */
export function reportedCell(cell: StatCell | undefined | null): ReportedStatCell | null {
  return cell !== undefined && cell !== null && isReportedStatCell(cell) ? cell : null;
}

/**
 * **(α ÷ β − 1) σε %, ΜΟΝΟ όταν ΚΑΙ ΤΑ ΔΥΟ κελιά περνούν το κατώφλι** — η μία απόσταση δύο διαμέσων: ζητούμενη ↔
 * συμβόλαιο (ADR-890 §12), τώρα ↔ πριν από Ν μήνες (ADR-890 §13). Κάτω από το κατώφλι θα ήταν διαίρεση θορύβου με
 * θόρυβο ⇒ `null`, ποτέ «0%».
 */
export function medianGapPct(a: StatCell | undefined | null, b: StatCell | undefined | null): number | null {
  const top = reportedCell(a);
  const bottom = reportedCell(b);
  if (top === null || bottom === null || bottom.median <= 0) return null;
  return Math.round((top.median / bottom.median - 1) * PERCENT);
}

/**
 * **Ακαθάριστη απόδοση ενοικίου σε %** (ADR-890 §5.4) = 12 × διάμεσο μηνιαίο ενοίκιο μονάδας ÷ διάμεση τιμή μονάδας,
 * με ένα δεκαδικό. Διάμεσος-προς-διάμεσο, όπως το idealista (τιμή πώλησης ÷ ενοίκιο των δεικτών του). `null` όταν
 * κάποιο κελί είναι κάτω από το κατώφλι.
 */
export function grossYieldPct(monthlyRent: StatCell | undefined | null, price: StatCell | undefined | null): number | null {
  const rent = reportedCell(monthlyRent);
  const sale = reportedCell(price);
  if (rent === null || sale === null || sale.median <= 0) return null;
  return Math.round(((MONTHS_PER_YEAR * rent.median) / sale.median) * PERCENT * 10) / 10;
}

/** Ο μήνας `YYYY-MM` μιας ημέρας αγοράς `YYYY-MM-DD`. */
export function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

/** Μετατόπιση μήνα `YYYY-MM` κατά `delta` μήνες. */
export function shiftMonth(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * MONTHS_PER_YEAR + Number(month.slice(5, 7)) - 1 + delta;
  const year = Math.floor(index / MONTHS_PER_YEAR);
  return `${year}-${String((index % MONTHS_PER_YEAR) + 1).padStart(2, '0')}`;
}

/** Οι `count` μήνες που τελειώνουν στον `last`, από τον παλαιότερο. */
export function monthsEndingAt(last: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(last, i - (count - 1)));
}

/** Τρίμηνο της ημερομηνίας `YYYY-MM-DD` → `YYYY-Qn`. */
export function quarterOf(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  return `${isoDate.slice(0, 4)}-Q${Math.ceil(month / 3)}`;
}

/** Τα `count` τρίμηνα που τελειώνουν στο τρίμηνο `last` (`YYYY-Qn`), από το παλαιότερο. */
export function quartersEndingAt(last: string, count: number): readonly string[] {
  const index = Number(last.slice(0, 4)) * 4 + Number(last.slice(6)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const q = index - (count - 1 - i);
    return `${Math.floor(q / 4)}-Q${(q % 4) + 1}`;
  });
}
