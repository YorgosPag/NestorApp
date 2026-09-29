/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΟΥ ΧΑΡΤΗ ΦΟΝΤΟΥ** — ένα αρχείο PMTiles της Ελλάδας, δικό μας (ADR-891 Φ2).
 * @related ADR-891 §7 · `lib/basemap/*` · `lib/cached-download.ts` · ADR-883 (τα όρια που ορίζουν την επικράτεια)
 *
 * ```
 * όρια Καλλικράτη (public/data)  →  φύλλα έως τον δήμο          (basemap-coverage · territoryLeaves)
 * builds.json Protomaps          →  νεότερο build σχήματος 4.x  (protomaps-builds · selectBuild)
 * go-pmtiles (sha256 καρφωμένο)  →  extract ανά ζώνη zoom        (αιτήματα Range, ΟΧΙ ο πλανήτης)
 *                                →  merge → verify → bundle/greece-YYYYMMDD.pmtiles + .provenance.json
 * basemaps-assets (sha256)       →  bundle/assets/<rev>/{fonts,sprites} + άδειες   (basemap-assets · Φ3)
 * ```
 *
 * **Εκτέλεση**: `npm run build:basemap` · επιλογές `--build=YYYYMMDD` (καρφωμένο build) · `--dry-run` (μόνο μέτρηση)
 * · `--assets-only` (μόνο γραμματοσειρές/sprites, χωρίς να ξαναχτιστεί το αρχείο)
 *
 * 🔴 **Η ΕΞΟΔΟΣ ΔΕΝ ΜΠΑΙΝΕΙ ΣΤΟ `public/`.** Το `Dockerfile` αντιγράφει **ολόκληρο** το `public/` στην εικόνα:
 * ~600 MB θα ταξίδευαν σε **κάθε** deploy και θα έμπαιναν στο git. Η έξοδος ζει στην cache εκτός git·
 * σερβίρεται από τον **δικό μας** στατικό διακομιστή με HTTP Range (`maps.nestorconstruct.gr`, `infra/basemap/`, ADR-891 §9).
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { adminBoundaryFileName, readAdminBoundary, ADMIN_BOUNDARIES_DIR } from '../src/lib/geo/admin-boundary-file';
import { REPO_ROOT, readHierarchyRows } from './lib/admin-boundaries/admin-boundary-source';
import { fileSha256 } from './lib/cached-download';
import {
  BASEMAP_TIERS,
  TERRITORY_FINEST_LEVEL,
  assertTierPartition,
  bboxArgument,
  territoryLeaves,
  tierExtent,
  unionBox,
  type BasemapTier,
  type TerritoryBoundary,
} from './lib/basemap/basemap-coverage';
import { BASEMAP_ARCHIVE_BUILD, basemapArchiveFileName } from '../src/lib/maps/basemap-catalog';
import { writeBasemapAssets } from './lib/basemap/basemap-assets';
import { BASEMAP_BUNDLE_DIR, BASEMAP_CACHE_DIR } from './lib/basemap/basemap-paths';
import { PMTILES_CLI_VERSION, capture, ensurePmtilesCli, run } from './lib/basemap/pmtiles-cli';
import { buildUrl, fetchBuildsIndex, selectBuild, type ProtomapsBuild } from './lib/basemap/protomaps-builds';

const CACHE_DIR = BASEMAP_CACHE_DIR;
const PARTS_DIR = join(CACHE_DIR, 'parts');
/**
 * **Ο φάκελος που ανεβαίνει στον διακομιστή, αυτούσιος** (ADR-891 §9): `greece-YYYYMMDD.pmtiles` + προέλευση +
 * `assets/<rev>/{fonts,sprites}`. Τα ονόματα φέρουν την έκδοση ⇒ ο διακομιστής τα σερβίρει `immutable`.
 */
const BUNDLE_DIR = BASEMAP_BUNDLE_DIR;

/** `20260926.pmtiles` (κλειδί Protomaps) → `…/bundle/greece-20260926.pmtiles`. */
function archivePathOf(build: ProtomapsBuild): string {
  return join(BUNDLE_DIR, basemapArchiveFileName(build.key.slice(0, 8)));
}

/** Zoom όπου η Ελλάδα χωρά ολόκληρη σε οθόνη — το zoom του κέντρου της κεφαλίδας. */
const TERRITORY_OVERVIEW_ZOOM = 6;

/** Η μορφή της αναφοράς προέλευσης· αλλάζει όταν αλλάζει το σχήμα της. */
const PROVENANCE_FORMAT_VERSION = 1;

/** Η άδεια των δεδομένων — ταξιδεύει μέσα στην αναφορά, όπως το `ATTRIBUTION` των ορίων. */
const DATA_LICENSE = {
  data: 'OpenStreetMap — ODbL 1.0',
  attribution: '© OpenStreetMap contributors',
  tiles: 'Protomaps basemap build (σχήμα BSD-3 / CC0 / MIT)',
  tool: `go-pmtiles ${PMTILES_CLI_VERSION} — BSD-3-Clause`,
} as const;

interface TierResult {
  readonly id: string;
  readonly zoom: string;
  readonly area: string;
  readonly bytes: number;
  readonly seconds: number;
}

function parseArgs(argv: readonly string[]): { build: string | null; dryRun: boolean; assetsOnly: boolean } {
  const arg = argv.find((a) => a.startsWith('--build='));
  const build = arg === undefined ? null : arg.slice('--build='.length);
  if (build !== null && !/^\d{8}$/.test(build)) throw new Error(`--build=${build}: αναμενόταν YYYYMMDD`);
  return { build, dryRun: argv.includes('--dry-run'), assetsOnly: argv.includes('--assets-only') };
}

/** Γραμματοσειρές + sprites + άδειες στο bundle (ADR-891 §9). */
async function buildAssets(): Promise<void> {
  const assets = await writeBasemapAssets(CACHE_DIR, BUNDLE_DIR);
  console.log(`🔤 assets: ${assets.files} αρχεία · ${(assets.bytes / 1e6).toFixed(1)} MB → ${assets.directory}`);
  const added = Object.entries(assets.supplement.addedByStack).map(([stack, n]) => `${stack} +${n}`).join(' · ');
  console.log(`➕ Noto Sans Math: ${added}`);
  console.log(`🧾 κάλυψη γλυφών → ${assets.coverageFile} (στο git — ADR-891 §9.5)`);
}

/** Ο κατάλογος ζητά **ένα** build· αν χτίσαμε άλλο, ο χάρτης θα ζητούσε αρχείο που δεν ανεβάσαμε. */
function reportCatalogPin(build: ProtomapsBuild): void {
  const built = build.key.slice(0, 8);
  if (built === BASEMAP_ARCHIVE_BUILD) return;
  console.warn(
    `⚠️  χτίστηκε το ${built}, ο κατάλογος ζητά ${BASEMAP_ARCHIVE_BUILD}: ανέβασε το bundle ΠΡΩΤΑ και μετά άλλαξε ` +
      `το BASEMAP_ARCHIVE_BUILD στο src/lib/maps/basemap-catalog.ts (ADR-891 §9)`,
  );
}

/** Τα όρια έως τον δήμο, από τα αρχεία που **ήδη** δημοσιεύουμε (ADR-883). */
function loadTerritory(): TerritoryBoundary[] {
  const rows = readHierarchyRows();
  const parents = new Map(rows.map((row) => [row.id, row.p]));
  const boundaries: TerritoryBoundary[] = [];
  for (const row of rows) {
    if (row.l > TERRITORY_FINEST_LEVEL) continue;
    const file = join(REPO_ROOT, 'public', ADMIN_BOUNDARIES_DIR, adminBoundaryFileName(row.id));
    if (!existsSync(file)) continue;
    const boundary = readAdminBoundary(JSON.parse(readFileSync(file, 'utf8')), row.id);
    if (boundary === null) throw new Error(`όριο ${row.id}: άκυρο αρχείο — τρέξε build:admin-boundaries`);
    boundaries.push({ id: row.id, level: boundary.level, bbox: boundary.bbox });
  }
  return territoryLeaves(boundaries, (id) => parents.get(id) ?? null);
}

/** Τα ορίσματα περιοχής του `extract` — πολύγωνο σε αρχείο, ή ορθογώνιο. */
function areaArguments(tier: BasemapTier, leaves: readonly TerritoryBoundary[]): { args: string[]; label: string } {
  const extent = tierExtent(tier, leaves);
  if (extent.kind === 'bbox') return { args: [`--bbox=${bboxArgument(extent.bbox)}`], label: bboxArgument(extent.bbox) };
  const regionPath = join(PARTS_DIR, `${tier.id}.region.geojson`);
  writeFileSync(regionPath, JSON.stringify(extent.region));
  return { args: [`--region=${regionPath}`], label: `${extent.region.coordinates.length} ορθογώνια ορίων` };
}

async function extractTier(cli: string, source: string, tier: BasemapTier, leaves: readonly TerritoryBoundary[], dryRun: boolean): Promise<TierResult> {
  const started = Date.now();
  const part = join(PARTS_DIR, `${tier.id}.pmtiles`);
  rmSync(part, { force: true });
  const area = areaArguments(tier, leaves);
  console.log(`\n▸ ${tier.id} · z${tier.minZoom}–${tier.maxZoom} · ${tier.why}`);
  const zoom = [`--minzoom=${tier.minZoom}`, `--maxzoom=${tier.maxZoom}`];
  await run(cli, ['extract', source, part, ...area.args, ...zoom, ...(dryRun ? ['--dry-run'] : [])]);
  return {
    id: tier.id,
    zoom: `${tier.minZoom}–${tier.maxZoom}`,
    area: area.label,
    bytes: dryRun ? 0 : statSync(part).size,
    seconds: Math.round((Date.now() - started) / 1000),
  };
}

/**
 * **Το κέντρο της κεφαλίδας = η επικράτεια.** Το `merge` αντιγράφει κέντρο και μεταδεδομένα από το **πρώτο**
 * αρχείο (τον κόσμο) ⇒ μετρημένο `center: [0, 0, 0]`, δηλαδή ο Κόλπος της Γουινέας. Τα `bounds` μένουν
 * **όλη η Γη** επίτηδες: το πρωτόκολλο `pmtiles` δεν ζητά πλακίδια έξω από αυτά, και η ζώνη `world` θα χανόταν.
 */
async function centerOnTerritory(cli: string, leaves: readonly TerritoryBoundary[], output: string): Promise<void> {
  const header = JSON.parse(await capture(cli, ['show', output, '--header-json'])) as Record<string, unknown>;
  const territory = unionBox(leaves.map((l) => l.bbox));
  const center = [(territory.west + territory.east) / 2, (territory.south + territory.north) / 2, TERRITORY_OVERVIEW_ZOOM];
  const headerPath = join(PARTS_DIR, 'header.json');
  writeFileSync(headerPath, JSON.stringify({ ...header, center }));
  await run(cli, ['edit', output, `--header-json=${headerPath}`]);
  rmSync(headerPath, { force: true });
}

/** Ενώνει τις ζώνες, κεντράρει, επαληθεύει τη δομή και επιστρέφει την κεφαλίδα του αρχείου. */
async function assemble(cli: string, parts: readonly string[], leaves: readonly TerritoryBoundary[], output: string): Promise<unknown> {
  mkdirSync(join(output, '..'), { recursive: true });
  rmSync(output, { force: true });
  await run(cli, ['merge', ...parts, output]);
  // Οι ζώνες είναι ενδιάμεσα: ~όσο το αποτέλεσμα, σε δίσκο που δεν έχει να περισσεύει (μετρημένο: 6 GB ελεύθερα).
  for (const part of parts) rmSync(part, { force: true });
  await centerOnTerritory(cli, leaves, output);
  await run(cli, ['verify', output]);
  return JSON.parse(await capture(cli, ['show', output, '--header-json'])) as unknown;
}

async function writeProvenance(build: ProtomapsBuild, tiers: readonly TierResult[], leaves: readonly TerritoryBoundary[], header: unknown, seconds: number): Promise<string> {
  const output = archivePathOf(build);
  const territory = unionBox(leaves.map((l) => l.bbox));
  const provenance = {
    format: PROVENANCE_FORMAT_VERSION,
    generator: 'scripts/build-basemap.ts',
    adr: 'ADR-891 Φ2',
    builtAt: new Date().toISOString(),
    seconds,
    license: DATA_LICENSE,
    source: { url: buildUrl(build), key: build.key, schema: build.version, uploaded: build.uploaded, b3sum: build.b3sum ?? null },
    territory: { boundaries: leaves.length, bbox: territory },
    tiers,
    output: { file: basename(output), bytes: statSync(output).size, sha256: await fileSha256(output), header },
  };
  const provenancePath = `${output}.provenance.json`;
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
  return provenancePath;
}

async function main(): Promise<void> {
  const started = Date.now();
  assertTierPartition(BASEMAP_TIERS);
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(PARTS_DIR, { recursive: true });
  if (args.assetsOnly) {
    await buildAssets();
    return;
  }

  const leaves = loadTerritory();
  const build = selectBuild(await fetchBuildsIndex(), args.build);
  console.log(`🗺  build ${build.key} · σχήμα ${build.version} · επικράτεια ${leaves.length} όρια`);
  const cli = await ensurePmtilesCli(CACHE_DIR);

  const tiers: TierResult[] = [];
  for (const tier of BASEMAP_TIERS) tiers.push(await extractTier(cli, buildUrl(build), tier, leaves, args.dryRun));
  if (args.dryRun) {
    console.log('\n✅ dry-run — κανένα αρχείο δεν γράφτηκε');
    return;
  }

  const output = archivePathOf(build);
  const header = await assemble(cli, BASEMAP_TIERS.map((t) => join(PARTS_DIR, `${t.id}.pmtiles`)), leaves, output);
  const seconds = Math.round((Date.now() - started) / 1000);
  const provenancePath = await writeProvenance(build, tiers, leaves, header, seconds);
  await buildAssets();
  console.table(tiers.map((t) => ({ ...t, MB: (t.bytes / 1e6).toFixed(1) })));
  console.log(`✅ ${(statSync(output).size / 1e6).toFixed(1)} MB σε ${seconds}s → ${output}\n📄 προέλευση → ${provenancePath}`);
  reportCatalogPin(build);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
