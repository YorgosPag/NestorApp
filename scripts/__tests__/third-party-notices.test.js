/**
 * CHECK 3.84 / ADR-863 — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΑΠΟΔΟΣΗΣ ΑΔΕΙΩΝ.
 *
 * ⚠️ Οι μεταλλάξεις γίνονται στις **ΕΙΣΟΔΟΥΣ** (συνθετικό πακέτο / συνθετικά stats / συνθετικό
 * στιγμιότυπο), όχι στην πύλη — μια πύλη που κρίνει **περιεχόμενο** οφείλει να αποδείξει ότι
 * ξεχωρίζει περιεχόμενο.
 *
 * 🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ**: αν η πύλη δεν έβρισκε **τίποτα** εκεί, το
 * «0 παραβιάσεις» θα σήμαινε «δεν κοίταξα». Και ο παρονομαστής **δεν μετακινείται μαζί με τη
 * θεραπεία** (ADR-790 §9.1): δεν απαιτεί ζωντανή βλάβη, αλλά **μία** αλλαγή πολιτικής.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const T = require('../lib/third-party-notices/texts');
const G = require('../lib/third-party-notices/judge');
const S = require('../lib/third-party-notices/surfaces');
const R = require('../lib/third-party-notices/render');
const LP = require('../lib/license-policy/policy');

const REPO_ROOT = path.join(__dirname, '..', '..');
const REAL_POLICY_RAW = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, LP.POLICY_FILE_NAME), 'utf8'));

/** Η **ΠΡΑΓΜΑΤΙΚΗ** πολιτική με **μία** αλλαγή. ⚠️ Ποτέ δεύτερη λίστα αδειών μέσα στη σουίτα. */
function policyWith(mutate = () => {}) {
  const raw = JSON.parse(JSON.stringify(REAL_POLICY_RAW));
  mutate(raw);
  const compiled = LP.compilePolicy(raw);
  if (!compiled.ok) throw new Error(compiled.error);
  return compiled.policy;
}

const text = (source, files = [{ name: 'LICENSE', text: 'κείμενο' }], detail = null) => ({ source, files, detail });

const subject = (over = {}) => ({
  id: 'pkg@1.0.0', name: 'pkg', version: '1.0.0', license: 'MIT',
  surface: G.SURFACE.BROWSER, requiresAttribution: true, text: text(T.TEXT_SOURCE.PACKAGE), ...over,
});

// ─── Κ — μία κατάσταση η καθεμία, μία μετάλλαξη εισόδου ──────────────────────

describe('CHECK 3.84 — ταξιδεύει το κείμενο μαζί με το αντίγραφο;', () => {
  it('Κ1: διανέμεται, απαιτεί απόδοση, έχει δικό του κείμενο ⇒ ✅ attributed', () => {
    expect(G.judgePackage(subject()).state).toBe(G.STATES.ATTRIBUTED);
  });

  it('Κ2: διανέμεται, απαιτεί απόδοση, ΚΑΝΕΝΑ κείμενο ⇒ 🔴 notice-text-missing', () => {
    const row = G.judgePackage(subject({ text: text(T.TEXT_SOURCE.MISSING, []) }));
    expect(row.state).toBe(G.STATES.NOTICE_TEXT_MISSING);
  });

  it('Κ3: το κείμενο ήρθε από το κανονικό licenses/ ⇒ ✅ ΔΗΛΩΜΕΝΟ, όχι σιωπηλό', () => {
    const row = G.judgePackage(subject({ text: text(T.TEXT_SOURCE.CANONICAL, [{ name: 'licenses/MIT.txt', text: 'x' }]) }));
    expect(row.state).toBe(G.STATES.ATTRIBUTED_CANONICAL);
  });

  /** ⚠️ Μισό νομικό κείμενο είναι χειρότερο από καθόλου — **μοιάζει** πλήρες. */
  it('Κ4: κείμενο μη αναγνώσιμο ή υπερμέγεθες ⇒ ⛔ notice-text-unusable', () => {
    for (const bad of [T.TEXT_SOURCE.UNREADABLE, T.TEXT_SOURCE.OVERSIZE]) {
      expect(G.judgePackage(subject({ text: text(bad, []) })).state).toBe(G.STATES.NOTICE_TEXT_UNUSABLE);
    }
  });

  it('Κ5: μένει στον διακομιστή ⇒ ✅ server-only, καμία υποχρέωση', () => {
    const row = G.judgePackage(subject({ surface: G.SURFACE.SERVER, text: text(T.TEXT_SOURCE.MISSING, []) }));
    expect(row.state).toBe(G.STATES.SERVER_ONLY);
  });

  it('Κ6: κανείς δεν ξέρει πού καταλήγει ⇒ ⛔ surface-unknown (fail-closed)', () => {
    expect(G.judgePackage(subject({ surface: G.SURFACE.UNKNOWN })).state).toBe(G.STATES.SURFACE_UNKNOWN);
  });

  it('Κ7: η άδεια δεν απαιτεί απόδοση ⇒ ✅ χωρίς υποχρέωση', () => {
    const row = G.judgePackage(subject({ requiresAttribution: false, text: text(T.TEXT_SOURCE.MISSING, []) }));
    expect(row.state).toBe(G.STATES.NO_ATTRIBUTION_REQUIRED);
  });

  /**
   * 🔑 **Η ΣΕΙΡΑ ΕΙΝΑΙ ΦΕΡΟΥΣΑ**: «διανέμεται;» ΠΡΙΝ «έχει κείμενο;». Ανάποδα θα μαζεύαμε
   * ελλείψεις για πακέτα που δεν διανέμονται ποτέ — θόρυβος πάνω από το κατώφλι <10%
   * ψευδώς θετικών που η Google θέτει για blocking checks.
   */
  it('Κ8: server + χωρίς κείμενο ⇒ ΔΕΝ είναι έλλειψη (η σειρά των ερωτημάτων)', () => {
    const row = G.judgePackage(subject({ surface: G.SURFACE.SERVER, text: text(T.TEXT_SOURCE.MISSING, []) }));
    expect(row.state).not.toBe(G.STATES.NOTICE_TEXT_MISSING);
  });

  it('Κ9: η λογιστική ΚΛΕΙΝΕΙ — κάθε στοιχείο ακριβώς μία κατάσταση', () => {
    const verdict = G.judge([subject(), subject({ id: 'b@1', surface: G.SURFACE.SERVER })]);
    expect(Object.values(verdict.tally).reduce((a, b) => a + b, 0)).toBe(verdict.rows.length);
  });

  it('Κ10: άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ (fail-closed λογιστική)', () => {
    expect(() => G.tallyOf([{ state: 'φαντασμα', id: 'x' }])).toThrow(/άγνωστη κατάσταση/);
  });

  /** ⚠️ Ταυτότητα «κατάσταση :: πακέτο» — αλλιώς η **ανταλλαγή** περνά αθόρυβα (ADR-749). */
  it('Κ11: η ταυτότητα ratchet περιέχει ΚΑΙ την κατάσταση, όχι μόνο το πακέτο', () => {
    expect(G.violationId({ state: 'notice-text-missing', id: 'pkg@1' })).toBe('notice-text-missing :: pkg@1');
  });
});

// ─── Τ — το κείμενο: από πού ήρθε, και τι γίνεται όταν λείπει ────────────────

describe('Τ — η προέλευση του κειμένου είναι ΡΗΤΗ, ποτέ σιωπή', () => {
  it('Τ1: κατάλογος χωρίς LICENSE ⇒ missing ΜΕ ΑΙΤΙΑ', () => {
    const res = T.readPackageTexts('/ψευτικο', { readDir: () => ['index.js', 'package.json'] });
    expect(res.ok).toBe(false);
    expect(res.state).toBe(T.TEXT_SOURCE.MISSING);
  });

  /** ⚠️ Το `NOTICE` ΔΕΝ είναι το `LICENSE`: Apache-2.0 §4(δ) είναι ξεχωριστή υποχρέωση. */
  it('Τ2: μαζεύονται ΚΑΙ το LICENSE ΚΑΙ το NOTICE, όχι το πρώτο που ταίριαξε', () => {
    const io = {
      readDir: () => ['LICENSE', 'NOTICE', 'README.md'],
      stat: () => ({ size: 10 }),
      readFile: (f) => `κείμενο του ${path.basename(f)}`,
    };
    const res = T.readPackageTexts('/π', io);
    expect(res.files.map((f) => f.name)).toEqual(['LICENSE', 'NOTICE']);
  });

  /** ⚠️ Αγκυρωμένο στην ΑΡΧΗ: χαλαρό `includes('license')` θα μάζευε ΚΩΔΙΚΑ ως νομικό κείμενο. */
  it('Τ3: το κριτήριο ονόματος δεν πιάνει πηγαία αρχεία με τη λέξη «license»', () => {
    for (const good of ['LICENSE', 'LICENCE', 'LICENSE.txt', 'LICENSE-MIT', 'COPYING', 'NOTICE.md']) {
      expect(T.isLicenseFileName(good)).toBe(true);
    }
    // 🔴 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΧΩΡΙΣ τον φρουρό κατάληξης, το σκέτο σχήμα τα δέχεται.
    expect(T.LICENSE_FILE_RE.test('license-check.js')).toBe(true);
    for (const bad of ['license-check.js', 'eslint-license-header.js', 'licenses.json', 'LICENSE.ts']) {
      expect(T.isLicenseFileName(bad)).toBe(false);
    }
  });

  it('Τ4: υπερμέγεθες ⇒ ρητή κατάσταση, ΠΟΤΕ σιωπηλή περικοπή', () => {
    const io = { readDir: () => ['LICENSE'], stat: () => ({ size: T.MAX_TEXT_BYTES + 1 }), readFile: () => 'x' };
    expect(T.readPackageTexts('/π', io).state).toBe(T.TEXT_SOURCE.OVERSIZE);
  });

  /**
   * 🔴 ΓΡΑΦΤΗΚΕ ΕΠΕΙΔΗ Η ΜΕΤΡΗΣΗ ΤΟ ΑΠΑΙΤΗΣΕ: η πρώτη γραφή δεχόταν μόνο **απλό** id, άρα
   * το `Apache-2.0 AND MIT` (υπαρκτό στο δέντρο) έμενε «χωρίς κείμενο» ΕΝΩ έχουμε και τα δύο.
   */
  it('Τ5: σύνθετη έκφραση ⇒ κανονικό κείμενο ΑΝΑ ΦΥΛΛΟ', () => {
    const files = T.canonicalTexts(REPO_ROOT, 'Apache-2.0 AND MIT');
    expect(files).not.toBeNull();
    expect(files.map((f) => f.name).sort()).toEqual(['licenses/Apache-2.0.txt', 'licenses/MIT.txt']);
  });

  /** ⚠️ ΟΛΑ Ή ΤΙΠΟΤΑ: μισή υποχρέωση **μοιάζει** πλήρης. */
  it('Τ6: αν λείπει ΕΝΑ φύλλο, δεν αποδίδεται τίποτα', () => {
    expect(T.canonicalTexts(REPO_ROOT, 'MIT AND LicenseRef-Δεν-Υπάρχει')).toBeNull();
  });

  it('Τ7: id που δεν είναι SPDX δεν γίνεται ΠΟΤΕ διαδρομή αρχείου', () => {
    expect(T.canonicalText(REPO_ROOT, '../../etc/passwd')).toBeNull();
    expect(T.canonicalText(REPO_ROOT, 'MIT/../MIT')).toBeNull();
  });
});

// ─── Σ — η επιφάνεια: το build αποφασίζει, όχι η δήλωση ──────────────────────

describe('Σ — η δήλωση ΔΕΝ αυτοεπιβεβαιώνεται', () => {
  /** ⚠️ `.npmrc` = `node-linker=isolated` ⇒ η διάταξη pnpm είναι η ΠΡΑΓΜΑΤΙΚΗ εδώ. */
  it('Σ1: όνομα πακέτου από διαδρομή — ΚΑΙ επίπεδη ΚΑΙ pnpm, ποτέ «.pnpm»', () => {
    expect(S.packageNameFromModulePath('../node_modules/foo/dist/x.js')).toBe('foo');
    expect(S.packageNameFromModulePath('./node_modules/.pnpm/foo@1.2.3/node_modules/foo/i.js')).toBe('foo');
    expect(S.packageNameFromModulePath('node_modules/.pnpm/@sc+p@1/node_modules/@sc/p/i.js')).toBe('@sc/p');
    expect(S.packageNameFromModulePath('src/app/page.tsx')).toBeNull();
  });

  /**
   * 🔑 **«0 = κανείς δεν κοίταξε»** — το σχήμα που αυτό το repo έχει πληρώσει μετρημένα έξι
   * φορές. Κενή λίστα εδώ θα διαβαζόταν ως «κανένα πακέτο δεν φτάνει στον browser».
   */
  it('Σ2: stats λάθος σχήματος ⇒ ok:false ΜΕ ΑΙΤΙΑ, ποτέ κενή λίστα', () => {
    expect(S.packagesFromStats(null).ok).toBe(false);
    expect(S.packagesFromStats({}).ok).toBe(false);
    expect(S.packagesFromStats({ modules: [] }).ok).toBe(false);
    expect(S.packagesFromStats({ modules: [{ name: 'src/x.ts' }] }).ok).toBe(false);
  });

  it('Σ3: έγκυρα stats ⇒ ταξινομημένα ονόματα πακέτων', () => {
    const res = S.packagesFromStats({ modules: [
      { name: './node_modules/.pnpm/b@1/node_modules/b/i.js' },
      { name: './node_modules/a/i.js' },
    ] });
    expect(res).toMatchObject({ ok: true, packages: ['a', 'b'], modules: 2 });
  });

  /** 🔑 Το ΜΕΤΡΗΜΕΝΟ υπερισχύει της δήλωσης — αλλιώς η δήλωση θα έκρυβε γεγονός. */
  it('Σ4: πακέτο στο μετρημένο browser ΥΠΕΡΙΣΧΥΕΙ ισχυρισμού «server»', () => {
    const snap = { measured: true, browser: ['sharp'], claims: { sharp: { surface: 'server', why: 'ω' } } };
    expect(S.surfaceOf(snap, 'sharp')).toBe(G.SURFACE.BROWSER);
  });

  it('Σ5: χωρίς μέτρηση, ό,τι δεν έχει ισχυρισμό είναι UNKNOWN (fail-closed)', () => {
    const snap = { measured: false, browser: [], claims: { a: { surface: 'server', why: 'ω' } } };
    expect(S.surfaceOf(snap, 'a')).toBe(G.SURFACE.SERVER);
    expect(S.surfaceOf(snap, 'β')).toBe(G.SURFACE.UNKNOWN);
  });

  /** 🎯 **ΕΔΩ ΠΕΦΤΕΙ ΤΟ `sharp`** αν κάποτε διαρρεύσει στο client bundle. */
  it('Σ6: ισχυρισμός «server» που το build ΔΙΕΨΕΥΣΕ ⇒ αναφέρεται ονομαστικά', () => {
    const snap = { claims: { sharp: { surface: 'server', why: 'LGPL' } } };
    expect(S.refutedClaims(snap, ['sharp']).map((r) => r.name)).toEqual(['sharp']);
    expect(S.refutedClaims(snap, ['άλλο'])).toEqual([]);
  });

  it('Σ7: στιγμιότυπο που λείπει ⇒ ok:false ΜΕ ΟΔΗΓΙΑ, ποτέ σιωπηλό «server»', () => {
    const res = S.loadSnapshot(REPO_ROOT, { exists: () => false });
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/σπείρε|CI/);
  });
});

// ─── Π — ο παρονομαστής: το ΠΡΑΓΜΑΤΙΚΟ δέντρο ───────────────────────────────

describe('Π — το πραγματικό δέντρο', () => {
  /**
   * 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ. Με **μία** αλλαγή πολιτικής («η notice δεν απαιτεί απόδοση»), ο
   * πληθυσμός της υποχρέωσης **οφείλει** να καταρρεύσει. Αν έμενε ίδιος, η πύλη δεν θα
   * κοίταζε την πολιτική καθόλου. ⚠️ ΔΕΝ απαιτεί ζωντανή βλάβη (ADR-790 §9.1).
   */
  it('Π1: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — η πολιτική ΟΝΤΩΣ κρίνει ποιος απαιτεί απόδοση', () => {
    const real = policyWith();
    const loose = policyWith((raw) => { raw.categories.notice.attribution = 'none'; });
    expect(LP.requiresAttribution(real, 'MIT')).toBe(true);
    expect(LP.requiresAttribution(loose, 'MIT')).toBe(false);
    // …και η `unencumbered` μένει «none» και στις δύο — δεν είναι καθολικός διακόπτης.
    expect(LP.requiresAttribution(real, 'CC0-1.0')).toBe(false);
  });

  /** 🔴 Το νομικό κενό που ΕΚΛΕΙΣΕ: η MIT ήταν ΑΟΡΑΤΗ στο χειρόγραφο Set. */
  it('Π2: MIT/ISC/BSD απαιτούν απόδοση — το κενό του παλιού χειρόγραφου συνόλου', () => {
    const p = policyWith();
    for (const id of ['MIT', 'ISC', 'BSD-3-Clause', 'Apache-2.0']) {
      expect(LP.requiresAttribution(p, id)).toBe(true);
    }
  });

  /** 🔑 Οι σύνθετες λύνονται από την ΥΠΑΡΧΟΥΣΑ αποτίμηση, χωρίς δεύτερη λογική. */
  it('Π3: OR ⇒ ευνοϊκότερη, AND ⇒ αυστηρότερη', () => {
    const p = policyWith();
    expect(LP.requiresAttribution(p, 'MIT OR CC0-1.0')).toBe(false);
    expect(LP.requiresAttribution(p, 'MIT AND CC0-1.0')).toBe(true);
  });

  it('Π4: τα κανονικά κείμενα ΥΠΑΡΧΟΥΝ και έχουν τεκμήριο προέλευσης', () => {
    const sources = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'licenses', 'SOURCES.json'), 'utf8'));
    for (const [id, meta] of Object.entries(sources.licenses)) {
      expect(fs.existsSync(path.join(REPO_ROOT, 'licenses', `${id}.txt`))).toBe(true);
      expect(meta.sourcePackage).toBeTruthy();
    }
  });

  /**
   * 🔴 **ΤΟ ΛΑΘΟΣ ΠΟΥ ΕΓΙΝΕ ΚΑΙ ΔΙΟΡΘΩΘΗΚΕ, ΚΑΡΦΩΜΕΝΟ**: η πρώτη σπορά άφησε μέσα το
   * «Copyright (c) 2024-present The Fastify team», δηλαδή θα απέδιδε **15 άσχετα πακέτα**
   * στον Fastify. Αν κάποιος ξανασπείρει με σπασμένο αλγόριθμο, εδώ κοκκινίζει.
   */
  it('Π5: κανένα κανονικό κείμενο δεν κουβαλά copyright ΣΥΓΚΕΚΡΙΜΕΝΟΥ εκδότη', () => {
    const dir = path.join(REPO_ROOT, 'licenses');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const body = fs.readFileSync(path.join(dir, file), 'utf8');
      expect(body).not.toMatch(/Fastify|Elan Shanker|Daniel Wirtz|JS Foundation|Functional Software/i);
    }
  });
});

// ─── Ζ — ο φρουρός του zero-tolerance, ΚΑΙ η καλωδίωσή του ──────────────────

describe('Ζ — το zero-tolerance ΜΠΛΟΚΑΡΕΙ όντως', () => {
  const cli = require('../check-third-party-notices.js');

  function captureExit(fn) {
    const realExit = process.exit;
    const realErr = console.error;
    const realWarn = console.warn;
    const codes = [];
    process.exit = (c) => { codes.push(c); throw new Error('__exit__'); };
    console.error = () => {};
    console.warn = () => {};
    try { fn(); } catch (e) { if (e.message !== '__exit__') throw e; }
    finally { process.exit = realExit; console.error = realErr; console.warn = realWarn; }
    return codes;
  }

  const blocking = () => ({ awaiting: false, blocking: [{ state: 'notices-stale', id: 'x', detail: 'δοκιμή' }] });
  const clean = () => ({ awaiting: false, blocking: [] });

  it('Ζ1: μπλοκάρουσα κατάσταση ⇒ έξοδος με 1', () => {
    expect(captureExit(() => cli.enforceZeroTolerance([], blocking))).toEqual([1]);
  });

  it('Ζ2: καθαρή κατάσταση ⇒ καμία έξοδος', () => {
    expect(captureExit(() => cli.enforceZeroTolerance([], clean))).toEqual([]);
  });

  it('Ζ3: `--report` ΔΕΝ μπλοκάρει — ο άνθρωπος πρέπει να ΔΕΙ τι έσπασε', () => {
    expect(captureExit(() => cli.enforceZeroTolerance(['--report'], blocking))).toEqual([]);
  });

  /** ⏳ Η αναμονή σποράς ΔΕΝ μπλοκάρει, αλλά ΔΕΝ είναι και ψευδώς πράσινη. */
  it('Ζ4: αναμονή μέτρησης ⇒ δεν μπλοκάρει, αλλά ανακοινώνεται', () => {
    const awaiting = () => ({ awaiting: true, blocking: [] });
    expect(captureExit(() => cli.enforceZeroTolerance([], awaiting))).toEqual([]);
  });

  it('Ζ5: η σπορά ΑΡΝΕΙΤΑΙ να κλειδώσει μπλοκάρουσα κατάσταση σε baseline', () => {
    expect(() => cli.buildPayload({ blocking: [{ state: 'notices-stale' }] })).toThrow(/άρνηση σποράς/);
  });

  /** 🔑 Η ΚΑΛΩΔΙΩΣΗ — το `Ζ1` θα έμενε πράσινο ακόμη κι αν κανείς δεν καλούσε τον φρουρό. */
  it('Ζ6: το CLI καλεί τον φρουρό ΠΡΙΝ το ratchet', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'check-third-party-notices.js'), 'utf8');
    const guard = src.indexOf('enforceZeroTolerance(process.argv');
    const ratchetCall = src.indexOf('runSetRatchetCli({');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(ratchetCall);
  });

  /** 🔴 Το μπαγιάτικο artifact: το σχήμα που αυτό το repo πλήρωσε τέσσερις φορές. */
  it('Ζ7: αποτύπωμα που δεν ταιριάζει ⇒ μπαγιάτικο ΜΕ ΑΙΤΙΑ', () => {
    expect(cli.staleness({ fingerprint: 'δεν-ταιριάζει-ποτέ' })).toMatchObject({ stale: true });
    const real = require('../generate-third-party-notices').inputsFingerprint();
    expect(cli.staleness({ fingerprint: real }).stale).toBe(false);
  });
});

// ─── Ρ — η παρουσίαση: δύο μορφές, ΜΙΑ πηγή ─────────────────────────────────

describe('Ρ — ό,τι βλέπει ο παραλήπτης', () => {
  const verdict = G.judge([
    subject({ id: 'a@1', name: 'a', version: '1' }),
    subject({ id: 'b@1', name: 'b', version: '1', surface: G.SURFACE.SERVER }),
  ]);
  verdict.rows = verdict.rows.map((r) => ({ ...subject({ id: r.id, name: r.id.split('@')[0], version: '1' }), ...r }));

  it('Ρ1: το κείμενο χωρίζει ΔΙΑΝΟΜΗ από ΕΚΤΕΛΕΣΗ — χωριστές ενότητες', () => {
    const out = R.renderNotices(verdict, { generatedAt: 'τ', fingerprint: 'φ' });
    expect(out).toContain('ΜΕΡΟΣ Α — ΔΙΑΝΕΜΕΤΑΙ ΣΤΟ ΠΡΟΓΡΑΜΜΑ ΠΕΡΙΗΓΗΣΗΣ');
    expect(out).toContain('ΜΕΡΟΣ Β — ΕΚΤΕΛΕΙΤΑΙ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ');
    expect(out).toContain('sha256:φ');
  });

  it('Ρ2: το SBOM είναι CycloneDX και φέρει το ΙΔΙΟ αποτύπωμα — δεν μπορούν να αποκλίνουν', () => {
    const sbom = JSON.parse(R.renderSbom(verdict, { generatedAt: 'τ', fingerprint: 'φ' }));
    expect(sbom.bomFormat).toBe('CycloneDX');
    expect(sbom.components).toHaveLength(2);
    expect(sbom.components[0].purl).toMatch(/^pkg:npm\//);
    expect(sbom.metadata.properties[0].value).toBe('sha256:φ');
  });

  // ─── Ι — ΤΟ ΤΡΙΤΟ ΠΑΡΑΔΟΤΕΟ: Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΟΘΟΝΗΣ (ADR-863 Φ3) ──────────

  const index = (measured) => JSON.parse(R.renderIndex(verdict, { generatedAt: 'τ', fingerprint: 'φ', measured }));

  it('Ι1: ο κατάλογος φέρει ΤΟ ΙΔΙΟ αποτύπωμα — τρεις μορφές, μία κρίση', () => {
    expect(index(true).fingerprint).toBe('sha256:φ');
    expect(index(true).rows).toHaveLength(verdict.rows.length);
  });

  /**
   * 🔑 **ΤΕΣΣΕΡΑ ΠΕΔΙΑ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ**: το SBOM είναι 586 KB· η οθόνη χρειάζεται
   * όνομα · έκδοση · άδεια · επιφάνεια. Ένα πέμπτο πεδίο που γλιστρά εδώ είναι bytes που
   * κατεβαίνουν σε συσκευή χωρίς να τα ζητά κανείς.
   */
  it('Ι2: ΜΟΝΟ τα τέσσερα πεδία που αποδίδει η οθόνη — κανένα λαθρεπιβάτης', () => {
    for (const row of index(true).rows) {
      expect(Object.keys(row).sort()).toEqual(['l', 'n', 's', 'v']);
    }
  });

  /**
   * 🔴 Η ΔΙΑΦΟΡΑ ΑΝΑΜΕΣΑ ΣΕ «ΑΓΝΟΙΑ» ΚΑΙ «ΑΠΑΛΛΑΓΗ», ΚΑΙ ΕΙΝΑΙ ΟΛΟΚΛΗΡΗ. Χωρίς το
   * `measured`, η οθόνη θα έδειχνε «0 διανέμονται» τη στιγμή που **κανείς δεν κοίταξε** —
   * το σχήμα που αυτό το repo καταγγέλλει σε N.11 · N.12 · N.18 · 3.18.
   */
  it('Ι3: το `measured` ταξιδεύει ΑΥΤΟΥΣΙΟ — η οθόνη μπορεί να πει «δεν μετρήθηκε»', () => {
    expect(index(false).measured).toBe(false);
    expect(index(true).measured).toBe(true);
  });

  /** ⚠️ Κατεβαίνει σε **συσκευή**, σε αντίθεση με το SBOM που το ζητά μηχανή. */
  it('Ι4: συμπαγές, χωρίς εσοχές — αλλιώς ~40% bytes σε κάθε επίσκεψη', () => {
    expect(R.renderIndex(verdict, { generatedAt: 'τ', fingerprint: 'φ' })).not.toMatch(/\n {2}"/);
  });

  /**
   * 🧹 **Η ΚΑΛΩΔΙΩΣΗ ΤΟΥ ΦΡΟΥΡΟΥ ΦΡΕΣΚΑΔΑΣ** (πρότυπο `Ζ6`). Μέχρι την Φ3 το
   * `staleness()` κοιτούσε **μόνο** το `.txt`: το `sbom.json` παραγόταν από την ίδια
   * κρίση με το ίδιο αποτύπωμα και **κανείς δεν το ρωτούσε**. Χωρίς αυτή την άγκυρα, η
   * επέκταση μπορεί να αναιρεθεί σιωπηλά.
   */
  it('Ι5: ο φρουρός φρεσκάδας ρωτά ΚΑΙ ΤΑ ΤΡΙΑ παραγόμενα, όχι μόνο το κείμενο', () => {
    const generator = require('../generate-third-party-notices');
    expect(generator.INDEX_FILE).toMatch(/index\.json$/);
    const src = fs.readFileSync(path.join(__dirname, '..', 'check-third-party-notices.js'), 'utf8');
    for (const artifact of ['NOTICES_FILE', 'SBOM_FILE', 'INDEX_FILE']) {
      expect(src).toContain(`generator.${artifact}`);
    }
  });
});
