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
