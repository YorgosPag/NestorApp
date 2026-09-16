/**
 * CHECK 4 — **η πύλη μεγέθους αρχείου**, και η ερώτηση *«μετράει αυτό που λέει ότι μετράει;»*
 *
 *   Μ0      — το ΠΡΑΓΜΑΤΙΚΟ δέντρο: τα αρχεία που σήμερα ξεπερνούν τις 500 ωμές γραμμές
 *             περνούν, γιατί ο κώδικάς τους είναι κάτω από το όριο (μετρημένο 11/11)
 *   Κ1..Κ8  — το συμβόλαιο: τι μετριέται, τι όχι, και ότι το μήνυμα το ΛΕΕΙ
 *   Μ1..Μ2  — μεταλλάξεις **στην ΙΔΙΑ ΤΗΝ ΠΥΛΗ**: αν φύγει ο κανόνας, το Κ κοκκινίζει
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ**: ως τις 2026-09-16 η πύλη που μπλοκάρει **κάθε**
 * commit του έργου **δεν είχε καμία άγκυρα** — μόνο ο δρομολογητής την καλούσε. Δηλαδή η
 * μηχανή που αποφασίζει «περνάς ή όχι» ήταν **ανεπαλήθευτη**, και το ίδιο το ADR-587 §6.1
 * το ονομάζει: *«ένα anchor χωρίς πύλη δεν είναι anchor, είναι σχόλιο»* — εδώ ήταν το
 * ανάποδο, **πύλη χωρίς anchor**.
 *
 * 🔑 **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΧΤΥΠΟΥΝ ΤΗΝ ΠΥΛΗ, ΟΧΙ ΤΙΣ ΕΙΣΟΔΟΥΣ** — επίτηδες, και είναι η διαφορά
 * από το CHECK 3.48 εδώ δίπλα. Εκεί το ερώτημα είναι *«πιάνει η πύλη τη νάρκη;»* (μεταλλάσσεις
 * την είσοδο). Εδώ το ερώτημα είναι *«είναι ο **ΚΑΝΟΝΑΣ ΜΕΤΡΗΣΗΣ** ζωντανός;»* — και αυτό
 * απαντιέται μόνο αν χαλάσεις τον **μετρητή** και απαιτήσεις να αλλάξει η ετυμηγορία.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { withMutation } = require('./_mutate');

const REPO = path.resolve(__dirname, '..', '..');
const GATE = path.join(REPO, 'scripts', 'check-file-sizes.js');

let workdir;
beforeAll(() => {
  workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-4-'));
});
afterAll(() => {
  fs.rmSync(workdir, { recursive: true, force: true });
});

/**
 * Γράφει προσωρινό αρχείο και **εκτελεί** την πύλη πάνω του.
 *
 * ⚠️ Το όνομα **δεν** επιτρέπεται να ταιριάζει στο `EXEMPT_RE` (`.test.`, `-constants`, …),
 * αλλιώς το test θα έβαφε πράσινο επειδή η πύλη **δεν κοίταξε** — το σχήμα «`0` = κανείς δεν
 * κοίταξε» μέσα στην ίδια του την άγκυρα.
 */
function runGateOn(name, source) {
  const target = path.join(workdir, name);
  fs.writeFileSync(target, source, 'utf8');
  try {
    const stdout = execFileSync('node', [GATE, target], { cwd: REPO, encoding: 'utf8' });
    return { blocked: false, stdout };
  } catch (err) {
    return { blocked: true, stdout: String(err.stdout ?? '') };
  }
}

/** `n` γραμμές πραγματικού κώδικα. */
const code = (n) => Array.from({ length: n }, (_, i) => `const x${i} = ${i};`);

/** `n` γραμμές σχολίου μιας γραμμής. */
const slashes = (n) => Array.from({ length: n }, (_, i) => `// σχόλιο ${i}`);

/** Ένα μπλοκ JSDoc `n` γραμμών (άνοιγμα + σώμα + κλείσιμο). */
const block = (n) => ['/**', ...Array.from({ length: n - 2 }, (_, i) => ` * γραμμή ${i}`), ' */'];

// ── Μ0 ───────────────────────────────────────────────────────────────────────

describe('Μ0 — η βάση: το ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  /**
   * Μετρημένο 2026-09-16: **11 στα 11** μη-εξαιρούμενα αρχεία του `src/` που ξεπερνούν τις
   * 500 **ωμές** γραμμές είναι κάτω από 500 γραμμές **κώδικα**. Δηλαδή η παλιά μέτρηση δεν
   * έπιανε **κανένα** πραγματικό χρέος σε αυτή τη ζώνη — έπιανε **μόνο** τεκμηρίωση.
   */
  const REAL = [
    'src/lib/message-utils.ts',
    'src/lib/social-platform-system/profile-service.ts',
    'src/lib/auth/role-catalogue.ts',
    'src/subapps/dxf-viewer/ui/wall-advanced-panel/sections/WallDnaEditor.tsx',
  ];

  it.each(REAL)('%s: >500 ωμές γραμμές αλλά ΠΕΡΝΑ — ο κώδικάς του είναι κάτω από το όριο', (rel) => {
    const abs = path.join(REPO, rel);
    const raw = fs.readFileSync(abs, 'utf8').split('\n').length;
    // Αν το αρχείο συρρικνωθεί κάτω από 500 ωμές, το test δεν δοκιμάζει πια τίποτα.
    expect(raw).toBeGreaterThan(500);
    expect(execFileSync('node', [GATE, abs], { cwd: REPO, encoding: 'utf8' })).toContain('✅');
  });
});

// ── Κ1..Κ8 — το συμβόλαιο ────────────────────────────────────────────────────

describe('Κ — το συμβόλαιο της μέτρησης', () => {
  it('Κ1: 400 κώδικας + 400 σχόλια ⇒ ΠΕΡΝΑ (800 ωμές γραμμές)', () => {
    const src = [...slashes(400), ...code(400)].join('\n');
    expect(runGateOn('probe-comments.ts', src).blocked).toBe(false);
  });

  it('Κ2: 501 γραμμές καθαρού κώδικα ⇒ ΜΠΛΟΚ — το ταβάνι ΔΕΝ χαλάρωσε', () => {
    const { blocked, stdout } = runGateOn('probe-code.ts', code(501).join('\n'));
    expect(blocked).toBe(true);
    expect(stdout).toContain('501/500');
  });

  it('Κ3: ακριβώς 500 γραμμές κώδικα ⇒ ΠΕΡΝΑ — το όριο είναι «πάνω από», όχι «ίσο»', () => {
    expect(runGateOn('probe-500.ts', code(500).join('\n')).blocked).toBe(false);
  });

  it('Κ4: 🔴 το trailing newline ΔΕΝ είναι γραμμή — το off-by-one που ανέφερε 521 αντί 520', () => {
    // Η παλιά μέτρηση (`split('\n').length`) έλεγε 501 για αυτό το αρχείο και ΜΠΛΟΚΑΡΕ.
    // Το ESLint το τεκμηριώνει ρητά: «This rule does not count that extra line».
    expect(runGateOn('probe-trailing.ts', `${code(500).join('\n')}\n`).blocked).toBe(false);
  });

  it('Κ5: μπλοκ σχολίου (JSDoc) δεν προσμετράται, ούτε οι γραμμές συνέχειας `*`', () => {
    const src = [...block(300), ...code(400)].join('\n');
    expect(runGateOn('probe-jsdoc.ts', src).blocked).toBe(false);
  });

  it('Κ6: κώδικας ΜΕΤΑ το κλείσιμο μπλοκ μετριέται — `*/ const x = 1;` είναι κώδικας', () => {
    // Χωρίς αυτό, κάποιος θα μπορούσε να κρύψει ολόκληρο αρχείο πίσω από μια γραμμή `*/`.
    const tail = Array.from({ length: 480 }, (_, i) => `*/ const y${i} = ${i}; /*`);
    const src = ['/*', ...tail, '*/', ...code(30)].join('\n');
    expect(runGateOn('probe-after-close.ts', src).blocked).toBe(true);
  });

  it('Κ7: το μήνυμα ΛΕΕΙ τι μέτρησε — και τον κώδικα και το σύνολο', () => {
    // Μια πύλη που κρύβει τη μέτρησή της είναι η επόμενη αδιαφάνεια: ο άνθρωπος βλέπει «521»,
    // ανοίγει το αρχείο, μετρά 520, και παύει να εμπιστεύεται την πύλη.
    const src = [...slashes(200), ...code(501)].join('\n');
    const { blocked, stdout } = runGateOn('probe-message.ts', src);
    expect(blocked).toBe(true);
    expect(stdout).toContain('γραμμές κώδικα');
    expect(stdout).toContain('σύνολο αρχείου: 701');
    expect(stdout).toContain('ΜΗΝ σβήσεις σχόλια');
  });

  it('Κ8: εξαιρούμενο αρχείο περνά ανεξάρτητα από μέγεθος — οι εξαιρέσεις έμειναν ανέγγιχτες', () => {
    expect(runGateOn('types.ts', code(2000).join('\n')).blocked).toBe(false);
  });
});

// ── Μ1..Μ2 — μεταλλάξεις ΣΤΗΝ ΠΥΛΗ ───────────────────────────────────────────

describe('Μ — ο κανόνας μέτρησης είναι ΖΩΝΤΑΝΟΣ', () => {
  it('Μ1: αν πάψει να αναγνωρίζει το `//`, το Κ1 ΜΠΛΟΚΑΡΕΙ — ο κανόνας δαγκώνει', () => {
    const src = [...slashes(400), ...code(400)].join('\n');
    const blocked = withMutation(
      GATE,
      '      if (eol !== -1 && (open === -1 || eol < open)) {',
      '      if (false) {',
      () => runGateOn('probe-mutation-1.ts', src).blocked,
    );
    expect(blocked).toBe(true);
  });

  it('Μ2: αν ξαναμετρήσει το trailing newline, το ΣΥΝΟΛΟ του μηνύματος γίνεται λάθος', () => {
    // ⚠️ Η μετάλλαξη ΔΕΝ αλλάζει την ετυμηγορία, και αυτό είναι **εύρημα**: αφότου η μέτρηση
    // έγινε «κώδικας», η τελευταία κενή γραμμή δεν μετριέται ούτως ή άλλως. Το `pop()` κρατά
    // τίμιο το **σύνολο που τυπώνεται** — δηλαδή ακριβώς τον αριθμό που έκανε τον άνθρωπο να
    // δει «521» ενώ το `wc -l` έλεγε «520» και να πάψει να εμπιστεύεται την πύλη.
    const src = `${[...slashes(200), ...code(501)].join('\n')}\n`;
    const stdout = withMutation(
      GATE,
      "  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();",
      '  void 0;',
      () => runGateOn('probe-mutation-2.ts', src).stdout,
    );
    expect(stdout).toContain('σύνολο αρχείου: 702');
  });
});
