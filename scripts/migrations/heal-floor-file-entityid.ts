#!/usr/bin/env tsx
/**
 * ADR-420 / ADR-399 — Heal cross-floor `entityId` drift on floor-scoped DXF files.
 *
 * WHY: a floor `files` doc carries TWO floor references that must agree:
 *   - `storagePath` — the canonical, immutable storage location, built once at
 *     create-time as `…/entities/floor/<floorId>/…` and NEVER re-written on a
 *     merge-update (see dual-write-to-files.ts).
 *   - `entityId`    — the scope field `isCrossFloorSceneLink` compares against the
 *     level's `floorId`.
 *
 * Historically `entityId` was re-derived from the volatile per-save
 * `context.floorId` on EVERY auto-save merge. A stale `saveContext.floorId`
 * (sticky across level switches, pre-fix) therefore overwrote `entityId` with
 * ANOTHER floor's id while `storagePath` stayed correct. Result: the cross-floor
 * guard false-positived → the level's DXF save target was nulled → every BIM
 * entity drawn on that floor silently failed to persist (lost on reload).
 *
 * The companion code fix (dual-write-to-files.ts `isCreate`) stops the drift
 * going forward. This migration heals already-corrupted docs: for every
 * floor-scoped file whose `entityId` ≠ the `entityId` encoded in its
 * `storagePath`, it rewrites `entityId` to match the storagePath (the SSoT).
 *
 * 🔁 SSoT REUSE: the floor id is extracted from the storage path via the canonical
 * `parseStoragePath()` (ADR-293/ADR-031, `src/services/upload/utils/storage-path.ts`),
 * the SAME parser used app-wide — NOT a bespoke regex. Run via `tsx` so the
 * TS + `@/`-alias import resolves (the project's seed scripts use tsx too).
 *
 * SAFE: dry-run by default. Pass `--apply` to write. Optional `--company=<id>`.
 *
 *   npx tsx scripts/migrations/heal-floor-file-entityid.ts            # dry-run, all
 *   npx tsx scripts/migrations/heal-floor-file-entityid.ts --apply    # write, all
 *   npx tsx scripts/migrations/heal-floor-file-entityid.ts --apply --company=comp_x
 *
 * @see docs/centralized-systems/reference/adrs/ADR-420-bim-floor-scope-ssot.md
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
// 🔁 SSoT — the canonical storage-path parser (ADR-293). Relative import so the
// ts-node runner resolves it (it transitively pulls `@/config/domain-constants`,
// which the project's ts-node setup resolves — see scripts/bim/migrate-opening-tags.ts).
import { parseStoragePath } from '../../src/services/upload/utils/storage-path';

const serviceAccountPath = join(__dirname, '..', '..', 'pagonis-87766-firebase-adminsdk-fbsvc-469209d7a0.json');
if (existsSync(serviceAccountPath)) {
  initializeApp({ credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))) });
} else {
  initializeApp({ credential: applicationDefault(), projectId: 'pagonis-87766' });
}
const db = getFirestore();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const companyFilter = (args.find((a) => a.startsWith('--company=')) || '').split('=')[1] || null;

/**
 * The TRUTH floor id for a floor-scoped file = the `entityId` encoded in its
 * canonical storagePath, decoded via the SSoT `parseStoragePath`. Returns null
 * when the path is non-canonical / unparseable (left untouched, logged).
 */
function truthFloorIdFromStoragePath(storagePath: unknown): string | null {
  if (typeof storagePath !== 'string') return null;
  const parsed = parseStoragePath(storagePath);
  if (!parsed || parsed.entityType !== 'floor') return null;
  return parsed.entityId ?? null;
}

async function run(): Promise<void> {
  console.log(`\nADR-420/399 entityId heal — mode=${APPLY ? 'APPLY' : 'DRY-RUN'}` +
    `${companyFilter ? ` company=${companyFilter}` : ''}\n`);

  let q = db.collection('files').where('entityType', '==', 'floor');
  if (companyFilter) q = q.where('companyId', '==', companyFilter);
  const snap = await q.get();

  const totals = { scanned: 0, ok: 0, healed: 0, unresolved: 0 };
  let batch = db.batch();
  let batchCount = 0;

  for (const d of snap.docs) {
    totals.scanned++;
    const data = d.data();
    const truthFloorId = truthFloorIdFromStoragePath(data.storagePath);
    if (!truthFloorId) {
      totals.unresolved++;
      console.log(`  [unresolved] files/${d.id} — storagePath not a canonical floor path (${data.storagePath ?? '∅'})`);
      continue;
    }
    if (data.entityId === truthFloorId) { totals.ok++; continue; }

    totals.healed++;
    console.log(`  [heal] files/${d.id} — entityId ${data.entityId ?? '∅'} → ${truthFloorId} (from storagePath SSoT)`);
    if (APPLY) {
      batch.update(d.ref, { entityId: truthFloorId });
      if (++batchCount >= 450) { await batch.commit(); batch = db.batch(); batchCount = 0; }
    }
  }
  if (APPLY && batchCount > 0) await batch.commit();

  console.log(`\nTOTAL: scanned=${totals.scanned} ok=${totals.ok} healed=${totals.healed} unresolved=${totals.unresolved}`);
  console.log(APPLY ? '\n✅ Applied.' : '\n(dry-run — re-run with --apply to write)\n');
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
