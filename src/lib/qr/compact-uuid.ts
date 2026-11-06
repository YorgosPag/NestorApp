/**
 * =============================================================================
 * Ο ΣΥΜΠΑΓΗΣ UUID ΓΙΑ QR (ADR-923 Ν10 α) — 128 bit σε 26 χαρακτήρες Crockford base32, μόνο `[0-9A-Z]`
 * =============================================================================
 *
 * 🔑 **Γιατί κεφαλαία**: το QR έχει **αλφαριθμητική λειτουργία** (ISO/IEC 18004 §7.4.4) για `0-9 A-Z $%*+-./:` και κενό,
 *    με 5,5 bit ανά χαρακτήρα αντί για 8. Μια διεύθυνση γραμμένη ολόκληρη σε αυτό το σύνολο πέφτει δύο εκδόσεις
 *    (μετρημένο: `/q/cprod_<uuid>` 71 χαρ. = v6, 41 μονάδες · συμπαγής 56 χαρ. = v4, 33 μονάδες). Στο ίδιο εμβαδόν η μονάδα
 *    μένει στον **στόχο** του GS1 (0,495 mm) αντί να πέσει κοντά στο ελάχιστο (0,396 mm).
 * 🔑 **Crockford**: χωρίς `I L O U`, άρα κανένα γράμμα δεν μοιάζει με ψηφίο (για τον άνθρωπο που διαβάζει την ετικέτα).
 * 🔒 **Μία μορφή ανά uuid**: η αποκωδικοποίηση δέχεται μόνο την κανονική γραφή (κεφαλαία, χωρίς ψευδώνυμα `I→1`, με τα δύο
 *    bit συμπλήρωσης στο μηδέν). Δύο κείμενα για το ίδιο id θα ήταν δύο κλειδιά μνήμης για τον ίδιο πόρο.
 * 🔑 Καμία αποθήκευση: η αντιστοίχιση είναι **αντιστρέψιμη**, άρα δεν υπάρχει πίνακας σύντομων κωδικών να χαθεί ή να
 *    αποκλίνει από το χαρτί που ζει χρόνια.
 *
 * @module lib/qr/compact-uuid
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Ο πρώτος χαρακτήρας κρατά 3 bit (τα δύο ανώτερα είναι συμπλήρωση, πάντα μηδέν), οι υπόλοιποι 25 από 5: 3 + 125 = 128. */
const COMPACT_SHAPE = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/** Μήκος της συμπαγούς μορφής: ⌈128 / 5⌉. */
export const COMPACT_UUID_LENGTH = 26;

/** `uuid` (πεζά, με παύλες) → 26 χαρακτήρες. `null` όταν η τιμή δεν είναι uuid: ο καλών κρατά την παλιά μορφή. */
export function compactUuidOf(uuid: string): string | null {
  if (!UUID_SHAPE.test(uuid)) return null;
  let buffer = 0;
  let bits = 2; // δύο μηδενικά bit συμπλήρωσης μπροστά: 130 = 26 × 5
  let out = '';
  for (const nibble of uuid.replace(/-/g, '')) {
    buffer = (buffer << 4) | Number.parseInt(nibble, 16);
    bits += 4;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(buffer >> bits) & 31];
    }
    buffer &= (1 << bits) - 1;
  }
  return out;
}

/** 26 χαρακτήρες → `uuid` (πεζά, με παύλες). `null` για κάθε μη κανονική γραφή. */
export function uuidOfCompact(code: string): string | null {
  if (!COMPACT_SHAPE.test(code)) return null;
  let buffer = ALPHABET.indexOf(code[0]);
  let bits = 3;
  let hex = '';
  for (const char of code.slice(1)) {
    buffer = (buffer << 5) | ALPHABET.indexOf(char);
    bits += 5;
    while (bits >= 4) {
      bits -= 4;
      hex += ((buffer >> bits) & 15).toString(16);
    }
    buffer &= (1 << bits) - 1;
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
