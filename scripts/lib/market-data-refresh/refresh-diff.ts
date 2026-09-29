/**
 * @fileoverview **ΤΙ ΑΛΛΑΞΕ — πριν ↔ μετά**, δομημένα (ADR-889 §11, απόφαση 3). Καθαρές συναρτήσεις, χωρίς δίσκο.
 * @related `refresh-snapshot.ts` (είσοδος) · `refresh-gates.ts` / `refresh-report.ts` (καταναλωτές)
 *
 * 🔑 Ο αριθμός που συγκρίνεται είναι ο **ίδιος** που δείχνει η οθόνη: η διάμεσος 12μήνου του `price-map.json`
 * (`priceMapMedian`), που είναι προβολή του `summary/` (ADR-890 §14.4). Η διαφορά δεν ξαναϋπολογίζει τίποτα.
 */

import { MARKET_SEGMENTS, type MarketSegment } from '../../../src/lib/market/market-segments';
import { priceMapMedian, type PriceMapAreas } from '../../../src/lib/market/price-map';
import type { MamaInput, MarketSnapshot, ZoneKey, ZoneSnapshot } from './refresh-snapshot';

export interface YearDiff {
  readonly year: number;
  readonly before: MamaInput | null;
  readonly after: MamaInput | null;
}

/** Ένα κελί (περιοχή × τμήμα) με διάμεσο **και πριν και μετά**. `ratio` = μετά ÷ πριν. */
export interface MedianMove {
  readonly areaId: string;
  readonly segment: MarketSegment;
  readonly before: number;
  readonly after: number;
  readonly nBefore: number;
  readonly nAfter: number;
  readonly ratio: number;
}

export interface CellRef {
  readonly areaId: string;
  readonly segment: MarketSegment;
}

export interface MarketDiff {
  readonly asOf: { readonly before: string | null; readonly after: string };
  readonly years: readonly YearDiff[];
  readonly areaCount: { readonly before: number | null; readonly after: number };
  readonly moves: readonly MedianMove[];
  /** Κελιά που πέρασαν το κατώφλι εμφάνισης (§5.4) — ή έπεσαν κάτω από αυτό. */
  readonly cellsAppeared: readonly CellRef[];
  readonly cellsDisappeared: readonly CellRef[];
}

export interface ZonePriceChange {
  readonly key: ZoneKey;
  readonly before: number;
  readonly after: number;
}

export interface ZoneDiff {
  readonly sourceChanged: boolean;
  readonly zoneCount: { readonly before: number | null; readonly after: number };
  readonly areaCount: { readonly before: number | null; readonly after: number };
  readonly priceChanges: readonly ZonePriceChange[];
  readonly added: number;
  readonly removed: number;
  /** Ημερομηνίες έναρξης ισχύος που **δεν** υπήρχαν πριν — σημάδι αναπροσαρμογής. */
  readonly newValidFrom: readonly string[];
}

function yearDiffs(before: MarketSnapshot | null, after: MarketSnapshot): YearDiff[] {
  const older = new Map((before?.inputs ?? []).map((input) => [input.year, input]));
  const newer = new Map(after.inputs.map((input) => [input.year, input]));
  const years = [...new Set([...older.keys(), ...newer.keys()])].sort((a, b) => a - b);
  return years.map((year) => ({ year, before: older.get(year) ?? null, after: newer.get(year) ?? null }));
}

function compareCells(before: PriceMapAreas, after: PriceMapAreas): Pick<MarketDiff, 'moves' | 'cellsAppeared' | 'cellsDisappeared'> {
  const moves: MedianMove[] = [];
  const cellsAppeared: CellRef[] = [];
  const cellsDisappeared: CellRef[] = [];
  const areaIds = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const areaId of areaIds) {
    for (const segment of MARKET_SEGMENTS) {
      const old = before[areaId]?.[segment];
      const now = after[areaId]?.[segment];
      const was = priceMapMedian(old);
      const is = priceMapMedian(now);
      if (was === null && is !== null) cellsAppeared.push({ areaId, segment });
      else if (was !== null && is === null) cellsDisappeared.push({ areaId, segment });
      else if (was !== null && is !== null && old !== undefined && now !== undefined) {
        moves.push({ areaId, segment, before: was, after: is, nBefore: old[0], nAfter: now[0], ratio: is / was });
      }
    }
  }
  return { moves, cellsAppeared, cellsDisappeared };
}

export function diffMarket(before: MarketSnapshot | null, after: MarketSnapshot): MarketDiff {
  return {
    asOf: { before: before?.asOf ?? null, after: after.asOf },
    years: yearDiffs(before, after),
    areaCount: { before: before?.areaCount ?? null, after: after.areaCount },
    ...compareCells(before?.priceMap ?? {}, after.priceMap),
  };
}

export function diffZones(before: ZoneSnapshot | null, after: ZoneSnapshot): ZoneDiff {
  const old = before?.zones ?? new Map();
  const priceChanges: ZonePriceChange[] = [];
  let added = 0;
  for (const [key, zone] of [...after.zones].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const was = old.get(key);
    if (was === undefined) added += 1;
    else if (was.price !== zone.price) priceChanges.push({ key, before: was.price, after: zone.price });
  }
  const removed = [...old.keys()].filter((key) => !after.zones.has(key)).length;
  const oldDates = new Set([...old.values()].map((zone) => zone.validFrom));
  const newValidFrom = [...new Set([...after.zones.values()].map((zone) => zone.validFrom))].filter((date) => !oldDates.has(date)).sort();
  return {
    sourceChanged: before === null || before.source.sha256 !== after.source.sha256,
    zoneCount: { before: before?.zones.size ?? null, after: after.zones.size },
    areaCount: { before: before?.areaCount ?? null, after: after.areaCount },
    priceChanges,
    added,
    removed,
    newValidFrom: before === null ? [] : newValidFrom,
  };
}
