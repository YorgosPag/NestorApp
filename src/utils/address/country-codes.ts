/**
 * =============================================================================
 * COUNTRY CODE SSoT — όνομα χώρας ➜ ISO 3166-1 alpha-2 (ADR-332)
 * =============================================================================
 *
 * ΓΙΑΤΙ ΕΝΑ ΣΗΜΕΙΟ
 * Το ίδιο ερώτημα («είναι ελληνική αυτή η διεύθυνση;») απαντιόταν σε δύο θέσεις
 * με διαφορετικό λεξιλόγιο:
 *   - `geocoding-engine.ts` — πλήρης χάρτης 13 χωρών, accent-insensitive index.
 *   - `AddressWithHierarchy.tsx` — inline αλυσίδα `||` με 6 τιμές γραμμένες στο χέρι.
 * Κάθε νέα ορθογραφία («ΕΛΛΑΣ», NFD από clipboard macOS) έπρεπε να προστεθεί και
 * στα δύο· μια ξεχασμένη προσθήκη περνούσε **αθόρυβα** και άλλαζε συμπεριφορά
 * (ο engine περιόριζε τη χώρα, το UI όχι — ή το ανάποδο).
 *
 * Η κανονικοποίηση γίνεται με `normalizeGreekText` (lowercase + NFD strip), οπότε
 * καταχωρήσεις που διαφέρουν μόνο σε τόνο συμπίπτουν στο ίδιο κλειδί: ο χάρτης
 * παρακάτω μένει αναγνώσιμος, το ευρετήριο κάνει τη δουλειά.
 *
 * @module utils/address/country-codes
 * @see ADR-332 D12 — ακεραιότητα χώρας στο geocoding
 */

import { normalizeGreekText } from '@/utils/greek-text';

/** ISO 3166-1 alpha-2 της Ελλάδας — το κλειδί κάθε «ελληνικού» κανόνα. */
export const GREECE_COUNTRY_CODE = 'gr';

/**
 * Ονόματα/κωδικοί χωρών που δέχεται η εφαρμογή ➜ ISO alpha-2.
 * Καλύπτει τις χώρες που εμφανίζονται ρεαλιστικά σε ελληνικό μητρώο επαφών.
 */
const COUNTRY_CODE_MAP: Record<string, string> = {
  gr: 'gr', bg: 'bg', cy: 'cy', al: 'al', mk: 'mk', ro: 'ro',
  de: 'de', it: 'it', fr: 'fr', gb: 'gb', uk: 'gb', tr: 'tr', rs: 'rs',
  greece: 'gr', 'ελλάδα': 'gr', 'ελλας': 'gr', hellas: 'gr',
  bulgaria: 'bg', 'βουλγαρία': 'bg', 'βουλγαρια': 'bg',
  cyprus: 'cy', 'κύπρος': 'cy', 'κυπρος': 'cy',
  albania: 'al', 'αλβανία': 'al', 'north macedonia': 'mk', 'βόρεια μακεδονία': 'mk',
  romania: 'ro', 'ρουμανία': 'ro', germany: 'de', 'γερμανία': 'de',
  italy: 'it', 'ιταλία': 'it', france: 'fr', 'γαλλία': 'fr',
  'united kingdom': 'gb', turkey: 'tr', 'τουρκία': 'tr', serbia: 'rs',
};

/**
 * Accent- και case-insensitive ευρετήριο πάνω στον {@link COUNTRY_CODE_MAP}.
 *
 * Το όνομα χώρας φτάνει από πληκτρολόγηση, από επικόλληση και από αποθηκευμένη
 * εγγραφή: «Ελλάδα», «ΕΛΛΑΔΑ» και η αποσυντεθειμένη (NFD) μορφή δηλώνουν την ίδια
 * χώρα, αλλά μόνο η πρώτη ταίριαζε σε σκέτο `toLowerCase()`.
 */
const COUNTRY_CODE_INDEX: ReadonlyMap<string, string> = new Map(
  Object.entries(COUNTRY_CODE_MAP).map(([name, code]) => [normalizeGreekText(name), code]),
);

/** ISO alpha-2 για το δοσμένο όνομα/κωδικό χώρας, ή `null` αν είναι άγνωστο. */
export function countryNameToCode(country: string | undefined | null): string | null {
  if (!country) return null;
  return COUNTRY_CODE_INDEX.get(normalizeGreekText(country.trim())) ?? null;
}

/**
 * Είναι ελληνική η διεύθυνση με αυτή τη χώρα;
 *
 * **Η κενή χώρα μετράει ως ελληνική**: η φόρμα ξεκινά με κενό πεδίο και ο χρήστης
 * σπάνια το συμπληρώνει για εγχώρια διεύθυνση. Αν το κενό μετρούσε ως «ξένη», η
 * ελληνική ιεραρχία και η μάσκα Τ.Κ. θα έσβηναν στην πιο συνηθισμένη περίπτωση.
 */
export function isGreekAddressCountry(country: string | undefined | null): boolean {
  const trimmed = country?.trim();
  if (!trimmed) return true;
  return countryNameToCode(trimmed) === GREECE_COUNTRY_CODE;
}
