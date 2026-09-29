/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΩΝ ΠΑΝΕΛΛΑΔΙΚΩΝ ΑΡΧΕΙΩΝ ΕΠΙΣΚΟΠΗΣΗΣ** — Δήμοι + Δ.Ε. σε ένα αρχείο ανά βαθμίδα,
 * με **τοπολογική** απλοποίηση, για τον χωροπληθή χάρτη τιμών (ADR-890 §14.3).
 * @related ADR-890 §14 · ADR-883 · `src/lib/geo/admin-overview-file.ts` · `lib/admin-boundaries/shared-arc-simplify.ts`
 * ```
 * WFS «dimotikes_enotites» (CC-BY) ─┬─→ φύλλα = 948 Δ.Ε. + Δήμοι ΧΩΡΙΣ Δ.Ε. (από «kallikratikoi_dimoi»)
 *                                   └─→ Δήμοι = ένωση των Δ.Ε. τους (διάλυση κοινών ακμών)
 *                                   ──→ απλοποίηση ανά ΚΟΙΝΟ ΤΟΞΟ, ανά βαθμίδα
 *                                   ──→ public/data/admin-overview/{municipality,municipal_unit}.json
 * ```
 * **Εκτέλεση**: `npm run build:admin-overview` (η cache της πηγής είναι κοινή με το `build:admin-boundaries`).
 *
 * 🔑 **Γιατί οι Δήμοι από τις Δ.Ε. και ΟΧΙ από το layer Δήμων**: η τοπολογική απλοποίηση θέλει γείτονες με
 * **ίδιες** κορυφές. Μέσα στο layer των Δ.Ε. αυτό ισχύει (240.587 κοινές ακμές)· ανάμεσα στα δύο layers μόνο
 * κατά 76% (μετρημένο 2026-09-28). Άρα ό,τι μπορεί να χτιστεί από **ένα** layer, χτίζεται από αυτό.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  ADMIN_OVERVIEW_DIR,
  ADMIN_OVERVIEW_FORMAT_VERSION,
  type AdminOverviewFeature,
  type AdminOverviewProperties,
  type AdminOverviewTier,
} from '../src/lib/geo/admin-overview-file';
import {
  ATTRIBUTION,
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
import { simplifySharedArcs, type TopologyFeature } from './lib/admin-boundaries/shared-arc-simplify';

const MUNICIPALITY_LEVEL = 5;
const OUTPUT_DIR = join(REPO_ROOT, 'public', ADMIN_OVERVIEW_DIR);

/**
 * **Ανοχή ανά βαθμίδα, σε μέτρα** — από το zoom όπου φαίνεται η βαθμίδα (ADR-890 §14.3):
 * οι Δήμοι φαίνονται κάτω από το zoom 9 (≈ 240 m/pixel στο πλάτος της Ελλάδας), οι Δ.Ε. από εκεί και πάνω.
 * Σχισμές δεν υπάρχουν σε **καμία** ανοχή — η ανοχή ορίζει μόνο πόσο «ακριβές» είναι το σχήμα.
 */
const TOLERANCE_M: Readonly<Record<AdminOverviewTier, number>> = {
  municipality: 150,
  municipal_unit: 80,
};

/** 4 δεκαδικά ≈ 11 m — κάτω από κάθε ανοχή του πίνακα. */
const DECIMALS = 4;

function asMultiPolygon(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.MultiPolygon {
  return geometry.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [geometry.coordinates] } : geometry;
}

interface OverviewArea extends TopologyFeature {
  readonly parent: string | null;
}

/** Τα χαρακτηριστικά του αρχείου — ονόματα από την ιεραρχία (η γραφή του μητρώου, ADR-893). */
function propertiesOf(area: OverviewArea, nameOf: ReadonlyMap<string, string>): AdminOverviewProperties {
  const parentName = area.parent === null ? null : nameOf.get(area.parent) ?? null;
  return { id: area.id, name: nameOf.get(area.id) ?? area.id, parent: area.parent, parentName };
}

function matchedLayer(
  layer: GeoJSON.FeatureCollection,
  level: number,
  rows: readonly HierarchyRow[],
): Map<string, GeoJSON.MultiPolygon> {
  const { index, ambiguous } = buildIdIndex(rows);
  const matched = new Map<string, GeoJSON.MultiPolygon>();
  for (const feature of layer.features) {
    const match = matchFeature(feature, level, index, ambiguous);
    if (match.kind === 'matched') matched.set(match.id, asMultiPolygon(match.geometry));
  }
  return matched;
}

/** Τα φύλλα + οι Δήμοι, ως δύο σύνολα περιοχών έτοιμα για απλοποίηση. */
async function collectAreas(rows: readonly HierarchyRow[]): Promise<Record<AdminOverviewTier, OverviewArea[]>> {
  const unitsLayer = await loadLayer('dimotikes_enotites');
  const units = matchedLayer(unitsLayer, MUNICIPAL_UNIT_LEVEL, rows);
  const parentOf = new Map(rows.map((row) => [row.id, row.p]));
  // «Χωρίς Δ.Ε.» = χωρίς **γεωμετρία** Δ.Ε., όχι χωρίς γραμμή στην ιεραρχία: η Δ.Ε. Νεμέας υπάρχει στην
  // ιεραρχία αλλά λείπει από την πηγή (μετρημένο 2026-09-28) — χωρίς αυτό, ο Δήμος θα έλειπε από τον χάρτη.
  const withUnits = new Set([...units.keys()].map((id) => parentOf.get(id)));
  const municipalities = matchedLayer(await loadLayer('kallikratikoi_dimoi'), MUNICIPALITY_LEVEL, rows);
  const childless = [...municipalities].filter(([id]) => !withUnits.has(id));

  const leaves: OverviewArea[] = [
    ...[...units].map(([id, geometry]) => ({ id, geometry, parent: parentOf.get(id) ?? null })),
    ...childless.map(([id, geometry]) => ({ id, geometry, parent: null })),
  ];

  let undissolved = 0;
  const composed = [...composeMunicipalitiesFromUnits(rows, unitsLayer, new Set())].map(([id, { geometry }]) => {
    const dissolved = dissolveSharedEdges(geometry);
    if (dissolved === null) undissolved += 1;
    return { id, geometry: dissolved ?? geometry, parent: null };
  });
  console.log(`🧩 Δήμοι: ${composed.length} από Δ.Ε. (${undissolved} αδιάλυτοι) + ${childless.length} χωρίς Δ.Ε.`);
  return { municipality: [...composed, ...childless.map(([id, geometry]) => ({ id, geometry, parent: null }))], municipal_unit: leaves };
}

/** Περιοχή που έσβησε **ολόκληρη** (νησίδα κάτω από την ανοχή) κρατά την αρχική της γεωμετρία — ποτέ δεν χάνεται. */
function overviewFeatures(
  areas: readonly OverviewArea[],
  tier: AdminOverviewTier,
  nameOf: ReadonlyMap<string, string>,
): AdminOverviewFeature[] {
  const { geometries, stats } = simplifySharedArcs(areas, TOLERANCE_M[tier], DECIMALS);
  let intact = 0;
  const features = [...areas]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((area): AdminOverviewFeature => {
      let geometry = geometries.get(area.id) ?? null;
      if (geometry === null) {
        intact += 1;
        geometry = simplifySharedArcs([area], 0, DECIMALS).geometries.get(area.id) ?? area.geometry;
      }
      return { type: 'Feature', properties: propertiesOf(area, nameOf), geometry };
    });
  console.log(`   ${tier}: ${stats.vertices} → ${stats.kept} κορυφές · ${stats.junctions} κόμβοι · ${stats.arcs} τόξα · ${intact} αυτούσιες`);
  return features;
}

function writeTier(tier: AdminOverviewTier, features: readonly AdminOverviewFeature[]): void {
  const body = {
    type: 'FeatureCollection',
    v: ADMIN_OVERVIEW_FORMAT_VERSION,
    tier,
    toleranceM: TOLERANCE_M[tier],
    meta: { ...ATTRIBUTION, generator: 'scripts/build-admin-overview.ts', adr: 'ADR-890 §14.3' },
    features,
  };
  const text = JSON.stringify(body);
  writeFileSync(join(OUTPUT_DIR, `${tier}.json`), text);
  const kb = (bytes: number) => Math.round(bytes / 1024);
  console.log(`🗺️  ${tier}.json: ${features.length} περιοχές · ${kb(text.length)} KB ωμό · ${kb(gzipSync(text, { level: 9 }).length)} KB gzip`);
}

async function main(): Promise<void> {
  const rows = readHierarchyRows();
  const areas = await collectAreas(rows);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const nameOf = new Map(rows.map((row) => [row.id, row.n]));
  for (const tier of Object.keys(areas) as AdminOverviewTier[]) writeTier(tier, overviewFeatures(areas[tier], tier, nameOf));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
