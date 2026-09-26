/**
 * @fileoverview **ΤΟ ΑΡΧΕΙΟ ΕΞΟΔΟΥ ΑΝΑ ΠΕΡΙΟΧΗ** — σχήμα, κωδικοποίηση γραμμής, ντετερμινιστική σύνθεση (ADR-889 §5.2 βήμα 5–6).
 * @related ADR-889 · `market-statistics.ts` · `scripts/build-market-transactions.ts` (ο γραφέας)
 *
 * 🔑 **ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ.** Ίδιες είσοδοι ⇒ byte-ταυτόσημη έξοδος: ταξινομημένες γραμμές, ταξινομημένα κλειδιά,
 * και **καμία** χρονοσφραγίδα εκτέλεσης μέσα στα αρχεία (η προέλευση είναι το `Last-Modified` και το
 * sha256 της πηγής, στο ευρετήριο). Έτσι ένα `git diff` σε επαναπαραγωγή δείχνει **μόνο** ό,τι άλλαξε στην πηγή.
 *
 * 🔑 **ΠΛΕΙΑΔΑ, ΟΧΙ ΑΝΤΙΚΕΙΜΕΝΟ ΑΝΑ ΓΡΑΜΜΗ** — ίδια απόφαση με το `admin-area-index-file.ts`: δεκάδες χιλιάδες
 * γραμμές × 16 ονόματα πεδίων θα ήταν περισσότερα bytes σε κλειδιά παρά σε δεδομένα. Τα ονόματα ζουν **μία**
 * φορά, στο `vocab.rowFields` του ευρετηρίου.
 *
 * ⚠️ **Φ2**: όταν η οθόνη γίνει καταναλωτής, οι **τύποι** και ο αναγνώστης αυτού του σχήματος μετακομίζουν
 * στο `src/lib/`, όπως το `admin-boundary-file.ts` (ένα συμβόλαιο, δύο πλευρές).
 */

import type { MamaRecord } from './mama-source';
import { quarterOf } from './market-statistics';
import type { MarketSegment } from '../../../src/lib/market/market-segments';
import { summarize, type StatCell } from '../../../src/lib/market/market-statistics';
import {
  MAMA_APAA,
  MAMA_CATEGORIES,
  MAMA_RIGHTS,
  MAMA_SPECIAL_CONDITIONS,
  type MamaRight,
} from './mama-vocabulary';

export const MARKET_TRANSACTIONS_FORMAT_VERSION = 1;

/** Η σειρά των πεδίων της πλειάδας — δημοσιεύεται στο ευρετήριο ως `vocab.rowFields`. */
export const ROW_FIELDS = [
  'date',
  'category',
  'price',
  'mainArea',
  'auxArea',
  'yearBuilt',
  'floor',
  'zonePrice',
  'frontages',
  'plotArea',
  'buildingRight',
  'buildingShare',
  'plotRight',
  'plotShare',
  'special',
  'district',
  'insideApaa',
  'unitPrice',
] as const;

type Cell = string | number | null;
export type EncodedRow = readonly Cell[];

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
function compareCells(a: Cell, b: Cell): number {
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

export interface AreaFile {
  readonly v: number;
  readonly id: string;
  readonly name: string;
  readonly level: number;
  /** Ετικέτες «Διαμέρισμα» της πηγής — το πεδίο `district` είναι δείκτης εδώ. */
  readonly districts: readonly string[];
  readonly rows: readonly EncodedRow[];
  /** τμήμα → τρίμηνο → κελί. Μόνο συγκρίσιμες γραμμές. */
  readonly stats: Readonly<Record<string, Readonly<Record<string, StatCell>>>>;
}

function sortedRecord<T>(entries: Iterable<readonly [string, T]>): Record<string, T> {
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Τμήμα → τρίμηνο → κελί στατιστικών, από τις συγκρίσιμες γραμμές. */
function buildStats(items: readonly ClassifiedRecord[]): AreaFile['stats'] {
  const buckets = new Map<string, Map<string, number[]>>();
  for (const { record, segment, unitPrice } of items) {
    if (segment === null || unitPrice === null) continue;
    const bySegment = buckets.get(segment) ?? new Map<string, number[]>();
    buckets.set(segment, bySegment);
    const quarter = quarterOf(record.contractDate);
    const values = bySegment.get(quarter);
    if (values === undefined) bySegment.set(quarter, [unitPrice]);
    else values.push(unitPrice);
  }
  return sortedRecord(
    [...buckets].map(([segment, byQuarter]) => [segment, sortedRecord([...byQuarter].map(([q, values]) => [q, summarize(values)]))] as const),
  );
}

/** **Το αρχείο μιας περιοχής** — ντετερμινιστικό για κάθε σειρά εισόδου των γραμμών. */
export function buildAreaFile(area: { id: string; name: string; level: number }, items: readonly ClassifiedRecord[]): AreaFile {
  const districts = [...new Set(items.map((item) => item.record.district))].sort();
  const districtIndex = new Map(districts.map((label, i) => [label, i]));
  const rows = items.map((item) => encodeRow(item, districtIndex.get(item.record.district) as number)).sort(compareRows);
  return { v: MARKET_TRANSACTIONS_FORMAT_VERSION, ...area, districts, rows, stats: buildStats(items) };
}
