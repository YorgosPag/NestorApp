/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ CLAIMS ΤΩΝ OPS SCRIPTS (ADR-813 · ADR-360)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Όταν αλλάζει το ποιος είσαι, το μαθαίνει ο φυλλομετρητής;»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ — ΤΟ ΣΥΜΒΟΛΑΙΟ ΥΠΗΡΧΕ ΓΡΑΠΤΟ ΚΑΙ ΤΟ ΠΑΡΑΒΙΑΖΑΝ 4 ΣΤΑ 6
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `src/lib/auth/set-claims-with-mirror.ts` γράφει **κατά λέξη**: *«ALL server
 * code paths that mutate custom claims MUST go through this helper.»*
 * Μετρημένο 2026-08-26 στα ops scripts που καλούν `setCustomUserClaims`:
 *
 *   ❌ `set-super-admin.js` · `downgrade-super-admin.js` ·
 *      `clear-permissions.js` · `set-user-claims-direct.js`
 *   ✅ `claims.setCompanyId.js` · `bootstrap-pagonis-admin.js`
 *
 * ⚠️ **Οι ΔΥΟ διαδρομές ΑΝΑΚΛΗΣΗΣ ήταν στους παραβάτες** (`downgrade-super-admin`,
 * `clear-permissions`) — δηλαδή ο υποβιβασμένος διαχειριστής **κρατούσε τα
 * προνόμιά του έως μία ώρα**, όσο ζει το cached ID token. Ένα claim που
 * αφαιρείται χωρίς σήμα **δεν έχει αφαιρεθεί**· έχει προγραμματιστεί να
 * αφαιρεθεί. *«Ένα anchor χωρίς gate είναι σχόλιο»* (CHECK 3.36) — και εδώ το
 * σχόλιο ήταν το ίδιο το συμβόλαιο.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΔΕΥΤΕΡΗ ΥΛΟΠΟΙΗΣΗ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ADR-749
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο αδελφός (`src/lib/auth/set-claims-with-mirror.ts`) φέρει `import 'server-only'`
 * και είναι TypeScript: ένα CJS ops script **δεν μπορεί** να τον εισαγάγει χωρίς
 * βήμα μεταγλώττισης. Άρα οι υλοποιήσεις είναι **δύο κατ' ανάγκη** — αλλά:
 *
 *   1. οι **καταναλωτές** είναι πλέον **ένας ο καθένας** (εφαρμογή → TS · ops → CJS)·
 *   2. η **ισοδυναμία** τους είναι αγκυρωμένη μηχανικά, όχι υποσχεμένη
 *      (`scripts/__tests__/ops-claims-mirror.test.js`, ομάδα `Ι`)·
 *   3. καμία **απόφαση** δεν ζει εδώ — ούτε ρόλος, ούτε permission, ούτε κριτής.
 *      Ο κριτής είναι **ΕΝΑΣ** (`decideCapability`, CHECK 3.68) και αυτό το
 *      αρχείο **δεν τον ρωτά ποτέ**: μεταφέρει ό,τι του δώσουν.
 *
 * ⛔ **ΜΗΝ βάλεις εδώ λογική ρόλων/permissions.** Τη στιγμή που αυτό το αρχείο
 * αποφασίσει *τι* claims πρέπει να μπουν, γίνεται **δεύτερος κριτής** — και
 * τότε είναι ADR-749 στα αλήθεια.
 *
 * @module scripts/_shared/setClaimsWithMirror
 * @see src/lib/auth/set-claims-with-mirror.ts — ο αδελφός της εφαρμογής (SSoT)
 * @see ADR-360 — γιατί χρειάζεται καθρέφτης
 * @see ADR-813 — γιατί χρειάζεται ΕΝΑΣ γραφέας και στα ops
 */

/**
 * Το όνομα του πεδίου-σήματος. **Μία φορά, εδώ.**
 *
 * ⚠️ Είναι το **ίδιο** literal με τον αδελφό, και αυτό το επαληθεύει άγκυρα που
 * διαβάζει **και τα δύο** αρχεία (`Ι1`). Χωρίς αυτήν, μια μετονομασία στη μία
 * πλευρά θα άφηνε την άλλη να στέλνει σήμα **που κανείς δεν ακούει** — δηλαδή
 * σιωπηλή επιστροφή ακριβώς στο ελάττωμα που το αρχείο θεραπεύει.
 */
const CLAIMS_UPDATED_AT_FIELD = 'claimsUpdatedAt';

/** Η συλλογή του καθρέφτη — ίδια με τον αδελφό (`COLLECTIONS.USERS`). */
const USERS_COLLECTION = 'users';

/**
 * Γράφει custom claims **και** χτυπά το καμπανάκι ανανέωσης.
 *
 * Ο καλών δίνει το **ΠΛΗΡΕΣ** φορτίο claims — αυτό το αρχείο **δεν συγχωνεύει**
 * με τα υπάρχοντα, ακριβώς όπως ο αδελφός: η ευθύνη της συγχώνευσης μένει στον
 * καλούντα, ώστε τα audit logs να κρατούν πλήρη εικόνα πριν/μετά.
 *
 * @param {import('firebase-admin').app.App | { auth: Function, firestore: Function }} admin
 *        Το αρχικοποιημένο `firebase-admin` namespace ή app.
 * @param {string} uid Ο χρήστης.
 * @param {Record<string, unknown>} claims Το ΠΛΗΡΕΣ φορτίο claims.
 * @returns {Promise<{ claimsUpdatedAt: number, firestoreMirrorOk: boolean }>}
 *
 * @example
 * const { claimsUpdatedAt } = await setClaimsWithMirror(admin, uid, {
 *   companyId, globalRole, mfaEnrolled, permissions,
 * });
 */
async function setClaimsWithMirror(admin, uid, claims) {
  if (!uid || typeof uid !== 'string') {
    throw new Error('setClaimsWithMirror: uid is required');
  }
  if (!claims || typeof claims !== 'object') {
    throw new Error('setClaimsWithMirror: claims payload is required');
  }

  const claimsUpdatedAt = Date.now();
  const stampedClaims = { ...claims, [CLAIMS_UPDATED_AT_FIELD]: claimsUpdatedAt };

  // ⚠️ Η γραφή στο Auth είναι Η ΑΥΘΕΝΤΙΑ. Αν αποτύχει, τίποτα δεν άλλαξε και το
  //    σφάλμα ανεβαίνει — ποτέ σιωπηλή μερική επιτυχία.
  await admin.auth().setCustomUserClaims(uid, stampedClaims);

  // Ο καθρέφτης είναι **κανάλι ειδοποίησης**, όχι αυθεντία: αποτυχία του δεν
  // ακυρώνει τη γραφή, αλλά ΔΕΝ σιωπά — ο καλών το βλέπει στο αποτέλεσμα.
  let firestoreMirrorOk = true;
  try {
    await admin
      .firestore()
      .collection(USERS_COLLECTION)
      .doc(uid)
      .set(
        {
          [CLAIMS_UPDATED_AT_FIELD]: claimsUpdatedAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    firestoreMirrorOk = false;
    console.warn(
      `[CLAIMS_MIRROR] ⚠️ Ο καθρέφτης απέτυχε για ${uid} — τα claims ΓΡΑΦΤΗΚΑΝ, ` +
        `αλλά ο φυλλομετρητής θα τα δει μόλις λήξει το token (έως 1h): ` +
        `${error && error.message ? error.message : error}`,
    );
  }

  return { claimsUpdatedAt, firestoreMirrorOk };
}

module.exports = { setClaimsWithMirror, CLAIMS_UPDATED_AT_FIELD, USERS_COLLECTION };
