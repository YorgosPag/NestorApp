/**
 * @jest-environment node
 *
 * ⚠️ ΤΟ `node` ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ: στο jsdom το `fetch` αποτυγχάνει και **κάθε**
 * άγκυρα εδώ θα έβγαινε `route-unreachable` — δηλαδή θα «πέρναγε» για λάθος λόγο.
 * Γι' αυτό κάθε test ελέγχει **και** το `status`: αποτυχημένο fetch δίνει `null`.
 *
 * =============================================================================
 * CHECK 3.51 Χ (ADR-781 §13) — Α: ΜΙΑ ΑΝΑΚΑΤΕΥΘΥΝΣΗ ΔΕΝ ΕΙΝΑΙ Η ΣΕΛΙΔΑ
 * =============================================================================
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (μετρημένο 2026-09-22)
 * ----------------------------------------------------------
 * Ο χρησμός χτυπούσε με `redirect: 'follow'` και **ποτέ δεν ρωτούσε αν η τελική
 * διεύθυνση είναι αυτή που ζήτησε**. Επειδή χτυπά **ανώνυμα** και το
 * `src/app/(app)/o/[workspace]/layout.tsx` κάνει `redirect(AUTH_ROUTES.login)` σε
 * κάθε ανώνυμο, **110** διαδρομές έδιναν το πόρισμα της **σελίδας σύνδεσης** — με
 * 110 διαφορετικά ονόματα διαδρομών.
 *
 * 🔴 Και δεν αποτύγχανε δυνατά: επειδή όλες είναι δυναμικές, το πόρισμα
 * απορροφιόταν στο 🔶 `surface-synthetic-id`, που **δεν απαριθμείται ποτέ**.
 * **Μηδέν** από τις 312 ταυτότητες της baseline ξεκινούσε με `/o/`. Το σφάλμα
 * **εξατμιζόταν**.
 *
 * Η ΠΡΑΚΤΙΚΗ ΠΟΥ ΑΚΟΛΟΥΘΕΙΤΑΙ — ΚΑΙ ΕΙΝΑΙ ΤΩΝ ΜΕΓΑΛΩΝ
 * ---------------------------------------------------
 * • **Google Search Console**: τα δεδομένα **δεν αποδίδονται** στον προορισμό —
 *   κάθε URL της αλυσίδας μετριέται χωριστά και η πηγή παίρνει **δική της**
 *   κατάσταση, `Page with redirect`.
 * • **Lighthouse** (GoogleChrome/lighthouse#15536): η ονομασμένη αστοχία είναι
 *   *«ελέγχει τη σελίδα σύνδεσης αντί για τη σελίδα-στόχο»*· θεραπεία =
 *   `maxRedirects: 0` ή σύγκριση τελικής vs ζητούμενης διεύθυνσης.
 *
 * 🔑 Η ΙΣΧΥΡΟΤΕΡΗ ΑΓΚΥΡΑ ΕΔΩ ΕΙΝΑΙ ΓΕΓΟΝΟΣ ΔΙΚΤΥΟΥ, ΟΧΙ ΠΟΡΙΣΜΑ
 * -------------------------------------------------------------
 * Το `Α3` δεν ρωτά «τι είπε ο χρησμός» — ρωτά «**ζητήθηκε ποτέ ο προορισμός;**».
 * Ένα πόρισμα εξαρτάται από όλη τη λογική ταξινόμησης κατάντη και μπορεί να
 * συμπέσει κατά τύχη· ο μάρτυρας `requested` **δεν μπορεί**.
 * =============================================================================
 */
'use strict';

const O = require('../lib/i18n-ssr/oracle');
const { serving, servingRoutes, withServer } = require('./i18n-ssr-probe-fixture');

const UA = 'Mozilla/5.0 (test)';
const STATIC_ROUTE = { file: 'src/app/(light)/search/page.tsx', url: '/search', dynamic: false, withheld: null };
const WORKSPACE_ROUTE = { file: 'src/app/(app)/o/[workspace]/account/page.tsx', url: '/o/ssr-probe/account', dynamic: true, withheld: null };

const probe = (baseUrl, route = STATIC_ROUTE, oracle = {}) =>
  O.probeRoute(route, { baseUrl, userAgent: UA, oracle, timeoutMs: 5000 });

/** Η ταυτότητα του ratchet, όπως τη χτίζει το `check-i18n-ssr-oracle.js`. */
const identity = (record) => `${record.route}|${record.state}|${record.detail}`;

describe('Α — η ανακατεύθυνση είναι γεγονός ΤΗΣ ΔΙΑΔΡΟΜΗΣ, όχι κρίση της σελίδας', () => {
  test('Α1 — 307 με Location ⇒ route-redirected, με τον προορισμό στη λεπτομέρεια', async () => {
    await servingRoutes({ '/search': { status: 307, headers: { location: '/login' } } }, async (baseUrl) => {
      const record = await probe(baseUrl);
      expect(record.status).toBe(307);
      expect(record.state).toBe(O.X_STATES.REDIRECTED);
      expect(record.detail).toBe('→ /login');
    });
  });

  test('Α2 — ΔΥΟ προορισμοί ⇒ ΔΥΟ ταυτότητες: η ανταλλαγή μπλοκάρει (ADR-749)', async () => {
    const seen = [];
    for (const destination of ['/login', '/pro']) {
      await servingRoutes({ '/search': { status: 307, headers: { location: destination } } }, async (baseUrl) => {
        const record = await probe(baseUrl);
        expect(record.status).toBe(307);
        seen.push(identity(record));
      });
    }
    expect(seen).toEqual(['/search|route-redirected|→ /login', '/search|route-redirected|→ /pro']);
    expect(new Set(seen).size).toBe(2);
  });

  test('Α3 — 🔑 Η ΜΕΤΑΛΛΑΞΗ: ο προορισμός ΔΕΝ ζητήθηκε ποτέ (γεγονός δικτύου)', async () => {
    await servingRoutes(
      {
        '/search': { status: 307, headers: { location: '/elsewhere' } },
        // Σελίδα που, αν κρινόταν, θα έδινε ΕΝΤΕΛΩΣ άλλο πόρισμα.
        '/elsewhere': { status: 200, body: '<!doctype html><html><body><h1>άλλη σελίδα</h1></body></html>' },
      },
      async (baseUrl, requested) => {
        const record = await probe(baseUrl);

        // Με `redirect:'follow'` ΚΑΙ ΟΙ ΤΕΣΣΕΡΙΣ πέφτουν:
        expect(requested).toEqual(['/search']); // ο μάρτυρας: το /elsewhere ΔΕΝ ζητήθηκε
        expect(record.status).toBe(307); // με follow θα ήταν 200
        expect(record.state).toBe(O.X_STATES.REDIRECTED);
        expect(record.detail).toBe('→ /elsewhere');
      },
    );
  });

  test('Α4 — Location σχετικό ΚΑΙ απόλυτο ίδιας προέλευσης ⇒ ΙΔΙΑ ταυτότητα', async () => {
    // Χωρίς αυτό, η θύρα του CI θα έμπαινε στην ταυτότητα και η baseline θα
    // άλλαζε σε ΚΑΘΕ εκτέλεση — ratchet που είναι θόρυβος, όχι φρουρός.
    const absolute = await withServer(
      (request, response) => {
        response.writeHead(307, { location: `http://${request.headers.host}/login` });
        response.end('');
      },
      async (baseUrl) => identity(await probe(baseUrl)),
    );
    const relative = await servingRoutes(
      { '/search': { status: 307, headers: { location: '/login' } } },
      async (baseUrl) => identity(await probe(baseUrl)),
    );
    expect(absolute).toBe(relative);
    expect(absolute).toBe('/search|route-redirected|→ /login');
  });

  test('Α5 — προορισμός ΕΞΩ από τον server μας μένει ΟΛΟΚΛΗΡΟΣ (άλλο γεγονός)', async () => {
    await servingRoutes({ '/search': { status: 308, headers: { location: 'https://example.org/somewhere' } } }, async (baseUrl) => {
      const record = await probe(baseUrl);
      expect(record.status).toBe(308);
      expect(record.detail).toBe('→ https://example.org/somewhere');
    });
  });

  test('Α6 — αλυσίδα 3xx→3xx→200: καταγράφεται Η ΠΡΩΤΗ, η αλυσίδα ΔΕΝ ακολουθείται', async () => {
    await servingRoutes(
      {
        '/search': { status: 302, headers: { location: '/hop' } },
        '/hop': { status: 302, headers: { location: '/end' } },
        '/end': { status: 200, body: '<!doctype html><html><body>τέλος</body></html>' },
      },
      async (baseUrl, requested) => {
        const record = await probe(baseUrl);
        expect(requested).toEqual(['/search']);
        expect(record.status).toBe(302);
        expect(record.detail).toBe('→ /hop');
      },
    );
  });

  test('Α7 — 3xx ΧΩΡΙΣ Location δεν είναι ανακατεύθυνση, είναι χαλασμένη απάντηση ⇒ ⛔', async () => {
    // Δεν μπορούμε καν να σχηματίσουμε ταυτότητα ⇒ «δεν κοίταξα», και αυτό δεν
    // έχει πρόοδο. Ποτέ `route-redirected` χωρίς προορισμό.
    await servingRoutes({ '/search': { status: 307 } }, async (baseUrl) => {
      const record = await probe(baseUrl);
      expect(record.status).toBe(307);
      expect(record.state).toBe(O.X_STATES.UNREACHABLE);
      expect(O.X_ZERO_TOLERANCE).toContain(record.state);
    });
  });

  test('Α8 — ο κάδος: 🔴 ratchet, ΟΧΙ ⛔ και ΟΧΙ 🔶 — και τα δύο με λόγο', async () => {
    expect(O.X_RATCHETED).toContain(O.X_STATES.REDIRECTED);
    expect(O.X_ZERO_TOLERANCE).not.toContain(O.X_STATES.REDIRECTED);
    // 🔶 θα επαναλάμβανε ΑΚΡΙΒΩΣ το σφάλμα που αυτή η κατάσταση διορθώνει:
    // «μετριέται, δεν απαριθμείται» είναι πώς εξατμίστηκαν οι 110 διαδρομές.
    expect(O.X_COUNTED).not.toContain(O.X_STATES.REDIRECTED);
  });

  test('Α9 — ΜΗΔΕΝ παλινδρόμηση: 200 χωρίς ανακατεύθυνση κρίνεται όπως πάντα', async () => {
    const oracle = {
      universe: new Set(['pages.home']),
      shellControls: new Set(['Καλημέρα']),
      pageControls: new Set(['Περιεχόμενο']),
    };
    await serving(200, '<!doctype html><html><body><span>pages.home</span></body></html>', async (baseUrl) => {
      const record = await probe(baseUrl, STATIC_ROUTE, oracle);
      expect(record.status).toBe(200);
      expect(record.state).toBe(O.X_STATES.RAW_KEY);
      expect(record.keys.map((hit) => hit.key)).toEqual(['pages.home']);
    });
  });

  test('Α10 — η ΖΩΝΤΑΝΗ περίπτωση: δυναμική διαδρομή χώρου ΔΕΝ πέφτει πια στο 🔶', async () => {
    // Πριν: 307 → /login, το fetch ακολουθούσε, ο χρησμός έκρινε τη σελίδα
    // σύνδεσης και —επειδή `dynamic: true`— το πόρισμα γινόταν `surface-synthetic-id`.
    await servingRoutes({ '/o/ssr-probe/account': { status: 307, headers: { location: '/login' } } }, async (baseUrl) => {
      const record = await probe(baseUrl, WORKSPACE_ROUTE);
      expect(record.status).toBe(307);
      expect(record.state).toBe(O.X_STATES.REDIRECTED);
      expect(record.state).not.toBe(O.X_STATES.SYNTHETIC_ID);
      expect(identity(record)).toBe('/o/ssr-probe/account|route-redirected|→ /login');
    });
  });
});

// =============================================================================
// Α-bis (ADR-781 §14) — Η ΔΕΥΤΕΡΗ ΜΕΤΑΦΟΡΑ: 200 + ΔΕΙΚΤΗΣ ΣΤΟ DOM
// =============================================================================
//
// Το `(app)` έχει `loading.tsx` ⇒ streaming ⇒ το `redirect()` του layout ρίχνεται
// αφού έχουν φύγει οι κεφαλίδες ⇒ **200**, και η ανακατεύθυνση ταξιδεύει ως δείκτης
// του ορίου Suspense. Μετρημένο στην παραγωγή: 110 από τις 112 ανακατευθύνσεις.

/** ⚠️ Το `REAL_BOUNDARY` ΔΕΝ είναι χειρόγραφο — βλ. Α16. */
const REAL_BOUNDARY =
  '<main data-shell-surface="" class="w-full flex-1 overflow-y-auto overflow-x-hidden bg-background/95 max-w-full">' +
  '<!--$!--><template data-dgst="NEXT_REDIRECT;replace;/login;307;"></template>' +
  '<section class="flex h-screen items-center justify-center" role="status" aria-live="polite">';
/** Οι ΔΥΟ γραμμές του flight της ίδιας απάντησης: σελίδα (15) ΚΑΙ layout (12). */
const REAL_FLIGHT =
  '<script>self.__next_f.push([1,"\\n15:E{\\"digest\\":\\"NEXT_REDIRECT;replace;/account/profile;307;\\"}' +
  '\\n12:E{\\"digest\\":\\"NEXT_REDIRECT;replace;/login;307;\\"}\\n"])</script>';

/** Κέλυφος που ΑΠΟΔΕΙΚΝΥΕΙ τον εαυτό του — ώστε χωρίς τον δείκτη να πέφτει στο 🔶. */
const SHELL_ORACLE = {
  universe: new Set(['pages.home']),
  shellControls: new Set(['Αλλαγή θέματος']),
  pageControls: new Set(['Περιεχόμενο σελίδας']),
};
const streamed = (inner) =>
  `<!DOCTYPE html><html><head><title>Nestor</title></head><body><header><span>Αλλαγή θέματος</span></header>${inner}</body></html>`;
const boundary = (digest) => `<main><!--$!--><template data-dgst="${digest}"></template><section role="status">…</section></main>`;

describe('Α-bis — το ΙΔΙΟ γεγονός από ΑΛΛΟ κανάλι: 200 + data-dgst', () => {
  test('Α11 — 200 + NEXT_REDIRECT ⇒ route-redirected, → /login', async () => {
    await serving(200, streamed(boundary('NEXT_REDIRECT;replace;/login;307;')), async (baseUrl) => {
      const record = await probe(baseUrl, WORKSPACE_ROUTE, SHELL_ORACLE);
      expect(record.status).toBe(200);
      expect(record.state).toBe(O.X_STATES.REDIRECTED);
      expect(identity(record)).toBe('/o/ssr-probe/account|route-redirected|→ /login');
    });
  });

  test('Α12 — ο προορισμός ΜΕ query δίνει ΑΛΛΗ ταυτότητα (και οι οντότητες HTML λύνονται)', async () => {
    const seen = [];
    for (const digest of ['NEXT_REDIRECT;replace;/login;307;', 'NEXT_REDIRECT;replace;/login?next=%2Fdashboard&amp;x=1;307;']) {
      await serving(200, streamed(boundary(digest)), async (baseUrl) => {
        const record = await probe(baseUrl, WORKSPACE_ROUTE, SHELL_ORACLE);
        expect(record.status).toBe(200);
        seen.push(identity(record));
      });
    }
    expect(seen).toEqual([
      '/o/ssr-probe/account|route-redirected|→ /login',
      '/o/ssr-probe/account|route-redirected|→ /login?next=%2Fdashboard&x=1',
    ]);
  });

  test('Α13 — 🔑 Η ΜΕΤΑΛΛΑΞΗ: χωρίς τον δείκτη η ΙΔΙΑ απάντηση εξατμίζεται στο 🔶', async () => {
    // Το αντιπαράδειγμα είναι ο ΙΔΙΟΣ κριτής χωρίς το τρίτο όρισμα — δηλαδή
    // ακριβώς ο κώδικας πριν το Α-bis. Αν ο κλάδος σβηστεί από το probeRoute,
    // το Α11 κοκκινίζει· αυτό εδώ αποδεικνύει ότι το fixture ΔΙΑΚΡΙΝΕΙ.
    const html = streamed(boundary('NEXT_REDIRECT;replace;/login;307;'));
    const verdict = O.judgeHtml(html, SHELL_ORACLE);
    expect(verdict.shellProven).toBe(true);
    expect(O.classifySurface(WORKSPACE_ROUTE, verdict).state).toBe(O.X_STATES.SYNTHETIC_ID);
    expect(O.X_COUNTED).toContain(O.X_STATES.SYNTHETIC_ID);
    expect(O.classifySurface(WORKSPACE_ROUTE, verdict, { target: '/login' }).state).toBe(O.X_STATES.REDIRECTED);
  });

  test('Α14 — ΜΗΔΕΝ παλινδρόμηση: 200 χωρίς δείκτη, ή με ΑΛΛΟ digest, κρίνεται όπως πάντα', async () => {
    for (const inner of ['<main><section>…</section></main>', boundary('NEXT_HTTP_ERROR_FALLBACK;404'), boundary('1234567890')]) {
      await serving(200, streamed(inner), async (baseUrl) => {
        const record = await probe(baseUrl, WORKSPACE_ROUTE, SHELL_ORACLE);
        expect(record.status).toBe(200);
        expect(record.state).toBe(O.X_STATES.SYNTHETIC_ID);
      });
    }
    // Και το ωμό κλειδί ΠΡΟΗΓΕΙΤΑΙ: ζωγραφίστηκε στο κέλυφος, άρα παραμένει αληθές.
    await serving(200, streamed(`<span>pages.home</span>${boundary('NEXT_REDIRECT;replace;/login;307;')}`), async (baseUrl) => {
      expect((await probe(baseUrl, WORKSPACE_ROUTE, SHELL_ORACLE)).state).toBe(O.X_STATES.RAW_KEY);
    });
  });

  test('Α15 — χαλασμένο NEXT_REDIRECT ⇒ ⛔ probe-unproven, ΠΟΤΕ clean (fail-closed)', async () => {
    const pageOracle = { ...SHELL_ORACLE, pageControls: new Set(['Αλλαγή θέματος']) };
    for (const digest of ['NEXT_REDIRECT;replace;/login;302;', 'NEXT_REDIRECT;bogus;/login;307;', 'NEXT_REDIRECT']) {
      await serving(200, streamed(boundary(digest)), async (baseUrl) => {
        // Στατική διαδρομή με ΑΠΟΔΕΙΓΜΕΝΗ σελίδα: χωρίς fail-closed θα ήταν `clean`.
        const record = await probe(baseUrl, STATIC_ROUTE, pageOracle);
        expect(record.status).toBe(200);
        expect(record.state).toBe(O.X_STATES.PROBE_UNPROVEN);
        expect(O.X_ZERO_TOLERANCE).toContain(record.state);
      });
    }
  });

  test('Α16 — 🔬 ΠΡΑΓΜΑΤΙΚΟ fixture: παραγωγή, Next 15.5.22, /o/ssr-probe/account (2026-09-23)', async () => {
    // Το flight φέρει ΔΥΟ ανακατευθύνσεις (σελίδα → /account/profile, layout → /login)·
    // το DOM ΜΙΑ. Αν ο αναλυτής διάβαζε το flight, θα έπαιρνε τη σελίδα που ΔΕΝ
    // αποδόθηκε. Αν αλλάξει το σχήμα του React/Next, αυτό κοκκινίζει ΠΡΩΤΟ.
    await serving(200, streamed(`${REAL_BOUNDARY}</section></main>${REAL_FLIGHT}`), async (baseUrl) => {
      const record = await probe(baseUrl, WORKSPACE_ROUTE, SHELL_ORACLE);
      expect(record.status).toBe(200);
      expect(record.state).toBe(O.X_STATES.REDIRECTED);
      expect(record.detail).toBe('→ /login');
    });
  });

  test('Α17 — ισοτιμία με τον αναλυτή του ΙΔΙΟΥ του Next.js (το CI του χρησμού δεν τον έχει)', () => {
    const { isRedirectError } = require('next/dist/client/components/redirect-error');
    const { getURLFromRedirectError } = require('next/dist/client/components/redirect');
    const { parseRedirectDigest } = require('../lib/i18n-ssr/redirect-contract');
    const corpus = [
      'NEXT_REDIRECT;replace;/login;307;',
      'NEXT_REDIRECT;push;/pro;308;',
      'NEXT_REDIRECT;replace;/a;b?c=1;303;',
      'NEXT_REDIRECT;replace;https://example.org/x;307;',
      'NEXT_REDIRECT;replace;/x;302;',
      'NEXT_REDIRECT;replace;/x;301;',
      'NEXT_REDIRECT;bogus;/x;307;',
      'NEXT_REDIRECT;replace;/x;307',
      'NEXT_REDIRECT;replace;/x;abc;',
      'NEXT_REDIRECT',
      'NEXT_HTTP_ERROR_FALLBACK;404',
    ];
    for (const digest of corpus) {
      const ours = parseRedirectDigest(digest);
      const theirs = isRedirectError({ digest });
      expect([digest, ours !== null]).toEqual([digest, theirs]);
      if (theirs) expect(ours.target).toBe(getURLFromRedirectError({ digest }));
    }
  });

  test('Α18 — ΜΙΑ ταυτότητα για ΔΥΟ μεταφορές: 307+Location ≡ 200+δείκτης', async () => {
    const hard = await servingRoutes({ '/o/ssr-probe/account': { status: 307, headers: { location: '/login' } } }, async (baseUrl) =>
      identity(await probe(baseUrl, WORKSPACE_ROUTE)),
    );
    const soft = await serving(200, streamed(boundary('NEXT_REDIRECT;replace;/login;307;')), async (baseUrl) =>
      identity(await probe(baseUrl, WORKSPACE_ROUTE, SHELL_ORACLE)),
    );
    // Αφαίρεση ενός `loading.tsx` αλλάζει μεταφορά — ΟΧΙ εύρημα.
    expect(soft).toBe(hard);
  });
});
