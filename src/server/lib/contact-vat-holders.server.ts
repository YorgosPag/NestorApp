import 'server-only';

/**
 * @fileoverview **Ποιες επαφές του χώρου έχουν αυτό το ΑΦΜ;** — η ΜΙΑ ερώτηση του server (Admin SDK).
 * @module server/lib/contact-vat-holders.server
 * @related lib/validation/vat-validation (`findVatHolders` — η ίδια ερώτηση στον client) ·
 *          lib/contacts/contact-identifier-duplicate-policy (`decideVatDuplicate` — η κρίση πάνω στους κατόχους)
 *
 * 🔑 **Ερώτημα μόνο με ισότητες** (`companyId` + `vatNumber`) — ίδιο σχήμα με το `findVatHolders` του client: καμία
 *    σάρωση, κανένας σύνθετος δείκτης. Το ΑΦΜ κανονικοποιείται με την ΕΝΑ κρίση (`greek-vat-number`).
 * 🔑 **Ποιος είναι κάτοχος — ο κανόνας του ADR-944 §9.7**, ίδιος με το `liveIdentifierHolders` του client:
 *    - επαφή **στον κάδο** (`isTrashed`) **δεν** είναι κάτοχος — αλλιώς κρατά το ΑΦΜ της δεσμευμένο ως την οριστική
 *      διαγραφή (ζωντανό σφάλμα 2026-11-24)·
 *    - επαφή **στο αρχείο** **είναι** κάτοχος, σημαδεμένη `archived` — μοτίβο Odoo (`_compute_same_vat_partner_id`,
 *      `active_test=False`: η αρχειοθετημένη με ίδιο ΑΦΜ προειδοποιεί κι αυτή). Ο καλών αποφασίζει αν μπορεί να
 *      συνδεθεί· η ερώτηση δεν την κρύβει.
 * ⚠️ Το φίλτρο κάδου τρέχει **μετά** το `limit` (όπως στον client): αν ο κάδος γεμίσει το όριο, ζωντανός κάτοχος
 *    μπορεί να μη φανεί. Δηλωμένο όριο του §9.7· δεν απαιτεί νέο δείκτη.
 * 🔑 **Ο αναγνώστης είναι παράμετρος**: ο ίδιος κώδικας τρέχει εκτός συναλλαγής (πρόταση) και **μέσα** σε συναλλαγή
 *    (φραγμός δημιουργίας) — αλλιώς θα υπήρχαν δύο ερωτήματα για την ίδια ερώτηση, όπως πριν από αυτό το αρχείο.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { isContactType } from '@/constants/contact-types';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { GREEK_VAT_REGEX, normalizeVat } from '@/lib/validation/greek-vat-number';
import { isArchived, isTrashed } from '@/lib/firestore/trashed-status';
import { extractContactDisplayName } from '@/server/lib/contact-doc-fields';
import type { IdentifierHolder } from '@/lib/contacts/contact-identifier-duplicate-policy';

/** Πώς διαβάζεται το ερώτημα — απευθείας, ή μέσα στη συναλλαγή του καλούντα. */
export type ContactQueryReader = (query: FirebaseFirestore.Query) => Promise<FirebaseFirestore.QuerySnapshot>;

/** Ανάγνωση εκτός συναλλαγής. */
export const directQueryReader: ContactQueryReader = (query) => query.get();

/** Ανάγνωση μέσα στη συναλλαγή `tx` — τα έγγραφα που επιστρέφει μπαίνουν στο σύνολο ανάγνωσής της. */
export const transactionQueryReader = (tx: FirebaseFirestore.Transaction): ContactQueryReader => (query) => tx.get(query);

/**
 * Πόσους κατόχους φέρνουμε. Αρκεί για «κανείς · ένας · πολλοί» και για να δείξει η οθόνη ποιοι είναι· ίδιο ταβάνι με
 * το `findVatHolders` του client.
 */
const VAT_HOLDER_PROBE_LIMIT = 6;

/** Ένας κάτοχος του ΑΦΜ, με όσα χρειάζονται η κρίση (`IdentifierHolder`) και η οθόνη. */
export interface ContactVatHolder extends IdentifierHolder {
  /** Στο αρχείο (`isArchived`) — κάτοχος, αλλά δεν συνδέεται πριν επανέλθει. Στον κάδο ⇒ δεν είναι κάτοχος καθόλου. */
  readonly archived: boolean;
  /** Το ωμό έγγραφο — για ό,τι άλλο χρειάζεται ο καλών, χωρίς δεύτερη ανάγνωση. */
  readonly data: FirebaseFirestore.DocumentData;
}

/**
 * Οι επαφές του χώρου `companyId` με ΑΦΜ `vat` (κανονικοποιείται εδώ· μη έγκυρο ⇒ κανένας, χωρίς ερώτημα).
 * Παραλείπονται: επαφή στον κάδο (ADR-944 §9.7) · έγγραφο με άγνωστο `type` (η κρίση `decideVatDuplicate` δεν ξέρει τι
 * να κάνει με αυτό).
 */
export async function findContactVatHolders(
  companyId: string,
  vat: string,
  read: ContactQueryReader = directQueryReader,
): Promise<readonly ContactVatHolder[]> {
  const normalized = normalizeVat(vat);
  if (!GREEK_VAT_REGEX.test(normalized)) return [];

  const snapshot = await read(
    getAdminFirestore()
      .collection(COLLECTIONS.CONTACTS)
      .where('companyId', '==', companyId)
      .where('vatNumber', '==', normalized)
      .limit(VAT_HOLDER_PROBE_LIMIT),
  );

  return snapshot.docs.flatMap((doc): ContactVatHolder[] => {
    const data = doc.data();
    const type: unknown = data.type;
    if (isTrashed(data) || !isContactType(type)) return [];
    return [{
      id: doc.id,
      name: extractContactDisplayName(data),
      type,
      archived: isArchived(data),
      data,
    }];
  });
}
