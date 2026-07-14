/**
 * =============================================================================
 * 📦 SHARED STORAGE UPLOADER — SSoT για «ανέβασε τοπικά αρχεία στο Firebase Storage»
 * =============================================================================
 *
 * Εξήχθη από το `scripts/upload-bim-textures.js` (ADR-413) όταν το ADR-655 χρειάστηκε ΤΟΝ ΙΔΙΟ
 * μηχανισμό (init admin → bucket → upload loop → σύνοψη). Δύο αντίγραφα θα ήταν ακριβώς το
 * token-based sibling clone που απαγορεύει ο κανόνας N.18 — άρα ο μηχανισμός ζει ΕΔΩ, μία φορά.
 *
 * @see ../upload-bim-textures.js — PBR textures (ADR-413)
 * @see ../upload-asset-pack.js   — gated asset packs (ADR-655)
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./loadEnvLocal');

/** Init Admin SDK + bucket. Idempotent ως προς το `initializeApp` (ένα script = ένα process). */
function initAdminBucket() {
  const envVars = loadEnvLocal();
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  const storageBucket =
    envVars.FIREBASE_STORAGE_BUCKET ?? envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });

  return { bucket: admin.storage().bucket(), storageBucket };
}

/**
 * Ανεβάζει `jobs` ([{ localPath, remotePath }]) με immutable cache headers.
 * IDEMPOTENT: υπάρχον αρχείο αντικαθίσταται (safe re-run).
 */
async function uploadJobs(bucket, jobs, contentType) {
  let ok = 0;
  let fail = 0;

  for (const { localPath, remotePath } of jobs) {
    try {
      await bucket.upload(localPath, {
        destination: remotePath,
        metadata: { contentType, cacheControl: 'public, max-age=31536000' },
      });
      console.log(`   ✅ ${remotePath}`);
      ok++;
    } catch (err) {
      console.error(`   ❌ ${remotePath} — ${err.message}`);
      fail++;
    }
  }

  return { ok, fail };
}

/** Τυπώνει τη σύνοψη και τερματίζει με exit code 1 αν κάτι απέτυχε. */
function reportAndExit({ ok, fail }, total, successMessage) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  ✅ Επιτυχία: ${ok}  |  ❌ Αποτυχία: ${fail}  |  Σύνολο: ${total}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  if (fail > 0) {
    console.log('⚠️  Μερικά αρχεία απέτυχαν — δες τα errors παραπάνω.');
    process.exit(1);
  }
  console.log(successMessage);
}

module.exports = { initAdminBucket, uploadJobs, reportAndExit };
