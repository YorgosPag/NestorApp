/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΩΝ ΠΑΝΕΛΛΑΔΙΚΩΝ ΑΡΧΕΙΩΝ ΕΠΙΣΚΟΠΗΣΗΣ** — Δήμοι + Δ.Ε. σε ένα αρχείο ανά βαθμίδα,
 * με **τοπολογική** απλοποίηση, για τον χωροπληθή χάρτη τιμών (ADR-890 §14.3).
 * @related ADR-890 §14 · ADR-883 · `src/lib/geo/admin-overview-file.ts` · `lib/admin-boundaries/shared-arc-simplify.ts`
 * ```
 * WFS «dimotikes_enotites» (CC-BY) ─┬─→ φύλλα = 948 Δ.Ε. + Δήμοι ΧΩΡΙΣ Δ.Ε. (από «kallikratikoi_dimoi»)
 *                                   └─→ Δήμοι = ένωση των Δ.Ε. τους (διάλυση κοινών ακμών)
 *                                   ──→ απλοποίηση ανά ΚΟΙΝΟ ΤΟΞΟ, ανά βαθμίδα
 * WFS «perifereiakes_enotites» (CC-BY) ──→ Π.Ε. (ίδια τοπολογία με τα φύλλα: 100% κοινές ακμές, §16)
 *                                   ──→ απλοποίηση ανά ΚΟΙΝΟ ΤΟΞΟ, ανά βαθμίδα
 *                                   ──→ public/data/admin-overview/{regional_unit,municipality,municipal_unit}.json
 *                                   ──→ public/data/admin-overview/children/<γονέας>.json — τα παιδιά ΕΝΟΣ γονέα + σημείο
 *                                       ετικέτας, για τη σελίδα του (ADR-890 §15 Δήμος→Δ.Ε. · §16 Π.Ε.→Δήμοι, Περιφέρεια→Π.Ε.)
 * ```
 * **Εκτέλεση**: `npm run build:admin-overview` (η cache της πηγής είναι κοινή με το `build:admin-boundaries`).
 *
 * 🔑 **Γιατί οι Δήμοι από τις Δ.Ε. και ΟΧΙ από το layer Δήμων**: η τοπολογική απλοποίηση θέλει γείτονες με
 * **ίδιες** κορυφές. Μέσα στο layer των Δ.Ε. αυτό ισχύει (240.587 κοινές ακμές)· ανάμεσα στα δύο layers μόνο
 * κατά 76% (μετρημένο 2026-09-28). Άρα ό,τι μπορεί να χτιστεί από **ένα** layer, χτίζεται από αυτό.
 *
 * 🔑 **Γιατί οι Π.Ε. από το layer τους και ΟΧΙ από διάλυση** (μετρημένο 2026-09-29, ADR-890 §16): το layer
 * `perifereiakes_enotites` είναι τοπολογικά καθαρό (0 ακμές σε > 2 πολύγωνα) και **το 100%** των ακμών του υπάρχει
 * ήδη στα φύλλα· η διάλυση των φύλλων ανά Π.Ε. άφηνε **1** αδιάλυτη (`regional_unit:25`, Δήμος-φύλλο από άλλο layer).
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { ADMIN_LEVEL } from '../src/lib/geo/admin-area-index-file';
import { adminBoundaryFileName } from '../src/lib/geo/admin-boundary-file';
import { geoLabelPoint } from './lib/admin-overview/geo-label-point';
import {
  ADMIN_OVERVIEW_CHILDREN_DIR,
  ADMIN_OVERVIEW_CHILDREN_MIN,
  ADMIN_OVERVIEW_DIR,
  ADMIN_OVERVIEW_FORMAT_VERSION,
  type AdminOverviewFeature,
  type AdminOverviewProperties,
  type AdminOverviewTier,
} from '../src/lib/geo/admin-overview-file';
import {
  ATTRIBUTION,
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

const OUTPUT_DIR = join(REPO_ROOT, 'public', ADMIN_OVERVIEW_DIR);

/**
 * **Ανοχή ανά βαθμίδα, σε μέτρα** — από το zoom όπου φαίνεται η βαθμίδα (ADR-890 §14.3):
 * οι Δήμοι φαίνονται κάτω από το zoom 9 (≈ 240 m/pixel στο πλάτος της Ελλάδας), οι Δ.Ε. από εκεί και πάνω.
 * Σχισμές δεν υπάρχουν σε **καμία** ανοχή — η ανοχή ορίζει μόνο πόσο «ακριβές» είναι το σχήμα.
 */
const TOLERANCE_M: Readonly<Record<AdminOverviewTier, number>> = {
  // Οι Π.Ε. φαίνονται στον χάρτη **μιας Περιφέρειας** (zoom ~7, ≈ 1 km/pixel).
  regional_unit: 300,
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

/** Τα φύλλα + οι Δήμοι + οι Π.Ε., ως σύνολα περιοχών έτοιμα για απλοποίηση. */
async function collectAreas(rows: readonly HierarchyRow[]): Promise<Record<AdminOverviewTier, OverviewArea[]>> {
  const unitsLayer = await loadLayer('dimotikes_enotites');
  const units = matchedLayer(unitsLayer, ADMIN_LEVEL.municipalUnit, rows);
  const parentOf = new Map(rows.map((row) => [row.id, row.p]));
  // «Χωρίς Δ.Ε.» = χωρίς **γεωμετρία** Δ.Ε., όχι χωρίς γραμμή στην ιεραρχία: η Δ.Ε. Νεμέας υπάρχει στην
  // ιεραρχία αλλά λείπει από την πηγή (μετρημένο 2026-09-28) — χωρίς αυτό, ο Δήμος θα έλειπε από τον χάρτη.
  const withUnits = new Set([...units.keys()].map((id) => parentOf.get(id)));
  const municipalities = matchedLayer(await loadLayer('kallikratikoi_dimoi'), ADMIN_LEVEL.municipality, rows);
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
  const regionalUnits = [...matchedLayer(await loadLayer('perifereiakes_enotites'), ADMIN_LEVEL.regionalUnit, rows)];
  return {
    regional_unit: regionalUnits.map(([id, geometry]) => ({ id, geometry, parent: null })),
    municipality: [...composed, ...childless.map(([id, geometry]) => ({ id, geometry, parent: null }))],
    municipal_unit: leaves,
  };
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

const kb = (bytes: number) => Math.round(bytes / 1024);

/** Το κείμενο ενός αρχείου επισκόπησης — ίδιο σχήμα για τη βαθμίδα και για τα παιδιά ενός γονέα. */
function overviewText(tier: AdminOverviewTier, features: readonly AdminOverviewFeature[], adr: string): string {
  const meta = { ...ATTRIBUTION, generator: 'scripts/build-admin-overview.ts', adr };
  return JSON.stringify({ type: 'FeatureCollection', v: ADMIN_OVERVIEW_FORMAT_VERSION, tier, toleranceM: TOLERANCE_M[tier], meta, features });
}

function writeTier(tier: AdminOverviewTier, features: readonly AdminOverviewFeature[]): void {
  const text = overviewText(tier, features, 'ADR-890 §14.3');
  writeFileSync(join(OUTPUT_DIR, `${tier}.json`), text);
  console.log(`🗺️  ${tier}.json: ${features.length} περιοχές · ${kb(text.length)} KB ωμό · ${kb(gzipSync(text, { level: 9 }).length)} KB gzip`);
}

/**
 * **Ποια βαθμίδα δίνει τα παιδιά ποιου επιπέδου** (ADR-890 §15 · §16): κάθε σελίδα βάφει τα παιδιά της (idealista).
 * Το επίπεδο του παιδιού φιλτράρει τη βαθμίδα: στο `municipal_unit` ζουν και οι Δήμοι-φύλλα, που **δεν** είναι παιδιά
 * της Π.Ε. τους εδώ (αυτά τα δίνει η βαθμίδα `municipality`).
 */
const CHILD_TIERS: readonly { readonly tier: AdminOverviewTier; readonly level: number }[] = [
  { tier: 'regional_unit', level: ADMIN_LEVEL.regionalUnit },
  { tier: 'municipality', level: ADMIN_LEVEL.municipality },
  { tier: 'municipal_unit', level: ADMIN_LEVEL.municipalUnit },
];

type Hierarchy = ReadonlyMap<string, HierarchyRow>;

/** Τα παιδιά μιας βαθμίδας ανά γονέα της ιεραρχίας — με γονέα και σημείο ετικέτας, στη σειρά της βαθμίδας. */
function childrenByParent(features: readonly AdminOverviewFeature[], level: number, hierarchy: Hierarchy): Map<string, AdminOverviewFeature[]> {
  const byParent = new Map<string, AdminOverviewFeature[]>();
  for (const feature of features) {
    const row = hierarchy.get(feature.properties.id);
    if (row === undefined || row.l !== level || row.p === null) continue;
    const parentName = hierarchy.get(row.p)?.n ?? null;
    const label = geoLabelPoint(feature.geometry);
    const properties = { ...feature.properties, parent: row.p, parentName, ...(label === null ? {} : { label }) };
    byParent.set(row.p, [...(byParent.get(row.p) ?? []), { ...feature, properties }]);
  }
  return byParent;
}

/**
 * **Τα παιδιά ανά γονέα** (ADR-890 §15 · §16), **κομμένα** από τα ήδη απλοποιημένα αρχεία βαθμίδας — ίδια τόξα με τον
 * χάρτη της αναζήτησης, άρα ίδιο σχήμα και μηδέν σχισμές — με σημείο ετικέτας. Μόνο γονείς με ≥
 * `ADMIN_OVERVIEW_CHILDREN_MIN` παιδιά με γεωμετρία. Ο φάκελος ξαναγράφεται ολόκληρος (κανένα ορφανό).
 */
function writeChildren(tiers: ReadonlyMap<AdminOverviewTier, readonly AdminOverviewFeature[]>, hierarchy: Hierarchy): void {
  const dir = join(OUTPUT_DIR, ADMIN_OVERVIEW_CHILDREN_DIR);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const { tier, level } of CHILD_TIERS) {
    let files = 0;
    let bytes = 0;
    const byParent = [...childrenByParent(tiers.get(tier) ?? [], level, hierarchy)].sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [parent, features] of byParent) {
      if (features.length < ADMIN_OVERVIEW_CHILDREN_MIN) continue;
      const text = overviewText(tier, features, tier === 'municipal_unit' ? 'ADR-890 §15' : 'ADR-890 §16');
      writeFileSync(join(dir, adminBoundaryFileName(parent)), text);
      files += 1;
      bytes += text.length;
    }
    console.log(`🗺️  children/ (${tier}): ${files} γονείς με ≥ ${ADMIN_OVERVIEW_CHILDREN_MIN} παιδιά · ${kb(bytes)} KB ωμό · μέσος ${kb(bytes / Math.max(files, 1))} KB`);
  }
}

async function main(): Promise<void> {
  const rows = readHierarchyRows();
  const areas = await collectAreas(rows);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const nameOf = new Map(rows.map((row) => [row.id, row.n]));
  const tiers = new Map<AdminOverviewTier, readonly AdminOverviewFeature[]>();
  for (const tier of Object.keys(areas) as AdminOverviewTier[]) {
    const features = overviewFeatures(areas[tier], tier, nameOf);
    writeTier(tier, features);
    tiers.set(tier, features);
  }
  writeChildren(tiers, new Map(rows.map((row) => [row.id, row])));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
