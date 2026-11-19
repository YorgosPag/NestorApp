/**
 * @module utils/contacts/contact-hq-legacy-fields
 * @enterprise ADR-332 §D30 Φάση 2 · ADR-772
 *
 * **Τα κλειδιά διεύθυνσης που ΔΕΝ επιτρέπεται να ζουν στη ρίζα ενός εγγράφου επαφής.**
 *
 * Η έδρα ζει σε **ένα** δοχείο: `customFields.companyAddresses[0]` (αυθεντικό) με παράγωγο το
 * `addresses[]`. Παλαιότερα η φόρμα κρατούσε και **επίπεδα** πεδία (`street`, `neighborhood`, …),
 * και η διαδρομή ενημέρωσης τα άφηνε να πέφτουν στη ρίζα του εγγράφου, με εξαίρεση τέσσερα
 * (μετρημένο στην `cont_c4d79d09…`: top-level `neighborhood`). Αυτό το σύνολο είναι:
 * - το **σύνορο** του saver (κανένα από αυτά δεν φεύγει ποτέ προς τη ρίζα),
 * - ο κατάλογος του **repair-on-write** και του backfill (τι σβήνεται από παλαιά έγγραφα).
 *
 * 🔑 **Δεν γράφεται με το χέρι.** Παράγεται από το λεξιλόγιο `contactFlat` του πίνακα ADR-772, ώστε
 * νέο πεδίο του λεξιλογίου να μπαίνει αυτόματα στο σύνορο. Οι δύο χειρόγραφες λίστες που υπήρχαν
 * (`convertToEnterpriseStructure`: 4 κλειδιά, `updateExistingContact`: 13) είχαν αποκλίνει **και οι δύο**.
 *
 * ⚠️ Το λεξιλόγιο `contactFlat` επιβιώνει **μόνο** ως αναγνώστης παλαιών εγγράφων (tolerant reader).
 * Όταν το backfill μετρήσει 0 έγγραφα παλαιού σχήματος, φεύγει μαζί με αυτό το αρχείο (contract).
 */

import {
  ADMIN_LEVEL_VOCABULARY,
  HIERARCHY_ADJACENT_VOCABULARY,
  NOT_STORED,
  POSTAL_FIELD_VOCABULARY,
} from '@/utils/address/administrative-hierarchy-vocabulary';

/**
 * Κλειδιά της παλιάς φόρμας που δεν ανήκουν στο λεξιλόγιο του πίνακα: η χώρα, ο τύπος και η
 * ελεύθερη ετικέτα της έδρας (σήμερα ζουν στην ίδια την εγγραφή: `country` · `type` · `customLabel`).
 */
const HQ_META_FIELDS = ['hqAddressCountry', 'primaryAddressType', 'primaryAddressCustomLabel'] as const;

function slotNames(slot: readonly string[] | typeof NOT_STORED): readonly string[] {
  return slot === NOT_STORED ? [] : slot;
}

function collectLegacyRootFields(): readonly string[] {
  const keys = new Set<string>();
  for (const binding of Object.values(ADMIN_LEVEL_VOCABULARY)) {
    for (const key of slotNames(binding.contactFlat.name)) keys.add(key);
    for (const key of slotNames(binding.contactFlat.id)) keys.add(key);
  }
  for (const binding of [...Object.values(POSTAL_FIELD_VOCABULARY), ...Object.values(HIERARCHY_ADJACENT_VOCABULARY)]) {
    for (const key of slotNames(binding.contactFlat)) keys.add(key);
  }
  for (const key of HQ_META_FIELDS) keys.add(key);
  return Object.freeze([...keys]);
}

/** Κάθε κλειδί διεύθυνσης έδρας που δεν έχει θέση στη ρίζα του εγγράφου επαφής. */
export const LEGACY_ROOT_ADDRESS_FIELDS: readonly string[] = collectLegacyRootFields();

/** Αντίγραφο του `record` χωρίς κανένα κλειδί διεύθυνσης ρίζας (καθαρή συνάρτηση). */
export function withoutLegacyRootAddressFields<T extends Record<string, unknown>>(record: T): T {
  const result: Record<string, unknown> = { ...record };
  for (const key of LEGACY_ROOT_ADDRESS_FIELDS) delete result[key];
  return result as T;
}

/** Τα κλειδιά διεύθυνσης που **υπάρχουν** (με περιεχόμενο ή όχι) στη ρίζα ενός αποθηκευμένου εγγράφου. */
export function presentLegacyRootAddressFields(doc: Readonly<Record<string, unknown>>): string[] {
  return LEGACY_ROOT_ADDRESS_FIELDS.filter((key) => Object.prototype.hasOwnProperty.call(doc, key));
}

function hasEntries(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** Ζει η διεύθυνση του εγγράφου **κάπου αλλού** εκτός από τη ρίζα — πριν ή μετά από αυτή την εγγραφή; */
function addressLivesOutsideRoot(
  existing: Readonly<Record<string, unknown>>,
  payload: Readonly<Record<string, unknown>>,
): boolean {
  const existingCustom = existing.customFields as Readonly<Record<string, unknown>> | undefined;
  const payloadCustom = payload.customFields as Readonly<Record<string, unknown>> | undefined;
  return hasEntries(existingCustom?.companyAddresses)
    || hasEntries(existing.addresses)
    // Η αποθήκευση γράφει ρητά τη λίστα (ακόμη και κενή = «ο άνθρωπος καθάρισε»): η λίστα αποφασίζει.
    || Array.isArray(payloadCustom?.companyAddresses);
}

/**
 * **Repair-on-write** (ADR-332 §D30 Φάση 2): τα κλειδιά διεύθυνσης που ένα παλαιό έγγραφο κρατά
 * στη ρίζα, ως `null` — ο καθαριστής ενημέρωσης (`sanitizeContactForUpdate`) τα κάνει `deleteField()`.
 *
 * Ιδεμποτεντικό: έγγραφο χωρίς τέτοια κλειδιά ⇒ κενό patch. 🔴 **Ποτέ η μόνη αντιγραφή**: αν η
 * διεύθυνση ζει **μόνο** στη ρίζα (πολύ παλιό έγγραφο, χωρίς λίστα ή `addresses[]`) και αυτή η
 * εγγραφή δεν γράφει λίστα, τίποτα δεν σβήνεται — τη μετακινεί το backfill ή η πρώτη αποθήκευση έδρας.
 */
export function legacyRootAddressRepairPatch(
  existing: Readonly<Record<string, unknown>>,
  payload: Readonly<Record<string, unknown>>,
): Record<string, null> {
  const present = presentLegacyRootAddressFields(existing);
  if (present.length === 0 || !addressLivesOutsideRoot(existing, payload)) return {};
  return Object.fromEntries(present.map((key) => [key, null]));
}
