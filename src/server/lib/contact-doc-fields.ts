/**
 * 🏢 SSoT — ανάγνωση πεδίων επαφής **από ωμό έγγραφο Firestore** (Admin SDK).
 *
 * Ό,τι διαβάζει μια διαδρομή Admin SDK από έγγραφο επαφής και θα το έγραφε
 * αλλιώς δεύτερη φορά, ζει εδώ: όνομα εμφάνισης, λίστα email, κύριο τηλέφωνο, ΑΦΜ.
 *
 * ⚠️ Γιατί δεν είναι το `getContactDisplayName` του `types/contacts/helpers`:
 *
 * Εκείνο δέχεται τυποποιημένο `Contact` και βασίζεται σε type guards
 * (`isIndividualContact` κ.λπ.) — δηλαδή προϋποθέτει ότι το έγγραφο έχει ήδη
 * περάσει από το επίπεδο τύπων του πελάτη. Οι διαδρομές Admin SDK διαβάζουν
 * `DocumentData`: ωμό, χωρίς εγγυήσεις σχήματος, **και με legacy πεδία που η
 * τυποποιημένη εκδοχή δεν γνωρίζει** (`tradeName` για εταιρεία, `companyName` ως
 * εφεδρεία για υπηρεσία). Το να περάσει ωμό έγγραφο στην τυποποιημένη συνάρτηση
 * θα έδινε κενό όνομα ακριβώς στις παλιές εγγραφές που χρειάζονται την εφεδρεία.
 *
 * Δύο επίπεδα, δύο συναρτήσεις — **σκόπιμα**. Αυτό που ΔΕΝ επιτρέπεται είναι
 * τρίτο αντίγραφο: αυτή η λογική ήταν γραμμένη δύο φορές βυτε-για-βυτε
 * (`search-for-share` + `[contactId]/channels`, CHECK 3.28: 13 γραμμές / 97
 * tokens). Αν χρειαστείς άλλη εφεδρεία, πρόσθεσέ την **εδώ**.
 *
 * @module server/lib/contact-doc-fields
 */

import 'server-only';

import { isEmailType, type EmailType } from '@/lib/contact/email-type-vocabulary';

/**
 * Το όνομα που βλέπει ο άνθρωπος για μια επαφή, από το ωμό έγγραφό της.
 *
 * Η σειρά των εφεδρειών ανά τύπο δεν είναι αυθαίρετη — είναι η σειρά με την
 * οποία γέμισαν ιστορικά τα πεδία:
 * - `company` → επωνυμία, αλλιώς διακριτικός τίτλος
 * - `service` → όνομα υπηρεσίας, αλλιώς η επωνυμία που κουβαλούσαν οι παλιές
 *   εγγραφές υπηρεσιών πριν αποκτήσουν δικό τους πεδίο
 * - οτιδήποτε άλλο → «Όνομα Επώνυμο», τριμμένο ώστε το μισογεμάτο έγγραφο να
 *   δίνει το ένα από τα δύο και όχι κενό με κενό ανάμεσα
 *
 * Επιστρέφει `''` όταν δεν υπάρχει τίποτα αναγνώσιμο — ο καλών αποφασίζει τι
 * εμφανίζει στη θέση του (η επιλογή είναι ζήτημα i18n, όχι δεδομένων).
 */
export function extractContactDisplayName(data: FirebaseFirestore.DocumentData): string {
  if (data.type === 'company') {
    return String(data.companyName ?? data.tradeName ?? '');
  }
  if (data.type === 'service') {
    return String(data.serviceName ?? data.companyName ?? '');
  }

  const first = String(data.firstName ?? '');
  const last = String(data.lastName ?? '');
  return `${first} ${last}`.trim();
}

/** Μη κενό κείμενο, αλλιώς `null`. */
function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Το **κύριο** τηλέφωνο της επαφής από το ωμό έγγραφο — ίδια σειρά με το τυποποιημένο `getPrimaryPhone`
 * (`types/contacts/helpers`): το σημειωμένο κύριο → το πρώτο → τα παλιά πεδία υπηρεσίας. `null` = κανένα.
 * Εγγραφή λίστας: `number`, αλλιώς το παλιό `phone` (επαφές που έγραψε το ai-pipeline πριν από το ADR-326).
 */
export function extractContactPrimaryPhone(data: FirebaseFirestore.DocumentData): string | null {
  const phones: readonly Record<string, unknown>[] = Array.isArray(data.phones) ? data.phones : [];
  const entryNumber = (p: Record<string, unknown>): string | null => textOrNull(p?.number) ?? textOrNull(p?.phone);
  const numbered = phones.filter((p) => entryNumber(p) !== null);
  const chosen = numbered.find((p) => p.isPrimary === true) ?? numbered[0];
  if (chosen) return entryNumber(chosen);
  return textOrNull(data.phone) ?? textOrNull(data.telephone) ?? textOrNull(data.centralPhone);
}

/** Ο ΑΦΜ της επαφής από το ωμό έγγραφο — `vatNumber`, αλλιώς το παλιό `taxNumber` (`@deprecated`). `null` = κανένας. */
export function extractContactVatNumber(data: FirebaseFirestore.DocumentData): string | null {
  return textOrNull(data.vatNumber) ?? textOrNull(data.taxNumber);
}

/** Μια εγγραφή email επαφής, κανονικοποιημένη από ωμό `DocumentData`. */
export interface ContactEmailEntry {
  readonly email: string;
  /** Ρίζα `EmailType` — άγνωστη αποθηκευμένη τιμή ⇒ `other` (ADR-327 §8.5.4). */
  readonly type: EmailType;
  readonly isPrimary: boolean;
}

/**
 * Τα **έγκυρα** email μιας επαφής από το ωμό έγγραφό της.
 *
 * «Έγκυρο» εδώ σημαίνει μόνο *υπαρκτό και μη κενό* — όχι συντακτικά ορθό. Ο
 * έλεγχος μορφής ανήκει στην εγγραφή· εδώ διαβάζουμε ό,τι έχει ήδη γραφτεί, και
 * μια παλιά εγγραφή με στραβό email πρέπει να **φαίνεται** ώστε να διορθωθεί,
 * όχι να εξαφανίζεται σιωπηλά από τις λίστες.
 *
 * ⚠️ Ήταν γραμμένο δύο φορές με **δύο σχήματα εξόδου** (`ShareableEmail` στο
 * search-for-share, `AvailableChannel` στο channels) — ίδια σάρωση, ίδιο φίλτρο,
 * διαφορετικό τελικό σχήμα. Το σχήμα ανήκει στον καλούντα· η **σάρωση** εδώ.
 * Χαρτογράφησε το αποτέλεσμα, μην ξαναγράψεις το φίλτρο.
 */
export function extractContactEmails(
  data: FirebaseFirestore.DocumentData,
): readonly ContactEmailEntry[] {
  const emails = data.emails;
  if (!Array.isArray(emails)) return [];

  return emails
    .filter((e: Record<string, unknown>) => typeof e?.email === 'string' && e.email.length > 0)
    .map((e: Record<string, unknown>) => ({
      email: String(e.email),
      type: isEmailType(e.type) ? e.type : 'other',
      isPrimary: Boolean(e.isPrimary),
    }));
}
