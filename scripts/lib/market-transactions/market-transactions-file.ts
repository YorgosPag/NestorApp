/**
 * @fileoverview **Η ΣΥΝΘΕΣΗ ΤΩΝ ΑΡΧΕΙΩΝ ΑΝΑ ΠΕΡΙΟΧΗ** — κωδικοποίηση γραμμής και ντετερμινιστική σύνθεση (ADR-889 §5.2 βήμα 5–6).
 * @related ADR-889 · `src/lib/market/market-transactions-file.ts` (**το σχήμα** — κοινό με την εφαρμογή) ·
 *   `area-summary.ts` (τα στατιστικά) · `scripts/build-market-transactions.ts` (ο γραφέας)
 *
 * 🔑 **ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ.** Ίδιες είσοδοι ⇒ byte-ταυτόσημη έξοδος: ταξινομημένες γραμμές, ταξινομημένα κλειδιά,
 * και **καμία** χρονοσφραγίδα εκτέλεσης μέσα στα αρχεία (η προέλευση είναι το `Last-Modified` και το
 * sha256 της πηγής, στο ευρετήριο). Έτσι ένα `git diff` σε επαναπαραγωγή δείχνει **μόνο** ό,τι άλλαξε στην πηγή.
 *
 * 🔑 **Το σχήμα ζει στο `src/lib/`** (ADR-889 Φ2): ο γραφέας και ο αναγνώστης ρωτούν τους ΙΔΙΟΥΣ τύπους και το
 * ΙΔΙΟ `ROW_FIELDS`. Εδώ μένει μόνο ό,τι ξέρει την εγγραφή της πηγής (`MamaRecord`).
 */

import type { MamaRecord } from './mama-source';
import type { MarketSegment } from '../../../src/lib/market/market-segments';
import {
  MARKET_TRANSACTIONS_FORMAT_VERSION,
  type AreaRowsFile,
  type EncodedRow,
  type RowCell,
} from '../../../src/lib/market/market-transactions-file';
import {
  MAMA_APAA,
  MAMA_CATEGORIES,
  MAMA_RIGHTS,
  MAMA_SPECIAL_CONDITIONS,
  type MamaRight,
} from './mama-vocabulary';

/** Οι κατηγορίες με τη σειρά δήλωσης — ο δείκτης τους είναι η τιμή του πεδίου `category`. */
export const CATEGORY_ORDER: readonly string[] = Object.keys(MAMA_CATEGORIES);

/** Μία μεταβίβαση με τις αποφάσεις του γεννήτορα. */
export interface ClassifiedRecord {
  readonly record: MamaRecord;
  readonly segment: MarketSegment | null;
  /** Τιμή μονάδας αν η γραμμή είναι συγκρίσιμη (`comparableUnitPrice`), αλλιώς `null`. */
  readonly unitPrice: number | null;
}

function indexOrNull(value: MamaRight | string | null, list: readonly string[]): number | null {
  return value === null ? null : list.indexOf(value);
}

function encodeRow(item: ClassifiedRecord, district: number): EncodedRow {
  const r = item.record;
  return [
    r.contractDate,
    CATEGORY_ORDER.indexOf(r.category),
    r.price,
    r.mainArea,
    r.auxArea,
    r.yearBuilt,
    r.floor,
    r.zonePrice,
    r.frontages,
    r.plotArea,
    indexOrNull(r.buildingRight, MAMA_RIGHTS),
    r.buildingShare,
    indexOrNull(r.plotRight, MAMA_RIGHTS),
    r.plotShare,
    indexOrNull(r.special, MAMA_SPECIAL_CONDITIONS),
    district,
    r.apaa === MAMA_APAA[0] ? 1 : 0,
    item.unitPrice === null ? null : Math.round(item.unitPrice),
  ];
}

/** Σύγκριση πλειάδων κελί-κελί: `null` πρώτο, αριθμοί αριθμητικά, κείμενο λεξικογραφικά (σταθερό, ανεξάρτητο locale). */
function compareCells(a: RowCell, b: RowCell): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

export function compareRows(a: EncodedRow, b: EncodedRow): number {
  for (let i = 0; i < a.length; i += 1) {
    const order = compareCells(a[i], b[i]);
    if (order !== 0) return order;
  }
  return 0;
}

/** **Οι γραμμές μιας περιοχής** — ντετερμινιστικές για κάθε σειρά εισόδου. */
export function buildAreaRowsFile(areaId: string, items: readonly ClassifiedRecord[]): AreaRowsFile {
  const districts = [...new Set(items.map((item) => item.record.district))].sort();
  const districtIndex = new Map(districts.map((label, i) => [label, i]));
  const rows = items.map((item) => encodeRow(item, districtIndex.get(item.record.district) as number)).sort(compareRows);
  return { v: MARKET_TRANSACTIONS_FORMAT_VERSION, id: areaId, districts, rows };
}
