/**
 * =============================================================================
 * ΜΕΤΑΝΑΣΤΕΥΣΗ — ΤΑ ΑΝΤΙΚΑΤΕΣΤΗΜΕΝΑ ΑΡΧΕΙΑ ΒΓΑΙΝΟΥΝ ΑΠΟ ΤΟΝ ΚΑΔΟ (ADR-862 Φ0 Β10)
 * =============================================================================
 *
 * 🔴 ΓΙΑΤΙ: μέχρι το Β10 η αντικατάσταση αρχείου έστελνε το παλιό **στον κάδο με `purgeAt`**, και
 * το `file-purge.job` το **διαγράφει οριστικά** μόλις λήξει. Το ISO 19650 (UK BIM Framework Part C
 * §6.3, «Continuous Archiving») κρατά κάθε αντικατεστημένη έκδοση ως **αρχείο συμβατικής
 * πληροφορίας**. Μετρημένο 2026-09-17: **2** έγγραφα, με `purgeAt` 2026-12-08 και 2026-12-10.
 *
 * ΤΙ ΚΑΝΕΙ, ανά έγγραφο με `cdeState == 'SUPERSEDED'` που είναι ακόμη στον κάδο:
 *   - `lifecycleState: 'archived'` + `archivedAt`/`archivedBy`   (στα «Αρχειοθετημένα»)
 *   - σβήνει `isDeleted`/`purgeAt`/`trashedAt`/`trashedBy`/`deletedAt`/`deletedBy`
 *     ⇒ **δομικά** εκτός οριστικής διαγραφής
 *   - γράφει την πράξη `cdeSupersession` (by · at · revision · supersededByFileId), ίδιο σχήμα με
 *     τον ΕΝΑ γραφέα (`services/iso19650/container-transitions`) — ώστε ο θεματοφύλακας να μη
 *     χρειάζεται πια τον κλάδο κληρονομιάς για αυτά τα δύο.
 *
 * ⚠️ ΙΔΕΜΠΟΤΗΤΙΚΟ: έγγραφο που δεν είναι πια στον κάδο παραλείπεται. Δεύτερη εκτέλεση = τίποτα.
 * ⚠️ ΓΡΑΦΕΙ ΣΤΗΝ ΠΑΡΑΓΩΓΗ ΜΟΝΟ ΜΕ `--execute`. Προεπιλογή: dry-run. **Το τρέχει ο Giorgio, ποτέ πράκτορας.**
 *
 * Χρήση:
 *   node scripts/migrate-superseded-out-of-trash.js            # dry-run
 *   node scripts/migrate-superseded-out-of-trash.js --execute  # εγγραφή
 */

'use strict';

const admin = require('firebase-admin');
const { applyEnvLocal } = require('./_shared/loadEnvLocal');
const { initAdminApp } = require('./_shared/firebaseAdminOps');

const TRASH_FIELDS = ['isDeleted', 'purgeAt', 'trashedAt', 'trashedBy', 'deletedAt', 'deletedBy'];

/** Firestore Timestamp · Date · ISO → ISO (ο θεματοφύλακας δέχεται `at` ΜΟΝΟ ως Date ή string). */
function isoOf(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : new Date().toISOString();
}

/** Η ενημέρωση για ένα έγγραφο, ή `null` όταν δεν χρειάζεται (ιδεμποτησία). */
function planFor(data) {
  if (data.lifecycleState !== 'trashed' && data.isDeleted !== true) return null;
  if (typeof data.supersededByFileId !== 'string' || data.supersededByFileId.length === 0) return null;

  const actor = data.trashedBy || data.deletedBy || data.createdBy;
  const at = isoOf(data.supersededAt || data.trashedAt);
  const update = {
    lifecycleState: 'archived',
    archivedAt: at,
    archivedBy: actor,
    cdeSupersession: {
      by: actor,
      at,
      revision: typeof data.revision === 'number' ? data.revision : 0,
      supersededByFileId: data.supersededByFileId,
    },
    updatedAt: new Date().toISOString(),
  };
  for (const field of TRASH_FIELDS) update[field] = admin.firestore.FieldValue.delete();
  return update;
}

async function main() {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);

  console.log(`\nΑντικατεστημένα αρχεία εκτός κάδου — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}\n`);

  const snapshot = await db.collection('files').where('cdeState', '==', 'SUPERSEDED').get();
  let planned = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const update = planFor(data);
    if (update === null) {
      console.log(`  = ${doc.id} — ήδη εκτός κάδου`);
      continue;
    }
    planned++;
    console.log(`  → ${doc.id} «${data.displayName || ''}» purgeAt=${data.purgeAt || '-'} ⇒ archived (διάδοχος ${data.supersededByFileId})`);
    if (execute) await doc.ref.update(update);
  }

  console.log(`\nΣύνολο: ${snapshot.size} SUPERSEDED · ${planned} ${execute ? 'μετακινήθηκαν' : 'θα μετακινηθούν'}.\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Η μετανάστευση απέτυχε:', error);
    process.exit(1);
  });
}

module.exports = { planFor };
