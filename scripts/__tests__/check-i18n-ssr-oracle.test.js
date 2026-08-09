/**
 * =============================================================================
 * CHECK 3.51 Χ (ADR-781) — αυτοέλεγχος του ΧΡΗΣΜΟΥ
 * =============================================================================
 *
 * Ο χρησμός χρειάζεται ζωντανό server, οπότε **δεν** τον σηκώνει το test. Αυτό
 * που ελέγχεται εδώ είναι το μόνο που μπορεί να τον κάνει **μονίμως πράσινο**:
 * η **κρίση** (τι μετράει ως ωμό κλειδί), το **σύμπαν**, το **θετικό control**,
 * η **απαρίθμηση διαδρομών**, και η **άρνηση** να γραφτεί baseline πάνω σε
 * «δεν κοίταξα».
 *
 * 🔴 Οι τέσσερις τρόποι να γεννηθεί ψεύτικος έχουν ο καθένας το δικό του test:
 *    Μ1  ευρετικό αντί για κλειστό σύμπαν  → `nestorconstruct.gr` δεν είναι κλειδί
 *    Μ2  καμία απόδειξη ότι κοίταξε        → `probe-unproven`
 *    Μ3  μία επιφάνεια αντί για δύο        → `aria-label` (μετρημένα **7** σε 1 διαδρομή)
 *    Μ4  baseline που καταπίνει το «δεν ξέρω» → `buildPayload` **αρνείται**
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const O = require('../lib/i18n-ssr/oracle');
const CLI = require('../check-i18n-ssr-oracle');

const BS = String.fromCharCode(92);
const REPO_ROOT = path.join(__dirname, '..', '..');
const POSIX_ROOT = REPO_ROOT.split(BS).join('/');
const readLive = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const SLICE = JSON.parse(readLive('src/i18n/generated/shell-slice.el.json'));
const CONTROLS = O.buildPositiveControls(SLICE);
const { universe: UNIVERSE } = O.buildUniverse(path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'el'));
const ORACLE = { universe: UNIVERSE, controls: CONTROLS };

/** Μια σελίδα που έχει μεταφρασμένο κείμενο ⇒ το control περνά. */
const ANY_CONTROL = [...CONTROLS][0];
const page = (body) => `<!doctype html><html><body><div>${ANY_CONTROL}</div>${body}</body></html>`;

// ===========================================================================
// Μ0 — ο παρονομαστής
// ===========================================================================

describe('Μ0 — το σύμπαν και τα controls δεν είναι άδεια', () => {
  test('Μ0.1 — κλειστό σύμπαν με χιλιάδες κλειδιά (αν πέσει στο 0, ο χρησμός δεν βλέπει τίποτα)', () => {
    expect(UNIVERSE.size).toBeGreaterThan(20000);
    expect(UNIVERSE.has('navigation.pages.home')).toBe(false); // το ns-πρόθεμα ΔΕΝ είναι μέρος του κλειδιού
    expect(UNIVERSE.has('pages.home')).toBe(true);
  });

  test('Μ0.2 — τα θετικά controls είναι ελληνικές τιμές ΑΠΟ ΤΟ SLICE, όχι χειρόγραφα', () => {
    expect(CONTROLS.size).toBeGreaterThan(100);
    for (const control of [...CONTROLS].slice(0, 50)) {
      expect(control.length).toBeGreaterThanOrEqual(4);
      expect(/[Ͱ-Ͽἀ-῿]/.test(control)).toBe(true);
    }
  });

  test('Μ0.3 — καθαρή σελίδα με μεταφρασμένο κείμενο ⇒ clean', () => {
    const verdict = O.judgeHtml(page('<span>Καλημέρα κόσμε</span>'), ORACLE);
    expect(verdict.proven).toBe(true);
    expect(verdict.hits).toHaveLength(0);
  });
});

// ===========================================================================
// Μ — οι τέσσερις τρόποι να γεννηθεί ψεύτικος
// ===========================================================================

describe('Μ — μεταλλάξεις στην ΕΙΣΟΔΟ του χρησμού', () => {
  test('Μ1 — ωμό κλειδί σε κόμβο κειμένου ⇒ 🔴 εντοπίζεται', () => {
    const verdict = O.judgeHtml(page('<span>pages.home</span>'), ORACLE);
    expect(verdict.proven).toBe(true);
    expect(verdict.hits).toEqual([{ key: 'pages.home', surface: 'text' }]);
  });

  test('Μ2 — ΚΛΕΙΣΤΟ ΣΥΜΠΑΝ: κάτι που ΜΟΙΑΖΕΙ με κλειδί αλλά δεν είναι, ΔΕΝ μετράει', () => {
    // Ένα ευρετικό `\\w+(\\.\\w+)+` θα έπιανε και τα τρία. Κανένα δεν είναι κλειδί.
    const verdict = O.judgeHtml(page('<span>nestorconstruct.gr</span><span>report.pdf</span><span>v1.2.3</span>'), ORACLE);
    expect(verdict.hits).toHaveLength(0);
  });

  test('Μ3 — ΔΕΥΤΕΡΗ ΕΠΙΦΑΝΕΙΑ: ωμό κλειδί σε `aria-label` εντοπίζεται', () => {
    // Μετρημένο ζωντανά: στο /spaces/parking υπάρχουν **4** σε κείμενο και
    // **7** σε aria-label. Ένας text-only χρησμός θα ανέφερε 4 και θα φαινόταν
    // σωστός — ενώ το aria-label είναι η ΜΟΝΗ ετικέτα του αναγνώστη οθόνης.
    const verdict = O.judgeHtml(page('<button aria-label="pages.home">x</button>'), ORACLE);
    expect(verdict.hits).toEqual([{ key: 'pages.home', surface: 'aria-label' }]);
  });

  test('Μ3β — και στα υπόλοιπα ανθρώπινα attributes', () => {
    for (const attribute of O.HUMAN_ATTRIBUTES) {
      const verdict = O.judgeHtml(page(`<input ${attribute}="pages.home" />`), ORACLE);
      expect([attribute, verdict.hits.map((hit) => hit.surface)]).toEqual([attribute, [attribute]]);
    }
  });

  test('Μ4 — ΘΕΤΙΚΟ CONTROL: σελίδα χωρίς καμία μεταφρασμένη τιμή ⇒ ⛔ δεν είναι «clean»', () => {
    const verdict = O.judgeHtml('<!doctype html><html><body><div>only ascii</div></body></html>', ORACLE);
    expect(verdict.proven).toBe(false);
  });

  test('Μ5 — το `<script>` αφαιρείται: κλειδί μέσα σε RSC payload ΔΕΝ είναι ωμό κλειδί', () => {
    const verdict = O.judgeHtml(page('<script>self.__next={"k":"pages.home"}</script>'), ORACLE);
    expect(verdict.hits).toHaveLength(0);
  });

  test('Μ6 — HTML entities αποκωδικοποιούνται (αλλιώς το control χάνεται σιωπηλά)', () => {
    expect(O.decodeEntities('&amp;&lt;&gt;&#39;&nbsp;x')).toBe("&<>' x");
  });

  test('Μ7 — κενό σώμα ΔΕΝ είναι «καθαρή σελίδα»', () => {
    const verdict = O.judgeHtml('', ORACLE);
    expect(verdict.proven).toBe(false);
  });

  test('Μ8 — άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ (fail-closed)', () => {
    expect(() => O.assertClosedX([{ route: '/x', state: 'φανταστική' }]))
      .toThrow(/άγνωστη κατάσταση "φανταστική"/);
  });
});

// ===========================================================================
// Π — άγκυρες στην ΠΡΑΓΜΑΤΙΚΗ διαμόρφωση του έργου
// ===========================================================================

describe('Π — άγκυρες στο πραγματικό δέντρο', () => {
  test('Π1 — απαριθμούνται ΟΛΕΣ οι διαδρομές, από τη σύμβαση του Next.js', () => {
    const routes = O.enumerateRoutes(POSIX_ROOT);
    const onDisk = readLive('package.json') && routes.length;
    expect(onDisk).toBe(routes.length);
    expect(routes.length).toBeGreaterThan(100);
    expect(routes.map((route) => route.url)).toContain('/');
    expect(routes.map((route) => route.url)).toContain('/spaces/parking');
    // route groups `(auth)` ΔΕΝ εμφανίζονται στο URL
    expect(routes.map((route) => route.url)).toContain('/login');
    expect(routes.some((route) => route.url.includes('('))).toBe(false);
    // κανένα διπλό URL — αλλιώς η ταυτότητα του ratchet συγκρούεται
    expect(new Set(routes.map((route) => route.url)).size).toBe(routes.length);
  });

  test('Π2 — οι δυναμικές παίρνουν συνθετικό τμήμα, ρητά αναγνωρίσιμο', () => {
    const routes = O.enumerateRoutes(POSIX_ROOT);
    const dynamic = routes.filter((route) => route.dynamic);
    expect(dynamic.length).toBeGreaterThan(0);
    for (const route of dynamic) {
      expect(route.url).toContain(O.SYNTHETIC_SEGMENT);
      expect(route.url).not.toContain('[');
    }
  });

  test('Π3 — το middleware ΟΝΤΩΣ μπλοκάρει τα default UA των εργαλείων', () => {
    // 🔴 Αν αυτό αλλάξει, ο χρησμός μπορεί να αρχίσει να παίρνει 403 σιωπηλά.
    // Η άγκυρα διαβάζει τον ΠΡΑΓΜΑΤΙΚΟ κώδικα ασφαλείας, δεν τον αντιγράφει.
    const middleware = readLive('src/middleware.ts');
    expect(middleware).toContain('BLOCKED_BOT_PATTERNS');
    for (const pattern of ["'curl/'", "'node-fetch'", "'headlesschrome'"]) {
      expect(middleware).toContain(pattern);
    }
    // …και το UA της πύλης ΔΕΝ ταιριάζει σε κανένα από αυτά
    const lower = CLI.USER_AGENT.toLowerCase();
    for (const pattern of ['curl/', 'node-fetch', 'headlesschrome', 'python-requests', 'axios/']) {
      expect([pattern, lower.includes(pattern)]).toEqual([pattern, false]);
    }
  });

  test('Π4 — το `probeRoute` ΑΡΝΕΙΤΑΙ να τρέξει χωρίς User-Agent', async () => {
    await expect(
      O.probeRoute({ file: 'x', url: '/', dynamic: false }, { baseUrl: 'http://127.0.0.1:1', oracle: ORACLE })
    ).rejects.toThrow(/userAgent είναι ΥΠΟΧΡΕΩΤΙΚΟ/);
  });

  test('Π5 — server που δεν απαντά ⇒ `route-unreachable`, ΠΟΤΕ «clean»', async () => {
    const record = await O.probeRoute(
      { file: 'x', url: '/', dynamic: false },
      { baseUrl: 'http://127.0.0.1:1', userAgent: CLI.USER_AGENT, oracle: ORACLE, timeoutMs: 2000 }
    );
    expect(record.state).toBe(O.X_STATES.UNREACHABLE);
  });
});

// ===========================================================================
// Κ — τα συμβόλαια του ratchet
// ===========================================================================

describe('Κ — συμβόλαια ratchet και λογιστικής', () => {
  test('Κ1 — το `buildPayload` ΑΡΝΕΙΤΑΙ να γράψει «δεν κοίταξα» σε baseline', () => {
    for (const state of O.X_ZERO_TOLERANCE) {
      expect(() =>
        CLI.buildPayload({
          records: [{ route: '/x', state, keys: [], detail: 'δοκιμή' }],
          census: {}, routes: [], violationIds: [], declarations: [], violations: [],
        })
      ).toThrow(/ΔΕΝ απέδειξε ότι κοίταξε/);
    }
  });

  test('Κ2 — καθαρή μέτρηση γράφεται κανονικά, με κλειστή λογιστική', () => {
    const payload = CLI.buildPayload({
      records: [{ route: '/x', state: O.X_STATES.CLEAN, keys: [] }],
      census: { clean: 1 }, routes: [{ url: '/x', dynamic: false }],
      violationIds: [], declarations: ['/x'], violations: [],
    });
    expect(payload.violations).toEqual([]);
    expect(payload.declarations).toEqual(['/x']);
    expect(payload.check).toBe('CHECK 3.51 Χ');
  });

  test('Κ3 — η ταυτότητα ΔΕΝ περιέχει γραμμή/σειρά: `διαδρομή|επιφάνεια|κλειδί`', () => {
    const id = O.violationId({ route: '/spaces/parking' }, { surface: 'aria-label', key: 'filters.title' });
    expect(id).toBe('/spaces/parking|aria-label|filters.title');
    // ίδιο κλειδί σε ΑΛΛΗ επιφάνεια = ΑΛΛΗ ταυτότητα (αλλιώς μια διόρθωση σε μία
    // επιφάνεια θα έκρυβε μια νέα παραβίαση στην άλλη)
    expect(O.violationId({ route: '/spaces/parking' }, { surface: 'text', key: 'filters.title' }))
      .not.toBe(id);
  });

  test('Κ4 — δηλωμένο όριο: ό,τι δεν χτυπήθηκε μπαίνει ΡΗΤΑ ως `route-skipped` και ratchet-άρεται', () => {
    expect(O.X_RATCHETED).toContain(O.X_STATES.SKIPPED);
    // «καμία σιωπηλή δειγματοληψία»: το skipped ΔΕΝ είναι clean
    expect(O.X_STATES.SKIPPED).not.toBe(O.X_STATES.CLEAN);
  });

  test('Κ5 — οι δύο ⛔ καταστάσεις ΔΕΝ είναι ratcheted και το αντίστροφο', () => {
    for (const state of O.X_ZERO_TOLERANCE) expect(O.X_RATCHETED).not.toContain(state);
    for (const state of O.X_RATCHETED) expect(O.X_ZERO_TOLERANCE).not.toContain(state);
    // κλειστό σύνολο: κάθε κατάσταση ανήκει σε ακριβώς μία κατηγορία ή είναι ✅
    const all = Object.values(O.X_STATES);
    expect(all).toHaveLength(new Set(all).size);
  });

  test('Κ6 — δηλωμένο όριο: ο χρησμός κρίνει ΚΕΙΜΕΝΟ, όχι CSS content ή data-* attributes', () => {
    const verdict = O.judgeHtml(page('<div data-key="pages.home"></div>'), ORACLE);
    expect(verdict.hits).toHaveLength(0);
  });
});
