// ============================================================================
// ADR-413 — BIM PBR Texture downloader (Poly Haven, CC0)
// ============================================================================
// LICENSE: All textures are CC0 (public domain) from Poly Haven
//          (https://polyhaven.com). No attribution required. See ADR-409.
//
// Asset IDs used (verified against the Poly Haven API, all CC0):
//   concrete -> concrete_floor_02
//   brick    -> red_brick_03
//   plaster  -> beige_wall_001
//   wood     -> wood_planks_grey
//   tile     -> floor_tiles_06
//   stone    -> cobblestone_floor_04
//   metal    -> metal_plate
//
// Map-name mapping (our slug map  <-  Poly Haven key):
//   albedo    <- Diffuse
//   normal    <- nor_gl
//   roughness <- Rough
//   ao        <- AO
//
// Output: C:\Nestor_Pagonis\.tex-lib\<slug>\<map>.jpg  (1k jpg working copies)
//
// USAGE:
//   node tools/bim-textures/download-textures.mjs
//
// Idempotent: skips any <map>.jpg that already exists. Network failures per
// asset/map are caught and reported; the run continues for the remaining maps.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TEX_LIB = path.join(REPO_ROOT, '.tex-lib');
const RESOLUTION = '1k';
const FORMAT = 'jpg';

// our slug -> Poly Haven asset id (all CC0, verified to exist)
const ASSETS = {
  concrete: 'concrete_floor_02',
  brick: 'red_brick_03',
  plaster: 'beige_wall_001',
  wood: 'wood_planks_grey',
  tile: 'floor_tiles_06',
  stone: 'cobblestone_floor_04',
  metal: 'metal_plate',
};

// our map name -> Poly Haven file key
const MAP_KEYS = {
  albedo: 'Diffuse',
  normal: 'nor_gl',
  roughness: 'Rough',
  ao: 'AO',
};

/** Download a binary URL to dest (parent dirs created). */
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

/** Resolve the jpg url for a given Poly Haven file-key from the API payload. */
function resolveMapUrl(filesJson, polyHavenKey) {
  const entry = filesJson[polyHavenKey];
  if (!entry) {
    return null;
  }
  const byRes = entry[RESOLUTION];
  if (!byRes || !byRes[FORMAT]) {
    return null;
  }
  return byRes[FORMAT].url || null;
}

async function processSlug(slug, assetId, report) {
  const slugDir = path.join(TEX_LIB, slug);
  fs.mkdirSync(slugDir, { recursive: true });

  let filesJson;
  try {
    const res = await fetch(`https://api.polyhaven.com/files/${assetId}`);
    if (!res.ok) {
      throw new Error(`API HTTP ${res.status}`);
    }
    filesJson = await res.json();
  } catch (err) {
    report.failed.push({ slug, assetId, reason: `API: ${err.message}` });
    console.error(`[${slug}] FAILED to fetch API for ${assetId}: ${err.message}`);
    return;
  }

  const got = [];
  for (const [mapName, polyHavenKey] of Object.entries(MAP_KEYS)) {
    const dest = path.join(slugDir, `${mapName}.${FORMAT}`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      got.push(`${mapName} (skip)`);
      continue;
    }
    const url = resolveMapUrl(filesJson, polyHavenKey);
    if (!url) {
      console.warn(`[${slug}] no ${RESOLUTION}/${FORMAT} url for ${polyHavenKey}`);
      continue;
    }
    try {
      const bytes = await download(url, dest);
      got.push(`${mapName} (${(bytes / 1024).toFixed(0)}KB)`);
    } catch (err) {
      report.failed.push({ slug, assetId, map: mapName, reason: err.message });
      console.error(`[${slug}] FAILED ${mapName}: ${err.message}`);
    }
  }
  if (got.length > 0) {
    report.ok.push({ slug, assetId, maps: got });
    console.log(`[${slug}] ${assetId}: ${got.join(', ')}`);
  }
}

(async () => {
  const report = { ok: [], failed: [] };
  fs.mkdirSync(TEX_LIB, { recursive: true });
  for (const [slug, assetId] of Object.entries(ASSETS)) {
    await processSlug(slug, assetId, report);
  }
  console.log('\n=== SUMMARY ===');
  console.log(`OK slugs:     ${report.ok.length}/${Object.keys(ASSETS).length}`);
  console.log(`Failed items: ${report.failed.length}`);
  if (report.failed.length > 0) {
    console.log(JSON.stringify(report.failed, null, 2));
    process.exitCode = 1;
  }
})();
