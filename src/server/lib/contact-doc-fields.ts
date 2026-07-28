/**
 * 🏢 SSoT — ανάγνωση πεδίων επαφής **από ωμό έγγραφο Firestore** (Admin SDK).
 *
 * Ό,τι διαβάζει μια διαδρομή Admin SDK από έγγραφο επαφής και θα το έγραφε
 * αλλιώς δεύτερη φορά, ζει εδώ: όνομα εμφάνισης, λίστα email.
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

/** Μια εγγραφή email επαφής, κανονικοποιημένη από ωμό `DocumentData`. */
export interface ContactEmailEntry {
  readonly email: string;
  readonly type: string;
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
      type: String(e.type ?? 'other'),
      isPrimary: Boolean(e.isPrimary),
    }));
}
