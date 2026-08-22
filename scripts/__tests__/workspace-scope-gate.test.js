/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ CHECK 3.60 — Η ΠΥΛΗ ΤΗΣ ΕΜΒΕΛΕΙΑΣ (ADR-787 §5.3 γ)
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ** — μίνι-repo από **πραγματικά** αρχεία,
 *    μία γραμμή αλλαγή. Μετάλλαξη στην πύλη θα αποδείκνυε ότι το test τρέχει·
 *    μετάλλαξη στην είσοδο αποδεικνύει ότι **κοιτάζει το σωστό πράγμα**.
 *
 * ⚠️ **ΤΟ `miniRepo` ΟΥΡΛΙΑΖΕΙ ΑΝ Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ** — μια μετάλλαξη
 *    που δεν ταίριαξε αφήνει το test πράσινο **χωρίς να δοκιμάσει τίποτα**
 *    (μάθημα CHECK 3.44 / `Μ11`).
 *
 * ⚠️ `@jest-environment node`: η πύλη διαβάζει τον δίσκο.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gate = require('../check-workspace-scope');
const scope = require('../lib/workspace-scope/scope');
const { judgeIdentityShift, shiftPipeIdentity } = require('../lib/workspace-scope/identity-shift');

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Τα αρχεία-είσοδοι της πύλης, αντιγραμμένα **αυτούσια** από το repo. */
const FIXTURE_FILES = ['.workspace-scope.json', 'src/lib/workspace/workspace-path.ts'];

function miniRepo(edits = {}, pages = ['projects', 'contacts', 'admin', 'terms']) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ws360-'));

  for (const rel of FIXTURE_FILES) {
    let source = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    if (edits[rel]) {
      const next = edits[rel](source);
      if (next === source) throw new Error(`η μετάλλαξη στο ${rel} ΔΕΝ άλλαξε τίποτα.`);
      source = next;
    }
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, source);
  }

  for (const p of pages) {
    const dest = path.join(root, 'src', 'app', '(app)', ...p.split('/'), 'page.tsx');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, 'export default function P(){return null}\n');
  }
  return root;
}

const byState = (m) => Object.fromEntries(Object.entries(m.ledger).map(([k, v]) => [k, v.length]));

// =============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ
// =============================================================================

describe('Μ0 — παρονομαστής: η πύλη κρίνει το ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  it('Μ0α: το πρόθεμα διαβάζεται από το TS SSoT', () => {
    expect(scope.readPrefix()).toBe('o');
  });

  it('Μ0β: η λογιστική ΚΛΕΙΝΕΙ πάνω στο πραγματικό δέντρο', () => {
    const m = gate.measure();
    const counted = gate.ORDER.reduce((s, st) => s + m.ledger[st].length, 0);
    expect(counted).toBe(m.findings.length);
    expect(counted).toBe(m.scope.pages.length);
  });

  it('Μ0γ: καμία ορφανή δήλωση σήμερα', () => {
    expect(gate.measure().blocking).toEqual([]);
  });

  it('Μ0δ: κάθε εξαίρεση έχει λόγο ουσίας (>40 χαρακτήρες)', () => {
    for (const [segment, why] of scope.readScope()) {
      expect(why.length).toBeGreaterThan(40);
      expect(segment).toBeTruthy();
    }
  });
});

// =============================================================================
// Κ — ΤΑ ΚΡΙΤΗΡΙΑ, ΣΕ ΜΙΝΙ-REPO
// =============================================================================

describe('Κ — τα δύο κριτήρια', () => {
  it('Κ1: 🔴 η ΠΡΟΕΠΙΛΟΓΗ ΕΙΝΑΙ «ΜΠΑΙΝΕΙ» — αδήλωτος φάκελος μετριέται ως εντός', () => {
    const root = miniRepo({}, ['projects', 'contacts']);
    const m = gate.measure([], root);
    expect(byState(m)['unprefixed-in-scope']).toBe(2);
    expect(byState(m)['declared-outside']).toBe(0);
  });

  it('Κ2: δηλωμένη εξαίρεση μετριέται ΕΚΤΟΣ', () => {
    const root = miniRepo({}, ['projects', 'admin', 'terms']);
    const m = gate.measure([], root);
    expect(byState(m)['declared-outside']).toBe(2); // admin + terms
    expect(byState(m)['unprefixed-in-scope']).toBe(1); // projects
  });

  it('Κ3: σελίδα ΜΕ πρόθεμα μετριέται prefixed — η εκστρατεία μετράει πρόοδο', () => {
    const root = miniRepo({}, ['o/[workspace]/projects', 'contacts']);
    const m = gate.measure([], root);
    expect(byState(m).prefixed).toBe(1);
    expect(byState(m)['unprefixed-in-scope']).toBe(1);
  });

  it('Κ4: ⛔ ΟΡΦΑΝΗ ΔΗΛΩΣΗ — εξαίρεση για φάκελο που δεν υπάρχει', () => {
    // Κάθε νεκρή γραμμή είναι ένα όνομα που ο χρήστης δεν μπορεί να πάρει ΧΩΡΙΣ ΛΟΓΟ.
    const root = miniRepo({}, ['projects']); // κανένα από τα 15 δηλωμένα δεν υπάρχει
    const m = gate.measure([], root);
    expect(m.blocking.length).toBe(15);
    expect(m.blocking.every((f) => f.state === 'orphan-declaration')).toBe(true);
  });

  it('Κ5: 🔴 Η BASELINE ΑΡΝΕΙΤΑΙ ΝΑ ΓΡΑΨΕΙ ΟΡΦΑΝΗ ΔΗΛΩΣΗ', () => {
    // Ένα zero-tolerance που κλειδώνεται με ένα --write-baseline δεν είναι zero-tolerance.
    const root = miniRepo({}, ['projects']);
    expect(() => gate.buildPayload(gate.measure([], root))).toThrow(/ΑΡΝΗΣΗ ΕΓΓΡΑΦΗΣ BASELINE/);
  });

  it('Κ6: οι μπλοκάροντες κάδοι υπάρχουν ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ', () => {
    // Ένα «0» που δεν φαίνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος» (3.56).
    // ⚠️ Το δέντρο πρέπει να έχει σελίδα για ΚΑΘΕ δηλωμένη εξαίρεση, αλλιώς οι
    //    υπόλοιπες είναι — σωστά — ορφανές, και το test θα μετρούσε άλλο πράγμα.
    const allDeclared = [...scope.readScope().keys()];
    const m = gate.measure([], miniRepo({}, [...allDeclared, 'projects']));
    for (const state of gate.BLOCKING) expect(m.ledger[state]).toEqual([]);
    // Ο παρονομαστής: ΚΑΤΙ κρίθηκε — αλλιώς το «0» θα σήμαινε «δεν κοίταξα».
    expect(m.findings.length).toBe(allDeclared.length + 1);
  });
});

// =============================================================================
// Μ — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ
// =============================================================================

describe('Μ — μεταλλάξεις στις ΕΙΣΟΔΟΥΣ', () => {
  it('Μ1: 🔴 εξαίρεση ΧΩΡΙΣ λόγο ⇒ η πύλη ΑΡΝΕΙΤΑΙ', () => {
    const root = miniRepo(
      { '.workspace-scope.json': (s) => s.replace(/"why": "ΔΗΜΟΣΙΑ ΝΟΜΙΚΗ ΟΘΟΝΗ — ίδιος λόγος[^"]*"/, '"why": ""') },
      ['terms'],
    );
    expect(() => gate.measure([], root)).toThrow(/δεν έχει λόγο/);
  });

  it('Μ2: 🔴 αν σβηστεί το πρόθεμα από το TS SSoT ⇒ ΑΡΝΗΣΗ, όχι προεπιλογή', () => {
    // Ένα `?? 'o'` θα έκανε την πύλη να κρίνει με φανταστικό πρόθεμα — πράσινη
    // πάνω σε δέντρο που δεν κοίταξε.
    const root = miniRepo({
      'src/lib/workspace/workspace-path.ts': (s) =>
        s.replace("export const WORKSPACE_PATH_PREFIX = 'o';", 'const MOVED = 1;'),
    });
    expect(() => gate.measure([], root)).toThrow(/WORKSPACE_PATH_PREFIX/);
  });

  it('Μ3: αν ΑΛΛΑΞΕΙ το πρόθεμα, η πύλη το ακολουθεί — δεν κρατά αντίγραφο', () => {
    const root = miniRepo(
      {
        'src/lib/workspace/workspace-path.ts': (s) =>
          s.replace("export const WORKSPACE_PATH_PREFIX = 'o';", "export const WORKSPACE_PATH_PREFIX = 'ws';"),
      },
      ['ws/[workspace]/projects'],
    );
    const m = gate.measure([], root);
    expect(m.scope.prefix).toBe('ws');
    expect(byState(m).prefixed).toBe(1);
  });

  it('Μ4: αν αφαιρεθεί εξαίρεση, ο φάκελος γίνεται ΕΝΤΟΣ (fail-closed)', () => {
    const root = miniRepo(
      { '.workspace-scope.json': (s) => s.replace(/\s*"admin": \{[\s\S]*?\},\n/, '\n') },
      ['admin', 'terms'],
    );
    const m = gate.measure([], root);
    expect(byState(m)['unprefixed-in-scope']).toBe(1);
    expect(m.declarations).not.toContain('admin');
  });
});

// =============================================================================
// Ι — Ο ΙΣΟΜΟΡΦΙΣΜΟΣ: ΜΕΤΑΚΙΝΗΣΗ vs ΠΑΛΙΝΔΡΟΜΗΣΗ
// =============================================================================

describe('Ι — ο ισομορφισμός (ADR-787 §5.3 στ)', () => {
  const shiftPath = (url) =>
    scope.shiftUrl(url, { prefix: 'o', outside: new Map([['terms', 'x']]), alias: 'nikos' });
  const shift = (id) => shiftPipeIdentity(id, shiftPath);

  it('Ι1: ✅ ΚΑΘΑΡΗ ΜΕΤΑΚΙΝΗΣΗ ⇒ verdict «move»', () => {
    const before = ['/projects|surface-shell-only|x', '/contacts|raw-key|y'];
    const after = ['/o/nikos/projects|surface-shell-only|x', '/o/nikos/contacts|raw-key|y'];
    const r = judgeIdentityShift({ before, after, shift });
    expect(r.verdict).toBe('move');
    expect(r.appeared).toEqual([]);
    expect(r.vanished).toEqual([]);
  });

  it('Ι2: 🔴🔴 Η ΤΥΦΛΩΣΗ ΠΙΑΝΕΤΑΙ — shell-only → synthetic-id ΔΕΝ είναι μετακίνηση', () => {
    // ΤΟ ΚΡΙΣΙΜΟ: αυτό είναι το πραγματικό ρίσκο της Φάσης 3. Ο χρησμός σταματά
    // σιωπηλά να κρίνει, η παραβίαση γίνεται «μετριέται-δεν-μπλοκάρει», και ένα
    // μαζικό reseed θα το κλείδωνε. Η κατάσταση είναι ΜΕΡΟΣ της ταυτότητας,
    // οπότε ο ισομορφισμός το πιάνει ΧΩΡΙΣ να ξέρει τίποτα γι' αυτό.
    const before = ['/projects|surface-shell-only|x'];
    const after = ['/o/nikos/projects|surface-synthetic-id|x'];
    const r = judgeIdentityShift({ before, after, shift });
    expect(r.verdict).toBe('regression');
    expect(r.vanished).toEqual(['/o/nikos/projects|surface-shell-only|x']);
    expect(r.appeared).toEqual(['/o/nikos/projects|surface-synthetic-id|x']);
  });

  it('Ι3: 🔴 ΝΕΑ παραβίαση ⇒ regression, με ΟΝΟΜΑ', () => {
    const before = ['/projects|surface-shell-only|x'];
    const after = ['/o/nikos/projects|surface-shell-only|x', '/o/nikos/reports|raw-key|z'];
    const r = judgeIdentityShift({ before, after, shift });
    expect(r.verdict).toBe('regression');
    expect(r.appeared).toEqual(['/o/nikos/reports|raw-key|z']);
  });

  it('Ι4: εξαίρεση ΔΕΝ μετασχηματίζεται — μένει όπως ήταν', () => {
    const before = ['/terms|surface-shell-only|x'];
    const r = judgeIdentityShift({ before, after: before, shift });
    expect(r.verdict).toBe('identical');
  });

  it('Ι5: 🔴 ΜΗ ΕΝΕΣΙΜΟΣ ΜΕΤΑΣΧΗΜΑΤΙΣΜΟΣ ⇒ regression, ΟΧΙ σιωπηλή απώλεια', () => {
    // Αν δύο παλιές ταυτότητες πέσουν στην ΙΔΙΑ νέα, το πλήθος μειώνεται και μια
    // αφελής σύγκριση θα έλεγε «λιγότερα, μπράβο» — δηλαδή ο ίδιος ο ισομορφισμός
    // θα ήταν το εργαλείο που κρύβει την απώλεια.
    const collapse = () => '/o/nikos/same|s|k';
    const r = judgeIdentityShift({
      before: ['/a|s|k', '/b|s|k'],
      after: ['/o/nikos/same|s|k'],
      shift: collapse,
    });
    expect(r.verdict).toBe('regression');
    expect(r.collided).toHaveLength(1);
  });

  it('Ι6: το shiftUrl είναι IDEMPOTENT — διπλή εφαρμογή δεν δίνει /o/a/o/a', () => {
    const once = shiftPath('/projects');
    expect(shiftPath(once)).toBe(once);
  });

  it('Ι7: 🔑 ο ισομορφισμός δουλεύει στην ΠΡΑΓΜΑΤΙΚΗ baseline του CHECK 3.51', () => {
    // Ο παρονομαστής: αν το αρχείο δεν υπάρχει ή είναι άδειο, η άγκυρα θα ήταν
    // πράσινη επειδή δεν κοίταξε τίποτα.
    const baseline = require(path.join(REPO_ROOT, '.i18n-ssr-oracle-baseline.json'));
    expect(baseline.violations.length).toBeGreaterThan(100);

    const live = scope.buildScope();
    const shiftLive = (id) =>
      shiftPipeIdentity(id, (url) =>
        scope.shiftUrl(url, { prefix: live.prefix, outside: live.outside, alias: 'nikos' }),
      );

    const after = baseline.violations.map(shiftLive);
    const r = judgeIdentityShift({ before: baseline.violations, after, shift: shiftLive });
    expect(r.verdict).toBe('move');
    // Και ΚΑΤΙ μετακινήθηκε — αλλιώς το «move» θα ήταν κενή δήλωση.
    expect(r.moved).toBeGreaterThan(100);
  });
});
