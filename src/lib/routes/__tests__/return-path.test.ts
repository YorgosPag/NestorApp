/**
 * @jest-environment node
 *
 * Άγκυρα — **Ο ΦΡΟΥΡΟΣ ΤΟΥ `?next=`** (ADR-848)
 *
 * Κάθε γραμμή του πίνακα απόρριψης είναι **γνωστή τεχνική ανοιχτής ανακατεύθυνσης**
 * (OWASP · Unvalidated Redirects and Forwards). Κάθε γραμμή του πίνακα αποδοχής είναι
 * **πραγματικός** προορισμός του έργου — ένας φρουρός που απορρίπτει και το νόμιμο
 * δεν είναι φρουρός, είναι κλειδαριά.
 *
 * ⚠️ Οι ειδικοί χαρακτήρες γράφονται με `String.fromCharCode`, όχι με escape μέσα σε
 * συμβολοσειρά: ένα ωμό tab ή NUL μέσα στο αρχείο θα ήταν αόρατο στην ανάγνωση.
 *
 * @see lib/routes/return-path
 */

import { loginHref, RETURN_PATH_PARAM, safeReturnPath } from '@/lib/routes/return-path';

const BACKSLASH = String.fromCharCode(92);
const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);

/** Το `next` όπως θα το διάβαζε η σελίδα σύνδεσης. */
function nextOf(href: string): string | null {
  return new URLSearchParams(href.slice(href.indexOf('?') + 1)).get(RETURN_PATH_PARAM);
}

// ============================================================================
// Α — ΑΠΟΡΡΙΨΗ
// ============================================================================

describe('Α — απορρίπτει κάθε τιμή που δηλώνει ΔΙΚΟ της σπίτι', () => {
  it.each([
    ['//evil.example', 'protocol-relative'],
    [`/${BACKSLASH}evil.example`, 'backslash — ο φυλλομετρητής το διαβάζει ως /'],
    [`${BACKSLASH}${BACKSLASH}evil.example`, 'διπλό backslash χωρίς κάθετο'],
    ['/%2F%2Fevil.example', 'κωδικοποιημένο // — αποκωδικοποιείται αργότερα'],
    ['/%5Cevil.example', 'κωδικοποιημένο backslash'],
    ['/%09/evil.example', 'κωδικοποιημένο tab, που ο φυλλομετρητής πετά'],
    [`/${TAB}/evil.example`, 'ωμό tab'],
    [`/a${NUL}b`, 'NUL'],
    ['https://evil.example/x', 'απόλυτο URL'],
    ['javascript:alert(1)', 'σχήμα javascript:'],
    ['evil.example/x', 'χωρίς αρχική κάθετο'],
    [' /listings', 'αρχικό κενό'],
    ['/%E0%A4%A', 'χαλασμένη κωδικοποίηση'],
  ])('%s — %s', (raw) => {
    expect(safeReturnPath(raw)).toBeNull();
  });

  it('απορρίπτει ό,τι δεν είναι ΜΙΑ μη κενή συμβολοσειρά', () => {
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(['/a', '/b'])).toBeNull();
    expect(safeReturnPath(42)).toBeNull();
    expect(safeReturnPath('')).toBeNull();
  });

  it('απορρίπτει φορτίο πάνω από 2048 χαρακτήρες', () => {
    expect(safeReturnPath(`/${'a'.repeat(2048)}`)).toBeNull();
  });

  it.each(['/login', '/login?next=/dashboard', '/login/extra'])(
    '%s — βρόχος πίσω στη φόρμα σύνδεσης',
    (raw) => {
      expect(safeReturnPath(raw)).toBeNull();
    },
  );
});

// ============================================================================
// Β — ΑΠΟΔΟΧΗ
// ============================================================================

describe('Β — δέχεται τους ΠΡΑΓΜΑΤΙΚΟΥΣ προορισμούς του έργου', () => {
  it.each([
    ['/n/listing_match%3Au1%3Aev1', '/n/listing_match%3Au1%3Aev1'],
    // 🔑 Η παύλα: ένα regex χαρακτήρων ελέγχου γραμμένο ως εύρος την «έτρωγε»
    //    σιωπηλά — και θα απέρριπτε σχεδόν κάθε ταυτότητα του έργου.
    ['/listings/abc-def', '/listings/abc-def'],
    ['/listings/mandates/prop_1?tab=photos', '/listings/mandates/prop_1?tab=photos'],
    ['/o/nikos/dashboard', '/o/nikos/dashboard'],
    ['/offers/%CE%B1%CE%B2', '/offers/%CE%B1%CE%B2'],
    ['/loginx', '/loginx'],
  ])('%s', (raw, expected) => {
    expect(safeReturnPath(raw)).toBe(expected);
  });

  it('πετά το #hash — δεν φτάνει ποτέ στον διακομιστή', () => {
    expect(safeReturnPath('/listings/abc#photos')).toBe('/listings/abc');
  });
});

// ============================================================================
// Γ — loginHref
// ============================================================================

describe('Γ — loginHref: η σελίδα σύνδεσης, με επιστροφή μόνο όπου είναι ασφαλής', () => {
  it('κωδικοποιεί την επιστροφή στο ?next=', () => {
    expect(loginHref('/n/abc')).toBe(`/login?${RETURN_PATH_PARAM}=%2Fn%2Fabc`);
  });

  it('η επιστροφή επιβιώνει αυτούσια, μαζί με ΔΙΚΟ της ερώτημα', () => {
    expect(nextOf(loginHref('/listings?a=1&b=2'))).toBe('/listings?a=1&b=2');
  });

  it.each([undefined, null, '', '//evil.example', '/login'])(
    '%p ⇒ σκέτο /login, ποτέ σφάλμα',
    (raw) => {
      expect(loginHref(raw)).toBe('/login');
    },
  );

  it('στρογγυλή διαδρομή: ό,τι γράφει το loginHref, το ξαναδέχεται ο φρουρός', () => {
    expect(safeReturnPath(nextOf(loginHref('/n/x%3Ay')))).toBe('/n/x%3Ay');
  });
});
