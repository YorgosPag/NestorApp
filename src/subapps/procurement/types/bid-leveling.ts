// ============================================================================
// BID LEVELING — ADR-327 §8.5 (γραμμή RFQ × προσφορά)
// ============================================================================
//
// Ο πίνακας που συγκρίνει προσφορές **ανά γραμμή του αιτήματος**, όπως το bid leveling του Procore και του
// BuildingConnected. Υπολογίζεται (καθαρά) από `utils/bid-leveling.ts` — δεν αποθηκεύεται.
//
// Όλα τα ποσά είναι **καθαρά (χωρίς ΦΠΑ)**: το leveling συγκρίνει αντικείμενο εργασιών· ο ΦΠΑ ανήκει στο TCO.

/** Πώς απάντησε η προσφορά σε μια γραμμή RFQ. */
export type LevelingCellState = 'priced' | 'included' | 'excluded' | 'unanswered';

/** `explicit` = ο προμηθευτής το δήλωσε (πύλη) · `inferred` = το συμπέρανε ο κινητήρας (σάρωση/χειροκίνητη/παλιά). */
export type LevelingBinding = 'explicit' | 'inferred';

/**
 * Από πού ήρθε το ποσό που καλύπτει ένα κενό — **πάντα ορατό**, ποτέ σιωπηλό:
 * `estimate` = η εσωτερική εκτίμηση του PM (`RfqLine.unitPrice` × ποσότητα) ·
 * `highest_bid` = η ΥΨΗΛΟΤΕΡΗ συγκρίσιμη τιμή άλλου προμηθευτή στην ίδια γραμμή (συντηρητικό: το κενό δεν
 * «κερδίζει» ποτέ φθηνότερα από όσο θα κόστιζε να καλυφθεί).
 */
export type LevelingPlugSource = 'estimate' | 'highest_bid';

export interface LevelingPlug {
  amount: number;
  source: LevelingPlugSource;
}

export interface LevelingAlternate {
  lineId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
}

export interface LevelingCell {
  quoteId: string;
  rfqLineId: string;
  state: LevelingCellState;
  /** `null` όταν δεν υπάρχει απάντηση. */
  binding: LevelingBinding | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  /**
   * Η **συγκρίσιμη** αξία: τιμή μονάδας × ποσότητα **του RFQ** όταν οι μονάδες συμφωνούν (ίδια βάση για όλους)·
   * αλλιώς το σύνολο γραμμής του προμηθευτή, σημαδεμένο `unitMismatch`. `0` για «περιλαμβάνεται».
   */
  leveledAmount: number | null;
  /** Ο προμηθευτής τιμολόγησε σε ΑΛΛΗ μονάδα (`resolveUom`): m ≠ m² — όχι συγκρίσιμο ανά μονάδα. */
  unitMismatch: boolean;
  /** Ποσότητα προμηθευτή − ποσότητα RFQ (μόνο με ίδια μονάδα)· `0` = καμία απόκλιση. */
  quantityDeviation: number | null;
  note: string | null;
  /** Μόνο σε `excluded` / `unanswered`. `null` = κενό χωρίς διαθέσιμη πηγή ποσού. */
  plug: LevelingPlug | null;
  alternates: LevelingAlternate[];
}

/** `full` = όλοι τιμολόγησαν/κάλυψαν · `partial` = κάποιοι άφησαν κενό · `none` = ΚΑΝΕΙΣ δεν το καλύπτει. */
export type LevelingRowCoverage = 'full' | 'partial' | 'none';

export interface LevelingRow {
  rfqLineId: string;
  description: string;
  categoryCode: string | null;
  quantity: number | null;
  unit: string | null;
  cells: LevelingCell[];
  /** Η φθηνότερη **συγκρίσιμη** τιμολόγηση (`priced`, χωρίς `unitMismatch`)· `null` αν καμία. */
  lowestQuoteId: string | null;
  coverage: LevelingRowCoverage;
}

export interface LevelingColumn {
  quoteId: string;
  /** Όπως υποβλήθηκε (`totals.subtotal`). */
  submittedNet: number;
  pricedAmount: number;
  additionalItems: { count: number; amount: number };
  plugs: { count: number; amount: number };
  /** Κενά χωρίς πηγή ποσού — το εξισορροπημένο σύνολο είναι τότε **κάτω όριο**. */
  unpluggedGaps: number;
  inferredBindings: number;
  /** Συνολικό ποσό χωρίς τιμές γραμμών (`quotedTotal`) — δεν ισοσταθμίζεται ανά γραμμή. */
  lumpSum: boolean;
  /** pricedAmount + plugs + additionalItems (ή `submittedNet` όταν `lumpSum`). */
  leveledNet: number;
}

export interface BidLevelingResult {
  rows: LevelingRow[];
  columns: LevelingColumn[];
}
