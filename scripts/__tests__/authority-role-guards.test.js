/**
 * =============================================================================
 * CHECK 3.68 / Κ1′ — ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΦΡΟΥΡΟΥ ΡΟΛΟΥ (ADR-801 §2.11)
 * =============================================================================
 *
 * ⚠️ **Η ΒΑΘΜΟΝΟΜΗΣΗ ΕΙΝΑΙ ΤΟ ΚΕΝΤΡΟ.** Η ομάδα `Π` τρέχει τη μηχανή πάνω στον
 * **ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ ΚΩΔΙΚΑ** του `5fe59919` — το δέντρο **πριν** ανυψωθούν οι
 * φρουροί — και απαιτεί να **ΚΟΚΚΙΝΙΣΕΙ**. Χωρίς αυτό, το «0 φρουροί σήμερα» θα
 * μπορούσε να σημαίνει *«δεν υπήρξε ποτέ βλάβη»* ή, χειρότερα, *«η μηχανή δεν
 * κοιτάζει»* (μάθημα CHECK 3.45).
 *
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ COMMIT, ΠΟΤΕ `HEAD`**: το `HEAD` μετακινείται — και **μετακινήθηκε
 * ήδη έξι φορές** σε αυτό το ρεύμα δουλειάς, από άλλον πράκτορα στο ίδιο working
 * tree. Άγκυρα δεμένη στο `HEAD` θα αυτοακυρωνόταν σιωπηλά.
 *
 * ⚠️ **Το `Π2` αποδεικνύει τον ΠΑΡΟΝΟΜΑΣΤΗ**: τα **ίδια** αρχεία, στη **σημερινή**
 * τους εκδοχή, πρέπει να δίνουν **μηδέν**. Αλλιώς το `Π1` θα ήταν πράσινο επειδή η
 * μηχανή κοκκινίζει σε **οτιδήποτε**.
 *
 * ⚠️ **Οι μεταλλάξεις είναι ΣΤΙΣ ΕΙΣΟΔΟΥΣ, όχι στη μηχανή** (πρότυπο CHECK 3.44):
 * η ομάδα `Μ` **επαναφέρει** τον πραγματικό ιστορικό φρουρό μέσα σε μίνι-repo και
 * απαιτεί ⛔. Ένα fixture γραμμένο από το μηδέν θα δοκίμαζε τη μηχανή σε κόσμο που
 * δεν υπήρξε ποτέ.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  scanRoleChecks, guardIdOf, isCallerRoleExpression, collectRoleLocals,
} = require('../lib/authority-registry/role-guards');
const { takeInventory, readVocabularies } = require('../lib/authority-registry/inventory');
const { STATES, BLOCKING, judge, idsOf, judgeRoleGuards } = require('../lib/authority-registry/judge');
const { mutateText } = require('./_mutate');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * Το commit **πριν** τη Φάση 5 ανυψώσει τους φρουρούς στη δήλωση.
 * ⚠️ ΚΑΡΦΩΜΕΝΟ. Ποτέ `HEAD`.
 */
const PINNED = '5fe59919';

/** Πέντε πραγματικά αρχεία, ένα ανά **μορφή** φρουρού που βρέθηκε στο ιστορικό. */
const CALIBRATION_FILES = [
  'src/app/api/admin/rebuild-public-listings/route.ts',
  'src/app/api/admin/migrate-dxf/route.ts',
  'src/app/api/navigation/company/route.ts',
  'src/app/api/onboarding/organization/route.ts',
  'src/app/api/accounting/bank/reconcile/route.ts',
];

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

/** Υλοποιεί ένα σύνολο αρχείων σε προσωρινό δέντρο και σαρώνει. */
function scanTree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roleguard-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  const checks = Object.keys(files).flatMap((rel) => scanRoleChecks(dir, rel));
  return { dir, checks, guards: checks.filter((c) => c.denies) };
}

/** Το ίδιο, αλλά με **κρίση** — για τις καταστάσεις του μητρώου. */
function judgeTree(files, roleGuards = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roleguard-j-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  const registry = {
    ssot: { judge: 'src/lib/auth/authority.ts' },
    claimRoleVocabulary: [...readVocabularies(ROOT).globalRoles],
    legacyRoleNames: [],
    inlineDeciders: [],
    roleGuards,
  };
  const inventory = takeInventory(dir, {
    registry,
    vocabularies: readVocabularies(ROOT),
    files: Object.keys(files),
    roleCheckFiles: Object.keys(files),
  });
  return judge(inventory);
}

/** Ένα αρχείο πηγής από γραμμές — **ποτέ** literal escapes σε fixture. */
const src = (...lines) => `${lines.join('\n')}\n`;

/**
 * ⚠️ **ΟΥΡΛΙΑΖΕΙ αν η μετάλλαξη δεν άλλαξε τίποτα** (μάθημα CHECK 3.44 / `Μ11`):
 * ένα «RED» πάνω σε κείμενο που έμεινε ίδιο αποδεικνύει σπασμένο test, όχι φρουρό.
 *
 * 🔑 **Ο κανόνας μετακόμισε στο `./_mutate` (2026-08-30)**, μαζί με άλλα έξι σημεία. Εδώ η
 * μετάλλαξη είναι **καθαρά στη μνήμη** — κανένα αρχείο δεν αγγίζεται — και γι' αυτό ακριβώς ο
 * κανόνας εκεί ζει **χωριστά** από την τελετουργία του δίσκου: ένα ενιαίο
 * `withMutation(αρχείο, …)` θα ανάγκαζε αυτό το σημείο να **επινοήσει αρχείο** για να δανειστεί
 * τον φρουρό, δηλαδή θα το άφηνε πάλι έξω.
 *
 * 🔑 **ΚΑΙ ΚΕΡΔΙΖΕΙ ΤΟΝ ΦΡΟΥΡΟ ΑΣΑΦΕΙΑΣ ΠΟΥ ΔΕΝ ΕΙΧΕ**: το `String.replace` χτυπά σιωπηλά την
 * **πρώτη** εμφάνιση. Οι στόχοι εδώ είναι υπογραφές handler που επαναλαμβάνονται αυτούσιες σε
 * διαδρομές με πολλαπλά ρήματα — ακριβώς το σχήμα που έσπασε το `Μ0` του
 * `check-firestore-tenant-scope.test.js`. Αν κάποια μετάλλαξη αρχίσει να λέει «ΑΣΑΦΗΣ στόχος»,
 * **το εύρημα είναι πραγματικό**: δήλωσε `occurrence`, μη χαλαρώσεις τον στόχο.
 */
function mutate(source, from, to) {
  return mutateText(source, from, to, { label: 'το αρχείο πηγής' });
}

// =============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΩΝ ΠΑΝΤΩΝ
// =============================================================================

describe('Μ0 — ο Κ1′ στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  const real = judge(takeInventory(ROOT));

  it('Μ0α — κανένας ΑΔΗΛΩΤΟΣ φρουρός ρόλου σήμερα', () => {
    const undeclared = real.rows.filter((r) => r.state === STATES.UNDECLARED_ROLE_GUARD);
    expect(undeclared.map((r) => r.id)).toEqual([]);
  });

  it('Μ0β — και ΚΟΙΤΑΞΕ κάτι: υπάρχουν ζωντανοί έλεγχοι ρόλου', () => {
    // Χωρίς αυτό, ένα σπασμένο προφίλτρο θα έδινε «0 φρουροί» επειδή δεν διάβασε
    // αρχείο — το σχήμα «0 = κανείς δεν κοίταξε», που η ίδια η πύλη κυνηγά.
    expect(real.tally[STATES.ROLE_CONDITIONED_FLOW]).toBeGreaterThan(20);
    expect(real.tally[STATES.DECLARED_ROLE_GUARD]).toBeGreaterThanOrEqual(1);
  });

  it('Μ0γ — καμία μπλοκάρουσα κατάσταση του Κ1′/Κ4', () => {
    // ⚠️ **ΧΩΡΙΣ `BLOCKING.includes` ΣΤΟ ΦΙΛΤΡΟ, ΕΠΙΤΗΔΕΣ**: ο παρονομαστής δεν
    //    επιτρέπεται να μετακινείται με τη μετάλλαξη (σφάλμα ADR-790 §9.1) — μια
    //    μετάλλαξη που **αφαιρεί** κατάσταση από το `BLOCKING` θα άδειαζε το
    //    φίλτρο και θα έβγαινε πράσινη. Μετρήθηκε: ΒΓΗΚΕ.
    const guardStates = [
      STATES.UNDECLARED_ROLE_GUARD,
      STATES.ORPHAN_GUARD_DECLARATION,
      STATES.REASONLESS_GUARD_DECLARATION,
    ];
    expect(real.rows.filter((r) => guardStates.includes(r.state))
      .map((r) => `${r.state}:${r.id}`)).toEqual([]);
  });

  it('Μ0δ — 🔴 ΟΙ ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ ΤΟΥ Κ1′ ΕΙΝΑΙ ΟΝΟΜΑΣΤΙΚΑ ΜΠΛΟΚΑΡΟΥΣΕΣ', () => {
    // 🔴 Γεννήθηκε από μετάλλαξη που ΒΓΗΚΕ ΠΡΑΣΙΝΗ: αφαιρώντας το
    //    `UNDECLARED_ROLE_GUARD` από το `BLOCKING`, ΚΑΘΕ άγκυρα που το διάβαζε
    //    από εκεί έμενε πράσινη — και η ίδια η Λ4 μαζί, γιατί ο βρόχος της
    //    `for (const state of BLOCKING)` απλώς σταματούσε να το ελέγχει.
    //    Ένα zero-tolerance που παύει σιωπηλά να μπλοκάρει ΔΕΝ είναι zero-tolerance.
    expect(BLOCKING).toContain(STATES.UNDECLARED_ROLE_GUARD);
    expect(BLOCKING).toContain(STATES.ORPHAN_GUARD_DECLARATION);
    expect(BLOCKING).toContain(STATES.REASONLESS_GUARD_DECLARATION);
    // …και το `role-conditioned-flow` ΠΟΤΕ (είναι μέτρηση, όχι παράβαση).
    expect(BLOCKING).not.toContain(STATES.ROLE_CONDITIONED_FLOW);
  });
});

// =============================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ ΣΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ ΚΩΔΙΚΑ
// =============================================================================

describe(`Π — βαθμονόμηση στο καρφωμένο ${PINNED}`, () => {
  const pinned = Object.fromEntries(CALIBRATION_FILES.map((f) => [f, gitShow(PINNED, f)]));
  const today = Object.fromEntries(CALIBRATION_FILES.map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

  it('Π1 — ΚΟΚΚΙΝΙΖΕΙ: κάθε ένα από τα πέντε ιστορικά αρχεία έκρυβε φρουρό', () => {
    const { guards } = scanTree(pinned);
    const byFile = new Set(guards.map((g) => g.file));
    for (const f of CALIBRATION_FILES) expect([...byFile]).toContain(f);
    expect(guards.length).toBeGreaterThanOrEqual(6);
  });

  it('Π2 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: τα ΙΔΙΑ αρχεία σήμερα δίνουν ΜΗΔΕΝ φρουρούς', () => {
    const { guards } = scanTree(today);
    expect(guards.map((g) => `${g.file}:${g.line}`)).toEqual([]);
  });

  it('Π3 — ο ΑΝΤΕΣΤΡΑΜΜΕΝΟΣ φρουρός έχει πληθυσμό στο ιστορικό (όχι θεωρητικός κανόνας)', () => {
    // `if (isRoleBypass(...)) return null;` … `return createForbiddenResponse(…)`
    const { guards } = scanTree({ 'x.ts': pinned['src/app/api/admin/migrate-dxf/route.ts'] });
    expect(guards.map((g) => g.shape)).toContain('inverted');
  });

  it('Π4 — τα τρία τυφλά σημεία του regex ήταν ΠΡΑΓΜΑΤΙΚΑ, ονομαστικά', () => {
    const { guards } = scanTree(pinned);
    const conditions = guards.map((g) => g.condition);
    // (α) άλλο όνομα δέκτη — το regex έλεγε `ctx.`
    expect(conditions.some((c) => c.includes('auth.globalRole'))).toBe(true);
    // (β) ενδιάμεση μεταβλητή — η γραμμή της άρνησης δεν αναφέρει ρόλο
    expect(conditions).toContain('!isAdmin');
    // (γ) αντεστραμμένη πολικότητα
    expect(guards.some((g) => g.shape === 'inverted')).toBe(true);
  });
});

// =============================================================================
// Κ — ΜΙΑ ΑΓΚΥΡΑ ΑΝΑ ΚΛΑΣΗ, ΜΕ ΠΡΑΓΜΑΤΙΚΟ ΚΩΔΙΚΑ
// =============================================================================

describe('Κ — η διάκριση φρουρός / μη-φρουρός', () => {
  it('Κ1 — ΦΡΟΥΡΟΣ: συνθήκη μόνο ρόλου + άμεση άρνηση 403', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        '  if (!isRoleBypass(ctx.globalRole)) {',
        "    return NextResponse.json({ error: 'no' }, { status: 403 });",
        '  }',
        '  return run();',
        '}',
      ),
    });
    expect(guards).toHaveLength(1);
    expect(guards[0].condition).toBe('!isRoleBypass(ctx.globalRole)');
  });

  it('Κ2 — ΑΠΟΜΟΝΩΣΗ ΜΙΣΘΩΤΗ: ο ρόλος είναι ΕΝΑΣ τελεστέος ⇒ ΟΧΙ φρουρός', () => {
    // Ανύψωση εδώ θα έκλεινε τη διαδρομή σε όλους πλην υπερδιαχειριστή.
    const { checks, guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx, existing) {',
        '  if (existing.companyId !== ctx.companyId && !isRoleBypass(ctx.globalRole)) {',
        "    return NextResponse.json({ error: 'no' }, { status: 403 });",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(guards).toEqual([]);
    // …και ΔΕΝ καταγράφεται καν ως έλεγχος ρόλου: η συνθήκη δεν είναι ρόλου.
    expect(checks).toEqual([]);
  });

  it('Κ3 — ΕΜΒΕΛΕΙΑ: ο ρόλος ρυθμίζει ΔΕΔΟΜΕΝΑ, δεν αρνείται ⇒ role-conditioned-flow', () => {
    const verdict = judgeTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        "  const isSuperAdmin = ctx.globalRole === 'super_admin';",
        '  if (isSuperAdmin) {',
        '    return all();',
        '  }',
        '  return scopedTo(ctx.companyId);',
        '}',
      ),
    });
    expect(idsOf(verdict, STATES.UNDECLARED_ROLE_GUARD)).toEqual([]);
    expect(idsOf(verdict, STATES.ROLE_CONDITIONED_FLOW).length).toBe(1);
  });

  it('Κ4 — ΠΕΔΙΟ ΑΝΑΦΟΡΑΣ: `hasAccess:` στο σώμα δεν είναι καν έλεγχος', () => {
    const { checks } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        '  return NextResponse.json({',
        '    requester: { email: ctx.email, hasAccess: isRoleBypass(ctx.globalRole) },',
        '  });',
        '}',
      ),
    });
    expect(checks).toEqual([]);
  });

  it('Κ5 — ΙΔΙΟΚΤΗΣΙΑ ΠΟΡΟΥ: `authorId !== uid && !isSuperAdmin` ⇒ ΟΧΙ φρουρός', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx, data) {',
        '  const isSuperAdmin = isRoleBypass(ctx.globalRole);',
        '  if (data.authorId !== ctx.uid && !isSuperAdmin) {',
        "    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });",
        '  }',
        '  return purge();',
        '}',
      ),
    });
    expect(guards).toEqual([]);
  });

  it('Κ6 — ΕΠΙΚΥΡΩΣΗ ΔΕΔΟΜΕΝΟΥ: `isValidGlobalRole(globalRole)` ⇒ 400, ΟΧΙ εξουσιοδότηση', () => {
    // Το `globalRole` εδώ είναι ΠΑΡΑΜΕΤΡΟΣ ΣΩΜΑΤΟΣ, όχι ταυτότητα καλούντος.
    const { checks } = scanTree({
      'src/a.ts': src(
        'export function h(body) {',
        '  const { globalRole } = body;',
        '  if (!isValidGlobalRole(globalRole)) {',
        "    return NextResponse.json({ error: 'bad' }, { status: 400 });",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(checks).toEqual([]);
  });

  it('Κ7 — ΠΑΡΑΚΑΜΨΗ ΑΠΟ ΤΟΝ ΡΟΛΟ: η άρνηση πίσω από ΔΕΥΤΕΡΗ απόφαση ⇒ ΟΧΙ φρουρός', () => {
    // Segregation of duties: το «όχι» το λέει η ΤΑΥΤΟΤΗΤΑ, ο ρόλος απλώς εξαιρεί.
    const { guards, checks } = scanTree({
      'src/a.ts': src(
        'export function h(ctx, txn) {',
        '  if (!isRoleBypass(ctx.globalRole)) {',
        '    if (txn.matchedByName === ctx.email) {',
        "      return NextResponse.json({ error: 'segregation' }, { status: 403 });",
        '    }',
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(checks).toHaveLength(1);
    expect(guards).toEqual([]);
  });

  it('Κ8 — ΑΝΤΕΣΤΡΑΜΜΕΝΟΣ ΦΡΟΥΡΟΣ: early-return «ναι», καθαρή ουρά «όχι» ⇒ φρουρός', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function ensure(ctx) {',
        '  if (isRoleBypass(ctx.globalRole)) {',
        '    return null;',
        '  }',
        '  logger.warn("blocked");',
        '  return createForbiddenResponse();',
        '}',
      ),
    });
    expect(guards).toHaveLength(1);
    expect(guards[0].shape).toBe('inverted');
  });

  it('Κ8β — …αλλά ουρά ΜΕ δεύτερη απόφαση ⇒ ΟΧΙ φρουρός (απλή πρόωρη έξοδος)', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx, body) {',
        '  if (isRoleBypass(ctx.globalRole)) {',
        '    return null;',
        '  }',
        '  if (!body.id) {',
        "    return NextResponse.json({ error: 'no id' }, { status: 403 });",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(guards).toEqual([]);
  });

  it('Κ9 — ΑΛΥΣΙΔΑ ΔΥΟ ΚΡΙΚΩΝ: το σταθερό σημείο τη βλέπει', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        '  const role = ctx.globalRole;',
        "  const isAdmin = role === 'super_admin';",
        '  if (!isAdmin) {',
        "    return NextResponse.json({ error: 'no' }, { status: 403 });",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(guards).toHaveLength(1);
    expect(guards[0].condition).toBe('!isAdmin');
  });

  it('Κ10 — το 409 ΔΕΝ είναι άρνηση εξουσιοδότησης', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        '  if (!isRoleBypass(ctx.globalRole)) {',
        "    return NextResponse.json({ error: 'conflict' }, { status: 409 });",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(guards).toEqual([]);
  });

  it('Κ10β — ούτε το 400: επικύρωση εισόδου ΔΕΝ είναι άρνηση εξουσιοδότησης', () => {
    // ⚠️ Η άγκυρα γεννήθηκε επειδή η μετάλλαξη «το 400 γίνεται άρνηση» ΒΓΗΚΕ
    //    ΠΡΑΣΙΝΗ: το Κ6 δοκίμαζε γυμνό ταυτοποιητή, άρα ο κωδικός δεν παιζόταν
    //    ΠΟΤΕ. Δύο ανεξάρτητοι λόγοι έκρυβαν ο ένας τον άλλον.
    const { guards, checks } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        '  if (!isRoleBypass(ctx.globalRole)) {',
        "    return NextResponse.json({ error: 'bad request' }, { status: 400 });",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(checks).toHaveLength(1);
    expect(guards).toEqual([]);
  });

  it('Κ15 — αφαίρεση του `isRoleBypass` από τα κατηγορήματα ⇒ ο κυρίαρχος φρουρός ΤΥΦΛΩΝΕΤΑΙ', () => {
    // Κλείδωμα του ΜΟΝΟΥ πραγματικού λόγου ύπαρξης της λίστας.
    const { IDENTITY_ROLE_PREDICATES: preds } = require('../lib/authority-registry/role-guards');
    expect([...preds]).toContain('isRoleBypass');
  });

  it('Κ11 — Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ Η ΣΥΝΘΗΚΗ: μετακίνηση γραμμών ΔΕΝ γεννά νέα παραβίαση', () => {
    const body = src(
      'export function h(ctx) {',
      '  if (!isRoleBypass(ctx.globalRole)) {',
      "    return NextResponse.json({ error: 'no' }, { status: 403 });",
      '  }',
      '  return ok();',
      '}',
    );
    const before = scanTree({ 'src/a.ts': body }).guards.map(guardIdOf);
    const after = scanTree({ 'src/a.ts': `// νέο σχόλιο\n// άλλη γραμμή\n${body}` }).guards.map(guardIdOf);
    expect(after).toEqual(before);
    expect(before).toHaveLength(1);
  });

  it('Κ12 — …και ΔΕΥΤΕΡΟΣ, ΑΛΛΟΣ φρουρός στο ΙΔΙΟ αρχείο ΔΕΝ κληρονομεί τη δήλωση', () => {
    const files = {
      'src/a.ts': src(
        'export function one(ctx) {',
        '  if (!isRoleBypass(ctx.globalRole)) {',
        "    return NextResponse.json({ error: 'no' }, { status: 403 });",
        '  }',
        '  return ok();',
        '}',
        'export function two(ctx) {',
        "  if (ctx.globalRole !== 'super_admin') {",
        "    return NextResponse.json({ error: 'no' }, { status: 403 });",
        '  }',
        '  return ok();',
        '}',
      ),
    };
    const declared = [{ id: 'src/a.ts::!isRoleBypass(ctx.globalRole)', why: 'λ'.repeat(45) }];
    const verdict = judgeTree(files, declared);
    expect(idsOf(verdict, STATES.DECLARED_ROLE_GUARD)).toHaveLength(1);
    expect(idsOf(verdict, STATES.UNDECLARED_ROLE_GUARD)).toEqual([
      "src/a.ts::ctx.globalRole !== 'super_admin'",
    ]);
  });

  it('Κ13 — ο ΔΕΚΤΗΣ δεν έχει σημασία: `auth.` · `identity.` · `caller.`', () => {
    for (const receiver of ['ctx', 'auth', 'identity', 'caller']) {
      const { guards } = scanTree({
        'src/a.ts': src(
          'export function h(x) {',
          `  if (${receiver}.globalRole !== 'super_admin') {`,
          "    return NextResponse.json({ error: 'no' }, { status: 403 });",
          '  }',
          '  return ok();',
          '}',
        ),
      });
      expect(guards).toHaveLength(1);
    }
  });

  it('Κ14 — `throw` είναι άρνηση όσο και το 403', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        '  if (!isRoleBypass(ctx.globalRole)) {',
        "    throw new ApiError(403, 'no');",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(guards).toHaveLength(1);
  });
});

// =============================================================================
// Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ: ΕΠΑΝΑΦΟΡΑ ΤΟΥ ΙΣΤΟΡΙΚΟΥ ΦΡΟΥΡΟΥ
// =============================================================================

describe('Μ — επαναφορά του πραγματικού φρουρού ⇒ ⛔', () => {
  const cases = [
    {
      name: 'Μ1 — navigation/company: ο inline `!isAdmin` επιστρέφει',
      file: 'src/app/api/navigation/company/route.ts',
      from: 'async function handleAddCompany(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {',
      to: [
        'async function handleAddCompany(request: NextRequest, ctx: AuthContext): Promise<NextResponse> {',
        "  const isAdmin = ctx.globalRole === 'super_admin' || ctx.globalRole === 'company_admin';",
        '  if (!isAdmin) {',
        "    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });",
        '  }',
      ].join('\n'),
    },
    {
      name: 'Μ2 — org-structure: ο φρουρός του PUT επιστρέφει',
      file: 'src/app/api/org-structure/route.ts',
      from: '): Promise<NextResponse<PutResponse | { error: string }>> {',
      to: [
        '): Promise<NextResponse<PutResponse | { error: string }>> {',
        "  if (ctx.globalRole !== 'company_admin' && ctx.globalRole !== 'super_admin') {",
        "    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });",
        '  }',
      ].join('\n'),
    },
    {
      name: 'Μ3 — reconcile: ο ωμός `auth.globalRole` φρουρός επιστρέφει',
      file: 'src/app/api/accounting/bank/reconcile/route.ts',
      from: '  handler: async ({ req, auth }) => {',
      to: [
        '  handler: async ({ req, auth }) => {',
        "    if (auth.globalRole !== 'super_admin' && auth.globalRole !== 'company_admin') {",
        "      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });",
        '    }',
      ].join('\n'),
    },
  ];

  for (const { name, file, from, to } of cases) {
    it(name, () => {
      const original = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const mutated = mutate(original, from, to);
      const verdict = judgeTree({ [file]: mutated });
      const undeclared = idsOf(verdict, STATES.UNDECLARED_ROLE_GUARD);
      expect(undeclared.length).toBeGreaterThanOrEqual(1);
      expect(undeclared.every((id) => id.startsWith(file))).toBe(true);
    });
  }

  it('Μ4 — ο ΔΗΛΩΜΕΝΟΣ φρουρός: σβήσιμο της δήλωσης ⇒ ⛔ αδήλωτος', () => {
    const file = 'src/lib/admin-migration-runner.ts';
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const verdict = judgeTree({ [file]: body }, []);
    expect(idsOf(verdict, STATES.UNDECLARED_ROLE_GUARD)).toEqual([
      `${file}::!isRoleBypass(ctx.globalRole)`,
    ]);
  });

  it('Μ5 — …και ΑΛΛΑΓΗ της συνθήκης του ⇒ ⛔ ορφανή δήλωση + ⛔ αδήλωτος', () => {
    const file = 'src/lib/admin-migration-runner.ts';
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const mutated = mutate(body, '!isRoleBypass(ctx.globalRole)', "ctx.globalRole !== 'super_admin'");
    const verdict = judgeTree({ [file]: mutated }, [
      { id: `${file}::!isRoleBypass(ctx.globalRole)`, why: 'λ'.repeat(45) },
    ]);
    expect(idsOf(verdict, STATES.ORPHAN_GUARD_DECLARATION)).toHaveLength(1);
    expect(idsOf(verdict, STATES.UNDECLARED_ROLE_GUARD)).toHaveLength(1);
  });

  it('Μ6 — λόγος <40 χαρακτήρων ⇒ ⛔, ακόμη κι αν ο φρουρός είναι σωστός', () => {
    const file = 'src/lib/admin-migration-runner.ts';
    const body = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const verdict = judgeTree({ [file]: body }, [
      { id: `${file}::!isRoleBypass(ctx.globalRole)`, why: 'γιατί έτσι' },
    ]);
    expect(idsOf(verdict, STATES.REASONLESS_GUARD_DECLARATION)).toHaveLength(1);
  });

  it('Μ7 — ο μεταλλάκτης ΟΥΡΛΙΑΖΕΙ αν δεν άλλαξε τίποτα', () => {
    // Ο ισχυρισμός είναι «ουρλιάζει σε στόχο που λείπει», όχι η διατύπωση: το κείμενο
    // ανήκει πλέον στο `./_mutate` και έχει εκεί δικές του μεταλλάξεις.
    expect(() => mutate('abc', 'δεν υπάρχει', 'x')).toThrow(/βρέθηκε 0 φορές/);
  });

  it('Μ7β — ΚΑΙ ουρλιάζει σε ΑΣΑΦΗ στόχο, που πριν περνούσε ΣΙΩΠΗΛΑ', () => {
    // 🔴 Πριν την κεντρικοποίηση αυτό το κάλεσμα μετάλλασσε σιωπηλά την 1η εμφάνιση —
    // δηλαδή η άγκυρα δοκίμαζε σημείο που κανείς δεν διάλεξε, και θα «μετακόμιζε» μόνη
    // της την ημέρα που προστεθεί όμοιος handler. Είναι το περιστατικό που τεκμηριώνει
    // το `Μ0` του `check-firestore-tenant-scope.test.js`.
    const twice = src('handler: async () => {', 'handler: async () => {');
    expect(() => mutate(twice, 'handler: async () => {', 'x')).toThrow(/ΑΣΑΦΗΣ στόχος/);
  });
});

// =============================================================================
// Σ — ΤΑ ΔΟΜΙΚΑ ΣΤΟΙΧΕΙΑ
// =============================================================================

describe('Σ — τα δομικά στοιχεία', () => {
  const { parseSource } = require('../lib/contrast-promise/ts-read');

  function parse(body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roleguard-s-'));
    const abs = path.join(dir, 'x.ts');
    fs.writeFileSync(abs, body);
    return parseSource(abs);
  }

  it('Σ1 — collectRoleLocals: σταθερό σημείο, όχι ένα πέρασμα', () => {
    const sf = parse(src(
      'const a = ctx.globalRole;',
      "const b = a === 'super_admin';",
      'const c = b;',
    ));
    const locals = collectRoleLocals(sf);
    expect([...locals].sort()).toEqual(['a', 'b', 'c']);
  });

  it('Σ1β — …και το ΑΠΟΔΕΙΚΝΥΕΙ ΜΟΝΟ η ΑΝΤΙΣΤΡΟΦΗ σειρά: χρήση ΠΡΙΝ τη δήλωση', () => {
    // 🔴 Η ΑΓΚΥΡΑ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΑΛΛΑΞΗ ΠΟΥ ΒΓΗΚΕ ΠΡΑΣΙΝΗ: το `Σ1` γράφει την
    //    αλυσίδα σε ΤΟΠΟΛΟΓΙΚΗ σειρά, όπου ΕΝΑ πέρασμα αρκεί — δηλαδή δεν
    //    ασκούσε τον βρόχο καθόλου. Εδώ η δήλωση έρχεται ΜΕΤΑ τη χρήση της.
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        "  const isAdmin = role === 'super_admin';",
        '  if (!isAdmin) {',
        "    return NextResponse.json({ error: 'no' }, { status: 403 });",
        '  }',
        '  return ok();',
        '}',
        'const role = ctx.globalRole;',
      ),
    });
    expect(guards).toHaveLength(1);
    expect(guards[0].condition).toBe('!isAdmin');
  });

  it('Σ2 — isCallerRoleExpression: το «ή» απαιτεί ΚΑΙ ΤΑ ΔΥΟ σκέλη ρόλου', () => {
    const sf = parse(src(
      'export const x = isRoleBypass(ctx.globalRole) || data.authorId === ctx.uid;',
      "export const y = ctx.globalRole === 'a' || ctx.globalRole === 'b';",
    ));
    const ts = require('typescript');
    const inits = [];
    const walk = (n) => {
      if (ts.isVariableDeclaration(n) && n.initializer) inits.push(n.initializer);
      ts.forEachChild(n, walk);
    };
    ts.forEachChild(sf, walk);
    expect(isCallerRoleExpression(inits[0], new Set())).toBe(false);
    expect(isCallerRoleExpression(inits[1], new Set())).toBe(true);
  });

  it('Σ3 — τα ΣΧΟΛΙΑ δεν γεννούν φρουρό (το AST τα αγνοεί εξ ορισμού)', () => {
    // ⚠️ Το ίδιο το `role-guards.js` γράφει τον φρουρό σε σχόλιο ως τεκμηρίωση.
    const { guards } = scanTree({
      'src/a.ts': src(
        '// if (!isRoleBypass(ctx.globalRole)) return json(403);',
        '/* if (!isRoleBypass(ctx.globalRole)) { return json({}, {status: 403}); } */',
        'export const noop = 1;',
      ),
    });
    expect(guards).toEqual([]);
  });

  it('Σ4 — το judgeRoleGuards ανέχεται μητρώο ΧΩΡΙΣ `roleGuards` (fail-soft στη ΔΟΜΗ)', () => {
    // Η απουσία του πεδίου την πιάνει το `loadRegistry` (fail-closed), όχι εδώ:
    // δύο μηχανισμοί για το ίδιο θα ήταν δεύτερη αυθεντία.
    const rows = judgeRoleGuards({ registry: {}, roleChecks: [] });
    expect(rows).toEqual([]);
  });

  it('Σ6 — 🔴 Η ΣΚΑΝΔΑΛΗ ΒΛΕΠΕΙ ΤΟΝ ΜΟΝΟΡΟΛΙΚΟ ΦΡΟΥΡΟ', () => {
    // Χωρίς αυτό, ένα commit που προσθέτει `!isRoleBypass(ctx.globalRole)` δεν θα
    // πυροδοτούσε καν την πύλη — ο Κ1′ θα ήταν *γραμμένος και ανενεργός*
    // (ADR-749 §5). Ο μονορολικός φρουρός ΔΕΝ γράφει κανένα όνομα ρόλου.
    const { triggers } = require('../check-authority-registry');
    const guardOnly = src(
      'export function h(ctx) {',
      '  if (!isRoleBypass(ctx.globalRole)) {',
      "    return NextResponse.json({ error: 'no' }, { status: 403 });",
      '  }',
      '  return ok();',
      '}',
    );
    expect(guardOnly).not.toMatch(/super_admin|company_admin|internal_user|external_user/);
    expect(triggers(['src/app/api/x/route.ts'], () => guardOnly)).toBe(true);
  });

  it('Σ6β — …και ο ΠΑΡΟΝΟΜΑΣΤΗΣ: αρχείο χωρίς κανέναν δείκτη ΔΕΝ πυροδοτεί', () => {
    const { triggers } = require('../check-authority-registry');
    expect(triggers(['src/app/api/x/route.ts'], () => src('export const noop = 1;'))).toBe(false);
  });

  it('Σ7 — 🔴 ΤΟ ΜΟΝΟΠΑΤΙ ΤΟΥ ΚΑΤΑΛΟΓΟΥ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΜΗΤΡΩΟ, ΟΧΙ ΚΑΡΦΩΜΕΝΟ', () => {
    // 🔴 Ζωντανό περιστατικό: όταν το `PREDEFINED_ROLES` μετακόμισε σε
    //    `role-catalogue.ts` (N.7.1), η πύλη ΑΡΝΗΘΗΚΕ — σωστά. Η αιτία ήταν ότι
    //    το μονοπάτι ήταν ΔΕΥΤΕΡΗ ΑΥΘΕΝΤΙΑ δίπλα στο `ssot` του μητρώου.
    const { loadRegistry, readVocabularies: read } = require('../lib/authority-registry/inventory');
    const registry = loadRegistry(ROOT);
    expect(registry.ssot.roleCatalogue).toBe('src/lib/auth/role-catalogue.ts');
    expect(registry.ssot.rolePredicates).toBe('src/lib/auth/roles.ts');
    // …και ένα ΛΑΘΟΣ μονοπάτι στο μητρώο ⇒ ΑΡΝΗΣΗ, ποτέ «καθαρό δέντρο».
    expect(() => read(ROOT, { ssot: { roleCatalogue: 'src/lib/auth/types.ts' } }))
      .toThrow(/predefinedRoles/);
  });

  it('Σ5 — το `guardIdOf` κανονικοποιεί τα κενά της συνθήκης', () => {
    const { guards } = scanTree({
      'src/a.ts': src(
        'export function h(ctx) {',
        '  if (',
        '    !isRoleBypass(',
        '      ctx.globalRole,',
        '    )',
        '  ) {',
        "    return NextResponse.json({ error: 'no' }, { status: 403 });",
        '  }',
        '  return ok();',
        '}',
      ),
    });
    expect(guards).toHaveLength(1);
    expect(guardIdOf(guards[0])).not.toMatch(/\s{2}/);
  });
});
