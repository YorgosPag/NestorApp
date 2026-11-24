/**
 * @fileoverview **ΕΝΑ ΤΗΛΕΦΩΝΟ, ΜΙΑ ΜΟΡΦΗ** — ο κανονικοποιητής E.164 (ADR-841 §7 Α21.16).
 * @related lib/contact/channel-email.ts (το αδελφό του) · utils/contacts/formatPhoneDisplay.ts
 * @module lib/contact/channel-phone
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΒΙΒΛΙΟΘΗΚΗ ΚΑΙ ΟΧΙ REGEX
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `2310 123456` · `+30 2310123456` · `0030-2310-123456` · `(2310) 12 34 56` είναι **ο ίδιος
 * αριθμός**, και ο κανόνας για το ποιο είναι έγκυρο αλλάζει ανά χώρα και ανά χρόνο (οι
 * ελληνικοί αριθμοί άλλαξαν μορφή το 2002). Το `libphonenumber-js` (MIT) μεταφέρει τα
 * metadata της Google `libphonenumber` — την ίδια πηγή που χρησιμοποιούν Android και Gmail.
 * Ένα χειρόγραφο regex θα ήταν **δεύτερος, χειρότερος** ορισμός του «τι είναι τηλέφωνο».
 *
 * ⚠️ **ΠΟΤΕ ΣΤΗ ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ** (~80 KB metadata): το εισάγουν ο διακομιστής και η φόρμα
 * ρυθμίσεων. Ο επισκέπτης παίρνει έτοιμο `display` + `href` από το reveal.
 *
 * ⚠️ **Διαφορά με το `formatPhoneDisplay`**: εκείνο εμφανίζει **ό,τι αποθηκεύτηκε** στις
 * Επαφές (`PhoneInfo`, ελεύθερο κείμενο)· αυτό **κρίνει και κανονικοποιεί** πριν από
 * δημόσια δημοσίευση. Άλλη ερώτηση, άλλο σύνορο.
 */

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

/** Η χώρα που υπονοείται όταν ο αριθμός γράφτηκε **χωρίς** `+`. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'GR';

export type PhoneDefect = 'phone-empty' | 'phone-invalid';

export type NormalisedPhone =
  | { readonly ok: true; readonly e164: string; readonly display: string; readonly href: string }
  | { readonly ok: false; readonly defect: PhoneDefect };

/**
 * **Είναι αριθμός τηλεφώνου;** — και αν ναι, σε ποια κανονική μορφή.
 *
 * 🔑 `isValid()` και όχι `isPossible()`: το δεύτερο ελέγχει μόνο **μήκος**, και ένα
 * `2999999999` θα περνούσε — αριθμός που **δεν μπορεί** να καλεστεί, σε δημόσια κάρτα.
 */
export function normalisePhone(raw: string, country: CountryCode = DEFAULT_PHONE_COUNTRY): NormalisedPhone {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, defect: 'phone-empty' };

  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (parsed === undefined || !parsed.isValid()) return { ok: false, defect: 'phone-invalid' };

  return { ok: true, e164: parsed.number, display: parsed.formatInternational(), href: parsed.getURI() };
}

/**
 * **Ένας αριθμός → όπως τον διαβάζει άνθρωπος της χώρας του** (ADR-950 §8.12): εθνική μορφή για αριθμό της
 * `country` (`+302310559595` ⇒ `231 055 9595`), διεθνής για ξένο (`+359 74 520 126`) — αλλιώς ο ξένος θα έχανε τον
 * κωδικό του. Ίδια σύμβαση με το τηλεφωνητή του Android / τις Επαφές Google (ίδια metadata). `null` = μη έγκυρος.
 *
 * Μόνο **προβολή**: η αποθηκευμένη και συγκρινόμενη μορφή μένει το E.164 του `normalisePhone`.
 */
export function readablePhone(raw: string, country: CountryCode = DEFAULT_PHONE_COUNTRY): string | null {
  const parsed = parsePhoneNumberFromString(raw.trim(), country);
  if (parsed === undefined || !parsed.isValid()) return null;
  return parsed.country === country ? parsed.formatNational() : parsed.formatInternational();
}

/**
 * **Ποιος είναι ο κωδικός χώρας ενός διεθνούς αριθμού;** — `+359 74520126` ⇒ `{ +359, 74520126 }`.
 *
 * 🔴 Ζούσε ως χειρόγραφος πίνακας ~120 κωδικών (CC3/CC2/1-ψήφιοι) στο `parsePhoneForStorage` του
 * ai-pipeline (ADR-327 §8.5.4 ☎️#3): δεύτερος ορισμός του «τι είναι κωδικός χώρας», που δεν ήξερε
 * π.χ. το `+383` (Κόσοβο) ή το `+1 868`. Τα metadata της βιβλιοθήκης είναι η ΜΙΑ αλήθεια.
 *
 * Δεν απαιτεί **έγκυρο** αριθμό (`isValid`): η διάσπαση είναι ερώτηση σχήματος, όχι κρίσης — ο
 * γραφέας αποθηκεύει ό,τι έστειλε ο άνθρωπος. `null` ⇒ δεν αναγνωρίζεται κωδικός χώρας.
 */
export function splitCountryCallingCode(
  international: string,
): { readonly countryCode: string; readonly number: string } | null {
  const parsed = parsePhoneNumberFromString(international);
  if (parsed === undefined || parsed.nationalNumber === '') return null;
  return { countryCode: `+${parsed.countryCallingCode}`, number: parsed.nationalNumber };
}

/**
 * **Ένας αποθηκευμένος E.164 → ό,τι βλέπει ο επισκέπτης.** `null` αν ο δίσκος κρατά
 * σκουπίδι — ο αναγνώστης δεν ζωγραφίζει αριθμό που δεν μπορεί να καλεστεί.
 */
export function revealablePhone(
  e164: string,
  extension: string | null,
): { readonly display: string; readonly href: string } | null {
  const normalised = normalisePhone(e164);
  if (!normalised.ok) return null;
  const ext = extension?.trim() ?? '';
  return ext === ''
    ? { display: normalised.display, href: normalised.href }
    : { display: `${normalised.display} (${ext})`, href: `${normalised.href};ext=${encodeURIComponent(ext)}` };
}
