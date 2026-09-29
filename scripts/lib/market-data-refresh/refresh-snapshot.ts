/**
 * @fileoverview **Η ΣΥΜΠΑΓΗΣ ΠΡΟΒΟΛΗ ΤΩΝ ΔΕΔΟΜΕΝΩΝ ΑΓΟΡΑΣ** — ό,τι χρειάζεται η ανανέωση για να πει «τι άλλαξε» (ADR-889 §11).
 * @related `refresh-diff.ts` (πριν ↔ μετά) · `refresh-probe.ts` (προέλευση ↔ πηγή) · σχήματα στο `src/lib/market/*`
 *
 * 🔑 **Στη μνήμη, όχι αντίγραφο αρχείων.** Η προβολή κρατά μόνο αριθμούς (προέλευση πηγής, 12μηνο ανά περιοχή,
 * τιμή ανά ζώνη) — ~MB, όχι τα 45 MB του `public/`. Διαβάζεται **πριν** τρέξουν οι γεννήτορες και **ξανά μετά**.
 * Απόν αρχείο ⇒ `null` (πρώτη εκτέλεση)· **άκυρο** αρχείο ⇒ σφάλμα (ποτέ σιωπηλό «δεν υπήρχε»).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH, MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH } from '../../../src/lib/market/market-transactions-file';
import { readContractPriceMapFile, type PriceMapAreas } from '../../../src/lib/market/price-map';
import { VALUE_ZONES_DIR, type ValueZonesSourceMeta } from '../../../src/lib/market/value-zone-file';
import { isFiniteNumber, isPlainRecord } from '../../../src/lib/type-guards';

/** Μία γραμμή του `inputs` του ευρετηρίου συμβολαίων: η προέλευση ενός έτους (γράφεται από το `mama-download`). */
export interface MamaInput {
  readonly year: number;
  readonly url: string;
  readonly lastModified: string | null;
  readonly bytes: number;
  readonly sha256: string;
  readonly rows: number;
}

export interface MarketSnapshot {
  readonly window: { readonly from: number; readonly to: number };
  readonly asOf: string;
  readonly inputs: readonly MamaInput[];
  readonly areaCount: number;
  readonly priceMap: PriceMapAreas;
}

/** Ταυτότητα ζώνης μέσα στη χώρα: περιοχή + `ZONEREGIST` + γράμμα (+ δρόμος για μέτωπο). Το id μόνο του ΔΕΝ είναι μοναδικό. */
export type ZoneKey = string;

export interface ZonePrice {
  readonly price: number;
  readonly validFrom: string;
}

export interface ZoneSnapshot {
  readonly source: ValueZonesSourceMeta;
  readonly areaCount: number;
  readonly zones: ReadonlyMap<ZoneKey, ZonePrice>;
}

export interface DataSnapshot {
  readonly market: MarketSnapshot | null;
  readonly zones: ZoneSnapshot | null;
}

function invalid(what: string): never {
  throw new Error(`άκυρο αρχείο: ${what} — η σύγκριση πριν/μετά δεν γίνεται με μαντεψιά`);
}

function readMamaInput(value: unknown): MamaInput {
  if (!isPlainRecord(value)) invalid('inputs[]');
  const { year, url, lastModified, bytes, sha256, rows } = value;
  if (!isFiniteNumber(year) || typeof url !== 'string' || !isFiniteNumber(bytes) || typeof sha256 !== 'string' || !isFiniteNumber(rows)) {
    invalid('inputs[]');
  }
  if (lastModified !== null && typeof lastModified !== 'string') invalid('inputs[].lastModified');
  return { year, url, lastModified, bytes, sha256, rows };
}

/** Καθαρή: ευρετήριο + χάρτης τιμών ⇒ προβολή. */
export function marketSnapshotOf(indexPayload: unknown, priceMapPayload: unknown): MarketSnapshot {
  if (!isPlainRecord(indexPayload) || typeof indexPayload.asOf !== 'string') invalid('market-transactions/index.json');
  const { window, inputs, areas } = indexPayload;
  if (!isPlainRecord(window) || !isFiniteNumber(window.from) || !isFiniteNumber(window.to)) invalid('index.window');
  if (!Array.isArray(inputs) || !Array.isArray(areas)) invalid('index.inputs/areas');
  const priceMap = readContractPriceMapFile(priceMapPayload);
  if (priceMap === null) invalid('market-transactions/price-map.json');
  return {
    window: { from: window.from, to: window.to },
    asOf: indexPayload.asOf,
    inputs: inputs.map(readMamaInput),
    areaCount: areas.length,
    priceMap: priceMap.areas,
  };
}

function addZoneRows(areaId: string, rows: unknown, withStreet: boolean, into: Map<ZoneKey, ZonePrice>): void {
  if (!Array.isArray(rows)) invalid(`value-zones/${areaId}`);
  for (const row of rows) {
    if (!isPlainRecord(row) || !isFiniteNumber(row.id) || typeof row.name !== 'string' || !isFiniteNumber(row.price) || typeof row.validFrom !== 'string') {
      invalid(`value-zones/${areaId}`);
    }
    const street = withStreet && typeof row.street === 'string' ? `|${row.street}` : '';
    into.set(`${areaId}|${row.id}|${row.name}${street}`, { price: row.price, validFrom: row.validFrom });
  }
}

/** Καθαρή: ευρετήριο ζωνών + τα αρχεία περιοχών ⇒ τιμή ανά ζώνη. */
export function zoneSnapshotOf(indexPayload: unknown, areaFiles: Iterable<unknown>): ZoneSnapshot {
  if (!isPlainRecord(indexPayload) || !isPlainRecord(indexPayload.source) || !isPlainRecord(indexPayload.areas)) invalid('value-zones/index.json');
  const { url, lastModified, sha256 } = indexPayload.source;
  if (typeof url !== 'string' || typeof sha256 !== 'string' || (lastModified !== null && typeof lastModified !== 'string')) invalid('index.source');
  const zones = new Map<ZoneKey, ZonePrice>();
  for (const file of areaFiles) {
    if (!isPlainRecord(file) || typeof file.id !== 'string') invalid('value-zones/<περιοχή>');
    addZoneRows(file.id, file.zones, false, zones);
    addZoneRows(file.id, file.fronts, true, zones);
  }
  return { source: { url, lastModified, sha256 }, areaCount: Object.keys(indexPayload.areas).length, zones };
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readMarket(publicDir: string): MarketSnapshot | null {
  const indexPath = join(publicDir, ...MARKET_TRANSACTIONS_INDEX_PUBLIC_PATH);
  const priceMapPath = join(publicDir, ...MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH);
  if (!existsSync(indexPath)) return null;
  return marketSnapshotOf(readJson(indexPath), existsSync(priceMapPath) ? readJson(priceMapPath) : null);
}

function readZones(publicDir: string): ZoneSnapshot | null {
  const dir = join(publicDir, ...VALUE_ZONES_DIR.split('/'));
  if (!existsSync(join(dir, 'index.json'))) return null;
  const areaFiles = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .sort()
    .map((name) => readJson(join(dir, name)));
  return zoneSnapshotOf(readJson(join(dir, 'index.json')), areaFiles);
}

/** Η προβολή από τον δίσκο (`public/`). */
export function readDataSnapshot(publicDir: string): DataSnapshot {
  return { market: readMarket(publicDir), zones: readZones(publicDir) };
}
