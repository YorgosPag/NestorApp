/**
 * =============================================================================
 * Ο ΕΝΑΣ ΕΚΚΙΝΗΤΗΣ FIREBASE-ADMIN ΤΩΝ OPS SCRIPTS (ADR-813)
 * =============================================================================
 *
 * **Δύο ερωτήματα, δύο συναρτήσεις** — ποτέ μία με «και»:
 *   `loadServiceAccount()` → *«ποια διαπιστευτήρια;»*
 *   `initAdminApp(admin)`  → *«δώσ' μου `auth` και `db`»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ — ΕΠΤΑ ΑΝΤΙΓΡΑΦΑ, ΤΕΣΣΕΡΙΣ ΕΚΔΟΧΕΣ (μετρημένο 2026-08-26)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `loadServiceAccount` ήταν γραμμένο **7 φορές** με **4 διαφορετικά σώματα**
 * (`check-file-record` · `clear-permissions` · `downgrade-super-admin` ·
 * `list-all-files` · `list-all-users` · `set-super-admin` ·
 * `update-admin-messenger-psid`). Ίδιο όνομα, αποκλίνον περιεχόμενο — το σχήμα
 * του **ADR-749**. Το CHECK 3.28 τους ανέφερε ως **7 κλώνους** μόλις τρία από
 * αυτά βρέθηκαν στο ίδιο commit.
 *
 * 🔴 **ΚΑΙ ΟΛΑ ΗΤΑΝ ΤΥΦΛΑ ΣΤΟ `_B64`.** Ο κανονικός επιλυτής της εφαρμογής
 * (`src/lib/firebaseAdmin-credentials.ts`) δοκιμάζει **πρώτα**
 * `FIREBASE_SERVICE_ACCOUNT_KEY_B64` και **μετά** `FIREBASE_SERVICE_ACCOUNT_KEY`.
 * Και οι επτά διάβαζαν **μόνο** το δεύτερο, και μάλιστα με **regex πάνω στο
 * κείμενο του `.env.local`** — δηλαδή αγνοούσαν και το **πραγματικό
 * περιβάλλον**. Σε CI ή σε κέλυφος με εξαγμένη μεταβλητή, **καμία δεν δούλευε**.
 *
 * 🔴 **ΚΑΙ ΕΝΑ ΗΤΑΝ ΗΔΗ ΣΠΑΣΜΕΝΟ, ΑΠΟΔΕΔΕΙΓΜΕΝΑ.** Το `set-user-claims-direct.js`
 * καλούσε `loadEnvLocal()` και **πετούσε την επιστροφή**, μετά διάβαζε
 * `process.env.FIREBASE_SERVICE_ACCOUNT_KEY` — που το `loadEnvLocal`
 * **δεν γεμίζει ποτέ** (επιστρέφει αντικείμενο, δεν γράφει στο `process.env`).
 * Μετρημένο ζωντανά: `undefined`. Το script **δεν μπορούσε να τρέξει**.
 *
 * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΗ ΑΥΘΕΝΤΙΑ**: ο κανονικός επιλυτής είναι TypeScript
 * με `import 'server-only'` — ένα CJS ops script δεν μπορεί να τον εισαγάγει
 * χωρίς μεταγλώττιση. Άρα οι υλοποιήσεις είναι **δύο κατ' ανάγκη**, αλλά η
 * **σειρά προτίμησης** είναι αγκυρωμένη μηχανικά έναντι του αδελφού
 * (`scripts/__tests__/ops-firebase-admin.test.js`, ομάδα `Ι`), και οι
 * καταναλωτές είναι **ένας ο καθένας**.
 *
 * @module scripts/_shared/firebaseAdminOps
 * @see src/lib/firebaseAdmin-credentials.ts — ο κανονικός επιλυτής της εφαρμογής
 * @see ADR-813 — γιατί χρειάζεται ΕΝΑΣ εκκινητής και στα ops
 */

const { loadEnvLocal } = require('./loadEnvLocal');

/**
 * Η σειρά προτίμησης, **μία φορά, εδώ** — καθρέφτης του κανονικού επιλυτή.
 *
 * ⚠️ `_B64` **ΠΡΩΤΑ**: είναι η μορφή που χρησιμοποιούν τα workflows και οι
 * πλατφόρμες φιλοξενίας για μακριά κλειδιά. Αντίστροφη σειρά σημαίνει ότι σε
 * περιβάλλον με **και τα δύο** τα ops θα διάβαζαν άλλο κλειδί από την εφαρμογή.
 */
const CREDENTIAL_SOURCES = [
  { env: 'FIREBASE_SERVICE_ACCOUNT_KEY_B64', decode: (v) => Buffer.from(v, 'base64').toString('utf-8') },
  { env: 'FIREBASE_SERVICE_ACCOUNT_KEY', decode: (v) => v },
];

/** Καθαρίζει εισαγωγικά/κενά που κουβαλά μια τιμή από `.env` ή από κέλυφος. */
function sanitize(raw) {
  let v = String(raw).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

/**
 * Τα διαπιστευτήρια του service account.
 *
 * 🔑 **ΔΥΟ ΠΕΡΑΣΜΑΤΑ, ΟΧΙ ΕΝΑ ΜΠΛΕΓΜΕΝΟ** — η **ΠΗΓΗ** κυριαρχεί της
 * **ΠΑΡΑΛΛΑΓΗΣ**:
 *   1. ολόκληρο το `process.env` (`_B64` → ωμό)
 *   2. και **μόνο αν δεν βρέθηκε τίποτα**, το `.env.local` (`_B64` → ωμό)
 *
 * ⚠️ **Η πρώτη γραφή τα έμπλεκε, και ήταν ΛΑΘΟΣ — το έπιασε η άγκυρα `Κ2`**:
 * με εξαγμένο `FIREBASE_SERVICE_ACCOUNT_KEY` στο κέλυφος και `_B64` μέσα στο
 * `.env.local`, κέρδιζε **το αρχείο**. Δηλαδή ο άνθρωπος που έγραψε ρητά μια
 * μεταβλητή στο τερματικό του ενεργούσε **σιωπηλά με άλλα διαπιστευτήρια**.
 * *Ό,τι δηλώνεις ρητά νικά ό,τι βρίσκεται σε αρχείο.*
 *
 * @param {{ readFileEnv?: () => Record<string,string> }} [seam] Ραφή ένεσης για
 *        τις άγκυρες — **ποτέ** για παραγωγική χρήση.
 * @returns {Record<string, unknown>} Το αποκωδικοποιημένο service account JSON.
 * @throws {Error} Όταν καμία πηγή δεν δίνει έγκυρο κλειδί — **ποτέ σιωπηλά**.
 */
function loadServiceAccount(seam = {}) {
  const readFileEnv = seam.readFileEnv ?? (() => {
    try { return loadEnvLocal(); } catch { return {}; }
  });

  let fileEnv = null;
  const passes = [
    { label: 'process.env', get: (key) => process.env[key] },
    { label: '.env.local', get: (key) => (fileEnv ??= readFileEnv())[key] },
  ];

  const tried = [];
  for (const pass of passes) {
    for (const source of CREDENTIAL_SOURCES) {
      const raw = pass.get(source.env);
      if (!raw) { tried.push(`${source.env}@${pass.label}`); continue; }
      try {
        return JSON.parse(source.decode(sanitize(raw)));
      } catch (error) {
        // ⚠️ **ΔΕΝ πέφτουμε σιωπηλά στην επόμενη πηγή**: μια τιμή που ΥΠΑΡΧΕΙ
        //    και είναι άκυρη είναι **σφάλμα διαμόρφωσης**, όχι απουσία.
        //    Σιωπηλή πτώση θα έκρυβε ένα χαλασμένο κλειδί πίσω από ένα παλιό —
        //    και ο άνθρωπος θα ενεργούσε με διαπιστευτήρια που δεν νόμιζε ότι
        //    χρησιμοποιεί.
        throw new Error(
          `Το ${source.env} (${pass.label}) υπάρχει αλλά δεν είναι έγκυρο JSON ` +
            `service account: ${error && error.message ? error.message : error}`,
        );
      }
    }
  }

  throw new Error(
    `Δεν βρέθηκαν διαπιστευτήρια service account. Δοκιμάστηκαν: ${tried.join(' · ')}.`,
  );
}

/**
 * Αρχικοποιεί το `firebase-admin` **ιδεοδύναμα** και δίνει τα εργαλεία.
 *
 * @param {typeof import('firebase-admin')} admin Το `firebase-admin` namespace.
 * @param {{ storageBucket?: string, seam?: object }} [options] Extra για το app · `seam` μόνο για άγκυρες.
 * @returns {{ auth: any, db: any, projectId: string, serviceAccount: Record<string, unknown> }}
 *
 * @example
 * const admin = require('firebase-admin');
 * const { auth, db } = initAdminApp(admin);
 */
function initAdminApp(admin, options = {}) {
  const serviceAccount = loadServiceAccount(options.seam);
  const projectId = serviceAccount.project_id;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      ...(options.storageBucket ? { storageBucket: options.storageBucket } : {}),
    });
  }

  return { auth: admin.auth(), db: admin.firestore(), projectId, serviceAccount };
}

/**
 * Ο χρήστης που θα πειραχτεί — ή **τερματισμός με σαφές μήνυμα**.
 *
 * ⚠️ **Είναι βοηθός CLI, ΟΧΙ βιβλιοθήκη**: τερματίζει τη διεργασία επίτηδες,
 * γιατί αυτό ήταν το συμβόλαιο και των τριών αντιγράφων που αντικαθιστά
 * (`set-super-admin` · `downgrade-super-admin` · `clear-permissions`). Ένα
 * `throw` εδώ θα άλλαζε **σιωπηλά** το τι τυπώνεται σε ops διαδρομή που τρέχει
 * άνθρωπος με τα χέρια στο πληκτρολόγιο.
 *
 * @param {{ getUserByEmail: Function }} auth
 * @param {string} email
 * @returns {Promise<any>} Ο χρήστης, με τα claims του ήδη τυπωμένα.
 */
async function requireUserByEmail(auth, email) {
  console.log(`🔍 Looking for user: ${email}`);
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }
  console.log(`✅ User found: ${user.uid}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Display Name: ${user.displayName || 'N/A'}`);
  console.log(`   Current Claims: ${JSON.stringify(user.customClaims || {})}\n`);
  return user;
}

/**
 * Ξαναδιαβάζει τα claims **από την αυθεντία** και τα τυπώνει.
 *
 * ⚠️ Ξαναδιαβάζει επίτηδες αντί να τυπώσει ό,τι έστειλε ο καλών: ένα «✅ έγινε»
 * που δείχνει το **αίτημα** και όχι το **αποτέλεσμα** είναι απόδειξη που
 * επικυρώνει τον εαυτό της.
 */
async function printVerifiedClaims(auth, uid) {
  console.log('🔍 Verifying claims...');
  const updated = await auth.getUser(uid);
  console.log(`✅ Verified Claims: ${JSON.stringify(updated.customClaims)}\n`);
  return updated.customClaims;
}

module.exports = {
  loadServiceAccount,
  initAdminApp,
  requireUserByEmail,
  printVerifiedClaims,
  CREDENTIAL_SOURCES,
};
