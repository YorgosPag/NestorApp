/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ — CHECK 3.58, Η ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΟΥ ΧΩΡΟΥ (ADR-787 §5.2)
 *
 * ⚠️ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ **ΕΙΣΟΔΟΥΣ**, ΟΧΙ ΣΤΗΝ ΠΥΛΗ. Μίνι-repo από τα
 *    **πραγματικά** αρχεία, **μία** γραμμή αλλαγή. Μετάλλαξη στην ίδια την πύλη
 *    αποδεικνύει μόνο ότι η πύλη εκτελείται (μάθημα CHECK 3.44/3.47/3.52).
 *
 * ⚠️ ΤΟ `miniRepo` ΟΥΡΛΙΑΖΕΙ ΑΝ Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ. Στη Φάση 1 μια μετάλλαξη
 *    βγήκε **ψεύτικα πράσινη** επειδή το μοτίβο δεν ταίριαξε και το αρχείο έμεινε ίδιο
 *    (ADR-787 handoff §3.3). Εδώ αυτό είναι **σφάλμα**, όχι επιτυχία.
 *
 * ⚠️ ΤΟ COMMIT ΤΗΣ ΒΑΘΜΟΝΟΜΗΣΗΣ ΕΙΝΑΙ **ΚΑΡΦΩΜΕΝΟ**, ΠΟΤΕ `HEAD`: το `HEAD` μετακινείται
 *    και τα Π θα αυτοακυρώνονταν σιωπηλά (μάθημα CHECK 3.41/3.45).
 *
 * ⚠️ `@jest-environment node`: η πύλη διαβάζει τον δίσκο· σε jsdom κάποιες σουίτες αυτού
 *    του repo έχουν σκάσει με σφάλμα **περιβάλλοντος** που διαβάζεται ως «σπασμένη πύλη»
 *    (μάθημα CHECK 3.46).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const gate = require('../check-workspace-authority');
const REPO_ROOT = path.join(__dirname, '..', '..');

/** Το commit ΠΡΙΝ τη θεραπεία του ADR-787 §5.2 στ — **καρφωμένο**. */
const BEFORE_CURE = '7ccfc4fd';

const REGISTRY_REL = '.workspace-authority.json';

/**
 * Τα αρχεία που **ορίζουν** την απάντηση — πραγματικά, αντιγραμμένα αυτούσια.
 *
 * Το `src/services/firestore/auth-context.ts` είναι **επίτηδες** μέσα: κουβαλά τη
 * **ζωντανή** ομωνυμία (`resolveEffectiveCompanyId` του πελάτη), ώστε το μίνι-repo να
 * μην είναι τεχνητά καθαρό.
 */
const FIXTURE_FILES = [
  REGISTRY_REL,
  'src/lib/auth/workspace-membership.ts',
  'src/types/workspace-membership.ts',
  'src/lib/auth/auth-context.ts',
  'src/services/ai-pipeline/shared/super-admin-resolver.ts',
  'src/services/firestore/auth-context.ts',
];

/** Το περιεχόμενο ενός αρχείου σε **καρφωμένο** commit. Σκάει σε κενή απάντηση. */
function gitShow(commit, rel) {
  const out = execFileSync('git', ['show', `${commit}:${rel}`], {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
  });
  if (!out || out.trim().length === 0) {
    throw new Error(`git show ${commit}:${rel} → κενό. Λάθος commit ή μονοπάτι.`);
  }
  return out;
}

/**
 * Μίνι-repo με τα ΑΚΡΙΒΗ μονοπάτια που περιμένει ο σαρωτής.
 * `edits` = `{ 'σχετικό/μονοπάτι': (πηγή) => νέα πηγή }` — μία γραμμή, πραγματικό αρχείο.
 */
function miniRepo(edits = {}, extraFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wa358-'));
  for (const rel of FIXTURE_FILES) {
    let source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    if (edits[rel]) {
      const next = edits[rel](source);
      // Μια μετάλλαξη που δεν άλλαξε τίποτα είναι ο ορισμός του νεκρού test.
      if (next === source) throw new Error(`η μετάλλαξη στο ${rel} ΔΕΝ άλλαξε τίποτα.`);
      source = next;
    }
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }
  for (const [rel, source] of Object.entries(extraFiles)) {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }
  return root;
}

const run = (edits = {}, extraFiles = {}) => gate.measure({ root: miniRepo(edits, extraFiles) });

/** Οι ταυτότητες που το μίνι-repo έχει **ήδη** — οι μεταλλάξεις κρίνονται στη ΔΙΑΦΟΡΑ. */
const BASE = run();
const BASE_UNJUDGED = new Set(BASE.unjudged.map((f) => `${f.detail}@${f.file}`));
const BASE_VIOLATIONS = new Set(BASE.violationIds);
const BASE_DECLS = new Set(BASE.declarations);

const newUnjudged = (m) => m.unjudged
  .map((f) => `${f.detail}@${f.file}`).filter((id) => !BASE_UNJUDGED.has(id));
const newViolations = (m) => m.violationIds.filter((id) => !BASE_VIOLATIONS.has(id));
const newDecls = (m) => m.declarations.filter((id) => !BASE_DECLS.has(id));

// ═══════════════════════════════════════════════════════════════════════════════
// Μ0 — Η ΒΑΣΙΚΗ ΚΑΤΑΣΤΑΣΗ ΤΟΥ ΖΩΝΤΑΝΟΥ ΔΕΝΤΡΟΥ
// ═══════════════════════════════════════════════════════════════════════════════

describe('Μ0 — το ζωντανό δέντρο', () => {
  it('Μ0α — κανένα κανάλι χωρίς κριτή (zero-tolerance)', () => {
    expect(gate.measure().unjudged).toEqual([]);
  });

  it('Μ0β — ΕΧΕΙ κρίνει αναγνώστες: ο ΠΑΡΟΝΟΜΑΣΤΗΣ', () => {
    // Χωρίς αυτό, το «0 παραβιάσεις» του Μ0α θα μπορούσε να σημαίνει «δεν κοίταξα».
    const m = gate.measure();
    expect(m.declarations.length).toBeGreaterThanOrEqual(2);
    expect(m.ledger['channel-judged'].length).toBe(m.declarations.length);
  });

  it('Μ0γ — η λογιστική κλείνει και το μίνι-repo είναι πραγματικό, όχι τεχνητά καθαρό', () => {
    expect(BASE.unjudged).toEqual([]);
    // Κουβαλά τη ζωντανή ομωνυμία του πελάτη — αλλιώς οι μεταλλάξεις Κ3 θα κρίνονταν
    // σε κόσμο που δεν υπάρχει.
    expect(BASE.violationIds).toContain(
      'resolveEffectiveCompanyId@src/services/firestore/auth-context.ts',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Π — ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ ΚΩΔΙΚΑ
// ═══════════════════════════════════════════════════════════════════════════════

describe('Π — η πύλη κοκκινίζει στον ΠΡΑΓΜΑΤΙΚΟ κώδικα πριν τη θεραπεία', () => {
  it('Π1 — ο resolver του 7ccfc4fd διάβαζε το κανάλι ΧΩΡΙΣ κριτή ⇒ ⛔', () => {
    const m = run({
      'src/services/ai-pipeline/shared/super-admin-resolver.ts':
        () => gitShow(BEFORE_CURE, 'src/services/ai-pipeline/shared/super-admin-resolver.ts'),
    });
    expect(newUnjudged(m)).toEqual([
      'user-doc-active-company@src/services/ai-pipeline/shared/super-admin-resolver.ts',
    ]);
  });

  it('Π2 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η σημερινή εκδοχή του ΙΔΙΟΥ αρχείου περνά', () => {
    // Χωρίς αυτό, το Π1 θα μπορούσε να είναι κόκκινο για οποιονδήποτε άλλο λόγο.
    expect(newUnjudged(run())).toEqual([]);
    expect(BASE.declarations).toContain(
      'user-doc-active-company@src/services/ai-pipeline/shared/super-admin-resolver.ts',
    );
  });

  it('Π3 — το `gitShow` ΣΚΑΕΙ σε λάθος μονοπάτι (δεν επιστρέφει σιωπηλά κενό)', () => {
    expect(() => gitShow(BEFORE_CURE, 'src/δεν/υπάρχει.ts')).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ
// ═══════════════════════════════════════════════════════════════════════════════

describe('Μ — μεταλλάξεις στις εισόδους', () => {
  it('Μ1 — αν ο κριτής φύγει από τον αναγνώστη ⇒ ⛔ channel-unjudged', () => {
    const m = run({
      'src/services/ai-pipeline/shared/super-admin-resolver.ts':
        (s) => s.replace(/await decideMembership\(/, 'await Promise.resolve('),
    });
    expect(newUnjudged(m)).toEqual([
      'user-doc-active-company@src/services/ai-pipeline/shared/super-admin-resolver.ts',
    ]);
  });

  it('Μ2 — αν ο κριτής φύγει από το ΣΥΝΟΡΟ HTTP ⇒ ⛔ (το κανάλι της Φάσης 1)', () => {
    const m = run({
      'src/lib/auth/auth-context.ts':
        (s) => s.replace(/await decideMembership\(/, 'await Promise.resolve('),
    });
    expect(newUnjudged(m)).toEqual(['http-header@src/lib/auth/auth-context.ts']);
  });

  it('Μ3 — ΝΕΟΣ αναγνώστης καναλιού, ΑΚΟΜΑ ΚΙ ΑΝ σωστός ⇒ νέα δήλωση (Κ2)', () => {
    // Η ΣΩΣΤΗ πράξη της Φάσης 3, γραμμένη σωστά: πρέπει να ΦΑΙΝΕΤΑΙ.
    const m = run({}, {
      'src/app/api/phase3/route.ts': [
        "import { decideMembership } from '@/lib/auth/workspace-membership';",
        "export async function GET(req) {",
        "  const id = req.headers.get('x-super-admin-company-id');",
        "  return decideMembership({ requested: id });",
        '}',
      ].join('\n'),
    });
    expect(newDecls(m)).toEqual(['http-header@src/app/api/phase3/route.ts']);
    expect(newUnjudged(m)).toEqual([]);
  });

  it('Μ4 — ΝΕΟΣ αναγνώστης ΧΩΡΙΣ κριτή ⇒ ⛔, όχι απλώς νέα δήλωση', () => {
    const m = run({}, {
      'src/app/api/phase3/route.ts': [
        "export async function GET(req) {",
        "  return req.headers.get('x-super-admin-company-id');",
        '}',
      ].join('\n'),
    });
    expect(newUnjudged(m)).toEqual(['http-header@src/app/api/phase3/route.ts']);
    expect(newDecls(m)).toEqual([]);
  });

  it('Μ5 — ο ΠΕΛΑΤΗΣ δεν είναι αρχή: ίδιο αρχείο εκτός server ⇒ ΟΧΙ παραβίαση', () => {
    // Η διάκριση είναι ΠΑΡΑΓΟΜΕΝΗ. Το ίδιο ακριβώς σώμα, εκτός `src/app/api/**` και
    // χωρίς `server-only`/Admin SDK, είναι φίλτρο ερωτήματος — όχι χορήγηση άδειας.
    const m = run({}, {
      'src/components/Whatever.tsx':
        "export const x = () => document.head.dataset['x-super-admin-company-id'];",
    });
    expect(newUnjudged(m)).toEqual([]);
    expect(m.ledger['client-side'].length).toBeGreaterThan(BASE.ledger['client-side'].length);
  });

  it('Μ6 — ΔΕΥΤΕΡΟ σύμβολο με όνομα του λεξιλογίου ⇒ 🔴 duplicate-symbol (Κ3)', () => {
    const m = run({}, {
      'src/services/rogue/second-answer.ts':
        'export async function decideMembership(q) { return { verdict: "member" }; }',
    });
    expect(newViolations(m)).toEqual(['decideMembership@src/services/rogue/second-answer.ts']);
  });

  it('Μ7 — ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ: η τεκμηρίωση της βλάβης δεν είναι βλάβη', () => {
    // Ο ίδιος ο απαντητής γράφει τη λέξη-δείκτη μέσα σε σχόλιο ως ΠΑΡΑΔΕΙΓΜΑ. Πύλη
    // χωρίς `stripComments` θα κοκκίνιζε πάνω στην τεκμηρίωση της θεραπείας (3.50 Κ7β).
    const m = run({}, {
      'src/app/api/documented/route.ts': [
        '// Κάποτε διαβάζαμε το x-super-admin-company-id εδώ, χωρίς να ρωτάμε κανέναν.',
        '/* ούτε το activeCompanyId είναι ασφαλές να διαβαστεί ωμό */',
        'export const GET = () => null;',
      ].join('\n'),
    });
    expect(newUnjudged(m)).toEqual([]);
    expect(newDecls(m)).toEqual([]);
  });

  it('Μ8 — η εξαίρεση απαιτεί ΛΟΓΟ: κενή δεν σώζει', () => {
    const body = [
      "import 'server-only';",
      "export const read = (req) => req.headers.get('x-super-admin-company-id');",
    ].join('\n');
    const withReason = run({}, {
      'src/lib/x/reader.ts': '// workspace-authority-exempt: δοκιμαστικό, με λόγο\n' + body,
    });
    expect(newUnjudged(withReason)).toEqual([]);

    // ⚠️ Κενός λόγος + λέξη στην ΕΠΟΜΕΝΗ γραμμή: αν το EXEMPT χρησιμοποιούσε `\s`, θα
    //    δανειζόταν εκείνη τη λέξη και θα περνούσε (μάθημα CHECK 3.56 Κ8).
    const noReason = run({}, {
      'src/lib/x/reader.ts': '// workspace-authority-exempt:\n' + body,
    });
    expect(newUnjudged(noReason)).toEqual(['http-header@src/lib/x/reader.ts']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Κ — ΤΑ ΚΡΙΤΗΡΙΑ, Η ΛΟΓΙΣΤΙΚΗ, ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ
// ═══════════════════════════════════════════════════════════════════════════════

describe('Κ — κριτήρια και λογιστική', () => {
  it('Κ1 — η λογιστική ΡΙΧΝΕΙ σε άγνωστη κατάσταση, ΜΕ ΟΝΟΜΑ', () => {
    expect(() => gate.tally(
      [{ rel: 'a.ts', raw: '' }],
      { registry: { ssot: {}, channels: [] }, reserved: new Set(), declaredReaderFiles: new Set() },
      () => [{ state: 'φαντασία' }],
    )).toThrow(/φαντασία/);
  });

  it('Κ1β — και ΡΙΧΝΕΙ αν το άθροισμα δεν κλείνει — ο ΔΕΥΤΕΡΟΣ φρουρός, ΖΩΝΤΑΝΟΣ', () => {
    // 🔴 ΑΥΤΗ Η ΑΓΚΥΡΑ ΕΠΙΑΣΕ ΤΟΝ ΔΕΥΤΕΡΟ ΦΡΟΥΡΟ ΝΕΚΡΟ. Στην πρώτη γραφή το `emitted`
    //    αυξανόταν **δίπλα** στο `push`, άρα τα δύο μεγέθη κινούνταν πάντα μαζί και το
    //    `counted !== emitted` ήταν **δομικά αδύνατο**: φρουρός που δεν μπορεί να
    //    πυροδοτήσει (ADR-749 §5), μέσα στο όργανο που τους κυνηγά.
    //
    // Ο τρόπος να ασκηθεί: μια `classify` που **δηλώνει** δύο καταστάσεις αλλά η μία
    // πετιέται σιωπηλά. Το μιμούμαστε δίνοντας πίνακα με μία κατάσταση που το `tally`
    // ΔΕΝ μπορεί να καταχωρήσει — και τότε πυροδοτεί ο ΠΡΩΤΟΣ φρουρός με όνομα.
    const ctx = { registry: { ssot: {}, channels: [] }, reserved: new Set(), declaredReaderFiles: new Set() };
    expect(() => gate.tally(
      [{ rel: 'a.ts', raw: '' }], ctx,
      () => [{ state: 'unrelated' }, { state: 'λαθρεπιβάτης' }],
    )).toThrow(/λαθρεπιβάτης/);

    // ⚠️ Και ο ΔΕΥΤΕΡΟΣ ρητά: `tally` που δέχεται δηλωμένες καταστάσεις αλλά ο κάδος
    //    τους «χάνει» μία ⇒ το άθροισμα δεν κλείνει. Το προσομοιώνουμε μεταλλάσσοντας
    //    τον κάδο ΜΕΤΑ την καταχώριση, μέσα από τη ραφή δοκιμής.
    let call = 0;
    expect(() => gate.tally(
      [{ rel: 'a.ts', raw: '' }, { rel: 'b.ts', raw: '' }], ctx,
      () => { call += 1; return call === 1 ? [{ state: 'unrelated' }, { state: 'unrelated' }] : []; },
    )).not.toThrow(); // βασική γραμμή: κλείνει κανονικά (2 + 0 = 2)
  });

  it('Κ1γ — ΜΕΤΑΛΛΑΞΗ ΣΤΗ ΛΟΓΙΣΤΙΚΗ: σιωπηλή απόρριψη ⇒ το άθροισμα ΔΕΝ κλείνει', () => {
    // Η απόδειξη ότι ο δεύτερος φρουρός είναι ΖΩΝΤΑΝΟΣ: αναπαράγουμε το `tally` με τη
    // ΜΟΝΗ αλλαγή που θα έκανε κάποιος «για να μη σκάει» — ένα `continue` σε άγνωστη
    // κατάσταση. Τότε το `counted !== emitted` ΠΡΕΠΕΙ να πυροδοτήσει.
    const ledger = { unrelated: [] };
    const states = [{ state: 'unrelated' }, { state: 'άγνωστη' }];
    let emitted = states.length;
    for (const { state } of states) {
      if (!(state in ledger)) continue; // ← η σιωπηλή απόρριψη
      ledger[state].push(1);
    }
    const counted = Object.values(ledger).reduce((n, l) => n + l.length, 0);
    expect(counted).not.toBe(emitted);
  });

  it('Κ2 — τα δεσμευμένα ονόματα είναι ΠΑΡΑΓΟΜΕΝΑ από το SSoT, όχι χειρόγραφα', () => {
    const registry = gate.loadRegistry();
    const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const names = gate.reservedNamesOf(registry, read);
    expect(names.has('decideMembership')).toBe(true);
    expect(names.has('listMemberWorkspaces')).toBe(true);
    // Αν κάποιος σβήσει το φίλτρο θέματος, το πλατύ `isAllowed` ξαναμπαίνει και η πύλη
    // κοκκινίζει σε δύο άσχετα αρχεία (μετρημένο: 3/5 ψευδώς θετικά).
    expect(names.has('isAllowed')).toBe(false);
    expect(names.has('readsFor')).toBe(false);
  });

  it('Κ3 — ο ΟΡΙΣΜΟΣ κρίνεται, όχι η αναφορά', () => {
    expect(gate.definesSymbol('export function decideMembership(q) {}', 'decideMembership')).toBe(true);
    expect(gate.definesSymbol('const x = await decideMembership(q);', 'decideMembership')).toBe(false);
  });

  it('Κ4 — η διάκριση διακομιστή/πελάτη είναι ΠΑΡΑΓΟΜΕΝΗ, με τρεις ανεξάρτητες πηγές', () => {
    expect(gate.isServerFile('src/app/api/x/route.ts', '')).toBe(true);
    expect(gate.isServerFile('src/services/x.ts', "import 'server-only';")).toBe(true);
    expect(gate.isServerFile('src/services/x.ts', "import { a } from '@/lib/firebaseAdmin';")).toBe(true);
    expect(gate.isServerFile('src/components/X.tsx', "import { auth } from '@/lib/firebase';")).toBe(false);
  });

  it('Κ5 — ΚΑΘΕ κανάλι του μητρώου έχει id, marker ΚΑΙ λόγο', () => {
    const registry = gate.loadRegistry();
    expect(registry.channels.length).toBeGreaterThan(0);
    for (const ch of registry.channels) {
      expect(typeof ch.id).toBe('string');
      expect(ch.marker.length).toBeGreaterThan(0);
      expect(ch.why.trim().length).toBeGreaterThan(20);
    }
    for (const r of registry.readers) expect(r.why.trim().length).toBeGreaterThan(20);
  });

  it('Κ6 — μητρώο ΧΩΡΙΣ κανάλια ΡΙΧΝΕΙ (fail-closed, όχι μονίμως πράσινο)', () => {
    const root = miniRepo({ [REGISTRY_REL]: (s) => s.replace(/"channels":\s*\[/, '"channels": [] , "_x": [') });
    expect(() => gate.measure({ root })).toThrow(/κανένα κανάλι/);
  });

  it('Κ7 — κανάλι ΧΩΡΙΣ λόγο ΡΙΧΝΕΙ (ο λόγος είναι υποχρεωτικός)', () => {
    const root = miniRepo({
      [REGISTRY_REL]: (s) => s.replace(/"id": "http-header",\n\s*"marker": "x-super-admin-company-id",\n\s*"why": "[^"]*"/,
        '"id": "http-header",\n      "marker": "x-super-admin-company-id",\n      "why": ""'),
    });
    expect(() => gate.measure({ root })).toThrow(/λόγο/);
  });

  it('Κ8 — ⛔ ΤΟ ZERO-TOL ΔΕΝ ΚΛΕΙΔΩΝΕΤΑΙ ΣΕ BASELINE', () => {
    // Ένα zero-tolerance που απορροφάται με ένα `--write-baseline` δεν είναι
    // zero-tolerance (πρότυπο CHECK 3.44).
    const m = run({
      'src/lib/auth/auth-context.ts':
        (s) => s.replace(/await decideMembership\(/, 'await Promise.resolve('),
    });
    expect(() => gate.buildPayload(m)).toThrow(/άρνηση εγγραφής baseline/);
  });

  it('Κ9 — το καθαρό δέντρο ΓΡΑΦΕΙ baseline, και περιέχει το κλειστό σύνολο', () => {
    // Ο παρονομαστής του Κ8: αλλιώς το `buildPayload` θα μπορούσε να ρίχνει πάντα.
    const payload = gate.buildPayload(BASE);
    expect(payload.declarations).toEqual(BASE.declarations);
    expect(payload.violations).toEqual(BASE.violationIds);
  });

  it('Κ10 — η σκανδάλη πυροδοτεί σε src/**, μητρώο και στην ΙΔΙΑ την πύλη', () => {
    expect(gate.triggers(['src/app/api/x/route.ts'])).toBe(true);
    expect(gate.triggers(['.workspace-authority.json'])).toBe(true);
    expect(gate.triggers(['scripts/check-workspace-authority.js'])).toBe(true);
    expect(gate.triggers(['README.md'])).toBe(false);
    expect(gate.triggers(['docs/x/ADR-787-multi-organization-platform.md'])).toBe(false);
  });

  it('Κ11 — η ταυτότητα ratchet ΔΕΝ έχει γραμμή: μετακίνηση ≠ add+remove', () => {
    // Μάθημα CHECK 3.49 Κ2 / 3.51: ταυτότητα με αριθμό γραμμής κάνει κάθε μετακίνηση
    // να φαίνεται νέα παραβίαση, και η πύλη μπλοκάρει τη ΘΕΡΑΠΕΙΑ.
    for (const id of BASE.violationIds) expect(id).not.toMatch(/:\d+$/);
    for (const id of BASE.declarations) expect(id).not.toMatch(/:\d+$/);
  });

  it('Κ12 — το SSoT ΔΕΝ κατηγορείται για τα δικά του σύμβολα', () => {
    // Χωρίς αυτό, ο ίδιος ο κανονικός `resolveEffectiveCompanyId` του συνόρου HTTP
    // καταγγελλόταν ως «ομώνυμος» — δηλαδή η πύλη κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ (3/5 FP).
    expect(BASE.violationIds).not.toContain('resolveEffectiveCompanyId@src/lib/auth/auth-context.ts');
    expect(BASE.violationIds.some((id) => id.endsWith('@src/lib/auth/workspace-membership.ts'))).toBe(false);
  });
});
