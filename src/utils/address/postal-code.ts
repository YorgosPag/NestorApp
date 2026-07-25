/**
 * =============================================================================
 * ΤΑΧΥΔΡΟΜΙΚΟΣ ΚΩΔΙΚΑΣ — SSoT κανονικοποίησης / μορφοποίησης / επικύρωσης
 * =============================================================================
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ (μετρημένο 2026-07-26)
 * Ο χρήστης πληκτρολογούσε `54624` και στο Firestore κατέληγε **«546 24»**. Η
 * μορφή με κενό είναι η **επίσημη** ελληνική (ΕΛΤΑ) — άρα δεν ήταν αλλοίωση,
 * ήταν **ασυνέπεια**: η ίδια τιμή υπήρχε σε δύο μορφές και κάθε σύγκριση έσπαγε.
 *
 * Τεκμήρια ότι έσπαγε ήδη ζωντανά:
 *   - `public/data/administrative-hierarchy.json`: **949 οικισμοί με Τ.Κ., 0 με
 *     κενό** ⇒ `findSettlementsByPostalCode("546 24")` δεν βρίσκει ΠΟΤΕ τίποτα.
 *   - `/^[1-9]\d{4}$/` (postalCodeAutoFill, validateGreekHierarchy) και
 *     `/^\d{5}$/` (validateAddress) **απέρριπταν** τιμές που ήταν ήδη στη βάση.
 *   - Το badge «Τ.Κ. ταιριάζει» συνέκρινε «54624» με «546 24» ⇒ πάντα mismatch.
 *
 * Η ΑΠΟΦΑΣΗ (ADR-332 D16)
 * **Κανονική μορφή στη βάση** (5 ψηφία, χωρίς κενό) = κλειδί σύγκρισης και
 * αναζήτησης. **Μορφοποίηση μόνο στην οθόνη**. Η μάσκα είναι εμφάνιση· τα σύμβολά
 * της δεν αποθηκεύονται ποτέ — η καθιερωμένη πρακτική για μορφοποιημένα πεδία.
 *
 * ⚠️ ΞΕΝΟΙ Τ.Κ. ΜΕΝΟΥΝ ΑΝΕΠΑΦΟΙ
 * Κάθε συνάρτηση εδώ επιστρέφει την τιμή **αυτούσια** όταν δεν έχει σχήμα
 * ελληνικού Τ.Κ. Ένα τυφλό `replace(/\s/g, '')` θα μετέτρεπε το βρετανικό
 * `SW1A 1AA` σε `SW1A1AA`, και ένα τυφλό `replace(/\D/g, '')` σε `11`.
 *
 * @module utils/address/postal-code
 * @see ADR-332 D16 — κανονικός Τ.Κ. στη βάση, μάσκα στην οθόνη
 */

/** Έγκυρος ελληνικός Τ.Κ. σε κανονική μορφή: 5 ψηφία, πρώτο 1-9. */
const GREEK_POSTAL_CANONICAL = /^[1-9]\d{4}$/;

/** Επίσημη μορφή ΕΛΤΑ με κενό — «546 24». */
const GREEK_POSTAL_SPACED = /^(\d{3})\s(\d{2})$/;

/** Το μέγιστο πλήθος ψηφίων ελληνικού Τ.Κ. */
const GREEK_POSTAL_DIGITS = 5;

/**
 * Έχει η τιμή σχήμα ελληνικού Τ.Κ. (πλήρους ή υπό πληκτρολόγηση);
 * Μόνο ψηφία και κενά, το πολύ 5 ψηφία. Ό,τι άλλο είναι ξένη μορφή.
 */
function hasGreekPostalShape(value: string): boolean {
  return /^\d{0,5}$/.test(value.replace(/\s/g, ''));
}

/**
 * Κανονική μορφή για **αποθήκευση και σύγκριση**: «546 24» ➜ «54624».
 *
 * Η μετατροπή γίνεται μόνο για την ακριβή μορφή `\d{3} \d{2}`. Οτιδήποτε άλλο
 * (ήδη κανονικό, κενό, ξένος Τ.Κ.) επιστρέφεται όπως ήρθε — με μόνο το `trim`.
 */
export function toCanonicalGreekPostalCode(value: string | undefined | null): string {
  const trimmed = (value ?? '').trim();
  const spaced = GREEK_POSTAL_SPACED.exec(trimmed);
  return spaced ? `${spaced[1]}${spaced[2]}` : trimmed;
}

/**
 * Μορφή **εμφάνισης**: «54624» ➜ «546 24». Λειτουργεί και σε ημιτελή τιμή
 * («5462» ➜ «546 2») ώστε να χρησιμεύει ως μάσκα κατά την πληκτρολόγηση.
 *
 * Επιστρέφει την τιμή ανέπαφη όταν δεν έχει σχήμα ελληνικού Τ.Κ.
 */
export function formatGreekPostalCode(value: string | undefined | null): string {
  const raw = value ?? '';
  const trimmed = raw.trim();
  if (!hasGreekPostalShape(trimmed)) return raw;

  const digits = trimmed.replace(/\D/g, '').slice(0, GREEK_POSTAL_DIGITS);
  return digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
}

/**
 * Μετατρέπει ό,τι πληκτρολόγησε ο χρήστης σε **κανονική τιμή μοντέλου**.
 *
 * Καλείται ΜΟΝΟ όταν η διεύθυνση είναι ελληνική (βλ. `isGreekAddressCountry`):
 * κρατά μόνο ψηφία, το πολύ 5. Έτσι το backspace πάνω στη μάσκα δουλεύει σωστά —
 * «546 24» ➜ «546 2» ➜ μοντέλο «5462» ➜ οθόνη «546 2».
 */
export function parseGreekPostalCodeInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, GREEK_POSTAL_DIGITS);
}

/**
 * Έγκυρος ελληνικός Τ.Κ.; Δέχεται **και τις δύο** μορφές — κανονικοποιεί πρώτα.
 * Έτσι παλιά αποθηκευμένη τιμή με κενό δεν αποτυγχάνει πριν προλάβει η μετάπτωση.
 */
export function isValidGreekPostalCode(value: string | undefined | null): boolean {
  return GREEK_POSTAL_CANONICAL.test(toCanonicalGreekPostalCode(value));
}

/**
 * Εμφανίζεται ο Τ.Κ. μέσα σε ελεύθερο κείμενο, ανεξάρτητα από μορφή;
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `display_name` του Nominatim γράφει τον ελληνικό Τ.Κ. **με
 * κενό**. Μόλις το ερώτημα άρχισε να στέλνει κανονική τιμή, ένα σκέτο
 * `display.includes(postalCode)` θα έχανε το ταίριασμα και θα έριχνε την
 * εμπιστοσύνη του αποτελέσματος — παλινδρόμηση από τη διόρθωση, όχι από τα δεδομένα.
 */
export function postalCodeAppearsIn(haystack: string, postalCode: string | undefined | null): boolean {
  const canonical = toCanonicalGreekPostalCode(postalCode);
  if (!canonical) return false;
  if (haystack.includes(canonical)) return true;

  const formatted = formatGreekPostalCode(canonical);
  return formatted !== canonical && haystack.includes(formatted);
}
