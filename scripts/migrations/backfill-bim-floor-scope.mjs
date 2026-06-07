/**
 * ADR-420 — Backfill stable `floorId` scope onto every BIM entity document.
 *
 * WHY: BIM entities (walls, slabs, columns, … all 20 collections) were
 * historically scoped by the volatile `floorplanId` (= fileRecordId, regenerated
 * on every re-import). ADR-420 re-scopes them to the stable building-storey
 * `floorId`. Pre-existing documents were written WITHOUT `floorId`, so once the
 * subscribe query flips to `where('floorId','==',…)` they would no longer match
 * (orphaned). This migration derives and writes `floorId` on every legacy doc.
 *
 * Derivation (per doc, in priority order):
 *   1. doc already has a non-empty `floorId` → skip (idempotent).
 *   2. doc.<levelRef> (layerId for most types, levelId for stairs) is a viewer
 *      level id (lvl_*) → look up dxf_viewer_levels[levelId].floorId.
 *   3. fallback: doc.floorplanId matches a level's sceneFileId → that level's floorId.
 *   4. otherwise → unresolved (logged, left untouched; keeps floorplanId fallback scope).
 *
 * SAFE: dry-run by default. Pass `--apply` to write. Optional `--company=<id>`
 * and `--collection=<name>` filters. Batched writes (≤450/batch).
 *
 *   node scripts/migrations/backfill-bim-floor-scope.mjs            # dry-run, all
 *   node scripts/migrations/backfill-bim-floor-scope.mjs --apply    # write, all
 *   node scripts/migrations/backfill-bim-floor-scope.mjs --apply --company=comp_x
 *
 * @see docs/centralized-systems/reference/adrs/ADR-420-bim-floor-scope-ssot.md
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, '..', '..', 'pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// CLI flags
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const companyFilter = (args.find((a) => a.startsWith('--company=')) || '').split('=')[1] || null;
const collectionFilter = (args.find((a) => a.startsWith('--collection=')) || '').split('=')[1] || null;

// The 20 BIM collections. Stairs reference their level via `levelId`; all others
// via `layerId`. mep_systems has no level reference (logical network) — it can
// only be resolved via the floorplanId→sceneFileId fallback.
const BIM_COLLECTIONS = [
  'floorplan_walls', 'floorplan_openings', 'floorplan_slabs', 'floorplan_slab_openings',
  'floorplan_columns', 'floorplan_beams', 'floorplan_stairs', 'floorplan_railings',
  'floorplan_roofs', 'floorplan_floor_finishes', 'floorplan_electrical_panels',
  'floorplan_furniture', 'floorplan_symbols', 'floorplan_mep_fixtures', 'floorplan_mep_systems',
  'floorplan_mep_segments', 'floorplan_mep_fittings', 'floorplan_mep_manifolds',
  'floorplan_mep_radiators', 'floorplan_mep_boilers',
];

const levelRefField = (collection) => (collection === 'floorplan_stairs' ? 'levelId' : 'layerId');

async function buildLevelMaps() {
  const snap = await db.collection('dxf_viewer_levels').get();
  const byLevelId = new Map();      // levelId → floorId
  const bySceneFileId = new Map();  // sceneFileId → floorId
  for (const d of snap.docs) {
    const data = d.data();
    if (data.floorId) {
      byLevelId.set(d.id, data.floorId);
      if (data.sceneFileId) bySceneFileId.set(data.sceneFileId, data.floorId);
    }
  }
  return { byLevelId, bySceneFileId };
}

function resolveFloorId(data, collection, maps) {
  if (data.floorId) return { floorId: data.floorId, reason: 'already-set' };
  const ref = data[levelRefField(collection)];
  if (ref && maps.byLevelId.has(ref)) return { floorId: maps.byLevelId.get(ref), reason: 'levelRef' };
  if (data.floorplanId && maps.bySceneFileId.has(data.floorplanId)) {
    return { floorId: maps.bySceneFileId.get(data.floorplanId), reason: 'sceneFile' };
  }
  return { floorId: null, reason: 'unresolved' };
}

async function run() {
  console.log(`\nADR-420 backfill — mode=${APPLY ? 'APPLY' : 'DRY-RUN'}` +
    `${companyFilter ? ` company=${companyFilter}` : ''}${collectionFilter ? ` collection=${collectionFilter}` : ''}\n`);

  const maps = await buildLevelMaps();
  console.log(`Level map: ${maps.byLevelId.size} levels with floorId, ${maps.bySceneFileId.size} sceneFile links\n`);

  const totals = { scanned: 0, alreadySet: 0, backfilled: 0, unresolved: 0 };
  const collections = collectionFilter ? [collectionFilter] : BIM_COLLECTIONS;

  for (const collection of collections) {
    let q = db.collection(collection);
    if (companyFilter) q = q.where('companyId', '==', companyFilter);
    const snap = await q.get();
    if (snap.empty) continue;

    let scanned = 0, alreadySet = 0, backfilled = 0, unresolved = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const d of snap.docs) {
      scanned++;
      const { floorId, reason } = resolveFloorId(d.data(), collection, maps);
      if (reason === 'already-set') { alreadySet++; continue; }
      if (!floorId) {
        unresolved++;
        console.log(`  [unresolved] ${collection}/${d.id} (${levelRefField(collection)}=${d.data()[levelRefField(collection)] ?? '∅'}, floorplanId=${d.data().floorplanId ?? '∅'})`);
        continue;
      }
      backfilled++;
      if (APPLY) {
        batch.update(d.ref, { floorId });
        if (++batchCount >= 450) { await batch.commit(); batch = db.batch(); batchCount = 0; }
      }
    }
    if (APPLY && batchCount > 0) await batch.commit();

    console.log(`${collection}: scanned=${scanned} alreadySet=${alreadySet} backfilled=${backfilled} unresolved=${unresolved}`);
    totals.scanned += scanned; totals.alreadySet += alreadySet;
    totals.backfilled += backfilled; totals.unresolved += unresolved;
  }

  console.log(`\nTOTAL: scanned=${totals.scanned} alreadySet=${totals.alreadySet} ` +
    `backfilled=${totals.backfilled} unresolved=${totals.unresolved}`);
  console.log(APPLY ? '\n✅ Applied.' : '\n(dry-run — re-run with --apply to write)\n');
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
