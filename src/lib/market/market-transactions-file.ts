/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΩΝ ΑΡΧΕΙΩΝ ΤΙΜΩΝ ΣΥΜΒΟΛΑΙΩΝ** — σχήμα, διαδρομές και αναγνώστες σχήματος, κοινά
 * για τον γεννήτορα (ADR-889) και την εφαρμογή (ADR-890 Φ2).
 * @related ADR-889 §5.2 · `scripts/build-market-transactions.ts` (ο γραφέας) ·
 *   `services/market/market-transactions.reader.ts` (ο αναγνώστης του server) · `lib/geo/admin-boundary-file.ts` (ίδιο ιδίωμα)
 * @module lib/market/market-transactions-file
 *
 * 🔑 **ΔΥΟ ΑΡΧΕΙΑ ΑΝΑ ΠΕΡΙΟΧΗ, ΓΙΑ ΔΥΟ ΑΝΑΓΝΩΣΤΕΣ** (ADR-889 §8, «η ουρά μεγέθους»):
 * - `summary/<id>.json` — **λίγα KB**: τα στατιστικά που δείχνει η οθόνη. Αυτό φτάνει στη σελίδα.
 * - `rows/<id>.json` — οι γραμμές (Αθήνα: 2,2 MB). Τις διαβάζει **μόνο ο server** για τις συγκρίσιμες·
 *   ο browser **δεν** τις κατεβάζει ποτέ.
 *
 * 🔑 **ΠΛΕΙΑΔΑ, ΟΧΙ ΑΝΤΙΚΕΙΜΕΝΟ ΑΝΑ ΓΡΑΜΜΗ** — τα ονόματα πεδίων ζουν **μία** φορά ({@link ROW_FIELDS}).
 *
 * ⚠️ **Φύλλο χωρίς runtime εισαγωγές από `@/`**: το διαβάζει και ο γεννήτορας (`tsx`).
 */

import { adminBoundaryFileName } from '../geo/admin-boundary-file';
import { MARKET_SEGMENTS, type MarketSegment } from './market-segments';
import type { StatCell } from './market-statistics';

/** v2 (ADR-889 Φ2): χωριστά `summary/` + `rows/` και ευρετήριο με αναφορά CC-BY. */
export const MARKET_TRANSACTIONS_FORMAT_VERSION = 2;

/** Ο φάκελος μέσα στο `public/`. */
export const MARKET_TRANSACTIONS_DIR = 'data/market-transactions';

/** Η σειρά των πεδίων της πλειάδας — δημοσιεύεται και στο ευρετήριο (`vocab.rowFields`). */
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

export type RowField = (typeof ROW_FIELDS)[number];
export type RowCell = string | number | null;
export type EncodedRow = readonly RowCell[];

/** Θέση κάθε πεδίου στην πλειάδα — ο αναγνώστης ρωτά `row[ROW.unitPrice]`, ποτέ μαγικό αριθμό. */
export const ROW = Object.fromEntries(ROW_FIELDS.map((field, i) => [field, i])) as { readonly [K in RowField]: number };

/** Ο κωδικός της πηγής για το υπόγειο (ADR-889 §3: ο όροφος είναι κείμενο — `'0'`, `'2'`, `'Υ'`). */
const BASEMENT_CODE = 'Υ';

/** Όροφος της πηγής → αριθμός (υπόγειο = −1), ή `null` όταν δεν δηλώθηκε ή είναι άγνωστος κωδικός. */
export function mamaFloorLevel(code: RowCell): number | null {
  if (code === BASEMENT_CODE) return -1;
  if (typeof code !== 'string' || !/^\d+$/.test(code)) return null;
  return Number(code);
}

/** Τα στατιστικά ενός τμήματος αγοράς σε μία περιοχή. Μόνο συγκρίσιμες γραμμές (ADR-889 §5.3). */
export interface SegmentSummary {
  /** τρίμηνο `YYYY-Qn` → κελί. */
  readonly quarters: Readonly<Record<string, StatCell>>;
  /** Τα 12 μήνες ως το `asOf` του αρχείου. */
  readonly last12: StatCell;
  /** Κάδος έτους κατασκευής (`YEAR_BUILT_BUCKETS`) → κελί, για τα 12 μήνες. Μόνο για τμήματα με κτίσμα. */
  readonly yearBuilt: Readonly<Record<string, StatCell>>;
  /** Πηγή Γ — τιμή ζώνης €/τ.μ. των ίδιων γραμμών (12 μήνες). `null` όπου δεν έχει νόημα (γη, θέσεις). */
  readonly zone: StatCell | null;
  /** Τίμημα ÷ (επιφάνεια × τιμή ζώνης), **σε %** (12 μήνες). `null` όπως το `zone`. */
  readonly priceToZonePct: StatCell | null;
}

export interface AreaSummaryFile {
  readonly v: number;
  readonly id: string;
  /** Η τελευταία ημερομηνία συμβολαίου **όλης** της πηγής (`YYYY-MM-DD`) — το «έως» κάθε 12μήνου. */
  readonly asOf: string;
  readonly segments: Readonly<Partial<Record<MarketSegment, SegmentSummary>>>;
}

export interface AreaRowsFile {
  readonly v: number;
  readonly id: string;
  /** Ετικέτες «Διαμέρισμα» της πηγής — το πεδίο `district` είναι δείκτης εδώ. */
  readonly districts: readonly string[];
  readonly rows: readonly EncodedRow[];
}

export type MarketTransactionsKind = 'summary' | 'rows';

/** Τα τμήματα της διαδρομής μέσα στο `public/` (για τον αναγνώστη του server). */
export function marketTransactionsPublicPath(kind: MarketTransactionsKind, areaId: string): readonly string[] {
  return [...MARKET_TRANSACTIONS_DIR.split('/'), kind, adminBoundaryFileName(areaId)];
}

export const MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH: readonly string[] = [...MARKET_TRANSACTIONS_DIR.split('/'), 'index.json'];

// ── Αναγνώστες σχήματος — `null` = «δεν είναι αυτό το αρχείο», ποτέ «κενό» ─────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readStatCell(value: unknown): StatCell | null {
  if (!isRecord(value) || !isFiniteNumber(value.n)) return null;
  if (value.median === undefined) return { n: value.n };
  if (!isFiniteNumber(value.median) || !isFiniteNumber(value.p25) || !isFiniteNumber(value.p75)) return null;
  return { n: value.n, median: value.median, p25: value.p25, p75: value.p75 };
}

function readCellRecord(value: unknown): Record<string, StatCell> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, StatCell> = {};
  for (const [key, raw] of Object.entries(value)) {
    const cell = readStatCell(raw);
    if (cell === null) return null;
    out[key] = cell;
  }
  return out;
}

function readOptionalCell(value: unknown): StatCell | null | undefined {
  return value === null ? null : (readStatCell(value) ?? undefined);
}

function readSegmentSummary(value: unknown): SegmentSummary | null {
  if (!isRecord(value)) return null;
  const quarters = readCellRecord(value.quarters);
  const yearBuilt = readCellRecord(value.yearBuilt);
  const last12 = readStatCell(value.last12);
  const zone = readOptionalCell(value.zone);
  const priceToZonePct = readOptionalCell(value.priceToZonePct);
  if (quarters === null || yearBuilt === null || last12 === null) return null;
  if (zone === undefined || priceToZonePct === undefined) return null;
  return { quarters, last12, yearBuilt, zone, priceToZonePct };
}

function isMarketSegment(value: string): value is MarketSegment {
  return (MARKET_SEGMENTS as readonly string[]).includes(value);
}

/** **Διαβάζει ένα `summary/<id>.json`** — ή `null` αν δεν είναι (άλλη ταυτότητα, παλιό σχήμα, σελίδα σφάλματος). */
export function readAreaSummaryFile(payload: unknown, expectedId: string): AreaSummaryFile | null {
  if (!isRecord(payload) || payload.v !== MARKET_TRANSACTIONS_FORMAT_VERSION || payload.id !== expectedId) return null;
  if (typeof payload.asOf !== 'string' || !isRecord(payload.segments)) return null;
  const segments: Partial<Record<MarketSegment, SegmentSummary>> = {};
  for (const [key, raw] of Object.entries(payload.segments)) {
    const summary = readSegmentSummary(raw);
    if (!isMarketSegment(key) || summary === null) return null;
    segments[key] = summary;
  }
  return { v: payload.v, id: expectedId, asOf: payload.asOf, segments };
}

function isEncodedRow(value: unknown): value is EncodedRow {
  return (
    Array.isArray(value) &&
    value.length === ROW_FIELDS.length &&
    value.every((cell) => cell === null || typeof cell === 'string' || isFiniteNumber(cell))
  );
}

/** **Διαβάζει ένα `rows/<id>.json`** — ή `null`. Κάθε πλειάδα ελέγχεται σε μήκος και τύπους κελιών. */
export function readAreaRowsFile(payload: unknown, expectedId: string): AreaRowsFile | null {
  if (!isRecord(payload) || payload.v !== MARKET_TRANSACTIONS_FORMAT_VERSION || payload.id !== expectedId) return null;
  const { districts, rows } = payload;
  if (!Array.isArray(districts) || !districts.every((d) => typeof d === 'string')) return null;
  if (!Array.isArray(rows) || !rows.every(isEncodedRow)) return null;
  return { v: payload.v, id: expectedId, districts, rows };
}

/** Το ευρετήριο, όσο χρειάζεται στην εφαρμογή: ποιες περιοχές έχουν αρχείο, και τι τμήμα είναι κάθε κατηγορία. */
export interface MarketTransactionsIndex {
  readonly asOf: string;
  readonly window: { readonly from: number; readonly to: number };
  readonly areas: ReadonlySet<string>;
  /** δείκτης κατηγορίας (πεδίο `category`) → τμήμα, ή `null` = εκτός στατιστικών. */
  readonly categorySegments: readonly (MarketSegment | null)[];
}

function readCategorySegments(vocab: unknown): (MarketSegment | null)[] | null {
  if (!isRecord(vocab) || !Array.isArray(vocab.categories)) return null;
  const out: (MarketSegment | null)[] = [];
  for (const category of vocab.categories) {
    if (!isRecord(category)) return null;
    const { segment } = category;
    if (segment === null) out.push(null);
    else if (typeof segment === 'string' && isMarketSegment(segment)) out.push(segment);
    else return null;
  }
  return out;
}

/** **Διαβάζει το `index.json`** — ή `null`. */
export function readMarketTransactionsIndex(payload: unknown): MarketTransactionsIndex | null {
  if (!isRecord(payload) || payload.v !== MARKET_TRANSACTIONS_FORMAT_VERSION || typeof payload.asOf !== 'string') return null;
  const { window, areas } = payload;
  if (!isRecord(window) || !isFiniteNumber(window.from) || !isFiniteNumber(window.to)) return null;
  if (!Array.isArray(areas)) return null;
  const categorySegments = readCategorySegments(payload.vocab);
  if (categorySegments === null) return null;
  const ids = areas.map((row) => (Array.isArray(row) && typeof row[0] === 'string' ? row[0] : null));
  if (ids.some((id) => id === null)) return null;
  return { asOf: payload.asOf, window: { from: window.from, to: window.to }, areas: new Set(ids as string[]), categorySegments };
}
