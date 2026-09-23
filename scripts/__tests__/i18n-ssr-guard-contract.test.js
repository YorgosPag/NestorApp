/**
 * @jest-environment node
 *
 * ⚠️ ΤΟ `node` ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΟ: στο jsdom το `fetch` αποτυγχάνει και κάθε άγκυρα
 * θα έβγαινε `guard-unproven` — δηλαδή θα «πέρναγε» για λάθος λόγο.
 *
 * =============================================================================
 * CHECK 3.51 Φ — Ο ΔΙΔΥΜΟΣ: «ο ανώνυμος ΔΕΝ μπαίνει στον ιδιωτικό χώρο» (ADR-875 §14)
 * =============================================================================
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Φ1 | ανώνυμο 200 **χωρίς** ανακατεύθυνση ⇒ ⛔ `guard-not-honored` | «200 ⇒ τιμήθηκε» |
 * | Φ2 | σύνδεση με `?next=` = η διαδρομή που ζητήθηκε ⇒ ✅ — και με 3xx και με δείκτη DOM | κρίση μόνο με 3xx |
 * | Φ3 | σύνδεση **χωρίς** σωστή επιστροφή ⇒ 🔴 `guard-return-lost` (το εύρημα §11.6) | «κάθε /login ⇒ ✅» |
 * | Φ4 | ανακατεύθυνση **αλλού** ⇒ 🔴 `guard-redirected-elsewhere` | «κάθε ανακατεύθυνση ⇒ ✅» |
 * | Φ5 | δεν ξέρουμε ⇒ ⛔ `guard-unproven` (4xx/5xx · 3xx χωρίς Location · χαλασμένος δείκτης · αδιέξοδο) | 404 ⇒ «δεν διέρρευσε» |
 * | Φ6 | ⛔ **κανένα cookie**, και χτυπιέται το **πραγματικό** `fetchUrl` | κληρονομιά `sessions` · συνθετικό URL |
 * | Φ7 | ένας δίδυμος ανά `/o/**` της απογραφής, πληρότητα με **ανεξάρτητο** κριτήριο | «0 για 0» |
 * | Φ8 | ⛔ μπλοκάρει **και στη σύγκριση** (`refusals`), όχι μόνο στη σπορά | ⛔ μόνο στο `--write-baseline` |
 * | Φ9 | ο δίδυμος **δεν** μπαίνει στις `declarations` (ο παρονομαστής του 7% μένει ίδιος) | δίδυμος ως δήλωση |
 * =============================================================================
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const G = require('../lib/i18n-ssr/guard-contract');
const S = require('../lib/i18n-ssr/states');
const ID = require('../lib/i18n-ssr/identity');
const { withServer } = require('./i18n-ssr-probe-fixture');

const UA = 'Mozilla/5.0 (test)';
const REQUESTED = '/o/comp_alpha/projects/proj_alpha_golden';
const BASE = 'http://127.0.0.1:3000';

/** Ο δείκτης ορίου Suspense όπως τον γράφει το Next 15.5 (βλ. `redirect-contract.js`). */
const streamedRedirect = (target) =>
  `<main><!--$!--><template data-dgst="NEXT_REDIRECT;replace;${target};307;"></template><p>φόρτωση</p></main>`;
const loginWithReturn = (returnPath) => `/login?next=${encodeURIComponent(returnPath)}`;
const judge = (answer) => G.judgeGuard({ location: null, html: '', ...answer }, REQUESTED, BASE);

describe('Φ1-Φ5 — η κρίση', () => {
  it('Φ1: 200 ΧΩΡΙΣ ανακατεύθυνση ⇒ ⛔ διαρροή ιδιωτικού χώρου', () => {
    const verdict = judge({ status: 200, html: '<main><h1>Έργα (7)</h1></main>' });
    expect(verdict.state).toBe(S.G_STATES.NOT_HONORED);
    expect(S.G_ZERO_TOLERANCE).toContain(verdict.state);
  });

  it('Φ2: σύνδεση με επιστροφή στη ζητηθείσα διαδρομή ⇒ ✅ (δείκτης DOM ΚΑΙ 3xx)', () => {
    expect(judge({ status: 200, html: streamedRedirect(loginWithReturn(REQUESTED)) }).state).toBe(S.G_STATES.HONORED);
    expect(judge({ status: 307, location: loginWithReturn(REQUESTED) }).state).toBe(S.G_STATES.HONORED);
    expect(judge({ status: 307, location: `${BASE}${loginWithReturn(REQUESTED)}` }).state).toBe(S.G_STATES.HONORED);
  });

  it('Φ3: σύνδεση ΧΩΡΙΣ σωστή επιστροφή ⇒ 🔴 guard-return-lost', () => {
    const plain = judge({ status: 200, html: streamedRedirect('/login') });
    expect(plain.state).toBe(S.G_STATES.RETURN_LOST);
    expect(plain.detail).toMatch(/^→ \/login /);
    expect(judge({ status: 200, html: streamedRedirect(loginWithReturn('/o/comp_alpha/dashboard')) }).state)
      .toBe(S.G_STATES.RETURN_LOST);
    expect(S.G_RATCHETED).toContain(S.G_STATES.RETURN_LOST);
  });

  it('Φ4: ανακατεύθυνση ΑΛΛΟΥ ⇒ 🔴 guard-redirected-elsewhere, με τον προορισμό στην ταυτότητα', () => {
    const verdict = judge({ status: 200, html: streamedRedirect('/dashboard') });
    expect(verdict).toMatchObject({ state: S.G_STATES.REDIRECTED_ELSEWHERE, detail: '→ /dashboard' });
    // Το «/loginx» ΔΕΝ είναι σύνδεση — ο κριτής δεν κάνει «ξεκινά με».
    expect(judge({ status: 307, location: '/loginx' }).state).toBe(S.G_STATES.REDIRECTED_ELSEWHERE);
  });

  it('Φ5: ό,τι δεν αποδεικνύει τον φρουρό ⇒ ⛔ guard-unproven, ΠΟΤΕ «δεν διέρρευσε»', () => {
    for (const answer of [
      { status: 404, html: 'not found' },
      { status: 500, html: 'boom' },
      { status: 307, location: null },
      { status: 200, html: '<template data-dgst="NEXT_REDIRECT;replace;/login;999;"></template>' },
    ]) {
      expect([answer.status, judge(answer).state]).toEqual([answer.status, S.G_STATES.UNPROVEN]);
    }
  });

  it('Φ5: server που δεν απαντά ⇒ ⛔ guard-unproven', async () => {
    const twin = { url: REQUESTED, template: '/o/[workspace]/projects/[id]', audience: ID.ANONYMOUS_AUDIENCE };
    const record = await G.probeGuard(twin, { baseUrl: 'http://127.0.0.1:9', userAgent: UA, timeoutMs: 2000 });
    expect(record.state).toBe(S.G_STATES.UNPROVEN);
  });

  it('κάθε κατάσταση ανήκει σε ΑΚΡΙΒΩΣ έναν κάδο (⛔ / 🔴 / ✅)', () => {
    for (const state of Object.values(S.G_STATES)) {
      const buckets = [S.G_ZERO_TOLERANCE, S.G_RATCHETED].filter((bucket) => bucket.includes(state)).length;
      expect([state, buckets]).toEqual([state, state === S.G_STATES.HONORED ? 0 : 1]);
    }
  });
});

describe('Φ6 — το αίτημα', () => {
  it('ΚΑΝΕΝΑ cookie όποιες κι αν είναι οι συνεδρίες, και χτυπιέται το ΠΡΑΓΜΑΤΙΚΟ fetchUrl', async () => {
    const seen = [];
    const twin = {
      file: 'src/app/(app)/o/[workspace]/projects/[id]/page.tsx',
      url: '/o/comp_alpha/projects/{project}',
      fetchUrl: REQUESTED,
      template: '/o/[workspace]/projects/[id]',
      audience: ID.ANONYMOUS_AUDIENCE,
    };
    const record = await withServer((request, response) => {
      seen.push({ url: request.url, cookie: request.headers.cookie });
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(streamedRedirect(loginWithReturn(request.url)));
    }, (baseUrl) => G.probeGuard(twin, {
      baseUrl,
      userAgent: UA,
      sessions: new Map([['organization:company_admin', '__session=SECRET']]),
    }));

    expect(seen).toEqual([{ url: REQUESTED, cookie: undefined }]);
    expect(record).toMatchObject({ state: S.G_STATES.HONORED, route: '/o/comp_alpha/projects/{project}@anonymous' });
    // Η εγγραφή ταξιδεύει σε αναφορά/artifact: ΠΟΤΕ τα πραγματικά ids (ίδιο `settle()` με τον Χ).
    expect(record).not.toHaveProperty('fetchUrl');
  });
});

describe('Φ7 — ο πληθυσμός', () => {
  const enumerated = [
    { file: 'a', url: '/search', template: '/search', dynamic: false },
    { file: 'b', url: '/o/ssr-probe/dashboard', template: '/o/[workspace]/dashboard', dynamic: true },
    { file: 'c', url: '/o/ssr-probe/projects/ssr-probe', template: '/o/[workspace]/projects/[id]', dynamic: true },
  ];
  const expanded = [
    enumerated[0],
    { ...enumerated[1], url: '/o/comp_alpha/dashboard', fetchUrl: '/o/comp_alpha/dashboard', persona: 'organization:internal_user' },
    { ...enumerated[1], url: '/o/comp_alpha/dashboard', fetchUrl: '/o/comp_alpha/dashboard', persona: 'organization:company_admin' },
    { ...enumerated[2], url: '/o/comp_alpha/projects/{project}', fetchUrl: REQUESTED, persona: 'organization:internal_user' },
  ];

  it('ένας δίδυμος ανά /o/**, από την ΠΡΩΤΗ κλάση, χωρίς persona, με ταυτότητα @anonymous', () => {
    const twins = G.guardTwinsOf(enumerated, expanded);
    expect(twins.map((twin) => [twin.template, twin.fetchUrl, twin.persona, ID.routeIdOf(twin)])).toEqual([
      ['/o/[workspace]/dashboard', '/o/comp_alpha/dashboard', undefined, '/o/comp_alpha/dashboard@anonymous'],
      ['/o/[workspace]/projects/[id]', REQUESTED, undefined, '/o/comp_alpha/projects/{project}@anonymous'],
    ]);
    expect(() => G.assertTwinCoverage(twins, enumerated)).not.toThrow();
  });

  it('χωρίς manifest (ανώνυμα, τοπικά) ο δίδυμος πέφτει στην ίδια την απογραφή', () => {
    const twins = G.guardTwinsOf(enumerated, enumerated);
    expect(twins.map((twin) => twin.url)).toEqual(['/o/ssr-probe/dashboard', '/o/ssr-probe/projects/ssr-probe']);
  });

  it('δίδυμος που λείπει ⇒ throw· και «0 για 0» ΔΕΝ περνά (ανεξάρτητο κριτήριο: template)', () => {
    const twins = G.guardTwinsOf(enumerated, expanded);
    expect(() => G.assertTwinCoverage(twins.slice(1), enumerated)).toThrow(/λείπουν: \/o\/\[workspace\]\/dashboard/);
    // Σπασμένο `isWorkspaceRoute` (π.χ. άλλο συνθετικό τμήμα): 0 δίδυμοι — η πληρότητα το πιάνει.
    const drifted = enumerated.map((route) => ({ ...route, url: route.url.replace('ssr-probe', 'x') }));
    expect(G.guardTwinsOf(drifted, drifted)).toEqual([]);
    expect(() => G.assertTwinCoverage([], drifted)).toThrow(/0 δίδυμοι για 2/);
  });
});

describe('Φ8/Φ9 — η καλωδίωση στην πύλη', () => {
  const cli = require('../check-i18n-ssr-oracle.js');
  const { runSetRatchetCli } = require('../lib/ratchet-baseline');

  async function captureExit(fn) {
    const realExit = process.exit;
    const realErr = console.error;
    const realLog = console.log;
    const codes = [];
    process.exit = (code) => { codes.push(code); throw new Error('__exit__'); };
    console.error = () => {};
    console.log = () => {};
    try { await fn(); } catch (error) { if (error.message !== '__exit__') throw error; } finally {
      process.exit = realExit;
      console.error = realErr;
      console.log = realLog;
    }
    return codes;
  }

  const leak = { route: '/o/comp_alpha/dashboard@anonymous', state: S.G_STATES.NOT_HONORED, detail: 'δοκιμή', keys: [] };

  it('Φ8: ⛔ του δίδυμου ΜΠΛΟΚΑΡΕΙ τη ΣΥΓΚΡΙΣΗ — ακόμα κι όταν τα σύνολα είναι ίδια με τη baseline', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-twin-'));
    const baselineFile = path.join(dir, 'baseline.json');
    fs.writeFileSync(baselineFile, JSON.stringify({ violations: [], declarations: ['/search'] }));
    const measured = { records: [], guardRecords: [leak], violationIds: [], declarations: ['/search'], violations: [] };
    const descriptor = { ...cli.DESCRIPTOR, baselineFile, skipEnv: undefined, budgets: undefined, measure: async () => measured };

    expect(await captureExit(() => runSetRatchetCli(descriptor, ['node', 'x']))).toEqual([1]);
    // Χωρίς ⛔, το ΙΔΙΟ descriptor περνά — η άρνηση οφείλεται στον δίδυμο, όχι σε κάτι άλλο.
    const clean = { ...descriptor, measure: async () => ({ ...measured, guardRecords: [] }) };
    expect(await captureExit(() => runSetRatchetCli(clean, ['node', 'x']))).toEqual([0]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('Φ8: η σπορά αρνείται επίσης (ΠΟΤΕ σε baseline)', () => {
    expect(() => cli.buildPayload({ records: [], guardRecords: [leak], census: {}, violationIds: [], declarations: [] }))
      .toThrow(/ΜΗΔΕΝΙΚΗΣ ΑΝΟΧΗΣ/);
  });

  it('Φ9: ο δίδυμος ΔΕΝ είναι δήλωση — το `declarations` βγαίνει ΜΟΝΟ από τις διαδρομές του Χ', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'check-i18n-ssr-oracle.js'), 'utf8');
    expect(src).toMatch(/declarations: routes\.map\(declarationOf\)\.sort\(\)/);
    expect(src).not.toMatch(/guard\w*\.map\(declarationOf\)/);
    // Και τα 🔴 του δίδυμου ΜΠΑΙΝΟΥΝ στη ΜΙΑ πηγή ευρημάτων.
    expect(src).toMatch(/toViolations\(records\.concat\(guard\.records\)\)/);
  });
});
