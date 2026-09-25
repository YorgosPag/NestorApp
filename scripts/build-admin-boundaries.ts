/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΩΝ ΟΡΙΩΝ ΤΟΥ ΧΑΡΤΗ** — ένα απλοποιημένο όριο ανά διοικητική οντότητα.
 * @related ADR-883 · `lib/admin-boundaries/admin-boundary-source.ts` · `src/lib/geo/admin-boundary-file.ts`
 *
 * ```
 * WFS GeoJSON (CC-BY)  →  join κατά κωδικό Καλλικράτη          (κοινή πηγή με τα αποτυπώματα)
 *                      →  δήμοι Κλεισθένη = ένωση δημ. ενοτήτων  (διάλυση κοινών ακμών)
 *                      →  Douglas–Peucker ανά βαθμίδα            (εγγυημένη απόκλιση)
 *                      →  public/data/admin-boundaries/<id>.json
 *                      →  public/data/admin-area-index.json      (ό,τι βρίσκει η αναζήτηση)
 * ```
 *
 * **Εκτέλεση**: `npm run build:admin-boundaries`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΝΑ ΑΡΧΕΙΟ ΑΝΑ ΟΝΤΟΤΗΤΑ (και όχι ένα μεγάλο, ή vector tiles)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο επισκέπτης βλέπει **ένα** όριο τη φορά — αυτό που ζήτησε. Ένα αρχείο ανά οντότητα
 * σημαίνει ότι κατεβάζει **μόνο** εκείνο (λίγα KB), στατικά, με cache του CDN, χωρίς
 * διακομιστή πλακιδίων. Τα vector tiles (PMTiles) κερδίζουν όταν ο χάρτης δείχνει
 * **όλα** τα όρια μαζί σε κάθε zoom — ερώτηση που **κανείς δεν κάνει** εδώ.
 *
 * ⚖️ **Η άδεια**: CC-BY 3.0 — η αναφορά πηγής ταξιδεύει στο `admin-area-index.json`
 * (`meta`) και φαίνεται στον χάρτη όσο εμφανίζεται όριο.
 */

import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { geoJsonRings } from '../src/lib/geo/geo-geojson';
import { simplifyGeoRing } from '../src/lib/geo/geo-simplify';
import { ADMIN_BOUNDARIES_DIR, adminBoundaryFileName } from '../src/lib/geo/admin-boundary-file';
import { ADMIN_AREA_INDEX_FILE, type AdminAreaIndexRow } from '../src/lib/geo/admin-area-index-file';
import type { GeoOutline } from '../src/types/geo/coordinates';
import {
  ATTRIBUTION,
  LAYERS,
  MUNICIPAL_UNIT_LEVEL,
  REPO_ROOT,
  buildIdIndex,
  composeMunicipalitiesFromUnits,
  loadLayer,
  matchFeature,
  readHierarchyRows,
  type HierarchyRow,
} from './lib/admin-boundaries/admin-boundary-source';
import { dissolveSharedEdges } from './lib/admin-boundaries/dissolve-shared-edges';

const OUTPUT_DIR = join(REPO_ROOT, 'public', ADMIN_BOUNDARIES_DIR);
const INDEX_PATH = join(REPO_ROOT, 'public', ADMIN_AREA_INDEX_FILE);

/**
 * **Εγγυημένη μέγιστη απόκλιση ανά βαθμίδα, σε μέτρα** — οικονομική απόφαση, μετρημένη.
 *
 * 🔑 Η πηγή είναι κλίμακας **1:50.000**: η ίδια η ψηφιοποίηση έχει σφάλμα θέσης **~10–25 m**.
 * Ανοχή κάτω από αυτό πληρώνει bytes για θόρυβο. Οι μεγάλες βαθμίδες φαίνονται σε μικρό
 * zoom, όπου 100 m είναι λιγότερο από ένα pixel.
 *
 * ⚠️ Η βαθμίδα 2 (αποκεντρωμένες διοικήσεις) **λείπει επίτηδες**: δεν είναι έννοια που
 * αναζητά ο επισκέπτης ακινήτων.
 */
const TOLERANCE_M: Readonly<Record<number, number>> = {
  3: 120, // περιφέρειες — 13
  4: 60, // περιφερειακές ενότητες — 74
  5: 25, // δήμοι — 333
  6: 15, // δημοτικές ενότητες — 949
  7: 10, // κοινότητες — 6.064
};

/** 5 δεκαδικά ≈ **1,1 m** — κάτω από κάθε ανοχή του πίνακα, άρα δεν αλλοιώνει την εγγύηση. */
function roundCoordinate(value: number): number {
  return Number(value.toFixed(5));
}

/** Ένας δακτύλιος GeoJSON → ανοιχτό περίγραμμα, μέσω του SSoT `geoJsonRings` (κενό αν < 3 κορυφές). */
function toOutline(ring: GeoJSON.Position[]): GeoOutline {
  return geoJsonRings({ type: 'Polygon', coordinates: [ring] })[0] ?? [];
}

function toClosedRing(outline: GeoOutline): GeoJSON.Position[] {
  const ring = outline.map(({ lng, lat }) => [roundCoordinate(lng), roundCoordinate(lat)]);
  return [...ring, ring[0]];
}

/**
 * Απλοποιεί κάθε πολύγωνο: ο εξωτερικός δακτύλιος που «σβήνει» παίρνει μαζί του το
 * πολύγωνο (νησίδα μικρότερη από την ανοχή)· η τρύπα που σβήνει απλώς φεύγει.
 */
function simplifyGeometry(geometry: GeoJSON.MultiPolygon, toleranceM: number): GeoJSON.MultiPolygon | null {
  const coordinates: GeoJSON.Position[][][] = [];
  for (const polygon of geometry.coordinates) {
    const outer = simplifyGeoRing(toOutline(polygon[0]), toleranceM);
    if (outer === null) continue;
    const holes = polygon
      .slice(1)
      .map((ring) => simplifyGeoRing(toOutline(ring), toleranceM))
      .filter((ring): ring is GeoOutline => ring !== null);
    coordinates.push([outer, ...holes].map(toClosedRing));
  }
  return coordinates.length > 0 ? { type: 'MultiPolygon', coordinates } : null;
}

/**
 * Το ορθογώνιο της **αληθινής** (όχι της απλοποιημένης) γεωμετρίας, στρογγυλεμένο **προς
 * τα έξω** — το ερώτημα Firestore που χτίζεται πάνω του δεν επιτρέπεται να χάσει αγγελία.
 */
function outwardBoundingBox(geometry: GeoJSON.MultiPolygon): [number, number, number, number] {
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of geometry.coordinates) {
    for (const [lng, lat] of polygon[0]) {
      west = Math.min(west, lng);
      south = Math.min(south, lat);
      east = Math.max(east, lng);
      north = Math.max(north, lat);
    }
  }
  const down = (value: number) => Math.floor(value * 1e4) / 1e4;
  const up = (value: number) => Math.ceil(value * 1e4) / 1e4;
  return [down(west), down(south), up(east), up(north)];
}

function asMultiPolygon(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.MultiPolygon {
  return geometry.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [geometry.coordinates] } : geometry;
}

interface LevelStats {
  level: number;
  written: number;
  skipped: number;
  collapsed: number;
  bytes: number[];
}

function writeBoundary(id: string, level: number, geometry: GeoJSON.MultiPolygon, stats: LevelStats): boolean {
  const toleranceM = TOLERANCE_M[level];
  const simplified = simplifyGeometry(geometry, toleranceM);
  if (simplified === null) {
    stats.collapsed += 1;
    return false;
  }
  const body = JSON.stringify({ id, level, bbox: outwardBoundingBox(geometry), toleranceM, geometry: simplified });
  writeFileSync(join(OUTPUT_DIR, adminBoundaryFileName(id)), body);
  stats.bytes.push(Buffer.byteLength(body));
  stats.written += 1;
  return true;
}

/** Οι δήμοι του Κλεισθένη — σύνθεση από τις ενότητες, με διάλυση όπου η τοπολογία το επιτρέπει. */
function writeComposedMunicipalities(
  rows: readonly HierarchyRow[],
  units: GeoJSON.FeatureCollection,
  written: Set<string>,
  stats: LevelStats,
): void {
  const nameOf = new Map(rows.map((row) => [row.id, row.n]));
  for (const [id, { geometry, children }] of composeMunicipalitiesFromUnits(rows, units, written)) {
    const dissolved = dissolveSharedEdges(geometry);
    const verdict = dissolved === null ? '⚠️ αδιάλυτο (ορατές εσωτερικές γραμμές)' : '✅ ενιαίο περίγραμμα';
    if (writeBoundary(id, 5, dissolved ?? geometry, stats)) written.add(id);
    console.log(`   🧩 ${nameOf.get(id)} ← ${children} δημ. ενότητες · ${verdict}`);
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
}

function reportSizes(stats: readonly LevelStats[]): void {
  console.table(
    stats.map((s) => ({
      level: s.level,
      toleranceM: TOLERANCE_M[s.level],
      written: s.written,
      skipped: s.skipped,
      collapsed: s.collapsed,
      totalKB: Math.round(s.bytes.reduce((a, b) => a + b, 0) / 1024),
      medianKB: +(median(s.bytes) / 1024).toFixed(1),
      maxKB: +(Math.max(0, ...s.bytes) / 1024).toFixed(1),
    })),
  );
}

/** Ό,τι βρίσκει η αναζήτηση — **μόνο** οντότητες που έχουν όριο, ώστε κάθε πρόταση να το δίνει. */
function writeIndex(rows: readonly HierarchyRow[], written: ReadonlySet<string>): void {
  const data: AdminAreaIndexRow[] = rows
    .filter((row) => written.has(row.id))
    .map((row) => [row.id, row.n, row.l, row.p]);
  const payload = { meta: { ...ATTRIBUTION, generator: 'scripts/build-admin-boundaries.ts', adr: 'ADR-883', count: data.length }, data };
  writeFileSync(INDEX_PATH, `${JSON.stringify(payload)}\n`);
  console.log(`🔎 δείκτης: ${data.length} οντότητες → ${INDEX_PATH} (${Math.round(statSync(INDEX_PATH).size / 1024)} KB ωμό)`);
}

async function main(): Promise<void> {
  const rows = readHierarchyRows();
  const { index, ambiguous } = buildIdIndex(rows);

  // 🔒 Καθαρός φάκελος σε κάθε εκτέλεση: ένα όριο οντότητας που **έπαψε** να υπάρχει δεν
  //    επιτρέπεται να μείνει να σερβίρεται από προηγούμενη εκτέλεση.
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const written = new Set<string>();
  const stats: LevelStats[] = [];
  let municipalUnits: GeoJSON.FeatureCollection | null = null;

  for (const { layer, level } of LAYERS) {
    if (TOLERANCE_M[level] === undefined) continue;
    const collection = await loadLayer(layer);
    if (level === MUNICIPAL_UNIT_LEVEL) municipalUnits = collection;
    const levelStats: LevelStats = { level, written: 0, skipped: 0, collapsed: 0, bytes: [] };
    for (const feature of collection.features) {
      const match = matchFeature(feature, level, index, ambiguous);
      if (match.kind === 'skipped') levelStats.skipped += 1;
      else if (writeBoundary(match.id, level, asMultiPolygon(match.geometry), levelStats)) written.add(match.id);
    }
    stats.push(levelStats);
  }

  if (municipalUnits !== null) {
    writeComposedMunicipalities(rows, municipalUnits, written, stats.find((s) => s.level === 5) as LevelStats);
  }

  reportSizes(stats);
  const missing = rows.filter((row) => TOLERANCE_M[row.l] !== undefined && !written.has(row.id));
  console.log(`\n⚠️  ${missing.length} οντότητες ΧΩΡΙΣ όριο (δεν θα προτείνονται στην αναζήτηση):`);
  for (const row of missing.slice(0, 40)) console.log(`   • ${row.id} ${row.n}`);
  if (missing.length > 40) console.log(`   … και ${missing.length - 40} ακόμη`);

  writeIndex(rows, written);
  console.log(`✅ ${readdirSync(OUTPUT_DIR).length} αρχεία ορίων → ${OUTPUT_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
