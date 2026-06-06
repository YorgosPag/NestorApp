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
 * node scripts/upload-bim-textures.js
 * ```
 *
 * IDEMPOTENT: αν το αρχείο υπάρχει ήδη στο Storage, αντικαθίσταται (safe re-run).
 * =============================================================================
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

const TEXTURES_DIR = path.join(__dirname, '..', 'public', 'textures');
const STORAGE_PREFIX = 'bim-texture-library';

const CONTENT_TYPE = 'image/jpeg';

async function uploadAll() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  📦 UPLOAD BIM TEXTURES → Firebase Storage (ADR-413)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  // ── Init ──────────────────────────────────────────────────────────────────
  const envVars = loadEnvLocal();
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  const storageBucket = envVars.FIREBASE_STORAGE_BUCKET ?? envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });

  const bucket = admin.storage().bucket();
  console.log(`📡 Bucket: ${storageBucket}`);
  console.log(`📁 Source: ${TEXTURES_DIR}`);
  console.log('');

  // ── Collect local files ───────────────────────────────────────────────────
  const slugDirs = fs.readdirSync(TEXTURES_DIR).filter((d) =>
    fs.statSync(path.join(TEXTURES_DIR, d)).isDirectory(),
  );

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

  // ── Upload ────────────────────────────────────────────────────────────────
  let ok = 0;
  let fail = 0;
  for (const { localPath, remotePath } of jobs) {
    try {
      await bucket.upload(localPath, {
        destination: remotePath,
        metadata: { contentType: CONTENT_TYPE, cacheControl: 'public, max-age=31536000' },
      });
      console.log(`   ✅ ${remotePath}`);
      ok++;
    } catch (err) {
      console.error(`   ❌ ${remotePath} — ${err.message}`);
      fail++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  ✅ Επιτυχία: ${ok}  |  ❌ Αποτυχία: ${fail}  |  Σύνολο: ${jobs.length}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  if (fail === 0) {
    console.log('🚀 Όλα τα textures ανέβηκαν. Κάνε push + deploy για να φανούν στο production.');
  } else {
    console.log('⚠️  Μερικά αρχεία απέτυχαν — δες τα errors παραπάνω.');
    process.exit(1);
  }
}

uploadAll().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
