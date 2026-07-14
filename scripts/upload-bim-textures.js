/**
 * =============================================================================
 * 📦 UPLOAD BIM TEXTURES TO FIREBASE STORAGE — ONE-TIME SCRIPT
 * =============================================================================
 *
 * Ανεβάζει όλα τα PBR texture files από public/textures/ στο Firebase Storage
 * κάτω από bim-texture-library/<slug>/<map>.jpg (ADR-413).
 *
 * Γιατί χρειάζεται: *.jpg είναι .gitignored → δεν μπαίνουν στο Vercel build.
 * Σε production η εφαρμογή διαβάζει από Storage (texture-source.ts, 'storage' mode).
 *
 * USAGE (one-time, run as super_admin):
 * ```
 * node scripts/upload-bim-textures.js                       # όλα τα slugs
 * node scripts/upload-bim-textures.js --only wicker,linen   # μόνο αυτά (incremental)
 * ```
 *
 * `--only <slug,slug…>` = ανεβάζει μόνο αυτά τα slug dirs (incremental add — π.χ. νέα
 * own-scans χωρίς να ξανα-ανεβαίνουν τα ήδη ανεβασμένα).
 *
 * IDEMPOTENT: αν το αρχείο υπάρχει ήδη στο Storage, αντικαθίσταται (safe re-run).
 *
 * ⚠️ Ο μηχανισμός (init → upload loop → σύνοψη) ζει στο κοινό `_shared/storage-uploader.js`
 * (ADR-655) — ΜΗΝ τον αντιγράψεις εδώ.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const { initAdminBucket, uploadJobs, reportAndExit } = require('./_shared/storage-uploader');

const TEXTURES_DIR = path.join(__dirname, '..', 'public', 'textures');
const STORAGE_PREFIX = 'bim-texture-library';

const CONTENT_TYPE = 'image/jpeg';

async function uploadAll() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  📦 UPLOAD BIM TEXTURES → Firebase Storage (ADR-413)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const { bucket, storageBucket } = initAdminBucket();
  console.log(`📡 Bucket: ${storageBucket}`);
  console.log(`📁 Source: ${TEXTURES_DIR}`);
  console.log('');

  // ── Collect local files (optionally filtered with --only slug,slug…) ──────
  const onlyArg = process.argv.indexOf('--only');
  const onlySlugs = onlyArg !== -1 && process.argv[onlyArg + 1]
    ? new Set(process.argv[onlyArg + 1].split(',').map((s) => s.trim()).filter(Boolean))
    : null;
  if (onlySlugs) console.log(`🔎 Φίλτρο --only: ${[...onlySlugs].join(', ')}`);

  const slugDirs = fs.readdirSync(TEXTURES_DIR)
    .filter((d) => fs.statSync(path.join(TEXTURES_DIR, d)).isDirectory())
    .filter((d) => !onlySlugs || onlySlugs.has(d));

  const jobs = [];
  for (const slug of slugDirs) {
    const slugDir = path.join(TEXTURES_DIR, slug);
    const maps = fs.readdirSync(slugDir).filter((f) => f.endsWith('.jpg'));
    for (const map of maps) {
      jobs.push({ localPath: path.join(slugDir, map), remotePath: `${STORAGE_PREFIX}/${slug}/${map}` });
    }
  }

  console.log(`📋 Files to upload: ${jobs.length}`);
  console.log('');

  const result = await uploadJobs(bucket, jobs, CONTENT_TYPE);
  reportAndExit(
    result,
    jobs.length,
    '🚀 Όλα τα textures ανέβηκαν. Κάνε push + deploy για να φανούν στο production.',
  );
}

uploadAll().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
