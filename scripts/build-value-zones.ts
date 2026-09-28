/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΩΝ ΖΩΝΩΝ ΑΝΤΙΚΕΙΜΕΝΙΚΩΝ ΑΞΙΩΝ** — ένα αρχείο ζωνών ανά Δημοτική Ενότητα.
 * @related ADR-889 §2.3 (η πηγή) · §10 (η υλοποίηση) · `src/lib/market/value-zone-file.ts` (το σχήμα)
 *
 * ```
 * zip ΥΠΕΘΟΟ (CC-BY 4.0, data.gov.gr)  →  shp + dbf (Windows-1253) · επικύρωση πεδίων / προβολής
 *                                     →  κάνναβος ΕΓΣΑ'87 → WGS84     (lib/geo/greek-grid.ts — προβολή + datum)
 *                                     →  Douglas–Peucker 2 m          (lib/geo/geo-simplify.ts)
 *                                     →  εσωτερικό σημείο → Δ.Ε.       (lib/geo/admin-area-of-point.ts, όρια ADR-883)
 *                                     →  public/data/value-zones/<adminId>.json + index.json
 * ```
 *
 * **Εκτέλεση**: `npm run build:value-zones` (`-- --refresh` για νέα λήψη). Προϋπόθεση: `build:admin-boundaries`.
 *
 * 🔑 **Ντετερμινιστικός**: ίδιες είσοδοι ⇒ byte-ταυτόσημη έξοδος (ταξινόμηση, σταθερή σειρά κλειδιών, **κανένα**
 * `generatedAt` — η προέλευση είναι το sha256 + `Last-Modified` της πηγής, στο `index.json`).
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { OPEN_DATA_SOURCES } from '../src/config/open-data-sources';
import {
  VALUE_ZONES_DIR,
  VALUE_ZONES_FORMAT_VERSION,
  valueZonesPublicPath,
  type BboxTuple,
  type ValueFrontRecord,
  type ValueZoneAreaFile,
  type ValueZoneRecord,
  type ValueZonesIndexFile,
} from '../src/lib/market/value-zone-file';
import { REPO_ROOT } from './lib/admin-boundaries/admin-boundary-source';
import { createFsAdminAreaLookup } from './lib/admin-boundaries/admin-area-lookup';
import { loadCachedSource } from './lib/cached-download';
import { assignZonesToAreas, type AreaZones } from './lib/value-zones/zone-areas';
import { unionBbox } from './lib/value-zones/zone-geometry';
import { readZoneSource } from './lib/value-zones/zone-source';

/** Ο πόρος shp του συνόλου δεδομένων (ADR-889 §2.3). Η σελίδα του συνόλου ζει στο `OPEN_DATA_SOURCES.valueZones`. */
const SOURCE_URL =
  'https://data.gov.gr/dataset/1fcf3d7d-e9f3-423d-83ff-59b930aa18f8/resource/7bba2acd-1aea-49f3-badb-60a7961d1b1a/download/zones_for_data_gov_gr.zip';

/**
 * **Εγγυημένη μέγιστη απόκλιση, σε μέτρα.** Οι ζώνες ακολουθούν άξονες δρόμων: 2 m είναι κάτω από το μισό πλάτος του
 * στενότερου δρόμου, άρα η απλοποίηση **δεν** μετακινεί ποτέ ένα όριο στο απέναντι πεζοδρόμιο.
 */
const TOLERANCE_M = 2;

const OUTPUT_DIR = join(REPO_ROOT, 'public', VALUE_ZONES_DIR);
const CACHE_PATH = join(REPO_ROOT, 'node_modules', '.cache', 'value-zones', 'zones_for_data_gov_gr.zip');

// ─── Συγχώνευση: ίδια ζώνη σε πολλές εγγραφές (4 διπλά id επιφανειών · μέτωπα ανά τμήμα δρόμου) ───

interface ZoneIdentity {
  readonly id: number;
  readonly name: string;
  readonly price: number;
  readonly validFrom: string;
  readonly bbox: BboxTuple;
}

function zoneKey(record: ZoneIdentity): string {
  return [record.id, record.name, record.price, record.validFrom].join('|');
}

/** Εγγραφές με το ίδιο κλειδί γίνονται **μία**: bbox ένωση, συντεταγμένες στη σειρά της πηγής. */
function mergeBy<T extends ZoneIdentity & { readonly geometry: { readonly coordinates: readonly unknown[] } }>(
  records: readonly T[],
  keyOf: (record: T) => string,
): T[] {
  const merged = new Map<string, T>();
  for (const record of records) {
    const key = keyOf(record);
    const existing = merged.get(key);
    merged.set(key, existing === undefined ? record : {
      ...existing,
      bbox: unionBbox([existing.bbox, record.bbox]),
      geometry: { ...existing.geometry, coordinates: [...existing.geometry.coordinates, ...record.geometry.coordinates] },
    });
  }
  return [...merged.values()];
}

function mergeZones(records: readonly ValueZoneRecord[]): ValueZoneRecord[] {
  return mergeBy(records, zoneKey).sort(byIdThenBbox);
}

function mergeFronts(records: readonly ValueFrontRecord[]): ValueFrontRecord[] {
  return mergeBy(records, (record) => `${zoneKey(record)}|${record.street}`)
    .sort((a, b) => byIdThenBbox(a, b) || a.street.localeCompare(b.street, 'el'));
}

function byIdThenBbox(a: { id: number; bbox: BboxTuple }, b: { id: number; bbox: BboxTuple }): number {
  return a.id - b.id || a.bbox[0] - b.bbox[0] || a.bbox[1] - b.bbox[1];
}

// ─── Εγγραφή ───

function areaFile(areaId: string, content: AreaZones): ValueZoneAreaFile {
  const zones = mergeZones(content.zones);
  const fronts = mergeFronts(content.fronts);
  const bbox = unionBbox([...zones, ...fronts].map((record) => record.bbox));
  return { v: VALUE_ZONES_FORMAT_VERSION, id: areaId, bbox, toleranceM: TOLERANCE_M, zones, fronts };
}

function validFromRange(files: readonly ValueZoneAreaFile[]): { from: string; to: string } {
  const dates = files.flatMap((file) => [...file.zones, ...file.fronts].map((record) => record.validFrom)).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

function writeOutputs(files: readonly ValueZoneAreaFile[], source: ValueZonesIndexFile['source']): void {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const areas: Record<string, BboxTuple> = {};
  for (const file of files) {
    writeFileSync(join(REPO_ROOT, 'public', ...valueZonesPublicPath(file.id)), JSON.stringify(file));
    areas[file.id] = file.bbox;
  }
  const index: ValueZonesIndexFile = { v: VALUE_ZONES_FORMAT_VERSION, validFrom: validFromRange(files), source, areas };
  writeFileSync(join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(index)}\n`);
}

// ─── Αναφορά μεγεθών (ADR-889 §10: μετρήθηκε πριν κλειδώσει η ανοχή) ───

function reportSizes(): void {
  const sizes = readdirSync(OUTPUT_DIR)
    .filter((name) => name !== 'index.json')
    .map((name) => ({ name, bytes: statSync(join(OUTPUT_DIR, name)).size }))
    .sort((a, b) => a.bytes - b.bytes);
  const pick = (q: number) => sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * q))];
  const largest = sizes[sizes.length - 1];
  const total = sizes.reduce((sum, file) => sum + file.bytes, 0);
  const gz = gzipSync(readFileSync(join(OUTPUT_DIR, largest.name))).length;
  const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(`  αρχεία ${sizes.length} · διάμεσος ${kb(pick(0.5).bytes)} · p95 ${kb(pick(0.95).bytes)} · max ${kb(largest.bytes)} (${largest.name}, gzip ${kb(gz)}) · σύνολο ${(total / 1e6).toFixed(1)} MB`);
}

async function main(): Promise<void> {
  console.log('▶ build:value-zones');
  const cached = await loadCachedSource({ url: SOURCE_URL, path: CACHE_PATH, label: 'ζώνες ΥΠΕΘΟΟ', refresh: process.argv.includes('--refresh') });
  const source = readZoneSource(readFileSync(cached.path));
  console.log(`  πηγή: ${source.zones.length} επιφάνειες · ${source.fronts.length} τμήματα μετώπων (${OPEN_DATA_SOURCES.valueZones.datasetUrl})`);

  const { byArea, report } = await assignZonesToAreas(source, TOLERANCE_M, createFsAdminAreaLookup(REPO_ROOT));
  const files = [...byArea.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, content]) => areaFile(id, content));
  writeOutputs(files, { url: cached.meta.url, lastModified: cached.meta.lastModified, sha256: cached.meta.sha256 });

  const zoneCount = files.reduce((sum, file) => sum + file.zones.length, 0);
  const frontCount = files.reduce((sum, file) => sum + file.fronts.length, 0);
  console.log(`  έξοδος: ${files.length} περιοχές · ${zoneCount} ζώνες · ${frontCount} μέτωπα (ανά δρόμο)`);
  console.log(`  χωρίς περιοχή: ${report.unassigned.length} ${JSON.stringify(report.unassigned.slice(0, 20))}`);
  console.log(`  μικρότερες από την ανοχή: ${report.collapsed.length} ${JSON.stringify(report.collapsed.slice(0, 20))}`);
  reportSizes();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
