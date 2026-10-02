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

import { loginHref, loginHrefForCurrentLocation, RETURN_PATH_PARAM, safeReturnPath } from '@/lib/routes/return-path';
import { listRepoSourceFiles, readRepoCode } from '@/test-utils/read-source';

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

describe('Δ — loginHrefForCurrentLocation: ο φρουρός ΠΕΛΑΤΗ επιστρέφει εκεί που ήταν ο άνθρωπος (ADR-900 §3.7)', () => {
  const globals = globalThis as { window?: { location: { pathname: string; search: string } } };
  afterEach(() => {
    delete globals.window;
  });

  it('χωρίς φυλλομετρητή ⇒ σκέτο /login (ποτέ σφάλμα)', () => {
    expect(loginHrefForCurrentLocation()).toBe('/login');
  });

  it('κρατά διαδρομή ΚΑΙ ερώτημα — η διεύθυνση της αρχικής επιβιώνει τη σύνδεση', () => {
    globals.window = { location: { pathname: '/interest-check', search: '?address=%CE%95%CE%B3%CE%BD%CE%B1%CF%84%CE%AF%CE%B1%CF%82' } };
    const href: string = loginHrefForCurrentLocation();
    const next = new URL(href, 'https://example.invalid').searchParams.get(RETURN_PATH_PARAM);
    expect(next).not.toBeNull();
    const back = new URL(next ?? '', 'https://example.invalid');
    expect(back.pathname).toBe('/interest-check');
    expect(back.searchParams.get('address')).toBe('Εγνατίας');
  });
});

// ============================================================================
// Ε — Η ΚΛΑΣΗ: κανένας φρουρός ΧΩΡΙΣ επιστροφή (ADR-848 §9 #3 · ADR-900 §3.7)
// ============================================================================

/**
 * **ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ**: ποιος επιτρέπεται να στείλει άνθρωπο σε **σκέτο** `/login` — και **γιατί**.
 *
 * Το κενό εμφανίστηκε **τέσσερις** φορές (το δίχτυ · το layout του χώρου · `ProtectedRoute` · οι τρεις
 * σελίδες πελάτη του ADR-900), κάθε φορά επειδή ο επόμενος φρουρός αντέγραψε τον προηγούμενο. Εδώ η
 * **κλάση** κλείνει: σκέτη σύνδεση σημαίνει «ο άνθρωπος **θέλει** να φύγει από ό,τι έβλεπε» — και αυτό
 * το λέει κάποιος **γραπτά** (πρότυπο `WAITING_SCREEN_NAVIGATORS` του `landing.test.ts`). Νέα εγγραφή,
 * ακόμα και σωστή, κοκκινίζει ώστε να τη δει άνθρωπος.
 *
 * ⚠️ **Εκτός εμβέλειας, επίτηδες**: οι σύνδεσμοι `href={AUTH_ROUTES.login}` (κουμπιά «Σύνδεση» σε σελίδες
 * που αποδίδονται και στον διακομιστή). Εκεί η τρέχουσα διεύθυνση δεν υπάρχει στην απόδοση χωρίς
 * `useSearchParams` (όριο Suspense, CHECK 3.55) — άλλο σχέδιο, καταγεγραμμένο στο
 * `.claude-rules/pending-ratchet-work.md`.
 */
const BARE_LOGIN_NAVIGATORS: ReadonlyArray<{ file: string; why: string }> = [
  { file: 'src/components/header/user-menu.tsx', why: 'αποσύνδεση: ο άνθρωπος ζήτησε να ΦΥΓΕΙ — επιστροφή θα τον έστελνε πίσω σε ό,τι μόλις έκλεισε' },
  { file: 'src/components/workspace-membership/use-leave-workspace.ts', why: 'αποχώρηση από χώρο: η σελίδα όπου ήταν ανήκει στον χώρο που μόλις άφησε' },
  { file: 'src/auth/components/AuthActionContent.tsx', why: 'σύνδεσμος email μιας χρήσης (επαλήθευση/επαναφορά): ο κωδικός καταναλώθηκε, η επιστροφή θα ήταν αδιέξοδο' },
  { file: 'src/app/home/route.ts', why: '«πήγαινέ με σπίτι»: μετά τη σύνδεση αποφασίζει ο ΕΝΑΣ επιλυτής προσγείωσης (landing.ts), όχι το /home' },
];

/** Πλοήγηση **προς** σκέτη σύνδεση — όχι αναφορά, και όχι σύνδεση με επιστροφή (`loginHref(…)`). */
const NAVIGATES_TO_BARE_LOGIN =
  /(?:(?:router\s*\.\s*(?:push|replace)|\bredirect(?:To)?|location\s*\.\s*(?:assign|replace)|new\s+URL)\s*\(\s*|location(?:\s*\.\s*href)?\s*=\s*)(?:[\w.]*AUTH_ROUTES\s*\.\s*login(?!\w)|['"`]\/login['"`])\s*[,);]/;

describe('Ε — η ΚΛΑΣΗ, όχι το δείγμα: κανένας φρουρός στέλνει σε σύνδεση ΧΩΡΙΣ επιστροφή', () => {
  const files = listRepoSourceFiles('src').filter((file) => !file.includes('/__tests__/'));

  it('Ε1: κάθε πλοήγηση σε σκέτο /login είναι ΔΗΛΩΜΕΝΗ, με λόγο — και κάθε δήλωση αντιστοιχεί σε κάτι', () => {
    // Φράχτης ενάντια στο κενό σύμπαν: «0 παραβάσεις σε 0 αρχεία» δεν είναι απόδειξη.
    expect(files.length).toBeGreaterThan(5000);
    expect(files).toEqual(expect.arrayContaining(['src/auth/components/ProtectedRoute.tsx', ...BARE_LOGIN_NAVIGATORS.map((entry) => entry.file)]));

    const found = files.filter((file) => NAVIGATES_TO_BARE_LOGIN.test(readRepoCode(file)));
    const declared = new Set(BARE_LOGIN_NAVIGATORS.map((entry) => entry.file));

    expect(found.filter((file) => !declared.has(file))).toEqual([]);
    expect([...declared].filter((file) => !found.includes(file))).toEqual([]);
    expect(BARE_LOGIN_NAVIGATORS.every((entry) => entry.why.trim().length > 20)).toBe(true);
  });

  it('Ε2: οι φρουροί ΠΕΛΑΤΗ ζητούν τον ΕΝΑ συνθέτη — ονομαστικά', () => {
    for (const file of [
      'src/auth/components/ProtectedRoute.tsx',
      'src/app/(app)/o/[workspace]/dashboard/page.tsx',
      'src/app/(app)/pending-approval/page.tsx',
      'src/app/(app)/onboarding/organization/page.tsx',
    ]) {
      expect([file, /router\s*\.\s*(?:push|replace)\(\s*loginHrefForCurrentLocation\(\)\s*\)/.test(readRepoCode(file))]).toEqual([file, true]);
    }
  });

  it('Ε3: …και το κριτήριο του Ε1 ΞΕΧΩΡΙΖΕΙ — σκέτη σύνδεση ≠ σύνδεση με επιστροφή ≠ αναφορά', () => {
    // Χωρίς αυτό, ένα regex που δεν ταιριάζει ΤΙΠΟΤΑ θα έβγαζε το Ε1 μονίμως πράσινο.
    for (const bare of [
      'router.replace(AUTH_ROUTES.login);',
      "router.push('/login')",
      'redirect(AUTH_ROUTES.login, workspace)',
      'return redirectTo(AUTH_ROUTES.login);',
      "window.location.href = '/login';",
      "new URL('/login', getPublicBaseUrl())",
    ]) {
      expect([bare, NAVIGATES_TO_BARE_LOGIN.test(bare)]).toEqual([bare, true]);
    }
    for (const fine of [
      'router.replace(loginHrefForCurrentLocation());',
      'redirect(loginHref(`${path}${query}`))',
      "router.push(AUTH_ROUTES.loginHelp)",
      "const LOOP_ROUTES = [AUTH_ROUTES.login];",
      '<Link href={AUTH_ROUTES.login}>',
      "router.push('/login-help')",
    ]) {
      expect([fine, NAVIGATES_TO_BARE_LOGIN.test(fine)]).toEqual([fine, false]);
    }
  });
});
