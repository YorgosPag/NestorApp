/**
 * @fileoverview **ΑΡΙΘΜΟΣ ΜΟΝΑΔΑΣ** — η «πόρτα» μέσα στο κτίριο (Α1, Β2, 12) · ADR-900 §8 #2 (2β.2).
 * @module lib/geo/unit-number
 *
 * 🔑 Πρότυπο των μεγάλων: **RESO Data Dictionary `UnitNumber`** (String, ≤25 — «APT G», «55»· συνώνυμα
 * ApartmentNumber / Suite) που τρέφει το Zillow · idealista `puerta` · UK AddressBase SAO («Flat 2»).
 *
 * ⚠️ **Γιατί `unitNumber` και όχι `door`**: στο έργο το «door» σημαίνει ήδη **πόρτα εισόδου** στη ροή
 * (`property-market:offer.door`, ADR-900 §3.7) και `PropertyDossierDoor` / `LocationDoor`. Δύο έννοιες
 * με ένα όνομα είναι το σχήμα του ADR-749.
 *
 * Εδώ ζει η **εμφάνιση** (πελάτης + server): ό,τι έγραψε ο άνθρωπος, καθαρισμένο. Η **σύγκριση**
 * (ελληνικό «Α1» ≡ λατινικό «A1») ζει στο κλειδί μονάδας, με τον σκελετό UTS #39
 * (`lib/unicode/skeleton.ts`, server-only) — **ποτέ** εδώ, γιατί ο σκελετός δεν δείχνεται σε άνθρωπο.
 */

/** RESO `UnitNumber` — «Max Length Suggested: 25». */
export const UNIT_NUMBER_MAX_LENGTH = 25;

/** Διαχωριστικά που δεν φέρουν πληροφορία ανάμεσα σε γράμμα και ψηφίο («Α-1» · «Α 1» · «Α.1»). */
const INNER_SEPARATORS = /(?<=[\p{L}\p{N}])[\s.\-_/]+(?=[\p{L}\p{N}])/gu;

/**
 * Ο **ένας** κανονικοποιητής: NFC · trim · κεφαλαία (ελληνική τοπική ρύθμιση) · χωρίς διαχωριστικά.
 * Κενό ⇒ `null` (ποτέ κενή συμβολοσειρά, που διαβάζεται ως «δηλώθηκε κενό»).
 * Πάνω από {@link UNIT_NUMBER_MAX_LENGTH} ⇒ `null` — δεν είναι αριθμός μονάδας, είναι κείμενο.
 */
export function normalizeUnitNumber(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const value = String(raw)
    .normalize('NFC')
    .trim()
    .toLocaleUpperCase('el')
    .replace(INNER_SEPARATORS, '');
  if (value === '' || value.length > UNIT_NUMBER_MAX_LENGTH) return null;
  return value;
}
