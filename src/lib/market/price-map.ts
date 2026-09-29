/**
 * @fileoverview **Ο ΧΑΡΤΗΣ ΤΙΜΩΝ €/τ.μ. — ΣΧΗΜΑ, ΚΛΑΣΕΙΣ, ΑΝΑΓΩΓΗ** (ADR-890 §14 = ADR-889 Φ3).
 * @related `components/search-results/price-map/*` (ο χάρτης) · `scripts/build-market-transactions.ts` (πηγή Β) ·
 *   `services/market/area-market-rollup.service.ts` (πηγή Α) · `market-statistics.ts` (κατώφλι)
 * @module lib/market/price-map
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΣΧΗΜΑ, ΔΥΟ ΠΗΓΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Συμβόλαια (στατικό αρχείο του γεννήτορα ADR-889) και ζητούμενες (έγγραφο της νυχτερινής σύνοψης ADR-890)
 * προβάλλονται στο **ίδιο** κελί `[n]` / `[n, διάμεσος]`. Ο χάρτης δεν ξέρει από πού ήρθε ο αριθμός — μόνο
 * η ετικέτα και η αναφορά πηγής το ξέρουν.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΣΤΑΘΕΡΑ ΕΘΝΙΚΑ ΟΡΙΑ — ΠΟΤΕ ΑΝΑ VIEWPORT, ΠΟΤΕ ΑΝΑ ΕΚΔΟΣΗ (§14.2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ίδιο χρώμα σημαίνει την ίδια τιμή σε όλη την Ελλάδα, σε κάθε zoom και κάθε μήνα (Zillow: σταθερή κλίμακα·
 * ONS/LSOA: σταθερές ζώνες). Και **κοινά για ζητούμενες και συμβόλαια**: η εναλλαγή πηγής δείχνει με χρώμα την
 * απόσταση ζητούμενης ↔ συμβολαίου. Τα όρια βγήκαν από τα πεντημόρια των διαμέσων 12μήνου των **Δήμων**
 * (συμβόλαια, 2026-09-28), στρογγυλεμένα σε αριθμούς που διαβάζονται. Ο φρουρός αντι-σάπισης
 * (`__tests__/price-map-breaks.test.ts`) ελέγχει στα **πραγματικά** αρχεία ότι καμία κλάση δεν άδειασε.
 *
 * ⚠️ **Φύλλο**: μόνο `market-statistics` / `market-segments` — ποτέ `observeAsking` (βαρύ για τον browser) και
 * καμία runtime εισαγωγή `@/` (το διαβάζει ο γεννήτορας με `tsx`).
 */

import type { AreaMarketMap, AreaMarketSnapshot, AskingOffer } from '@/types/area-market';
import type { MarketSegment } from './market-segments';
import { MARKET_STAT_MIN_SAMPLE, type StatCell } from './market-statistics';

/** Αλλάζει **μόνο** με ασύμβατη αλλαγή σχήματος (ADR-890 §12.1). */
export const PRICE_MAP_FORMAT_VERSION = 1;

/** `[n]` = μετρήθηκαν n, κάτω από το κατώφλι (ο αριθμός **δεν υπολογίστηκε καν**) · `[n, διάμεσος]`. */
export type PriceMapCell = readonly [n: number] | readonly [n: number, median: number];

/** Τα τμήματα μιας περιοχής. Απών κλειδί = κανένα δείγμα (n = 0). */
export type PriceMapSegments = Readonly<Partial<Record<MarketSegment, PriceMapCell>>>;

/** `areaId` → τμήματα. Κοινό για το αρχείο συμβολαίων, το έγγραφο ζητούμενων και την απάντηση του endpoint. */
export type PriceMapAreas = Readonly<Record<string, PriceMapSegments>>;

/** Οι δύο πηγές του ΕΝΟΣ χάρτη. */
export const PRICE_MAP_SOURCES = ['contracts', 'asking'] as const;
export type PriceMapSource = (typeof PRICE_MAP_SOURCES)[number];

/** Κελί στατιστικών → κελί χάρτη. `null` = κανένα δείγμα (δεν γράφεται — εξοικονομεί bytes και διαβάζεται ως n = 0). */
export function priceMapCellOf(cell: StatCell | null | undefined): PriceMapCell | null {
  if (cell === null || cell === undefined || cell.n === 0) return null;
  return 'median' in cell && cell.n >= MARKET_STAT_MIN_SAMPLE ? [cell.n, cell.median] : [cell.n];
}

/** Η διάμεσος του κελιού, **μόνο** αν περνά το κατώφλι — αλλιώς `null` (ποτέ αριθμός από < 5). */
export function priceMapMedian(cell: PriceMapCell | undefined): number | null {
  return cell !== undefined && cell.length === 2 && cell[0] >= MARKET_STAT_MIN_SAMPLE ? cell[1] : null;
}

/**
 * **Τα όρια των 5 κλάσεων** (4 κατώφλια) ανά (προσφορά × τμήμα), στη μονάδα του `SEGMENT_METRIC`.
 * Απών τμήμα = ο χάρτης δεν προσφέρει αυτόν τον συνδυασμό.
 *
 * Πώληση — πεντημόρια των διαμέσων 12μήνου των Δήμων (συμβόλαια ΜΑΜΑ, 2026-09-28):
 * διαμέρισμα 677·1.009·1.267·1.736 · μονοκατοικία 414·553·785·1.216 · επαγγελματικό 604·807·1.022·1.224 ·
 * γη 18·46·85·198 · αποθήκη 164·243·339·454 · θέση στάθμευσης (€/θέση) 5.076·6.656·8.533·10.250.
 *
 * Ενοίκιο (€/τ.μ./μήνα) — **δηλωμένα, όχι μετρημένα**: καμία περιοχή δεν περνά ακόμη το κατώφλι (15 αγγελίες,
 * 2026-09-28). Επανεξέταση όταν ≥ 30 περιοχές έχουν δημοσιευμένο ενοίκιο (ADR-890 §14.7). Γη: κανένας χάρτης
 * ενοικίου (η μίσθωση γης δεν είναι αγορά κατοικίας).
 */
export const PRICE_MAP_BREAKS: Readonly<Record<AskingOffer, Readonly<Partial<Record<MarketSegment, readonly number[]>>>>> = {
  sale: {
    apartment: [700, 1000, 1300, 1800],
    house: [400, 550, 800, 1200],
    commercial: [600, 800, 1000, 1250],
    land: [20, 50, 100, 200],
    storage: [150, 250, 350, 450],
    parking: [5000, 6500, 8500, 10500],
  },
  rent: {
    apartment: [6, 8, 10, 13],
    house: [5, 7, 9, 12],
    commercial: [6, 9, 12, 16],
    storage: [3, 5, 7, 9],
    parking: [40, 60, 80, 110],
  },
};

/** Η κλάση (0…4) μιας διαμέσου: πόσα κατώφλια έχει φτάσει. Το κατώφλι ανήκει στην **πάνω** κλάση (`step` του MapLibre). */
export function priceMapClassOf(breaks: readonly number[], median: number): number {
  let index = 0;
  while (index < breaks.length && median >= breaks[index]) index += 1;
  return index;
}

/** Μία κλάση του υπομνήματος: `low` `null` = «κάτω από», `high` `null` = «από … και πάνω». */
export interface PriceMapLegendClass {
  readonly low: number | null;
  readonly high: number | null;
}

/** Οι κλάσεις του υπομνήματος — **οι ίδιοι αριθμοί** με τα κατώφλια του χάρτη. */
export function priceMapLegend(breaks: readonly number[]): readonly PriceMapLegendClass[] {
  return [null, ...breaks].map((low, index) => ({ low, high: breaks[index] ?? null }));
}

/**
 * Η τιμή που **δείχνει** μια περιοχή:
 * - `own`: η δική της διάμεσος (≥ 5).
 * - `parent`: λίγα στη Δ.Ε. ⇒ η διάμεσος του **Δήμου της** (≥ 5) — τίμια αναγωγή, όπως η σελίδα περιοχής (§10.4).
 *   Ο χάρτης τη διαγραμμίζει και το κείμενο το λέει.
 * - `few`: ούτε ο Δήμος περνά το κατώφλι ⇒ κανένας αριθμός.
 */
export type PriceMapResolution =
  | { readonly kind: 'own'; readonly n: number; readonly median: number; readonly classIndex: number }
  | {
      readonly kind: 'parent';
      readonly n: number;
      readonly parentId: string;
      readonly parentN: number;
      readonly median: number;
      readonly classIndex: number;
    }
  | { readonly kind: 'few'; readonly n: number };

function sampleOf(cell: PriceMapCell | undefined): number {
  return cell?.[0] ?? 0;
}

export function resolvePriceMapArea(
  areas: PriceMapAreas,
  segment: MarketSegment,
  breaks: readonly number[],
  areaId: string,
  parentId: string | null,
): PriceMapResolution {
  const own = areas[areaId]?.[segment];
  const ownMedian = priceMapMedian(own);
  if (ownMedian !== null) {
    return { kind: 'own', n: sampleOf(own), median: ownMedian, classIndex: priceMapClassOf(breaks, ownMedian) };
  }
  const parent = parentId === null ? undefined : areas[parentId]?.[segment];
  const parentMedian = priceMapMedian(parent);
  if (parentId !== null && parentMedian !== null) {
    return {
      kind: 'parent',
      n: sampleOf(own),
      parentId,
      parentN: sampleOf(parent),
      median: parentMedian,
      classIndex: priceMapClassOf(breaks, parentMedian),
    };
  }
  return { kind: 'few', n: sampleOf(own) };
}

/** Τα τμήματα μιας περιοχής από κελιά στατιστικών — κοινό για γεννήτορα συμβολαίων και γραφέα ζητούμενων. */
export function priceMapSegmentsOf(cells: Readonly<Partial<Record<MarketSegment, StatCell | null>>>): PriceMapSegments {
  const segments: Partial<Record<MarketSegment, PriceMapCell>> = {};
  for (const segment of Object.keys(cells).sort() as MarketSegment[]) {
    const cell = priceMapCellOf(cells[segment]);
    if (cell !== null) segments[segment] = cell;
  }
  return segments;
}

function isCell(value: unknown): value is PriceMapCell {
  return (
    Array.isArray(value) &&
    (value.length === 1 || value.length === 2) &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

/** Έλεγχος σχήματος του `areaId → τμήματα`· `null` = χαλασμένο (ποτέ «καμία περιοχή»). */
export function readPriceMapAreas(value: unknown): PriceMapAreas | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  for (const segments of Object.values(value)) {
    if (typeof segments !== 'object' || segments === null || Array.isArray(segments)) return null;
    if (!Object.values(segments).every(isCell)) return null;
  }
  return value as PriceMapAreas;
}

/** Το στατικό αρχείο συμβολαίων (`public/data/market-transactions/price-map.json`). */
export interface ContractPriceMapFile {
  readonly v: number;
  /** Το τελευταίο συμβόλαιο της πηγής — το 12μηνο μετρά ως εκεί. */
  readonly asOf: string;
  readonly areas: PriceMapAreas;
}

export function readContractPriceMapFile(payload: unknown): ContractPriceMapFile | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const file = payload as Partial<ContractPriceMapFile>;
  if (file.v !== PRICE_MAP_FORMAT_VERSION || typeof file.asOf !== 'string') return null;
  const areas = readPriceMapAreas(file.areas);
  return areas === null ? null : { v: file.v, asOf: file.asOf, areas };
}

/**
 * **Ο χάρτης ζητούμενων μιας νύχτας** από τα στιγμιότυπά της — ό,τι γράφει ο γραφέας (ADR-890 §14.4). Το κελί είναι
 * το **ίδιο** `unitPrice` που δείχνει η σελίδα περιοχής. Περιοχή χωρίς κανένα δείγμα σε μια προσφορά δεν γράφεται.
 * ⚠️ Το `schemaVersion` το δίνει ο καλών (`AREA_MARKET_MAP_SCHEMA_VERSION`): το φύλλο δεν εισάγει τιμές από `@/`.
 */
export function buildAreaMarketMap(
  schemaVersion: AreaMarketMap['schemaVersion'],
  day: string,
  snapshots: readonly AreaMarketSnapshot[],
): AreaMarketMap {
  const offers: Record<AskingOffer, Record<string, PriceMapSegments>> = { sale: {}, rent: {} };
  for (const snapshot of [...snapshots].sort((a, b) => (a.areaId < b.areaId ? -1 : a.areaId > b.areaId ? 1 : 0))) {
    for (const offer of Object.keys(offers) as AskingOffer[]) {
      const cells: Partial<Record<MarketSegment, StatCell>> = {};
      for (const [segment, summary] of Object.entries(snapshot.offers[offer].segments)) {
        if (summary !== undefined) cells[segment as MarketSegment] = summary.unitPrice;
      }
      const segments = priceMapSegmentsOf(cells);
      if (Object.keys(segments).length > 0) offers[offer][snapshot.areaId] = segments;
    }
  }
  return { schemaVersion, day, offers };
}

/**
 * **Η απάντηση του `GET /api/market/price-map`** (πηγή Α). `none` = καμία ολοκληρωμένη νύχτα με χάρτη — γεγονός.
 * Η αποτυχία ανάγνωσης **δεν** είναι σώμα: είναι 503 (ποτέ «καμία περιοχή»).
 */
export type AskingPriceMapResponse =
  | { readonly kind: 'ready'; readonly day: string; readonly offers: Readonly<Record<AskingOffer, PriceMapAreas>> }
  | { readonly kind: 'none' };

/** Έλεγχος σχήματος της απάντησης στον browser· `null` = χαλασμένη (⇒ «μη διαθέσιμο», ποτέ «καμία περιοχή»). */
export function readAskingPriceMapResponse(payload: unknown): AskingPriceMapResponse | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as { kind?: unknown; day?: unknown; offers?: { sale?: unknown; rent?: unknown } };
  if (body.kind === 'none') return { kind: 'none' };
  if (body.kind !== 'ready' || typeof body.day !== 'string' || typeof body.offers !== 'object' || body.offers === null) return null;
  const sale = readPriceMapAreas(body.offers.sale);
  const rent = readPriceMapAreas(body.offers.rent);
  return sale === null || rent === null ? null : { kind: 'ready', day: body.day, offers: { sale, rent } };
}
