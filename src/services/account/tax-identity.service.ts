import 'server-only';

/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΟΥ ΑΦΜ** — ένας αριθμός, ένας ελεγκτής, μία πόρτα.
 * @related ADR-827 §9.20 · §8.3 · lib/validation/vat-validation.ts · firestore.rules
 * @module services/account/tax-identity
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΘΟΛΟΥ ΔΙΑΚΟΜΙΣΤΗΣ ΓΙΑ ΕΝΑ ΠΕΔΙΟ ΠΡΟΦΙΛ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε **άλλο** αυτο-δηλωμένο πεδίο του `users/{uid}` το γράφει ο πελάτης
 * απευθείας (όνομα, φωτογραφία, επάγγελμα) — και σωστά: κανείς δεν το πιστεύει
 * για εξουσιοδότηση. Το ΑΦΜ είναι **η εξαίρεση**, για έναν λόγο που μετριέται:
 *
 * > Μπαίνει σε **σύμβαση** που ο νόμος απαιτεί να τον περιέχει
 * > *(άρθρο 200 §2 Ν.4072/2012)*, και ταξιδεύει **αμετάκλητα** στο αποτύπωμα της
 * > επαφής τη στιγμή της αποδοχής (§8.3).
 *
 * Ένα λάθος ψηφίο δεν είναι τυπογραφικό: είναι **σύμβαση με άκυρο στοιχείο**, που
 * κανείς δεν θα δει μέχρι να τη ζητήσει η εφορία.
 *
 * 🔴 **ΚΑΙ Ο ΕΛΕΓΚΤΗΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΣΕ ΚΑΝΟΝΑ FIRESTORE.** Ο mod-11 απαιτεί
 * **βρόχο πάνω στα ψηφία**· η γλώσσα των κανόνων δεν τον έχει. Άρα οι δύο μόνες
 * επιλογές ήταν *«κάθε εννιάδα ψηφίων περνά»* ή *«η γραφή περνά από εδώ»*.
 *
 * ⚠️ **Server-owned ΔΕΝ σημαίνει «ο διακομιστής αποφασίζει ποιο είναι το ΑΦΜ σου».**
 * Σημαίνει *«ο διακομιστής επαληθεύει πριν το γράψει»*. Η **πηγή παραμένει ο
 * άνθρωπος** — και **μόνο** αυτός: το `uid` έρχεται από το σύνορο ταυτότητας,
 * ποτέ από το σώμα του αιτήματος, ώστε γραφή σε **ξένο** προφίλ να είναι
 * **δομικά αδύνατη**, όχι απαγορευμένη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΚΕΝΟ ΕΙΝΑΙ **ΔΙΑΓΡΑΦΗ**, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αντίθετα με το `applyProfileNames` (*«η κενή φόρμα δεν είναι εντολή διαγραφής»*),
 * εδώ το κενό **σβήνει**. Ο λόγος είναι διαφορετικός κατά **είδος**: το όνομα κάθε
 * λογαριασμού **υπάρχει πάντα** (Google/Entra/OIDC δεν προβλέπουν ανώνυμο), ενώ το
 * ΑΦΜ είναι **προαιρετικό δεδομένο ταυτοποίησης** που ο άνθρωπος έχει **δικαίωμα να
 * ανακαλέσει** όσο δεν έχει καταρτιστεί σύμβαση. Ένα «δεν σβήνεται ποτέ» θα ήταν
 * αποθήκευση χωρίς σκοπό (**GDPR 5§1ε**).
 *
 * ⚠️ **Η ανάκληση ΔΕΝ αγγίζει καμία υπάρχουσα επαφή**: εκείνες κρατούν
 * **αποτύπωμα**, με βάση **6§1γ** και πενταετή υποχρέωση (**§8.5**, άρ.30 §3
 * Ν.4557/2018). Η διαγραφή της πηγής δεν είναι διαγραφή της ιστορίας — και δεν
 * επιτρέπεται να είναι.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { isValidGreekVat, normalizeVat } from '@/lib/validation/vat-validation';

const logger = createModuleLogger('tax-identity.service');

/**
 * **Κλειστό σύνολο αρνήσεων** — ποτέ `boolean`, ποτέ ελεύθερο μήνυμα.
 *
 * 🔑 Κάθε τιμή γίνεται **κλειδί i18n**, άρα ο άνθρωπος μαθαίνει *τι* φταίει.
 * *«Μη έγκυρο»* για έναν αριθμό που **μοιάζει** σωστός είναι αδιέξοδο.
 */
export const TAX_IDENTITY_REJECTIONS = [
  /** Δεν είναι εννιά ψηφία — μορφή, πριν από κάθε αριθμητική. */
  'vat-format-invalid',
  /**
   * Εννιά ψηφία, **λάθος ψηφίο ελέγχου**. Ο πιο σημαντικός κωδικός του αρχείου:
   * είναι ο **μόνος** που πιάνει το τυπογραφικό λάθος — δύο ψηφία αντεστραμμένα
   * περνούν κάθε έλεγχο μορφής και **κόβονται μόνο εδώ**.
   */
  'vat-check-digit-invalid',
] as const;

export type TaxIdentityRejection = (typeof TAX_IDENTITY_REJECTIONS)[number];

/** Διακριτική ένωση — έκτη κατάσταση **δεν μεταγλωττίζεται** χωρίς απόφαση. */
export type TaxIdentityWriteResult =
  | { readonly kind: 'saved'; readonly vatNumber: string }
  | { readonly kind: 'cleared' }
  | { readonly kind: 'rejected'; readonly reason: TaxIdentityRejection }
  | { readonly kind: 'failed' };

/**
 * Κρίνει **χωρίς να γράφει** — καθαρή, άρα δοκιμάσιμη στα άκρα.
 *
 * ⚠️ Επιστρέφει την **κανονικοποιημένη** τιμή, όχι αυτή που πληκτρολογήθηκε: ο
 * άνθρωπος που γράφει `123 456 789` εννοεί τον ίδιο αριθμό, και δύο μορφές του
 * ίδιου ΑΦΜ στη βάση είναι δύο αλήθειες.
 */
export function judgeVatNumber(
  raw: string,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly reason: TaxIdentityRejection } {
  const normalized = normalizeVat(raw);

  // ⚠️ Η σειρά **μετράει**: «λάθος ψηφίο ελέγχου» σε συμβολοσειρά που δεν είναι καν
  //    εννιά ψηφία θα ήταν ψευδής πληροφορία — ο άνθρωπος θα έψαχνε τυπογραφικό
  //    λάθος εκεί που λείπει ολόκληρο ψηφίο.
  if (!/^\d{9}$/.test(normalized)) return { ok: false, reason: 'vat-format-invalid' };
  if (!isValidGreekVat(normalized)) return { ok: false, reason: 'vat-check-digit-invalid' };

  return { ok: true, value: normalized };
}

/**
 * **Ο ΜΟΝΑΔΙΚΟΣ ΓΡΑΦΕΑΣ** του `users/{uid}.vatNumber`.
 *
 * @param uid Έρχεται από το **σύνορο ταυτότητας** — ποτέ από το σώμα του αιτήματος.
 * @param raw Ό,τι πληκτρολόγησε ο άνθρωπος. Κενό ⇒ **ανάκληση**.
 */
export async function setOwnVatNumber(
  adminDb: AdminFirestore,
  uid: string,
  raw: string,
): Promise<TaxIdentityWriteResult> {
  const trimmed = raw.trim();

  try {
    if (trimmed.length === 0) {
      await adminDb.collection(COLLECTIONS.USERS).doc(uid).set(
        { vatNumber: null, updatedAt: new Date() },
        { merge: true },
      );
      // ⚠️ **Ποτέ ο ίδιος ο αριθμός στα logs** — είναι φορολογικό αναγνωριστικό.
      logger.info('[TaxIdentity] ΑΦΜ ανακλήθηκε', { uid });
      return { kind: 'cleared' };
    }

    const verdict = judgeVatNumber(trimmed);
    if (!verdict.ok) return { kind: 'rejected', reason: verdict.reason };

    await adminDb.collection(COLLECTIONS.USERS).doc(uid).set(
      { vatNumber: verdict.value, updatedAt: new Date() },
      { merge: true },
    );
    logger.info('[TaxIdentity] ΑΦΜ αποθηκεύτηκε', { uid });
    return { kind: 'saved', vatNumber: verdict.value };
  } catch (error) {
    logger.error('[TaxIdentity] Η γραφή απέτυχε', { uid, error });
    // 🔴 **Η βλάβη ΔΕΝ είναι άρνηση** (N.12): «δεν μπόρεσα να γράψω» ≠ «το ΑΦΜ σου
    //    είναι λάθος». Ο άνθρωπος που θα διάβαζε το δεύτερο θα άλλαζε έναν σωστό
    //    αριθμό.
    return { kind: 'failed' };
  }
}
