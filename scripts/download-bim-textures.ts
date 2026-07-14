/**
 * =============================================================================
 * ⬇️  DOWNLOAD BIM TEXTURES FROM POLY HAVEN (CC0) — ADR-653
 * =============================================================================
 *
 * Rebuilds the whole builtin texture library into `public/textures/<slug>/<map>.jpg`
 * from the manifest in `bim-texture-registry.ts`.
 *
 * WHY THIS EXISTS: `*.jpg` is `.gitignore`d (`.gitignore:31`), so the texture
 * binaries never enter git. Without this script the library lives on exactly one
 * disk and a fresh clone renders untextured. The registry carries the `sourceAsset`
 * id per slug, so the binaries are reproducible from source control — the same
 * assets-as-code pattern the big players use (Revit fetches families from the
 * Autodesk CDN, C4D's Asset Browser downloads by asset id, ArchiCAD loads .lcf
 * containers; none of them commit the binaries).
 *
 * THE CHAIN:  registry (git) → `npm run download:textures` → `npm run upload:textures`
 *                                   ↓                              ↓
 *                            public/textures/            Firebase Storage (prod)
 *
 * USAGE:
 *   npm run download:textures                 # fetch whatever is missing
 *   npm run download:textures -- --force      # re-fetch everything (overwrite)
 *   npm run download:textures -- --only=stone,brick
 *
 * IDEMPOTENT: an existing non-empty file is skipped unless `--force`. Per-map
 * failures are reported and do not abort the remaining slugs; a non-zero exit code
 * means at least one file failed.
 *
 * LICENSE: every asset is CC0 (public domain) — no attribution required. See ADR-409.
 * =============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  TEXTURE_SET_DEFS,
  TEXTURE_RESOLUTION,
  TEXTURE_PROVIDER,
  mapsForTextureSet,
  isOwnScanTexture,
  type PbrTextureMapName,
  type PbrTextureSlug,
} from '../src/subapps/dxf-viewer/bim/materials/bim-texture-registry';

// ============================================================================
// PROVIDER PLUMBING (the only Poly-Haven-specific knowledge in the codebase)
// ============================================================================

const API_BASE = 'https://api.polyhaven.com';
const FORMAT = 'jpg';
const TEXTURES_DIR = path.join(__dirname, '..', 'public', 'textures');

/** Our map name → the provider's file key. */
const PROVIDER_MAP_KEYS: Record<PbrTextureMapName, string> = {
  albedo: 'Diffuse',
  normal: 'nor_gl',
  roughness: 'Rough',
  ao: 'AO',
  displacement: 'Displacement',
};

/** Shape of the bits of `GET /files/<asset>` we consume. */
type ProviderFiles = Record<string, Record<string, Record<string, { url?: string }>>>;

interface Failure {
  readonly slug: string;
  readonly map?: PbrTextureMapName;
  readonly reason: string;
}

// ============================================================================
// CLI
// ============================================================================

interface Options {
  readonly force: boolean;
  /** Empty = every slug in the manifest. */
  readonly only: readonly string[];
}

function parseArgs(argv: readonly string[]): Options {
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  return {
    force: argv.includes('--force'),
    only: onlyArg
      ? onlyArg
          .slice('--only='.length)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  };
}

/** The slugs to process; exits when `--only` names something not in the manifest. */
function selectSlugs(only: readonly string[]): readonly PbrTextureSlug[] {
  const all = Object.keys(TEXTURE_SET_DEFS) as PbrTextureSlug[];
  // Τα ιδιόκτητα σκαναρίσματα (images_6) ΔΕΝ κατεβαίνουν από τον provider — η αναπαραγωγή
  // τους είναι το git-committed public tile + το Storage copy (βλ. isOwnScanTexture).
  const providerSlugs = all.filter((s) => !isOwnScanTexture(TEXTURE_SET_DEFS[s]));
  if (only.length === 0) return providerSlugs;

  const unknown = only.filter((s) => !all.includes(s as PbrTextureSlug));
  if (unknown.length > 0) {
    console.error(`❌ Άγνωστα slugs: ${unknown.join(', ')}`);
    console.error(`   Διαθέσιμα: ${providerSlugs.join(', ')}`);
    process.exit(1);
  }
  const ownScans = only.filter((s) => isOwnScanTexture(TEXTURE_SET_DEFS[s as PbrTextureSlug]));
  if (ownScans.length > 0) {
    console.warn(`⚠ Παραλείπονται ιδιόκτητα σκαναρίσματα (δεν είναι στον ${TEXTURE_PROVIDER}): ${ownScans.join(', ')}`);
  }
  return only.filter((s) => !isOwnScanTexture(TEXTURE_SET_DEFS[s as PbrTextureSlug])) as PbrTextureSlug[];
}

// ============================================================================
// FETCH
// ============================================================================

/** Resolve the jpg url for one map of an asset, or null when the provider has none. */
function resolveMapUrl(files: ProviderFiles, map: PbrTextureMapName): string | null {
  return files[PROVIDER_MAP_KEYS[map]]?.[TEXTURE_RESOLUTION]?.[FORMAT]?.url ?? null;
}

/** Download a binary url to `dest` (parent dirs created). Returns bytes written. */
async function downloadTo(url: string, dest: string): Promise<number> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const bytes = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  return bytes.length;
}

/** True when the file is already on disk with content (and we are not forcing). */
function isSatisfied(dest: string, force: boolean): boolean {
  return !force && fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

/** Fetch one map. Pushes to `failures` and returns null when it could not be written. */
async function fetchMap(
  slug: PbrTextureSlug,
  map: PbrTextureMapName,
  files: ProviderFiles,
  opts: Options,
  failures: Failure[],
): Promise<string | null> {
  const dest = path.join(TEXTURES_DIR, slug, `${map}.${FORMAT}`);
  if (isSatisfied(dest, opts.force)) return `${map} (υπάρχει)`;

  const url = resolveMapUrl(files, map);
  if (!url) {
    failures.push({ slug, map, reason: `δεν υπάρχει ${TEXTURE_RESOLUTION}/${FORMAT}` });
    return null;
  }

  try {
    const bytes = await downloadTo(url, dest);
    return `${map} (${(bytes / 1024).toFixed(0)}KB)`;
  } catch (err) {
    failures.push({ slug, map, reason: (err as Error).message });
    return null;
  }
}

/** Fetch every map a slug's manifest row declares. */
async function processSlug(
  slug: PbrTextureSlug,
  opts: Options,
  failures: Failure[],
): Promise<void> {
  const def = TEXTURE_SET_DEFS[slug];

  let files: ProviderFiles;
  try {
    const res = await fetch(`${API_BASE}/files/${def.sourceAsset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    files = (await res.json()) as ProviderFiles;
  } catch (err) {
    failures.push({ slug, reason: `API «${def.sourceAsset}»: ${(err as Error).message}` });
    console.error(`   ❌ ${slug} — δεν βρέθηκε το asset «${def.sourceAsset}»`);
    return;
  }

  const done: string[] = [];
  for (const map of mapsForTextureSet(def)) {
    const label = await fetchMap(slug, map, files, opts, failures);
    if (label) done.push(label);
  }
  console.log(`   ✅ ${slug.padEnd(16)} ← ${def.sourceAsset.padEnd(22)} ${done.join(', ')}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const slugs = selectSlugs(opts.only);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  ⬇️  DOWNLOAD BIM TEXTURES — ${TEXTURE_PROVIDER} ${TEXTURE_RESOLUTION} CC0 (ADR-653)`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`📁 Προορισμός: ${TEXTURES_DIR}`);
  console.log(`📋 Slugs: ${slugs.length}${opts.force ? '  (--force → επανακατέβασμα όλων)' : ''}`);
  console.log('');

  const failures: Failure[] = [];
  for (const slug of slugs) {
    await processSlug(slug, opts, failures);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  if (failures.length === 0) {
    console.log(`  ✅ Όλα εντάξει — ${slugs.length} slugs.`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🚀 Επόμενο βήμα (για production): npm run upload:textures');
    return;
  }

  console.log(`  ⚠️  Αποτυχίες: ${failures.length}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  for (const f of failures) {
    console.log(`   ❌ ${f.slug}${f.map ? `/${f.map}` : ''} — ${f.reason}`);
  }
  process.exitCode = 1;
}

main().catch((err: Error) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
