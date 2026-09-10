/**
 * @module utils/contacts/contact-update-paths
 * @enterprise ADR-332 D27 Βήμα Β-ΙΙ · ADR-323 (dirty diff)
 *
 * **Το `customFields` γράφεται ΚΛΕΙΔΙ-ΚΛΕΙΔΙ, ποτέ ως ολόκληρο αντικείμενο.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — σιωπηλή απώλεια δεδομένων, μετρημένη στον κώδικα (2026-09-11)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `updateDoc(ref, { customFields: {...} })` του Firestore **αντικαθιστά** τον χάρτη —
 * δεν τον συγχωνεύει. Η αποθήκευση όμως στέλνει **dirty diff** (ADR-323): το
 * `collectCompanyCustomFields` βάζει στο `customFields` μόνο ό,τι άγγιξε ο άνθρωπος.
 *
 * ⇒ Αποθήκευση που άλλαξε **μόνο διευθύνσεις** εταιρείας έγραφε
 *   `customFields: { companyAddresses }` και **έσβηνε** ΚΑΔ, επιμελητήριο, ΓΕΜΗ, κεφάλαιο.
 * ⇒ Και όταν σβήνονταν όλες οι διευθύνσεις, το `sanitizeContactForUpdate` έβρισκε τον
 *   χάρτη «κενό» και σημάδευε **ολόκληρο** το `customFields` για `deleteField()`.
 *
 * Εδώ κάθε κλειδί γίνεται **διαδρομή πεδίου** (`customFields.companyAddresses`), η μόνη
 * μορφή που το Firestore ενημερώνει χωρίς να αγγίξει τα αδέλφια. Το κενό κλειδί γίνεται
 * `deleteField()` **στο κλειδί** — ο καθαριστής δουλεύει ήδη ανά κλειδί, αρκεί να του
 * δοθούν κλειδιά.
 *
 * ⚠️ `customFields: null` **δεν** ισοπεδώνεται: είναι ρητή δήλωση «σβήσε τον χάρτη».
 */

const CUSTOM_FIELDS_KEY = 'customFields';

/** Εμφωλευμένος χάρτης του ίδιου αναδρομικού τύπου τιμών (π.χ. `ContactDataRecord`). */
function isNestedRecord<V>(value: V): value is V & Readonly<Record<string, V>> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && !(value instanceof Date);
}

/** `{ customFields: { a, b } }` → `{ 'customFields.a', 'customFields.b' }` — τα υπόλοιπα αυτούσια. */
export function flattenCustomFieldsForUpdate<V>(
  updates: Readonly<Record<string, V>>,
): Record<string, V> {
  const flat: Record<string, V> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (key === CUSTOM_FIELDS_KEY && isNestedRecord(value)) {
      for (const [field, fieldValue] of Object.entries(value)) {
        flat[`${CUSTOM_FIELDS_KEY}.${field}`] = fieldValue;
      }
      continue;
    }
    flat[key] = value;
  }
  return flat;
}
