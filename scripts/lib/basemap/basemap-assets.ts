/**
 * @fileoverview **Γραμματοσειρές + sprites του χάρτη φόντου** — από καρφωμένο commit, στο bundle που σερβίρουμε.
 * @related ADR-891 §9 (Φ3) · `src/lib/maps/basemap-catalog.ts` (διαδρομές, flavors, άδειες) · `../tar-extract.ts`
 *
 * 🔑 **Ο κατάλογος αποφασίζει, ο γεννήτορας εκτελεί.** Το commit (`BASEMAP_ASSETS_REVISION`), ο φάκελος μέσα στο
 * bundle, τα flavors και τα αρχεία αδειών (`distributedAssets`) τα διαβάζουμε από τον κατάλογο που διαβάζει και ο
 * χάρτης ⇒ ό,τι ζητά ο browser είναι **ακριβώς** ό,τι γράφτηκε. Εδώ ζει μόνο ό,τι αφορά τη λήψη: τα sha256.
 *
 * ⚖️ **Οι άδειες ταξιδεύουν μαζί με τα αντίγραφα**: OFL-1.1 (Noto, `fonts/OFL.txt` από το ίδιο tarball) και MIT
 * (εικονίδια από `tangrams/icons` — το repo των assets **δεν** φέρει το κείμενο, οπότε το κατεβάζουμε καρφωμένο).
 * Αν λείπει αρχείο άδειας που δηλώνει ο κατάλογος, ο γεννήτορας **σταματά**.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  BASEMAP_ASSETS_REVISION,
  BASEMAP_BUNDLE_PATHS,
  BASEMAP_PROVIDERS,
  BASEMAP_SOURCES,
} from '../../../src/lib/maps/basemap-catalog';
import { loadCachedSource } from '../cached-download';
import { readTarGz } from '../tar-extract';

/** sha256 του tarball ανά commit — μετρημένο δύο φορές, ίδιο (το `codeload` του GitHub είναι ντετερμινιστικό). */
const ASSETS_TARBALL_SHA256: Readonly<Record<string, string>> = {
  '028c18f713baecad011301ff7a69acc39bcc2ae7': '57e40e8c512bd8042d0a3a251f19d0d1c8523ad963c666c3c6643bada4dc92d0',
};

/** Το κείμενο MIT των εικονιδίων (tangrams/icons), καρφωμένο σε commit. */
const SPRITE_LICENSE = {
  url: 'https://raw.githubusercontent.com/tangrams/icons/92510779634f4a006c61ea70e50cb8c52c765a81/LICENSE.md',
  sha256: '46d0ca73c10d7366ef7bf3932d8508267096393ccc9ef3a41d1b1d1fe37023f1',
  bundlePath: 'sprites/LICENSE.md',
} as const;

/** Οι font stacks που ζητά το `@protomaps/basemaps` 5.x (`text-font`) — και η Devanagari για τα ινδικά ονόματα. */
export const BASEMAP_FONTSTACKS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic', 'Noto Sans Devanagari Regular v1'] as const;

/** Τα flavors που ζητά κάποια πηγή του καταλόγου — μόνο αυτά τα sprites μπαίνουν στο bundle. */
export function catalogSpriteFlavors(): string[] {
  const flavors = new Set<string>();
  for (const source of Object.values(BASEMAP_SOURCES)) {
    if (source.format === 'vector-archive') for (const flavor of Object.values(source.flavors)) flavors.add(flavor);
  }
  return [...flavors].sort();
}

/** Μπαίνει αυτό το αρχείο του tarball στο bundle; (διαδρομή χωρίς τον ριζικό φάκελο) */
export function isBundledAsset(path: string, flavors: readonly string[]): boolean {
  if (path === 'fonts/OFL.txt') return true;
  const font = /^fonts\/([^/]+)\/\d+-\d+\.pbf$/.exec(path);
  if (font !== null) return (BASEMAP_FONTSTACKS as readonly string[]).includes(font[1]);
  const sprite = /^sprites\/v4\/([a-z]+)(?:@2x)?\.(?:json|png)$/.exec(path);
  return sprite !== null && flavors.includes(sprite[1]);
}

export interface BasemapAssetsResult {
  readonly directory: string;
  readonly files: number;
  readonly bytes: number;
}

function writeFile(root: string, relative: string, data: Buffer): void {
  const target = join(root, ...relative.split('/'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
}

/** Κάθε αρχείο άδειας που δηλώνει ο κατάλογος πρέπει να υπάρχει στο bundle — αλλιώς διανέμουμε χωρίς άδεια. */
function assertDeclaredLicenses(directory: string): void {
  for (const provider of Object.values(BASEMAP_PROVIDERS)) {
    for (const asset of provider.distributedAssets) {
      if (!existsSync(join(directory, ...asset.licenseFile.split('/')))) {
        throw new Error(`${provider.id}: λείπει το ${asset.licenseFile} (${asset.spdx}) από το bundle`);
      }
    }
  }
}

/** Γράφει `<bundle>/assets/<rev>/{fonts,sprites}` — από την αρχή κάθε φορά, ώστε να μη μένουν υπολείμματα. */
export async function writeBasemapAssets(cacheDir: string, bundleDir: string): Promise<BasemapAssetsResult> {
  const sha256 = ASSETS_TARBALL_SHA256[BASEMAP_ASSETS_REVISION];
  if (sha256 === undefined) throw new Error(`basemaps-assets ${BASEMAP_ASSETS_REVISION}: κανένα καρφωμένο sha256 — μέτρησέ το πρώτα`);
  const tarball = await loadCachedSource({
    url: `https://codeload.github.com/protomaps/basemaps-assets/tar.gz/${BASEMAP_ASSETS_REVISION}`,
    path: join(cacheDir, 'assets', `basemaps-assets-${BASEMAP_ASSETS_REVISION}.tar.gz`),
    label: 'protomaps/basemaps-assets',
    expectedSha256: sha256,
  });
  const license = await loadCachedSource({
    url: SPRITE_LICENSE.url,
    path: join(cacheDir, 'assets', 'tangrams-icons-LICENSE.md'),
    label: 'tangrams/icons LICENSE',
    expectedSha256: SPRITE_LICENSE.sha256,
  });

  const directory = join(bundleDir, ...BASEMAP_BUNDLE_PATHS.assets.split('/'));
  rmSync(directory, { recursive: true, force: true });
  const flavors = catalogSpriteFlavors();
  const entries = readTarGz(readFileSync(tarball.path), (path) => isBundledAsset(path, flavors));
  for (const entry of entries) writeFile(directory, entry.path, entry.data);
  writeFile(directory, SPRITE_LICENSE.bundlePath, readFileSync(license.path));
  assertDeclaredLicenses(directory);

  const bytes = entries.reduce((sum, e) => sum + e.data.length, 0) + statSync(license.path).size;
  return { directory, files: entries.length + 1, bytes };
}
