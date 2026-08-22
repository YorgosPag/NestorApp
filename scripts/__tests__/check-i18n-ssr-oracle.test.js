/**
 * @jest-environment node
 *
 * ⚠️ **node, ΟΧΙ jsdom** — και είναι μέρος της ορθότητας, όχι προτίμηση.
 * Οι άγκυρες Ν2-Ν4 σηκώνουν πραγματικό HTTP server και χτυπούν τον χρησμό
 * πάνω του. Στο jsdom το `fetch` απαντά με σφάλμα δικτύου ⇒ **κάθε** άγκυρα
 * θα έβγαινε `route-unreachable`, δηλαδή θα «περνούσε» όποια περίμενε αποτυχία
 * και θα «έπεφτε» όποια περίμενε επιτυχία — σφάλμα **περιβάλλοντος** που
 * διαβάζεται ως «η πύλη είναι σπασμένη» (ίδιο μάθημα με CHECK 3.46).
 *
 * =============================================================================
 * CHECK 3.51 Χ (ADR-781/788) — αυτοέλεγχος του ΧΡΗΣΜΟΥ
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
const LOCALE_DIR = path.join(REPO_ROOT, 'src', 'i18n', 'locales', 'el');
const { universe: UNIVERSE } = O.buildUniverse(LOCALE_DIR);

/**
 * ⚠️ **ΔΥΟ σύνολα απόδειξης, όχι ένα** (ADR-788). Το παλιό `CONTROLS` ήταν
 * μόνο του κελύφους — και το κέλυφος ζωγραφίζεται σε ΚΑΘΕ διαδρομή.
 */
const CONTROLS = O.buildControlUniverse(LOCALE_DIR, SLICE);
const ORACLE = { universe: UNIVERSE, shellControls: CONTROLS.shell, pageControls: CONTROLS.page };

/** Τιμή που δίνει ΜΟΝΟ το κέλυφος — ζωγραφίζεται παντού. */
const SHELL_CONTROL = [...CONTROLS.shell][0];
/** Τιμή που ΔΕΝ δίνει το κέλυφος — μόνο περιεχόμενο σελίδας τη βάφει. */
const PAGE_CONTROL = [...CONTROLS.page][0];

/** Σελίδα που έβαψε **μόνο** το κέλυφος. */
const page = (body) => `<!doctype html><html><body><div>${SHELL_CONTROL}</div>${body}</body></html>`;
/** Σελίδα που έβαψε κέλυφος **και** δικό της περιεχόμενο. */
const fullPage = (body = '') => `${page(body)}<p>${PAGE_CONTROL}</p>`;

// ===========================================================================
// Μ0 — ο παρονομαστής
// ===========================================================================

describe('Μ0 — το σύμπαν και τα controls δεν είναι άδεια', () => {
  test('Μ0.1 — κλειστό σύμπαν με χιλιάδες κλειδιά (αν πέσει στο 0, ο χρησμός δεν βλέπει τίποτα)', () => {
    expect(UNIVERSE.size).toBeGreaterThan(20000);
    expect(UNIVERSE.has('navigation.pages.home')).toBe(false); // το ns-πρόθεμα ΔΕΝ είναι μέρος του κλειδιού
    expect(UNIVERSE.has('pages.home')).toBe(true);
  });

  test('Μ0.2 — τα θετικά controls είναι ελληνικές τιμές ΑΠΟ ΤΑ ΔΕΔΟΜΕΝΑ, όχι χειρόγραφα', () => {
    expect(CONTROLS.shell.size).toBeGreaterThan(100);
    for (const control of [...CONTROLS.shell, ...CONTROLS.page].slice(0, 50)) {
      expect(control.length).toBeGreaterThanOrEqual(4);
      expect(/[Ͱ-Ͽἀ-῿]/.test(control)).toBe(true);
    }
  });

  test('Μ0.3 — καθαρή σελίδα με μεταφρασμένο κείμενο ⇒ clean', () => {
    const verdict = O.judgeHtml(page('<span>Καλημέρα κόσμε</span>'), ORACLE);
    expect(verdict.shellProven).toBe(true);
    expect(verdict.hits).toHaveLength(0);
  });
});

// ===========================================================================
// Μ — οι τέσσερις τρόποι να γεννηθεί ψεύτικος
// ===========================================================================

describe('Μ — μεταλλάξεις στην ΕΙΣΟΔΟ του χρησμού', () => {
  test('Μ1 — ωμό κλειδί σε κόμβο κειμένου ⇒ 🔴 εντοπίζεται', () => {
    const verdict = O.judgeHtml(page('<span>pages.home</span>'), ORACLE);
    expect(verdict.shellProven).toBe(true);
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
    expect(verdict.shellProven).toBe(false);
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
    expect(verdict.shellProven).toBe(false);
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


// ===========================================================================
// Ν — ADR-788: ΟΙ ΔΥΟ ΠΑΓΙΔΕΣ ΠΟΥ ΕΚΑΝΑΝ ΤΟΝ ΧΡΗΣΜΟ ΝΑ ΛΕΕΙ «ΚΑΘΑΡΟ»
//     ΓΙΑ ΟΘΟΝΕΣ ΠΟΥ ΔΕΝ ΕΙΧΕ ΔΕΙ ΠΟΤΕ
// ===========================================================================

/**
 * ⚠️ Οι άγκυρες Ν2-Ν4 τρέχουν το **ΠΡΑΓΜΑΤΙΚΟ** `probeRoute` πάνω σε πραγματικό
 * HTTP server. Μια απευθείας κλήση της `judgeHtml` θα έμενε πράσινη ακόμα κι αν
 * η μηχανή καταστάσεων ήταν διακοσμητική — το ίδιο μάθημα με τη `Μ8` του §8.43,
 * που απαίτησε άγκυρα η οποία εκτελεί το αληθινό μονοπάτι.
 */
const http = require('node:http');

async function serving(html, fn) {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const probe = (baseUrl, route) =>
  O.probeRoute(route, { baseUrl, userAgent: CLI.USER_AGENT, oracle: ORACLE, timeoutMs: 5000 });

describe('Ν — ο χρησμός ξεχωρίζει ΤΗ ΣΕΛΙΔΑ από ΤΟ ΚΕΛΥΦΟΣ', () => {
  test('Ν1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: δύο σύνολα, και το της σελίδας είναι πολλαπλάσιο', () => {
    // Αν το `page` γίνει υποσύνολο του `shell`, ο χρησμός ξαναγίνεται τυφλός
    // ΧΩΡΙΣ να αλλάξει καμία γραμμή λογικής — γι' αυτό μετριέται εδώ.
    expect(CONTROLS.shell.size).toBeGreaterThan(500);
    expect(CONTROLS.page.size).toBeGreaterThan(CONTROLS.shell.size * 2);
    // ΞΕΝΑ μεταξύ τους: καμία τιμή δεν ανήκει και στα δύο, αλλιώς μια τιμή του
    // κελύφους θα μπορούσε να αποδείξει «η σελίδα αποδόθηκε».
    for (const value of CONTROLS.page) expect(CONTROLS.shell.has(value)).toBe(false);
  });

  test('Ν2 — 🔴 ΤΟ ΚΑΘΑΥΤΟ ΕΛΑΤΤΩΜΑ: σελίδα με ΜΟΝΟ κέλυφος ΔΕΝ είναι «clean»', async () => {
    await serving(page(''), async (baseUrl) => {
      const record = await probe(baseUrl, { file: 'x/page.tsx', url: '/x', dynamic: false });
      expect(record.state).toBe(O.X_STATES.SHELL_ONLY);
      expect(record.state).not.toBe(O.X_STATES.CLEAN);
    });
  });

  test('Ν2β — και η ίδια σελίδα ΜΕ δικό της περιεχόμενο ⇒ clean (ο παρονομαστής)', async () => {
    await serving(fullPage(), async (baseUrl) => {
      const record = await probe(baseUrl, { file: 'x/page.tsx', url: '/x', dynamic: false });
      expect(record.state).toBe(O.X_STATES.CLEAN);
    });
  });

  test('Ν3 — ΠΑΓΙΔΑ Α: δυναμική διαδρομή με συνθετικό id ΔΕΝ λέγεται ποτέ «clean»', async () => {
    // Ακόμα κι όταν βάφει άφθονο δικό της περιεχόμενο: αυτό που βάφει είναι το
    // «δεν βρέθηκε» της, γιατί το id ΔΕΝ ΥΠΑΡΧΕΙ.
    await serving(fullPage(), async (baseUrl) => {
      const record = await probe(baseUrl, { file: 'y/[id]/page.tsx', url: '/y/ssr-probe', dynamic: true });
      expect(record.state).toBe(O.X_STATES.SYNTHETIC_ID);
      expect(record.detail).toContain(O.SYNTHETIC_SEGMENT);
    });
  });

  test('Ν4 — Η ΑΣΥΜΜΕΤΡΙΑ: σε ακρίτη επιφάνεια το «βρήκα ωμό κλειδί» ΠΑΡΑΜΕΝΕΙ αληθές', async () => {
    const raw = [...UNIVERSE].find((key) => key.includes('.'));
    await serving(fullPage(`<span>${raw}</span>`), async (baseUrl) => {
      const record = await probe(baseUrl, { file: 'y/[id]/page.tsx', url: '/y/ssr-probe', dynamic: true });
      // ΟΧΙ `surface-synthetic-id`: το κλειδί ζωγραφίστηκε όντως.
      expect(record.state).toBe(O.X_STATES.RAW_KEY);
      expect(record.keys.map((hit) => hit.key)).toContain(raw);
    });
  });

  test('Ν5 — η 🔶 κατάσταση ΔΕΝ μπλοκάρει και ΔΕΝ μπαίνει σε baseline ως παραβίαση', () => {
    expect(O.X_COUNTED).toContain(O.X_STATES.SYNTHETIC_ID);
    expect(O.X_ZERO_TOLERANCE).not.toContain(O.X_STATES.SYNTHETIC_ID);
    expect(O.X_RATCHETED).not.toContain(O.X_STATES.SYNTHETIC_ID);
    // …και γράφεται baseline κανονικά όταν υπάρχει μόνο αυτή
    const payload = CLI.buildPayload({
      records: [{ route: '/y/ssr-probe', state: O.X_STATES.SYNTHETIC_ID, keys: [] }],
      census: { 'surface-synthetic-id': 1 }, routes: [{ url: '/y/ssr-probe', dynamic: true }],
      violationIds: [], declarations: ['/y/ssr-probe (dynamic)'], violations: [],
    });
    expect(payload.violations).toEqual([]);
  });

  test('Ν6 — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: κάθε κατάσταση σε ΑΚΡΙΒΩΣ μία κατηγορία', () => {
    const buckets = [O.X_ZERO_TOLERANCE, O.X_RATCHETED, O.X_COUNTED];
    for (const state of Object.values(O.X_STATES)) {
      const memberships = buckets.filter((bucket) => bucket.includes(state)).length;
      // `clean` ανήκει σε καμία (0)· κάθε άλλη σε ακριβώς μία.
      expect([state, memberships]).toEqual([state, state === O.X_STATES.CLEAN ? 0 : 1]);
    }
  });

  test('Ν7 — Ο ΔΙΑΧΩΡΙΣΤΗΣ: γειτονικοί κόμβοι ΔΕΝ κολλάνε μέσα σε λέξη', () => {
    const control = [...CONTROLS.shell].find((value) => value.length >= 8 && !value.includes(' '));
    const half = Math.floor(control.length / 2);
    // Τα δύο μισά ως ΞΕΧΩΡΙΣΤΟΙ κόμβοι: με join('') θα «αποδείκνυαν» ότι η
    // τιμή ζωγραφίστηκε, ενώ στην οθόνη δεν υπήρξε ποτέ.
    expect(O.anyControlRendered(CONTROLS.shell, [control.slice(0, half), control.slice(half)])).toBe(false);
    expect(O.anyControlRendered(CONTROLS.shell, [control])).toBe(true);
  });

  test('Ν8 — το surface-shell-only ratchet-άρεται και δεν είναι zero-tolerance', () => {
    expect(O.X_RATCHETED).toContain(O.X_STATES.SHELL_ONLY);
    expect(O.X_ZERO_TOLERANCE).not.toContain(O.X_STATES.SHELL_ONLY);
  });
});

// ===========================================================================
// Δ — ADR-788: Η ΠΑΡΑΔΟΣΗ. Ο χρησμός ΔΕΝ χτίζει· ρωτά την εικόνα.
// ===========================================================================

describe('Δ — ο χρησμός ρωτά την ΕΙΚΟΝΑ που στάλθηκε', () => {
  const ORACLE_WF = readLive('.github/workflows/i18n-ssr-oracle.yml');

  /**
   * ⚠️ Κρίνεται το **ΕΚΤΕΛΕΣΙΜΟ**, όχι το κείμενο. Η πρώτη γραφή αυτής της
   * άγκυρας κοκκίνιζε πάνω στο **σχόλιο που τεκμηριώνει τη θεραπεία** — το ίδιο
   * σφάλμα με το `Κ7β` του CHECK 3.50 και το `Π2` του CHECK 3.55. Ένα σχόλιο
   * που περιγράφει τη βλάβη δεν είναι η βλάβη.
   */
  const executable = (yaml) =>
    yaml
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');

  test('Δ1 — ΚΑΝΕΝΑ build: το job δεν καλεί build:ci ούτε next build', () => {
    // 🔴 Η ρίζα του ελαττώματος ήταν ένα ΔΕΥΤΕΡΟ build με άλλο περιβάλλον.
    // Αν κάποιος το ξαναφέρει, η απόκλιση των env ξαναγεννιέται.
    const body = executable(ORACLE_WF);
    expect(body).not.toContain('build:ci');
    expect(body).not.toContain('next build');
    expect(body).toContain('ghcr.io/yorgospag/nestor-app');
  });

  test('Δ2 — 🔴 Η ΣΚΑΝΔΑΛΗ ΤΑΙΡΙΑΖΕΙ ΑΚΡΙΒΩΣ ΜΕ ΤΟ name: ΤΟΥ docker-build', () => {
    // Το GitHub ΔΕΝ προειδοποιεί για ασυμφωνία στο `workflow_run.workflows`:
    // απλώς δεν πυροδοτεί ΠΟΤΕ. Δηλαδή «0 εκτελέσεις» που διαβάζεται ως
    // «όλα καθαρά» — ακριβώς το σχήμα που ο χρησμός υπάρχει για να κυνηγά.
    const producer = readLive('.github/workflows/docker-build.yml');
    const producerName = producer.match(/^name:\s*(.+)$/m)[1].trim();
    expect(ORACLE_WF).toContain(`workflows: ['${producerName}']`);
  });

  test('Δ3 — ο χρησμός ΔΕΝ ζει πια στο workflow φρεσκάδας', () => {
    const shellSlice = readLive('.github/workflows/i18n-shell-slice.yml');
    expect(shellSlice).not.toContain('ssr-raw-keys-oracle:');
    expect(shellSlice).toContain('i18n-ssr-oracle.yml');
  });

  test('Δ4 — το νέο workflow είναι ΚΑΤΑΧΩΡΗΜΕΝΟ στο μητρώο (CHECK 3.37)', () => {
    const registry = JSON.parse(readLive('.ci-gate-tiers.json'));
    const entry = registry.gates.find((gate) => gate.file === 'i18n-ssr-oracle.yml');
    expect(entry).toBeDefined();
    expect(entry.tier).toBe(2);
    // το name: του μητρώου ΠΡΕΠΕΙ να είναι το name: του αρχείου
    expect(ORACLE_WF).toContain(`name: ${entry.name}`);
  });

  test('Δ5 — η ετικέτα εικόνας δένεται στο commit, ΠΟΤΕ σε latest στο workflow_run', () => {
    // Σε δύο ταυτόχρονα merge το `latest` δεν είναι το δικό μας commit ⇒ ο
    // χρησμός θα ανέφερε αποτέλεσμα για κώδικα που δεν είναι αυτός.
    expect(ORACLE_WF).toContain('workflow_run.head_sha');
    expect(ORACLE_WF).toContain('main-');
  });

  test('Δ6 — fail-closed: αποτυχημένο build ⇒ ο χρησμός ΔΕΝ τρέχει σε παλιά εικόνα', () => {
    expect(ORACLE_WF).toContain("workflow_run.conclusion == 'success'");
  });
});
