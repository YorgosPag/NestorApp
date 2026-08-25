/**
 * =============================================================================
 * CHECK 3.68 — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΠΥΛΗΣ (ADR-801 §4)
 * =============================================================================
 *
 * ⚠️ **Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ.** Η ομάδα `Π` τρέχει την πύλη πάνω στον
 * **ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ ΚΩΔΙΚΑ** του `3188b211` — τον πίνακα των 13 ρόλων που
 * ζούσε **μήνες** με 11 πράσινα tests από πάνω — και απαιτεί να **κοκκινίσει**
 * στα `foreman`/`client`. Χωρίς αυτό, ο Κ3 θα ήταν ισχυρισμός.
 *
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ COMMIT, ΠΟΤΕ `HEAD`**: το `HEAD` μετακινείται (και **μετακινήθηκε
 * ήδη** — άλλος πράκτορας κομμιτάρισε τη Φάση 3α ενώ γραφόταν αυτό), οπότε μια
 * άγκυρα δεμένη στο `HEAD` θα αυτοακυρωνόταν σιωπηλά (μάθημα CHECK 3.41).
 *
 * ⚠️ **Το `Π2` αποδεικνύει τον ΠΑΡΟΝΟΜΑΣΤΗ**: η **σημερινή** εκδοχή του ίδιου
 * αρχείου πρέπει να **περνά**. Αλλιώς το `Π1` θα ήταν πράσινο επειδή η πύλη
 * κοκκινίζει σε **οτιδήποτε**.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  takeInventory, stripComments, windowsOf, isGate, readVocabularies, loadRegistry,
} = require('../lib/authority-registry/inventory');
const {
  STATES, BLOCKING, judge, idsOf, tallyOf, namesInRolePosition, MIN_REASON,
} = require('../lib/authority-registry/judge');

const ROOT = path.resolve(__dirname, '..', '..');

/** Το commit που **περιέχει** τον πίνακα των 13 ρόλων. ΠΟΤΕ `HEAD`. */
const PINNED = '3188b211';
const DEAD_TABLE = 'src/subapps/dxf-viewer/hooks/text-edit-capabilities.ts';

/** ⚠️ **Σκάει σε κενή απάντηση**: «δεν βρήκα» ΠΟΤΕ δεν διαβάζεται ως «καθαρό». */
function gitShow(ref, file) {
  const out = execFileSync('git', ['show', `${ref}:${file}`], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 << 20,
  });
  if (!out || out.trim().length === 0) {
    throw new Error(`gitShow: κενή απάντηση για ${ref}:${file} — η άγκυρα θα ήταν ψεύτικη`);
  }
  return out;
}

// -----------------------------------------------------------------------------
// ΤΟ ΜΙΝΙ-REPO — πραγματικά λεξιλόγια, ελεγχόμενα αρχεία
// -----------------------------------------------------------------------------

const REAL_VOCAB = readVocabularies(ROOT);

function miniRepo(files, registryOverride = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'authreg-'));
  const registry = {
    ssot: { judge: 'src/lib/auth/authority.ts' },
    claimRoleVocabulary: [...REAL_VOCAB.globalRoles],
    legacyRoleNames: [],
    inlineDeciders: [],
    ...registryOverride,
  };
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  const inventory = takeInventory(dir, {
    registry,
    vocabularies: REAL_VOCAB,
    files: Object.keys(files),
  });
  return { dir, verdict: judge(inventory), inventory };
}

const statesFor = (verdict, id) => verdict.rows.filter((r) => r.id === id).map((r) => r.state);

// =============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΠΑΝΤΩΝ
// =============================================================================

describe('Μ0 — η πύλη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  const real = judge(takeInventory(ROOT));

  it('Μ0α — καμία μπλοκάρουσα κατάσταση σήμερα', () => {
    const blocking = real.rows.filter((r) => BLOCKING.includes(r.state));
    expect(blocking.map((r) => `${r.state}:${r.id}`)).toEqual([]);
  });

  it('Μ0β — και ΚΟΙΤΑΞΕ κάτι (όχι κενή σάρωση)', () => {
    // Χωρίς αυτό, ένα σπασμένο προφίλτρο θα έδινε «0 παραβιάσεις» επειδή
    // δεν διάβασε αρχείο — το σχήμα «0 = κανείς δεν κοίταξε».
    expect(real.rows.length).toBeGreaterThan(20);
    expect(idsOf(real, STATES.INLINE_DECIDER).length).toBeGreaterThan(5);
  });

  it('Μ0γ — τα λεξιλόγια διαβάστηκαν από το SSoT και ΔΕΝ είναι κενά', () => {
    expect(REAL_VOCAB.globalRoles).toHaveLength(4);
    expect(REAL_VOCAB.predefinedRoles.length).toBeGreaterThanOrEqual(13);
    expect(REAL_VOCAB.permissions.length).toBeGreaterThan(50);
    expect(REAL_VOCAB.permissions).toContain('admin_access');
  });
});

// =============================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ ΣΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ ΚΩΔΙΚΑ
// =============================================================================

describe('Π — ο νεκρός πίνακας των 13 ρόλων', () => {
  it('Π1 — 🔴 Ο Κ3 ΚΟΚΚΙΝΙΖΕΙ στον ιστορικό κώδικα (foreman · client)', () => {
    const historical = gitShow(PINNED, DEAD_TABLE);
    expect(historical).toContain("case 'foreman'");

    const { verdict } = miniRepo({ [DEAD_TABLE]: historical });
    const ghosts = idsOf(verdict, STATES.GHOST_ROLE);
    expect(ghosts).toContain(`foreman@${DEAD_TABLE}`);
    expect(ghosts).toContain(`client@${DEAD_TABLE}`);
  });

  it('Π2 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ΣΗΜΕΡΙΝΗ εκδοχή περνά καθαρή', () => {
    const current = fs.readFileSync(path.join(ROOT, DEAD_TABLE), 'utf8');
    const { verdict } = miniRepo({ [DEAD_TABLE]: current });
    expect(idsOf(verdict, STATES.GHOST_ROLE)).toEqual([]);
  });

  it('Π3 — και ο ιστορικός πίνακας ταξινομείται ως ΚΡΙΤΗΣ, όχι ως δήλωση', () => {
    const historical = gitShow(PINNED, DEAD_TABLE);
    const { verdict } = miniRepo({ [DEAD_TABLE]: historical });
    expect(statesFor(verdict, DEAD_TABLE)).toContain(STATES.INLINE_DECIDER);
  });
});

// =============================================================================
// Κ — ΤΟ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

describe('Κ — οι τρεις κανόνες', () => {
  const DECIDER = "const A = ['super_admin', 'company_admin'];\nexport const ok = (r) => A.includes(r);\n";

  it('Κ1 — inline σύνολο που ΚΡΙΝΕΙ ⇒ inline-decider', () => {
    const { verdict } = miniRepo({ 'src/x.ts': DECIDER });
    expect(statesFor(verdict, 'src/x.ts')).toEqual([STATES.INLINE_DECIDER]);
  });

  it('Κ2 — το ΙΔΙΟ σύνολο χωρίς κρίση ⇒ policy-declaration, ΟΧΙ παράβαση', () => {
    const declOnly = "export const A = ['super_admin', 'company_admin'];\nexport const cfg = { roles: A };\n";
    const { verdict } = miniRepo({ 'src/x.ts': declOnly });
    expect(statesFor(verdict, 'src/x.ts')).toEqual([STATES.POLICY_DECLARATION]);
  });

  it('Κ3 — δηλωμένη εξαίρεση ΜΕ λόγο ⇒ declared-decider', () => {
    const { verdict } = miniRepo(
      { 'src/x.ts': DECIDER },
      { inlineDeciders: [{ id: 'src/x.ts', why: 'x'.repeat(MIN_REASON) }] },
    );
    expect(statesFor(verdict, 'src/x.ts')).toEqual([STATES.DECLARED_DECIDER]);
  });

  it('Κ4 — δηλωμένη εξαίρεση ΧΩΡΙΣ επαρκή λόγο ⇒ ΜΠΛΟΚ', () => {
    const { verdict } = miniRepo(
      { 'src/x.ts': DECIDER },
      { inlineDeciders: [{ id: 'src/x.ts', why: 'γιατί ναι' }] },
    );
    expect(statesFor(verdict, 'src/x.ts')).toEqual([STATES.REASONLESS_DECLARATION]);
  });

  it('Κ5 — δήλωση για αρχείο που δεν κρίνει ⇒ orphan-declaration', () => {
    const { verdict } = miniRepo(
      { 'src/x.ts': '// τίποτα\n' },
      { inlineDeciders: [{ id: 'src/other.ts', why: 'y'.repeat(MIN_REASON) }] },
    );
    expect(idsOf(verdict, STATES.ORPHAN_DECLARATION)).toEqual(['src/other.ts']);
  });

  it('Κ6 — 🏆 Ο Κ3 ΠΥΡΟΔΟΤΕΙ ΑΚΟΜΑ ΚΙ ΑΝ Ο Κ1 ΕΙΝΑΙ ΙΚΑΝΟΠΟΙΗΜΕΝΟΣ', () => {
    // Ο λόγος που είναι ΤΡΕΙΣ κανόνες και όχι ένας με «ή»: αρχείο δηλωμένο
    // (άρα καθαρό για τον Κ1) που κρατά νεκρό κλάδο πρέπει ΠΑΛΙ να μπλοκάρει.
    const withGhost = "const A = ['super_admin', 'company_admin', 'foreman'];\nexport const ok = (r) => A.includes(r);\n";
    const { verdict } = miniRepo(
      { 'src/x.ts': withGhost },
      { inlineDeciders: [{ id: 'src/x.ts', why: 'z'.repeat(MIN_REASON) }] },
    );
    expect(statesFor(verdict, 'src/x.ts')).toEqual([STATES.DECLARED_DECIDER]);
    expect(idsOf(verdict, STATES.GHOST_ROLE)).toEqual(['foreman@src/x.ts']);
  });

  it('Κ7 — δηλωμένο legacy όνομα ΔΕΝ είναι φάντασμα', () => {
    const withLegacy = "const A = ['super_admin', 'admin'];\nexport const ok = (r) => A.includes(r);\n";
    const { verdict } = miniRepo(
      { 'src/x.ts': withLegacy },
      { legacyRoleNames: [{ name: 'admin', why: 'ζει στα δεδομένα' }] },
    );
    expect(idsOf(verdict, STATES.GHOST_ROLE)).toEqual([]);
  });

  it('Κ8 — legacy όνομα που δεν στέκεται πουθενά ⇒ orphan-legacy', () => {
    const { verdict } = miniRepo(
      { 'src/x.ts': DECIDER },
      { legacyRoleNames: [{ name: 'foreman', why: 'φάντασμα' }] },
    );
    expect(idsOf(verdict, STATES.ORPHAN_LEGACY)).toEqual(['legacy:foreman']);
  });

  it('Κ9 — ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ: τεκμηρίωση της βλάβης ΔΕΝ είναι βλάβη', () => {
    const documented = "// Πριν: ['super_admin', 'company_admin', 'foreman']\nexport const x = 1;\n";
    const { verdict } = miniRepo({ 'src/x.ts': documented });
    expect(idsOf(verdict, STATES.GHOST_ROLE)).toEqual([]);
    expect(verdict.rows.filter((r) => r.id === 'src/x.ts')).toEqual([]);
  });

  it('Κ10 — απόκλιση δείκτη έναντι GLOBAL_ROLES ⇒ ΜΠΛΟΚ', () => {
    // Ένας δείκτης που πάλιωσε θα έκανε το προφίλτρο να μη βρίσκει τίποτα ⇒
    // «0 παραβιάσεις, πάντα». Fail-closed, με όνομα.
    const { verdict } = miniRepo({ 'src/x.ts': DECIDER }, { claimRoleVocabulary: ['super_admin'] });
    expect(idsOf(verdict, STATES.VOCABULARY_DRIFT)).toEqual(['claimRoleVocabulary']);
  });

  it('Κ11 — το SSoT δεν κατηγορείται ποτέ για τον εαυτό του', () => {
    const { verdict } = miniRepo({ 'src/lib/auth/authority.ts': DECIDER });
    expect(statesFor(verdict, 'src/lib/auth/authority.ts')).toEqual([STATES.SSOT]);
  });

  it('Κ12 — ΕΝΑΣ ρόλος δεν είναι σύνολο (κατώφλι 2)', () => {
    const single = "export const only = (r) => r === 'super_admin';\n";
    const { verdict } = miniRepo({ 'src/x.ts': single });
    expect(verdict.rows.filter((r) => r.id === 'src/x.ts')).toEqual([]);
  });
});

// =============================================================================
// Λ — Η ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ
// =============================================================================

describe('Λ — η λογιστική δεν χάνεται σιωπηλά', () => {
  it('Λ1 — άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ', () => {
    expect(() => tallyOf([{ id: 'x', state: 'κάτι-άγνωστο' }]))
      .toThrow(/άγνωστη κατάσταση «κάτι-άγνωστο»/);
  });

  it('Λ2 — το άθροισμα κλείνει σε ΚΑΘΕ κατάσταση', () => {
    const real = judge(takeInventory(ROOT));
    const sum = Object.values(real.tally).reduce((a, b) => a + b, 0);
    expect(sum).toBe(real.rows.length);
  });

  it('Λ3 — ΚΑΘΕ ονομασμένη κατάσταση υπάρχει στη λογιστική, ακόμη κι αν είναι 0', () => {
    const { verdict } = miniRepo({ 'src/x.ts': '// τίποτα\n' });
    for (const state of Object.values(STATES)) {
      expect(verdict.tally[state]).toBeDefined();
    }
  });

  it('Λ4 — κάθε μπλοκάρουσα κατάσταση είναι ΠΑΡΑΓΩΓΙΜΗ (κανένας αδρανής φρουρός)', () => {
    // ADR-749 §5: φρουρός που δεν μπορεί να πυροδοτήσει είναι σχόλιο.
    const produced = new Set();
    const D = "const A = ['super_admin', 'company_admin'];\nexport const ok = (r) => A.includes(r);\n";
    const G = "const A = ['super_admin', 'company_admin', 'foreman'];\nexport const ok = (r) => A.includes(r);\n";
    produced.add(idsOf(miniRepo({ 'src/x.ts': G }).verdict, STATES.GHOST_ROLE).length ? STATES.GHOST_ROLE : '');
    produced.add(idsOf(miniRepo({ 'src/x.ts': D }, { inlineDeciders: [{ id: 'src/z.ts', why: 'q'.repeat(MIN_REASON) }] }).verdict, STATES.ORPHAN_DECLARATION).length ? STATES.ORPHAN_DECLARATION : '');
    produced.add(idsOf(miniRepo({ 'src/x.ts': D }, { inlineDeciders: [{ id: 'src/x.ts', why: 'μικρό' }] }).verdict, STATES.REASONLESS_DECLARATION).length ? STATES.REASONLESS_DECLARATION : '');
    produced.add(idsOf(miniRepo({ 'src/x.ts': D }, { legacyRoleNames: [{ name: 'foreman', why: 'x' }] }).verdict, STATES.ORPHAN_LEGACY).length ? STATES.ORPHAN_LEGACY : '');
    produced.add(idsOf(miniRepo({ 'src/x.ts': D }, { claimRoleVocabulary: ['super_admin'] }).verdict, STATES.VOCABULARY_DRIFT).length ? STATES.VOCABULARY_DRIFT : '');
    for (const state of BLOCKING) expect([...produced]).toContain(state);
  });
});

// =============================================================================
// Σ — ΟΙ ΒΟΗΘΟΙ
// =============================================================================

describe('Σ — τα δομικά στοιχεία', () => {
  it('Σ1 — το switch παράθυρο δίνει ΜΟΝΟ τα case, όχι κάθε λέξη του αρχείου', () => {
    const win = { kind: 'switch', text: "const msg = 'tyxaia_lexi';\nswitch (r) { case 'foreman': break; }" };
    expect(namesInRolePosition(win)).toEqual(['foreman']);
  });

  it('Σ2 — ο πίνακας κόβεται στο κλείσιμο, όχι 12 γραμμές μετά', () => {
    const win = { kind: 'block', text: "const A = [\n 'super_admin',\n];\nconst other = 'tyxaia_lexi';" };
    expect(namesInRolePosition(win)).toEqual(['super_admin']);
  });

  it('Σ3 — το stripComments αφαιρεί ΚΑΙ τα δύο είδη σχολίου', () => {
    expect(stripComments("/* 'foreman' */\nconst a = 1; // 'client'\n")).not.toMatch(/foreman|client/);
  });

  it('Σ4 — isGate: `.includes(role)` ΕΙΝΑΙ κρίση, `requiredGlobalRoles:` ΔΕΝ είναι', () => {
    const v = REAL_VOCAB.globalRoles;
    expect(isGate('export const ok = (role) => A.includes(role);', v)).toBe(true);
    expect(isGate("withAuth(h, { requiredGlobalRoles: ['super_admin', 'company_admin'] })", v)).toBe(false);
  });

  it('Σ5 — windowsOf: το κατώφλι είναι ΔΥΟ ρόλοι', () => {
    const v = REAL_VOCAB.globalRoles;
    expect(windowsOf("const a = ['super_admin'];", v)).toHaveLength(0);
    expect(windowsOf("const a = ['super_admin', 'company_admin'];", v)).toHaveLength(1);
  });

  it('Σ6 — το μητρώο του ΠΡΑΓΜΑΤΙΚΟΥ δέντρου έχει όλα τα υποχρεωτικά πεδία', () => {
    const registry = loadRegistry(ROOT);
    expect(registry.ssot.judge).toBe('src/lib/auth/authority.ts');
    for (const entry of registry.inlineDeciders) {
      expect(entry.why.trim().length).toBeGreaterThanOrEqual(MIN_REASON);
    }
    for (const legacy of registry.legacyRoleNames) {
      expect(legacy.why.trim().length).toBeGreaterThanOrEqual(MIN_REASON);
    }
  });

  it('Σ7 — 🔴 Ο ΔΕΙΚΤΗΣ ΠΕΡΙΛΑΜΒΑΝΕΙ ΤΑ LEGACY: το §2.4 ΔΕΝ ξαναγίνεται αόρατο', () => {
    // Η πραγματική γραμμή του `admin-guards-types.ts`: **ΕΝΑΣ** ρόλος claims και
    // **τρία** legacy. Με δείκτη μόνο τα GLOBAL_ROLES δεν υπήρχε παράθυρο ⇒ το
    // αρχείο δεν σαρωνόταν ΚΑΘΟΛΟΥ, και το «0» του σήμαινε «δεν κοίταξα».
    const real = [
      "export type AdminRole = 'admin' | 'broker' | 'builder' | 'super_admin';",
      "export const ADMIN_ROLES: AdminRole[] = ['admin', 'broker', 'builder', 'super_admin'];",
      'export const ok = (r) => ADMIN_ROLES.includes(r);',
    ].join(String.fromCharCode(10));
    const legacy = [
      { name: 'admin', why: 'l'.repeat(MIN_REASON) },
      { name: 'broker', why: 'l'.repeat(MIN_REASON) },
      { name: 'builder', why: 'l'.repeat(MIN_REASON) },
    ];
    const { verdict } = miniRepo({ 'src/x.ts': real }, { legacyRoleNames: legacy });
    expect(statesFor(verdict, 'src/x.ts')).toEqual([STATES.INLINE_DECIDER]);
    expect(idsOf(verdict, STATES.GHOST_ROLE)).toEqual([]);
  });

  it('Λ5 — το buildPayload ΑΡΝΕΙΤΑΙ να σπείρει μπλοκάρουσα κατάσταση', () => {
    // «Ένα zero-tol που κλειδώνεται με ένα --write-baseline δεν είναι zero-tol».
    const gate = require('../check-authority-registry');
    expect(() => gate.buildPayload({
      blocking: [{ state: STATES.GHOST_ROLE, id: 'foreman@src/x.ts', detail: 'δοκιμή' }],
      violationIds: [], declarations: [],
    })).toThrow(/άρνηση σποράς/);
  });
});
