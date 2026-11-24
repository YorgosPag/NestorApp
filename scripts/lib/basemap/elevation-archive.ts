/**
 * @fileoverview **ΤΟ ΑΡΧΕΙΟ ΥΨΟΜΕΤΡΟΥ** — απόσπασμα Ελλάδας από το `planet.pmtiles` του Mapterhorn (ADR-920 §14.12 Β1).
 * @related ADR-891 §7 (ίδιος γεννήτορας, ίδιο εργαλείο) · `src/lib/maps/basemap-catalog.ts` (`ELEVATION_ARCHIVE_BUILD`)
 * @module scripts/lib/basemap/elevation-archive
 *
 * 🔴 **ΤΟ UPSTREAM ΔΕΝ ΕΧΕΙ ΕΚΔΟΣΗ ΣΤΟ ΟΝΟΜΑ ΤΟΥ.** Το `planet.pmtiles` ξαναγράφεται στη θέση του σε κάθε νέα έκδοση
 * του Mapterhorn. Το δικό μας αρχείο σερβίρεται `immutable` με την έκδοση στο όνομα ⇒ αν κόβαμε «ό,τι υπάρχει σήμερα»
 * κάτω από παλιό όνομα, δύο διαφορετικά περιεχόμενα θα μοιράζονταν μία διεύθυνση. Γι' αυτό ο γεννήτορας διαβάζει
 * πρώτα το ευρετήριο και **αρνείται** αν η έκδοση ή το md5 του πλανήτη δεν είναι τα καρφωμένα.
 *
 * 🔑 **Ορθογώνιο, όχι πολύγωνο ορίων.** Το υπόβαθρο κόβεται ανά δήμο (ADR-891 §7.2)· το έδαφος **όχι**: όπου λείπει
 * πλακίδιο υψομέτρου η MapLibre πέφτει σε πρόγονο χαμηλού ζουμ ⇒ ορατό σκαλοπάτι στο ανάγλυφο. Ένα ορθογώνιο δεν έχει
 * τρύπες. Μετρημένο 2026-11-24 (`--dry-run`, 19.2,34.7,29.8,41.9): 10.584 πλακίδια, **748 MB**.
 */

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { GeoBoundingBox } from '../../../src/types/geo/coordinates';
import { BASEMAP_BUNDLE_PATHS, COPERNICUS_DEM_LIABILITY_NOTICE, COPERNICUS_DEM_NOTICE, ELEVATION_ARCHIVE_BUILD } from '../../../src/lib/maps/basemap-catalog';
import { fileSha256, loadCachedSource } from '../cached-download';
import { bboxArgument, expandBox, unionBox, type TerritoryBoundary } from './basemap-coverage';
import { PMTILES_CLI_VERSION, capture, run } from './pmtiles-cli';

export const MAPTERHORN_INDEX_URL = 'https://download.mapterhorn.com/download_urls.json';

/** Πόσο έξω από το ορθογώνιο της επικράτειας φτάνει το ανάγλυφο — ώστε ο ορίζοντας μιας κεκλιμένης όψης να μην αδειάζει. */
export const ELEVATION_MARGIN_KM = 15;

interface PinnedPlanet {
  readonly url: string;
  readonly md5sum: string;
  readonly bytes: number;
}

/** Έκδοση Mapterhorn → ο πλανήτης της. Τιμές από το `download_urls.json`, διαβασμένες 2026-11-24. */
const PINNED_PLANETS: Readonly<Record<string, PinnedPlanet>> = {
  '0.0.13': { url: 'https://download.mapterhorn.com/planet.pmtiles', md5sum: '4bf586b043f7619d9a9442b43c163f36', bytes: 355_579_263_191 },
};

/** Το PDF της άδειας Copernicus WorldDEM-30 — το **ίδιο** αρχείο που διαβάστηκε (sha256 μετρημένο 2026-11-24). */
const COPERNICUS_LICENSE = {
  url: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf',
  sha256: '9cd37d37ea654bbcaf0a2e059e6a3a5b5f76072824d8dd860ccf274ada8951bd',
} as const;

const PROVENANCE_FORMAT_VERSION = 1;

interface MapterhornIndexItem {
  readonly name: string;
  readonly url: string;
  readonly md5sum: string;
  readonly size: number;
}

export interface MapterhornIndex {
  readonly version: string;
  readonly items: readonly MapterhornIndexItem[];
}

function isIndexItem(value: unknown): value is MapterhornIndexItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === 'string' && typeof item.url === 'string' && typeof item.md5sum === 'string' && typeof item.size === 'number';
}

/** Διαβάζει το ευρετήριο αυστηρά: άγνωστο σχήμα ⇒ σφάλμα, ποτέ «ό,τι βρέθηκε». */
export function parseMapterhornIndex(raw: unknown): MapterhornIndex {
  if (typeof raw !== 'object' || raw === null) throw new Error('ευρετήριο Mapterhorn: δεν είναι αντικείμενο');
  const { version, items } = raw as Record<string, unknown>;
  if (typeof version !== 'string' || !Array.isArray(items)) throw new Error('ευρετήριο Mapterhorn: λείπει `version` ή `items`');
  return { version, items: items.filter(isIndexItem) };
}

/**
 * Ο πλανήτης της καρφωμένης έκδοσης — **μόνο** αν το upstream σερβίρει ακόμη ακριβώς αυτόν.
 * Νέα έκδοση upstream ⇒ σφάλμα με οδηγία: νέα γραμμή στον πίνακα **και** νέο `ELEVATION_ARCHIVE_BUILD`.
 */
export function pinnedPlanetOf(index: MapterhornIndex, build: string = ELEVATION_ARCHIVE_BUILD): PinnedPlanet {
  const pinned = PINNED_PLANETS[build];
  if (pinned === undefined) throw new Error(`υψόμετρα ${build}: κανένας καρφωμένος πλανήτης — πρόσθεσε γραμμή στο PINNED_PLANETS`);
  if (index.version !== build) {
    throw new Error(`υψόμετρα: ο κατάλογος ζητά Mapterhorn ${build}, το upstream σερβίρει ${index.version} — το planet.pmtiles άλλαξε στη θέση του`);
  }
  const live = index.items.find((item) => item.url === pinned.url);
  if (live === undefined) throw new Error(`υψόμετρα ${build}: το ευρετήριο δεν έχει πια το ${pinned.url}`);
  if (live.md5sum !== pinned.md5sum || live.size !== pinned.bytes) {
    throw new Error(`υψόμετρα ${build}: ο πλανήτης άλλαξε χωρίς νέα έκδοση (md5 ${live.md5sum}, ${live.size} bytes)`);
  }
  return pinned;
}

/** Το ορθογώνιο του αποσπάσματος: η επικράτεια + {@link ELEVATION_MARGIN_KM} προς κάθε κατεύθυνση. */
export function elevationExtent(leaves: readonly TerritoryBoundary[]): GeoBoundingBox {
  return expandBox(unionBox(leaves.map((leaf) => leaf.bbox)), ELEVATION_MARGIN_KM);
}

async function fetchMapterhornIndex(): Promise<MapterhornIndex> {
  const response = await fetch(MAPTERHORN_INDEX_URL);
  if (!response.ok) throw new Error(`ευρετήριο Mapterhorn: HTTP ${response.status}`);
  return parseMapterhornIndex(await response.json());
}

/** Η άδεια δίπλα στο αρχείο, με το όνομα που δηλώνει ο κατάλογος (`licenseUrl` της πηγής). */
async function writeLicense(cacheDir: string, bundleDir: string): Promise<string> {
  const cached = await loadCachedSource({
    url: COPERNICUS_LICENSE.url,
    path: join(cacheDir, 'elevation', 'License-COPDEM-30.pdf'),
    label: 'άδεια Copernicus WorldDEM-30',
    expectedSha256: COPERNICUS_LICENSE.sha256,
  });
  const target = join(bundleDir, BASEMAP_BUNDLE_PATHS.elevationLicense);
  copyFileSync(cached.path, target);
  return target;
}

/** Η αναφορά προέλευσης δίπλα στο αρχείο: από πού κόπηκε, με ποια άδεια, τι βγήκε. */
async function writeProvenance(input: {
  readonly cli: string;
  readonly output: string;
  readonly planet: PinnedPlanet;
  readonly bbox: GeoBoundingBox;
  readonly license: string;
  readonly seconds: number;
}): Promise<void> {
  const { output, planet, bbox } = input;
  const header = JSON.parse(await capture(input.cli, ['show', output, '--header-json'])) as unknown;
  const provenance = {
    format: PROVENANCE_FORMAT_VERSION,
    generator: 'scripts/build-basemap.ts --elevation-only',
    adr: 'ADR-920 §14.12 Β1',
    builtAt: new Date().toISOString(),
    seconds: input.seconds,
    license: {
      data: 'Copernicus WorldDEM-30 (GLO-30) — Licence for the use of the Copernicus WorldDEM-30',
      notice: COPERNICUS_DEM_NOTICE,
      liability: COPERNICUS_DEM_LIABILITY_NOTICE,
      file: basename(input.license),
      tiles: 'Mapterhorn — κώδικας BSD-3-Clause· τα πλακίδια κρατούν την άδεια της πηγής τους',
      tool: `go-pmtiles ${PMTILES_CLI_VERSION} — BSD-3-Clause`,
    },
    source: { index: MAPTERHORN_INDEX_URL, version: ELEVATION_ARCHIVE_BUILD, ...planet },
    extent: { bbox, marginKm: ELEVATION_MARGIN_KM },
    output: { file: basename(output), bytes: statSync(output).size, sha256: await fileSha256(output), header },
  };
  writeFileSync(`${output}.provenance.json`, `${JSON.stringify(provenance, null, 2)}\n`);
}

export interface ElevationArchiveResult {
  readonly output: string | null;
  readonly bbox: GeoBoundingBox;
  readonly seconds: number;
}

/**
 * Κόβει το απόσπασμα (αιτήματα Range, **όχι** ο πλανήτης των 355 GB), το επαληθεύει και γράφει προέλευση + άδεια.
 * `dryRun` ⇒ μόνο η μέτρηση του εργαλείου· κανένα αρχείο.
 */
export async function buildElevationArchive(options: {
  readonly cli: string;
  readonly cacheDir: string;
  readonly bundleDir: string;
  readonly leaves: readonly TerritoryBoundary[];
  readonly dryRun: boolean;
}): Promise<ElevationArchiveResult> {
  const started = Date.now();
  const planet = pinnedPlanetOf(await fetchMapterhornIndex());
  const bbox = elevationExtent(options.leaves);
  const output = join(options.bundleDir, BASEMAP_BUNDLE_PATHS.elevation);
  mkdirSync(options.bundleDir, { recursive: true });
  console.log(`\n⛰  υψόμετρα Mapterhorn ${ELEVATION_ARCHIVE_BUILD} · ${bboxArgument(bbox)}`);

  if (!options.dryRun) rmSync(output, { force: true });
  await run(options.cli, ['extract', planet.url, output, `--bbox=${bboxArgument(bbox)}`, ...(options.dryRun ? ['--dry-run'] : [])]);
  const seconds = (): number => Math.round((Date.now() - started) / 1000);
  if (options.dryRun) return { output: null, bbox, seconds: seconds() };

  await run(options.cli, ['verify', output]);
  if (!existsSync(output)) throw new Error(`υψόμετρα: το ${output} δεν γράφτηκε`);
  await writeProvenance({ cli: options.cli, output, planet, bbox, license: await writeLicense(options.cacheDir, options.bundleDir), seconds: seconds() });
  return { output, bbox, seconds: seconds() };
}
