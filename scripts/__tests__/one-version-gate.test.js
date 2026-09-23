/**
 * @jest-environment node
 *
 * ΑΓΚΥΡΕΣ CHECK 3.65 — Η ΠΥΛΗ ΤΗΣ ΜΙΑΣ ΕΚΔΟΣΗΣ (ADR-800)
 *
 * ⚠️ **ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ** — μίνι-repo από **πραγματικά** αρχεία,
 *    μία γραμμή αλλαγή. Μετάλλαξη στην πύλη αποδεικνύει ότι το test *τρέχει*·
 *    μετάλλαξη στην είσοδο αποδεικνύει ότι *κοιτάζει το σωστό πράγμα*.
 *
 * ⚠️ **Ο ΜΕΤΑΛΛΑΚΤΗΣ ΟΥΡΛΙΑΖΕΙ ΑΝ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ — ΚΑΙ ΑΝΑ ΑΝΤΙΚΑΤΑΣΤΑΣΗ.**
 *    Ένας φρουρός μόνο στο **τελικό** αποτέλεσμα μένει σιωπηλός όταν ένα
 *    `s.replace(a).replace(b)` ταιριάξει μόνο το `a` — και τότε το test δοκιμάζει
 *    **μισό** σενάριο, πράσινο. Το πλήρωσα γράφοντας το `Μ2`· είναι το μάθημα #3
 *    της 2026-08-25 (και το `Μ11` του CHECK 3.44) σε νέα θέση.
 *
 * ⚠️ `@jest-environment node`: η πύλη διαβάζει τον δίσκο (μάθημα CHECK 3.46 —
 *    σφάλμα περιβάλλοντος διαβάζεται ως «σπασμένη πύλη»).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const contract = require('../lib/one-version/contract.js');
const lockfile = require('../lib/one-version/lockfile.js');
const workspace = require('../lib/one-version/workspace.js');
const { BLOCKING, LEDGER_STATES, sweep } = require('../lib/one-version/gate.js');
const cli = require('../check-one-version.js');
const ciTools = require('../lib/one-version/ci-tools.js');

const CI_OWNER = ciTools.CI_TOOLS['firebase-tools'].owner;
const CI_AUTHORITY = ciTools.CI_TOOLS['firebase-tools'].authority;

const S = contract.GATE_STATES;
const REPO_ROOT = path.join(__dirname, '..', '..');

/** ⚠️ ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`: το `HEAD` μετακινείται και η βαθμονόμηση
 *  θα αυτοακυρωνόταν σιωπηλά (μάθημα CHECK 3.41 · 3.50 · 3.55). */
const PRE_FIX_COMMIT = 'a3003038';

function gitShow(commit, rel) {
  const out = execFileSync('git', ['show', `${commit}:${rel}`], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (!out.trim()) throw new Error(`git show ${commit}:${rel} επέστρεψε κενό — η βαθμονόμηση δεν έχει είσοδο.`);
  return out;
}

/**
 * Το πραγματικό μπλοκ `importers:`, **αυτούσιο**. Δεν αντιγράφουμε ολόκληρο το
 * 1 MB lockfile σε κάθε test: αντιγράφουμε **ακριβώς** τις γραμμές που κρίνει η
 * πύλη, και προσθέτουμε επόμενο μπλοκ ανώτατου επιπέδου ώστε να ασκείται και ο
 * τερματισμός του αναγνώστη.
 */
function importersBlockOf(lockText) {
  const lines = lockText.split(/\r?\n/);
  const start = lines.indexOf('importers:');
  if (start < 0) throw new Error('importers: δεν βρέθηκε στο lockfile του fixture.');
  let end = start + 1;
  while (end < lines.length && !(/^\S/.test(lines[end]) && lines[end].trim())) end++;
  return lines.slice(start, end).join('\n');
}

const realImportersBlock = () =>
  importersBlockOf(fs.readFileSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'), 'utf8'));

function lockFrom(importersBlock) {
  return `lockfileVersion: '9.0'\n\n${importersBlock}\npackages:\n\n  some-pkg@1.0.0: {}\n`;
}

const NO_EXCEPTIONS = JSON.stringify({ sharedDependencies: {} }, null, 2);
const LONG_REASON = 'δοκιμαστικός λόγος, αρκετά μακρύς ώστε να περάσει το υποχρεωτικό κατώφλι της πύλης';

/** Μία αντικατάσταση· αν δεν ταίριαξε, σφάλμα — ποτέ σιωπηλά μισό σενάριο. */
function replaceOnce(text, pattern, replacement) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`η αντικατάσταση ${pattern} ΔΕΝ ταίριαξε σε τίποτα.`);
  return next;
}

/**
 * Μίνι-repo από **πραγματικά** αρχεία. `edits` = { relPath: (text) => text }
 * για μετάλλαξη, ή συμβολοσειρά για νέο αρχείο.
 */
/**
 * ⚠️ **ΟΛΟΚΛΗΡΗ Η ΚΑΤΑΣΤΑΣΗ ΑΠΟ ΤΟ ΙΔΙΟ ΣΗΜΕΙΟ, ΠΟΤΕ ΜΙΣΗ.** Με `fromCommit`, **ΚΑΘΕ**
 * είσοδος (manifests **και** lockfile) διαβάζεται από το καρφωμένο commit. Η πρώτη γραφή
 * ζευγάρωνε το **παλιό** manifest με το **σημερινό** lockfile — κατάσταση που **δεν υπήρξε
 * ποτέ**, και που έδινε σωστή απάντηση **κατά τύχη** μέχρι να τρέξει το `pnpm install`.
 * Το έπιασε η ίδια η βαθμονόμηση, μόλις η πραγματικότητα προχώρησε.
 */
function miniRepo(edits = {}, fromCommit = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'onever-'));
  const read = (rel) => (fromCommit ? gitShow(fromCommit, rel) : fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
  const files = {
    'pnpm-workspace.yaml': read('pnpm-workspace.yaml'),
    'pnpm-lock.yaml': lockFrom(importersBlockOf(read('pnpm-lock.yaml'))),
    '.one-version.json': NO_EXCEPTIONS,
    'package.json': read('package.json'),
    'packages/core/package.json': read('packages/core/package.json'),
    'src/subapps/dxf-viewer/package.json': read('src/subapps/dxf-viewer/package.json'),
    // ΣΤ · ΕΡΓΑΛΕΙΑ CI — πάντα από το ΤΡΕΧΟΝ δέντρο: είναι ορθογώνια στο pnpm ιστορικό των Π.
    [CI_OWNER]: fs.readFileSync(path.join(REPO_ROOT, CI_OWNER), 'utf8'),
    [CI_AUTHORITY]: fs.readFileSync(path.join(REPO_ROOT, CI_AUTHORITY), 'utf8'),
  };
  for (const [rel, mutate] of Object.entries(edits)) {
    const before = files[rel];
    if (before === undefined && typeof mutate !== 'string') {
      throw new Error(`άγνωστο fixture ${rel} — πέρασε συμβολοσειρά για να δημιουργηθεί νέο αρχείο.`);
    }
    const after = typeof mutate === 'string' ? mutate : mutate(before);
    if (before !== undefined && after === before) throw new Error(`η μετάλλαξη στο ${rel} ΔΕΝ άλλαξε τίποτα.`);
    files[rel] = after;
  }
  for (const [rel, text] of Object.entries(files)) {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text);
  }
  return root;
}

const counts = (result, ledger) => result.ledgers[ledger].tally;
const idsOf = (result, state) => result.rows.filter((r) => r.state === state).map((r) => r.id);

/** Προσθέτει εγγραφή στον importer του subapp, στο μπλοκ `dependencies:`. */
const addSubappLockEntry = (name, specifier, version) => (text) =>
  replaceOnce(
    text,
    /( {2}src\/subapps\/dxf-viewer:\n {4}dependencies:\n)/,
    `$1      ${name}:\n        specifier: ${specifier}\n        version: ${version}\n`,
  );

// =============================================================================
// Μ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η πύλη κρίνει το ΠΡΑΓΜΑΤΙΚΟ δέντρο
// =============================================================================

describe('Μ0 — παρονομαστής', () => {
  it('Μ0α: τα μέλη του workspace προκύπτουν από τα globs και είναι τρία', () => {
    const { members } = workspace.readWorkspace(REPO_ROOT);
    expect(members.map((m) => m.dir).sort()).toEqual(['.', 'packages/core', 'src/subapps/dxf-viewer']);
  });

  it('Μ0β: ο αναγνώστης του lockfile βρίσκει τους ίδιους importers', () => {
    const { importers } = lockfile.readLockfile(REPO_ROOT);
    expect(Object.keys(importers).sort()).toEqual(['.', 'packages/core', 'src/subapps/dxf-viewer']);
  });

  it('Μ0γ: ΚΑΘΕ κατάστιχο κλείνει πάνω στο πραγματικό δέντρο', () => {
    const result = sweep(REPO_ROOT);
    for (const [ledger, states] of Object.entries(LEDGER_STATES)) {
      const summed = states.reduce((n, s) => n + result.ledgers[ledger].tally[s], 0);
      const emitted = result.rows.filter((r) => r.ledger === ledger).length;
      expect({ ledger, summed }).toEqual({ ledger, summed: result.ledgers[ledger].population });
      expect({ ledger, emitted }).toEqual({ ledger, emitted: summed });
    }
  });

  it('Μ0δ: το `.one-version.json` υπάρχει και είναι καλοσχηματισμένο', () => {
    expect(() => contract.loadDeclarations(REPO_ROOT)).not.toThrow();
  });
});

// =============================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ σε ΠΡΑΓΜΑΤΙΚΟ ιστορικό κώδικα
// =============================================================================

describe('Π — βαθμονόμηση', () => {
  it('Π1: στην ΚΑΤΑΣΤΑΣΗ ΠΡΙΝ τη διόρθωση η πύλη είναι ΚΟΚΚΙΝΗ και ονομάζει jest/jsdom', () => {
    const result = sweep(miniRepo({}, PRE_FIX_COMMIT));
    expect(counts(result, 'names')[S.REDECLARED]).toBeGreaterThanOrEqual(20);
    expect(idsOf(result, S.VERSION_SPLIT)).toEqual(
      expect.arrayContaining(['jest', 'jsdom', '@types/jest', 'lucide-react', 'pixelmatch']),
    );
  });

  it('Π2: Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — με το ΣΗΜΕΡΙΝΟ manifest οι ίδιοι κάδοι μηδενίζουν', () => {
    const result = sweep(miniRepo());
    expect(counts(result, 'names')[S.REDECLARED]).toBe(0);
    expect(counts(result, 'declarations')[S.OVERRIDDEN_DECLARATION]).toBe(0);
    expect(counts(result, 'catalog')[S.UNREFERENCED_CATALOG]).toBe(0);
  });

  it('Π3: το subapp κρατά ΜΟΝΟ ό,τι κατέχει — η ρίζα δεν τα έχει, και μηδέν scripts', () => {
    const sub = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src/subapps/dxf-viewer/package.json'), 'utf8'));
    const root = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    const rootAll = { ...root.dependencies, ...root.devDependencies };
    for (const name of Object.keys(workspace.declaredDependencies(sub))) {
      expect({ name, inRoot: name in rootAll }).toEqual({ name, inRoot: false });
    }
    expect(sub.scripts).toBeUndefined();
  });
});

// =============================================================================
// Μ1-Μ9 — ΜΕΤΑΛΛΑΞΕΙΣ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, μία ανά μπλοκάρουσα κατάσταση
// =============================================================================

describe('Μ — μεταλλάξεις στις εισόδους', () => {
  /**
   * 🔑 Η ΑΠΟΔΕΙΞΗ ΟΤΙ ΤΟ Κ1 ΔΕΝ ΕΙΝΑΙ ΠΕΡΙΤΤΟ ΔΙΠΛΑ ΣΤΟ Κ2.
   * Το subapp ξαναδηλώνει `jest` **με την ΙΔΙΑ έκδοση με τη ρίζα** ⇒ καμία
   * διχασμένη επίλυση, άρα το Κ2 (lockfile) είναι **πράσινο** — και όμως το
   * δεύτερο manifest έχει ξαναγεννηθεί, εγγυημένα αποκλίνον στην πρώτη
   * αναβάθμιση της ρίζας. Ένας κανόνας με «ή» θα το άφηνε να περάσει.
   */
  it('Μ1: το subapp ξαναδηλώνει `jest` με ΙΔΙΑ έκδοση ⇒ redeclared χωρίς version-split', () => {
    const root = miniRepo({
      'src/subapps/dxf-viewer/package.json': (s) =>
        replaceOnce(s, '"fast-check"', '"jest": "^30.2.0",\n    "fast-check"'),
      'pnpm-lock.yaml': addSubappLockEntry('jest', '^30.2.0', '30.2.0'),
    });
    const result = sweep(root);
    expect(idsOf(result, S.REDECLARED)).toContain('jest');
    expect(idsOf(result, S.VERSION_SPLIT)).not.toContain('jest');
  });

  it('Μ2: δύο εγκατεστημένες εκδόσεις ⇒ version-split', () => {
    const root = miniRepo({
      'packages/core/package.json': (s) =>
        replaceOnce(s, '"@types/geojson"', '"polygon-clipping": "0.15.7",\n    "@types/geojson"'),
      'pnpm-lock.yaml': (s) =>
        replaceOnce(
          s,
          /( {2}packages\/core:\n {4}devDependencies:\n)/,
          '$1      polygon-clipping:\n        specifier: 0.15.7\n        version: 0.15.3\n',
        ),
    });
    expect(idsOf(sweep(root), S.VERSION_SPLIT)).toContain('polygon-clipping');
  });

  it('Μ3: το manifest λέει άλλο εύρος από το lockfile ⇒ overridden-declaration', () => {
    const root = miniRepo({
      'src/subapps/dxf-viewer/package.json': (s) =>
        replaceOnce(s, '"polygon-clipping": "0.15.7"', '"polygon-clipping": "^0.15.0"'),
    });
    expect(idsOf(sweep(root), S.OVERRIDDEN_DECLARATION)).toContain('src/subapps/dxf-viewer -> polygon-clipping');
  });

  it('Μ4: εξάρτηση σβήστηκε από το manifest χωρίς install ⇒ lockfile-desync', () => {
    const root = miniRepo({
      'src/subapps/dxf-viewer/package.json': (s) =>
        replaceOnce(s, /\n\s*"@formulajs\/formulajs": "4\.6\.1",/, ''),
    });
    expect(idsOf(sweep(root), S.LOCKFILE_DESYNC)).toContain('src/subapps/dxf-viewer');
  });

  it('Μ5: νέο package.json μέσα στα globs, εκτός lockfile ⇒ unlisted-manifest', () => {
    const root = miniRepo({
      'src/subapps/newcomer/package.json': '{ "name": "newcomer", "private": true }\n',
    });
    expect(idsOf(sweep(root), S.UNLISTED_MANIFEST)).toContain('src/subapps/newcomer');
  });

  it('Μ6: importer του lockfile χωρίς φάκελο ⇒ orphan-importer', () => {
    const root = miniRepo({
      'pnpm-lock.yaml': (s) => replaceOnce(s, 'importers:\n', 'importers:\n\n  packages/ghost: {}\n'),
    });
    expect(idsOf(sweep(root), S.ORPHAN_IMPORTER)).toContain('packages/ghost');
  });

  it('Μ7: εγγραφή καταλόγου που δεν τη ζητά κανείς ⇒ unreferenced-catalog-entry', () => {
    const root = miniRepo({
      'pnpm-workspace.yaml': (s) => `${s}\ncatalog:\n  zod: "3.25.76"\n`,
    });
    expect(idsOf(sweep(root), S.UNREFERENCED_CATALOG)).toContain('zod');
  });

  it('Μ8: δήλωση εξαίρεσης που δεν εξαιρεί τίποτα ⇒ orphan-declaration', () => {
    const root = miniRepo({
      '.one-version.json': JSON.stringify({ sharedDependencies: { zod: { reason: LONG_REASON } } }, null, 2),
    });
    expect(idsOf(sweep(root), S.ORPHAN_DECLARATION)).toContain('zod');
  });

  it('Μ9: δήλωση χωρίς ουσιαστικό λόγο ⇒ reasonless-declaration', () => {
    const root = miniRepo({
      '.one-version.json': JSON.stringify({ sharedDependencies: { zod: { reason: 'γιατί ναι' } } }, null, 2),
    });
    expect(idsOf(sweep(root), S.REASONLESS_DECLARATION)).toContain('zod');
  });
});

// =============================================================================
// Κ — ΤΟ ΚΡΙΤΗΡΙΟ ΚΑΙ ΤΑ ΟΡΙΑ ΤΟΥ
// =============================================================================

describe('Κ — κριτήριο', () => {
  it('Κ1: το «διανεμητέο» ΠΑΡΑΓΕΤΑΙ και δίνει σωστή απάντηση στα τρία πραγματικά manifests', () => {
    const read = (rel) => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
    expect(contract.isDistributable(read('package.json'))).toBe(false);
    expect(contract.isDistributable(read('src/subapps/dxf-viewer/package.json'))).toBe(false);
    expect(contract.isDistributable(read('packages/core/package.json'))).toBe(true);
  });

  it('Κ2: `private: true` ΜΟΝΟ ΤΟΥ δεν αρκεί — σημείο εισόδου ⇒ διανεμητέο', () => {
    expect(contract.isDistributable({ private: true, main: 'dist/index.js' })).toBe(true);
    expect(contract.isDistributable({ private: true })).toBe(false);
  });

  it('Κ3: το peer-επίθεμα ΔΕΝ είναι έκδοση — αλλιώς ΨΕΥΔΗΣ διχασμός', () => {
    expect(lockfile.bareVersion('0.542.0(react@19.2.1)')).toBe('0.542.0');
    const root = miniRepo({
      'pnpm-lock.yaml': (s) =>
        replaceOnce(s, /(polygon-clipping:\n {8}specifier: 0\.15\.7\n {8}version: 0\.15\.7)/, '$1(react@19.2.1)'),
    });
    expect(idsOf(sweep(root), S.VERSION_SPLIT)).not.toContain('polygon-clipping');
  });

  it('Κ4: FAIL-CLOSED — μη αναγνωρίσιμη γραμμή importers ⇒ σφάλμα με το περιεχόμενο', () => {
    const root = miniRepo({
      'pnpm-lock.yaml': (s) => replaceOnce(s, 'importers:\n', 'importers:\n    ??? bogus\n'),
    });
    expect(() => sweep(root)).toThrow(/μη αναγνωρίσιμη γραμμή importers/);
  });

  it('Κ5: FAIL-CLOSED — μη υποστηριζόμενο glob ⇒ σφάλμα ΜΕ ΤΟ pattern μέσα', () => {
    const root = miniRepo({
      'pnpm-workspace.yaml': (s) => replaceOnce(s, "  - 'packages/*'", "  - 'pack{a,b}ges/*'"),
    });
    expect(() => sweep(root)).toThrow(/pack\{a,b\}ges/);
  });

  it('Κ6: FAIL-CLOSED — απόν `.one-version.json` ⇒ σφάλμα, ΠΟΤΕ σιωπηλό {}', () => {
    const root = miniRepo();
    fs.unlinkSync(path.join(root, '.one-version.json'));
    expect(() => sweep(root)).toThrow(/one-version\.json/);
  });

  it('Κ7: FAIL-CLOSED — κακοσχηματισμένο κλειστό σύνολο ⇒ σφάλμα', () => {
    const root = miniRepo({ '.one-version.json': '{"somethingElse": 1}' });
    expect(() => sweep(root)).toThrow(/sharedDependencies/);
  });

  it('Κ8: η δήλωση εξαίρεσης ΚΑΤΑΝΑΛΩΝΕΤΑΙ — redeclared γίνεται declared-shared', () => {
    const edits = {
      'src/subapps/dxf-viewer/package.json': (s) =>
        replaceOnce(s, '"fast-check"', '"zod": "3.25.76",\n    "fast-check"'),
      'pnpm-lock.yaml': addSubappLockEntry('zod', '3.25.76', '3.25.76'),
    };
    expect(idsOf(sweep(miniRepo(edits)), S.REDECLARED)).toContain('zod');

    const declared = sweep(miniRepo({
      ...edits,
      '.one-version.json': JSON.stringify({ sharedDependencies: { zod: { reason: LONG_REASON } } }, null, 2),
    }));
    expect(idsOf(declared, S.REDECLARED)).not.toContain('zod');
    expect(idsOf(declared, S.DECLARED_SHARED)).toContain('zod');
    expect(counts(declared, 'exceptions')[S.ORPHAN_DECLARATION]).toBe(0);
  });

  it('Κ9: το ΔΙΑΝΕΜΗΤΕΟ μέλος εξαιρείται από το Κ1 αλλά ΟΧΙ από το Κ2', () => {
    const result = sweep(miniRepo());
    expect(idsOf(result, S.DISTRIBUTABLE_OWNED)).toContain('@types/geojson');
    expect(idsOf(result, S.REDECLARED)).not.toContain('@types/geojson');

    const split = sweep(miniRepo({
      'pnpm-lock.yaml': (s) =>
        replaceOnce(
          s,
          /( {2}packages\/core:\n {4}devDependencies:\n {6}'@types\/geojson':\n {8}specifier: [^\n]+\n {8}version: )[^\n]+/,
          '$17946.0.99',
        ),
    }));
    expect(idsOf(split, S.VERSION_SPLIT)).toContain('@types/geojson');
  });

  it('Κ10: κάθε ⛔ κατάσταση ανήκει σε κατάστιχο', () => {
    const all = new Set(Object.values(LEDGER_STATES).flat());
    for (const state of BLOCKING) expect({ state, known: all.has(state) }).toEqual({ state, known: true });
  });

  it('Κ11: Ο ΚΩΔΙΚΑΣ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΠΥΛΗΣ ΕΙΝΑΙ ΣΚΑΝΔΑΛΗ', () => {
    expect(cli.affects('scripts/check-one-version.js')).toBe(true);
    expect(cli.affects(path.join('scripts', 'lib', 'one-version', 'gate.js'))).toBe(true);
    expect(cli.affects('pnpm-lock.yaml')).toBe(true);
    expect(cli.affects('pnpm-workspace.yaml')).toBe(true);
    expect(cli.affects('.one-version.json')).toBe(true);
    expect(cli.affects(path.join('src', 'subapps', 'dxf-viewer', 'package.json'))).toBe(true);
    expect(cli.affects(path.join('src', 'app', 'page.tsx'))).toBe(false);
  });

  it('Κ12: άγνωστη κατάσταση σε κατάστιχο ⇒ throw ΜΕ ΟΝΟΜΑ', () => {
    // Η λογιστική δεν επιτρέπεται να χαθεί ΣΙΩΠΗΛΑ: το `pushTo` ρίχνει όταν μια
    // κατάσταση δεν ανήκει στο κατάστιχο που τη δέχεται (πρότυπο CHECK 3.39 `Κ15β`).
    const source = fs.readFileSync(path.join(REPO_ROOT, 'scripts/lib/one-version/gate.js'), 'utf8');
    expect(source).toMatch(/throw new Error\(`ΑΓΝΩΣΤΗ κατάσταση/);
    expect(LEDGER_STATES.catalog).not.toContain(S.VERSION_SPLIT);
  });
});

// =============================================================================
// ΣΤ — ΕΡΓΑΛΕΙΑ CI: μία έκδοση και για ό,τι ΔΕΝ ζει στο lockfile (ADR-875 §12)
// =============================================================================

describe('ΣΤ — εργαλεία CI', () => {
  const PRE_FIX = '2aa205ef'; // οι 5 ροές ΠΡΙΝ από το composite action
  const FLOWS = ['firestore-rules', 'storage-rules', 'functions-integration', 'service-integration', 'i18n-ssr-oracle'];

  /** Ρίζα με αυθεντία + ιδιοκτήτη από το τρέχον δέντρο, και ό,τι άλλο δοθεί. */
  function ciRepo(files = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'citools-'));
    const all = {
      [CI_OWNER]: fs.readFileSync(path.join(REPO_ROOT, CI_OWNER), 'utf8'),
      [CI_AUTHORITY]: fs.readFileSync(path.join(REPO_ROOT, CI_AUTHORITY), 'utf8'),
      ...files,
    };
    for (const [rel, text] of Object.entries(all)) {
      if (text === null) continue;
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
  }
  const judgeCi = (root, tools) => {
    const rows = [];
    ciTools.judgeCiTools(root, (state, id, detail) => rows.push({ state, id, detail }), tools);
    return rows;
  };
  const statesOf = (rows) => rows.map((r) => r.state);
  const S = contract.GATE_STATES;
  const wf = (body) => `jobs:\n  t:\n    steps:\n${body}\n`;

  it('ΣΤ1: το ΠΡΑΓΜΑΤΙΚΟ δέντρο — ένας ιδιοκτήτης, οι 5 ροές τον ζητούν, μηδέν παραβάσεις', () => {
    const tally = sweep(REPO_ROOT).ledgers.ciTools.tally;
    expect(tally[S.CI_TOOL_OWNER]).toBe(1);
    expect(tally[S.CI_TOOL_VIA_OWNER]).toBeGreaterThanOrEqual(FLOWS.length);
    expect(tally[S.CI_TOOL_BYPASS] + tally[S.CI_TOOL_VERSION_LITERAL] + tally[S.CI_TOOL_OWNER_BROKEN]).toBe(0);
  });

  it('ΣΤ2: 🔴 ΒΑΘΜΟΝΟΜΗΣΗ — οι ροές όπως ήταν ΠΡΙΝ κοκκινίζουν: 5 παρακάμψεις + 1 γραμμένη έκδοση', () => {
    const files = Object.fromEntries(
      FLOWS.map((f) => [`.github/workflows/${f}.yml`, gitShow(PRE_FIX, `.github/workflows/${f}.yml`)]),
    );
    const rows = judgeCi(ciRepo(files));
    expect(statesOf(rows).filter((s) => s === S.CI_TOOL_BYPASS)).toHaveLength(5);
    expect(rows.filter((r) => r.state === S.CI_TOOL_VERSION_LITERAL).map((r) => r.id)).toEqual([
      expect.stringMatching(/^\.github\/workflows\/i18n-ssr-oracle\.yml:\d+$/),
    ]);
  });

  it('ΣΤ3: `npx firebase-tools` σε workflow ΠΙΑΝΕΤΑΙ — όχι μόνο το `npm i -g`', () => {
    const rows = judgeCi(ciRepo({ '.github/workflows/x.yml': wf('      - run: npx --yes firebase-tools deploy') }));
    expect(statesOf(rows)).toContain(S.CI_TOOL_BYPASS);
  });

  it('ΣΤ4: ο ΠΑΡΟΝΟΜΑΣΤΗΣ — σχόλιο που περιγράφει την εγκατάσταση ΔΕΝ είναι εντολή', () => {
    const rows = judgeCi(ciRepo({ '.github/workflows/x.yml': wf('      # npm install -g firebase-tools@1.2.3\n      - run: echo ok') }));
    expect(statesOf(rows)).toEqual([S.CI_TOOL_OWNER]);
  });

  it('ΣΤ5: γραμμένη έκδοση ΜΕΣΑ στον ιδιοκτήτη ⇒ ⛔ (δεύτερη αλήθεια, όποιος κι αν τη γράφει)', () => {
    const owner = fs.readFileSync(path.join(REPO_ROOT, CI_OWNER), 'utf8').replace(
      /"firebase-tools@\$\{\{ steps\.version\.outputs\.version \}\}"/,
      'firebase-tools@15.13.0',
    );
    expect(owner).toContain('firebase-tools@15.13.0'); // η μετάλλαξη ΕΓΙΝΕ
    expect(statesOf(judgeCi(ciRepo({ [CI_OWNER]: owner })))).toContain(S.CI_TOOL_VERSION_LITERAL);
  });

  it('ΣΤ6: ιδιοκτήτης που ΔΕΝ διαβάζει την αυθεντία ⇒ ⛔ owner-broken', () => {
    const owner = fs.readFileSync(path.join(REPO_ROOT, CI_OWNER), 'utf8').split(CI_AUTHORITY).join('elsewhere.js');
    expect(statesOf(judgeCi(ciRepo({ [CI_OWNER]: owner })))).toContain(S.CI_TOOL_OWNER_BROKEN);
  });

  it('ΣΤ7: αυθεντία που δίνει ΔΥΟ εκδόσεις ή καμία ακριβή ⇒ ⛔ owner-broken (ποτέ σιωπηλό)', () => {
    const real = fs.readFileSync(path.join(REPO_ROOT, CI_AUTHORITY), 'utf8');
    const twice = `${real}\nconst FIREBASE_TOOLS_VERSION = '1.0.0';\n`;
    const range = real.replace(/const FIREBASE_TOOLS_VERSION = '[^']+';/, "const FIREBASE_TOOLS_VERSION = '^15';");
    expect(range).not.toBe(real);
    for (const text of [twice, range, null]) {
      expect(statesOf(judgeCi(ciRepo({ [CI_AUTHORITY]: text })))).toContain(S.CI_TOOL_OWNER_BROKEN);
    }
  });

  it('ΣΤ8: δήλωση εργαλείου ΧΩΡΙΣ λόγο ⇒ ⛔ owner-broken', () => {
    const tools = { 'firebase-tools': { ...ciTools.CI_TOOLS['firebase-tools'], reason: 'ok' } };
    expect(statesOf(judgeCi(ciRepo(), tools))).toEqual([S.CI_TOOL_OWNER_BROKEN]);
  });

  it('ΣΤ9: η αυθεντία που διαβάζει η πύλη ΕΙΝΑΙ η έκδοση του deployer', () => {
    const model = require('../lib/firestore-deploy/model.js');
    expect(ciTools.readAuthorityVersion(REPO_ROOT, ciTools.CI_TOOLS['firebase-tools'])).toBe(
      model.FIREBASE_TOOLS_VERSION,
    );
  });

  it('ΣΤ10: η σκανδάλη — αλλαγή σε workflow/action/αυθεντία ΞΥΠΝΑ την πύλη', () => {
    for (const f of ['.github/workflows/x.yml', `${CI_OWNER}`, CI_AUTHORITY]) expect(cli.affects(f)).toBe(true);
  });
});
