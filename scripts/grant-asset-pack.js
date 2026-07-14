/**
 * =============================================================================
 * 🔑 GRANT / REVOKE ASSET PACK ΣΕ ΕΤΑΙΡΕΙΑ (ADR-655)
 * =============================================================================
 *
 * Το εργαλείο του «ποιος αγόρασε τι». Γράφει στο `companies/{companyId}.assetPackEntitlements`
 * — το ένα από τα δύο στρώματα δικαιώματος (το άλλο είναι το RBAC `asset_packs:packs:use`).
 *
 * USAGE:
 * ```
 * node scripts/grant-asset-pack.js --list                              # ποιες εταιρείες υπάρχουν
 * node scripts/grant-asset-pack.js <companyId> furniture-plan-2d       # παραχώρηση
 * node scripts/grant-asset-pack.js <companyId> furniture-plan-2d --revoke   # ανάκληση
 * ```
 *
 * IDEMPOTENT: `arrayUnion` / `arrayRemove` — διπλή εκτέλεση = ίδιο αποτέλεσμα.
 *
 * ⚠️ Το `companies/{id}` έχει `allow write: if false` στους rules ⇒ ΚΑΝΕΝΑΣ client δεν μπορεί να
 * αυτο-παραχωρηθεί. Μόνο Admin SDK (αυτό εδώ) γράφει.
 *
 * ℹ️ Ο διακόπτης διανομής είναι ΑΛΛΟ πράγμα: `asset_pack_config/{packId}.status`
 *    (βλ. scripts/set-asset-pack-status.js).
 * =============================================================================
 */

const admin = require('firebase-admin');
const { loadEnvLocal } = require('./_shared/loadEnvLocal');

function initFirestore() {
  const envVars = loadEnvLocal();
  const serviceAccount = JSON.parse(envVars.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

async function listCompanies(db) {
  const snap = await db.collection('companies').get();
  console.log(`📋 Εταιρείες (${snap.size}):`);
  console.log('');
  snap.forEach((doc) => {
    const data = doc.data();
    const packs = Array.isArray(data.assetPackEntitlements) ? data.assetPackEntitlements : [];
    const name = data.name ?? data.companyName ?? '(χωρίς όνομα)';
    console.log(`   ${doc.id}`);
    console.log(`      όνομα:  ${name}`);
    console.log(`      packs:  ${packs.length ? packs.join(', ') : '— κανένα —'}`);
    console.log('');
  });
}

async function main() {
  const args = process.argv.slice(2);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔑 ASSET PACK ENTITLEMENTS (ADR-655)');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');

  const db = initFirestore();

  if (args.includes('--list')) {
    await listCompanies(db);
    return;
  }

  const [companyId, packId] = args;
  const revoke = args.includes('--revoke');

  if (!companyId || !packId) {
    console.error('❌ Χρήση: node scripts/grant-asset-pack.js <companyId> <packId> [--revoke]');
    console.error('        node scripts/grant-asset-pack.js --list');
    process.exit(1);
  }

  const ref = db.collection('companies').doc(companyId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`❌ Η εταιρεία '${companyId}' δεν υπάρχει. Τρέξε --list.`);
    process.exit(1);
  }

  await ref.update({
    assetPackEntitlements: revoke
      ? admin.firestore.FieldValue.arrayRemove(packId)
      : admin.firestore.FieldValue.arrayUnion(packId),
  });

  const after = (await ref.get()).data().assetPackEntitlements ?? [];
  console.log(`${revoke ? '🚫 Ανακλήθηκε' : '✅ Παραχωρήθηκε'}: '${packId}' → ${companyId}`);
  console.log(`   Τρέχοντα packs: ${after.length ? after.join(', ') : '— κανένα —'}`);
  console.log('');
  console.log('ℹ️  Ισχύει σε ≤60s (TTL cache της πύλης).');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('💥 Fatal:', err.message);
    process.exit(1);
  });
