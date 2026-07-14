/**
 * =============================================================================
 * 🔒 UPLOAD ASSET PACK → Firebase Storage (ADR-655)
 * =============================================================================
 *
 * Ανεβάζει ένα gated asset pack στο `asset-packs/<packId>/<version>/`.
 *
 * USAGE (super_admin, one-time ανά έκδοση πακέτου):
 * ```
 * node scripts/upload-asset-pack.js furniture-plan-2d
 * ```
 *
 * ⚠️ Η ΕΚΔΟΣΗ ΔΕΝ ΔΙΝΕΤΑΙ ΑΠΟ CLI — διαβάζεται από το `asset-pack-registry.ts`. Αν την
 * περνούσαμε χειροκίνητα, θα μπορούσε να αποκλίνει από το registry και τα αρχεία θα ανέβαιναν σε
 * διαδρομή που η εφαρμογή δεν ζητά ποτέ (σιωπηλά σπασμένο pack). Ένας SSoT, μηδέν drift.
 *
 * ΤΑ ΑΡΧΕΙΑ ΔΕΝ ΕΙΝΑΙ ΑΝΑΓΝΩΣΙΜΑ ΑΠΟ CLIENT: το `storage.rules` λέει `allow read: if false` για
 * το `asset-packs/**`. Σερβίρονται αποκλειστικά μέσω του `/api/asset-packs` proxy, αφού περάσει
 * η πύλη (status + company entitlement + RBAC).
 *
 * IDEMPOTENT: safe re-run.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const { initAdminBucket, uploadJobs, reportAndExit } = require('./_shared/storage-uploader');

const REGISTRY_PATH = path.join(__dirname, '..', 'src', 'lib', 'asset-packs', 'asset-pack-registry.ts');

/** Πού ζουν τοπικά τα παραγόμενα assets κάθε πακέτου (input του upload). */
const PACK_SOURCE_DIRS = {
  'furniture-plan-2d': path.join(__dirname, '..', 'public', 'furniture-2d'),
};

/**
 * Διαβάζει την έκδοση από τον SSoT (`asset-pack-registry.ts`). Σκάει δυνατά αν δεν βρεθεί —
 * ποτέ σιωπηλό fallback, γιατί λάθος έκδοση = pack που δεν σερβίρεται ποτέ.
 */
function readPackVersion(packId) {
  const source = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const entry = new RegExp(`id:\\s*'${packId}',[\\s\\S]{0,200}?version:\\s*'([^']+)'`).exec(source);
  if (!entry) {
    throw new Error(
      `Δεν βρέθηκε έκδοση για το pack '${packId}' στο ${path.relative(process.cwd(), REGISTRY_PATH)}`,
    );
  }
  return entry[1];
}

async function main() {
  const packId = process.argv[2];

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔒 UPLOAD ASSET PACK → Firebase Storage (ADR-655)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  if (!packId || !PACK_SOURCE_DIRS[packId]) {
    console.error(`❌ Άγνωστο pack: '${packId ?? '(κενό)'}'`);
    console.error(`   Διαθέσιμα: ${Object.keys(PACK_SOURCE_DIRS).join(', ')}`);
    console.error('   Χρήση: node scripts/upload-asset-pack.js <packId>');
    process.exit(1);
  }

  const version = readPackVersion(packId);
  const sourceDir = PACK_SOURCE_DIRS[packId];

  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Ο φάκελος δεν υπάρχει: ${sourceDir}`);
    console.error('   Τρέξε πρώτα τον builder των assets.');
    process.exit(1);
  }

  const { bucket, storageBucket } = initAdminBucket();
  const remotePrefix = `asset-packs/${packId}/${version}`;

  const jobs = fs
    .readdirSync(sourceDir)
    .filter((file) => file.endsWith('.webp'))
    .map((file) => ({
      localPath: path.join(sourceDir, file),
      remotePath: `${remotePrefix}/${file}`,
    }));

  console.log(`📡 Bucket:  ${storageBucket}`);
  console.log(`📦 Pack:    ${packId} @ ${version}`);
  console.log(`📁 Source:  ${sourceDir}`);
  console.log(`🎯 Target:  ${remotePrefix}/`);
  console.log(`📋 Αρχεία:  ${jobs.length}`);
  console.log('');

  if (jobs.length === 0) {
    console.error('❌ Κανένα .webp αρχείο — τίποτα να ανέβει.');
    process.exit(1);
  }

  const result = await uploadJobs(bucket, jobs, 'image/webp');
  reportAndExit(
    result,
    jobs.length,
    `🚀 Το pack '${packId}@${version}' ανέβηκε. Σερβίρεται ΜΟΝΟ μέσω /api/asset-packs (gated).`,
  );
}

main().catch((err) => {
  console.error('💥 Fatal:', err.message);
  process.exit(1);
});
