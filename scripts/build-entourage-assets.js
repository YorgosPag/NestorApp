/**
 * Entourage asset builder — ΓΕΝΙΚΟ CLI (ADR-654).
 *
 * Χτίζει ένα pack από έναν φάκελο TIF (μία πηγή, ένα group) — π.χ. άνθρωποι ή οχήματα. Η
 * μηχανική ζει στο `scripts/lib/entourage-asset-builder.js` (κοινή με τα έπιπλα, N.18).
 *
 * Χρήση:
 *   node scripts/build-entourage-assets.js <srcDir> <outSubdir> <prefix> [group]
 *
 * Παραδείγματα:
 *   node scripts/build-entourage-assets.js images_2 people-2d   ppl
 *   node scripts/build-entourage-assets.js images_3 vehicles-2d veh
 *
 *   • srcDir    — φάκελος με τα raw TIF (σχετικός στο repo ή απόλυτος).
 *   • outSubdir — υποφάκελος κάτω από `public/` (gitignored· input του upload-asset-pack.js).
 *   • prefix    — prefix των ids (σταθερή ταυτότητα των sprites).
 *   • group     — προαιρετικό group token για τα ids· default 'obj'.
 *
 * @see scripts/lib/entourage-asset-builder.js — η μηχανή
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

const path = require('node:path');
const { buildEntouragePack } = require('./lib/entourage-asset-builder');

const REPO_ROOT = path.resolve(__dirname, '..');

function usage(msg) {
  if (msg) console.error(`❌ ${msg}`);
  console.error('Χρήση: node scripts/build-entourage-assets.js <srcDir> <outSubdir> <prefix> [group]');
  process.exit(1);
}

async function main() {
  const [srcArg, outSubdir, prefix, group = 'obj'] = process.argv.slice(2);
  if (!srcArg) usage('Λείπει το srcDir');
  if (!outSubdir) usage('Λείπει το outSubdir');
  if (!prefix) usage('Λείπει το prefix');

  const srcDir = path.isAbsolute(srcArg) ? srcArg : path.join(REPO_ROOT, srcArg);
  const outRoot = path.join(REPO_ROOT, 'public', outSubdir);

  console.log(`Entourage asset build — '${prefix}' pack`);
  await buildEntouragePack({
    sources: [{ group, dir: srcDir }],
    outRoot,
    idPrefix: prefix,
    repoRoot: REPO_ROOT,
  });
}

main().catch((err) => {
  console.error('❌ Απέτυχε το asset build:', err.message);
  process.exitCode = 1;
});
