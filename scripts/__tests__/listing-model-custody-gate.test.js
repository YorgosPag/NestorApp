/**
 * ΑΓΚΥΡΕΣ ΤΗΣ CHECK 3.76 — Η ΠΥΛΗ ΤΗΣ ΕΠΙΜΕΛΕΙΑΣ ΤΟΥ ΜΟΝΤΕΛΟΥ (ADR-845 §8)
 *
 * ⛔ **ΚΑΘΕ ΚΡΙΤΗΡΙΟ ΑΣΚΕΙΤΑΙ ΜΕ ΜΕΤΑΛΛΑΞΗ ΣΤΗΝ ΕΙΣΟΔΟ, ΠΟΤΕ ΜΕ «ΕΙΝΑΙ ΠΡΑΣΙΝΟ ΣΗΜΕΡΑ».**
 * Μια σουίτα που επιβεβαιώνει μόνο το σημερινό δέντρο αποδεικνύει ότι *σήμερα δεν
 * υπάρχει παραβάτης* — **όχι** ότι η πύλη θα τον έβλεπε. Είναι ακριβώς το σχήμα
 * *«0 = κανείς δεν κοίταξε»* που αυτό το repo έχει μετρήσει σε N.11 · N.12 · N.18 ·
 * CHECK 3.18 · 3.74, και που το ίδιο το ADR-845 πλήρωσε δύο φορές (§7.4 · §7.5).
 *
 * Μ0  — βαθμονόμηση: το ΠΡΑΓΜΑΤΙΚΟ δέντρο είναι πράσινο (ο παρονομαστής)
 * Κ1  — δεύτερος γραφέας ⇒ ΚΟΚΚΙΝΟ · δηλωμένος ιδιοκτήτης ⇒ πράσινο
 * Κ1′ — δήλωση που σάπισε / χωρίς λόγο ⇒ ΚΟΚΚΙΝΟ
 * Κ2  — άδειασμα ραφιού με το χέρι ⇒ ΚΟΚΚΙΝΟ
 * Κ3  — σύμβολο χωρίς καλούντα ⇒ ΚΟΚΚΙΝΟ (το περιστατικό `encodeModelDeclaration`)
 * Κ4  — άγκυρα που λείπει ή έχασε την ερώτησή της ⇒ ΚΟΚΚΙΝΟ
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  CALL_OWNERS,
  GATE_STATES,
  GUARD_STATES,
  REQUIRED_ANCHORS,
} = require('../lib/listing-model-custody/contract.js');
const {
  auditAnchors,
  auditOwners,
  auditSymbolReach,
  classifyFile,
  executableLines,
  sweep,
} = require('../lib/listing-model-custody/gate.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OWNER_REL = 'src/services/listings/publish-public-listing-shelf.ts';
const STRANGER_REL = 'src/services/listings/some-new-writer.ts';

describe('Μ0 — ΒΑΘΜΟΝΟΜΗΣΗ: ο παρονομαστής υπάρχει και είναι πράσινος', () => {
  const result = sweep(REPO_ROOT);

  it('το πραγματικό δέντρο δεν έχει κανένα εύρημα', () => {
    expect(result.violations).toEqual([]);
  });

  // 🔴 Χωρίς αυτό, μια πύλη που σαρώνει **μηδέν αρχεία** θα ήταν επίσης «πράσινη».
  it('🔴 και ΣΑΡΩΣΕ ΠΡΑΓΜΑΤΙΚΑ ΑΡΧΕΙΑ — το «0 ευρήματα» δεν σημαίνει «0 κοιτάγματα»', () => {
    expect(result.scanned).toBeGreaterThan(1000);
    expect(result.tally[GATE_STATES.OWNER]).toBeGreaterThan(0);
    expect(result.tally[GATE_STATES.DEFINER]).toBeGreaterThan(0);
  });
});

describe('Κ1 — Ο ΔΕΥΤΕΡΟΣ ΓΡΑΦΕΑΣ', () => {
  const secondWriter = [
    "import { withPublishedModels } from './public-listing-model-projection';",
    'export function publishSomehow(listing, models) {',
    '  return withPublishedModels(listing, models);',
    '}',
  ].join('\n');

  it('🔴 άγνωστο αρχείο που καλεί τον γραφέα ⇒ custody-bypass', () => {
    expect(classifyFile(STRANGER_REL, secondWriter).state).toBe(GATE_STATES.CUSTODY_BYPASS);
  });

  it('το ΙΔΙΟ κείμενο σε δηλωμένο ιδιοκτήτη ⇒ owner, όχι εύρημα', () => {
    expect(classifyFile(OWNER_REL, secondWriter).state).toBe(GATE_STATES.OWNER);
  });

  it('η αιτία ονομάζεται — το εύρημα κουβαλά ΤΟ ΓΙΑΤΙ, όχι μόνο το ΤΙ', () => {
    expect(classifyFile(STRANGER_REL, secondWriter).detail).toMatch(/ψήστη/);
  });
});

describe('Κ1 — Η ΤΕΚΜΗΡΙΩΣΗ ΔΕΝ ΕΙΝΑΙ ΚΛΗΣΗ', () => {
  // ⚠️ Αν αυτό σπάσει, η πύλη κοκκινίζει πάνω σε **σχόλια** — ο σιγουρότερος δρόμος
  //    προς το `SKIP_`. Ο ίδιος ο κώδικας του έργου γράφει `{@link withPublishedModels}`.
  it('🔴 αναφορά μέσα σε JSDoc ⇒ mention-only, ΠΟΤΕ custody-bypass', () => {
    const doc = [
      '/**',
      ' * Δες {@link withPublishedModels} — καλείται withPublishedModels(a, b) αλλού.',
      ' */',
      'export const nothing = 1;',
    ].join('\n');
    expect(classifyFile(STRANGER_REL, doc).state).toBe(GATE_STATES.MENTION_ONLY);
  });

  it('το `executableLines` πετά σχόλια και κρατά κώδικα', () => {
    const lines = executableLines(['// α', ' * β', '/* γ */', 'const δ = 1;', ''].join('\n'));
    expect(lines).toEqual(['const δ = 1;']);
  });
});

describe('Κ2 — ΤΟ ΑΔΕΙΑΣΜΑ ΜΕ ΤΟ ΧΕΡΙ (το μετρημένο περιστατικό του §7.4)', () => {
  const manual = 'await reconcileShelfSafely(listingId, []);';

  it('🔴 κενή λίστα εκτός SSoT ⇒ manual-emptying', () => {
    expect(classifyFile(STRANGER_REL, manual).state).toBe(GATE_STATES.MANUAL_EMPTYING);
  });

  it('ο δηλωμένος ιδιοκτήτης της απόσυρσης επιτρέπεται — αλλιώς η πύλη χτυπά τη ΘΕΡΑΠΕΙΑ', () => {
    expect(classifyFile(OWNER_REL, manual).state).not.toBe(GATE_STATES.MANUAL_EMPTYING);
  });

  it('κλήση ΜΕ πηγές δεν είναι άδειασμα — η πύλη ρωτά για το `[]`, όχι για τη συνάρτηση', () => {
    const real = 'await reconcileShelfSafely(listingId, sources);';
    expect(classifyFile(STRANGER_REL, real).state).toBe(GATE_STATES.NOT_A_CUSTODY_FILE);
  });
});

describe('Κ1′ — ΟΙ ΔΗΛΩΣΕΙΣ ΣΑΠΙΖΟΥΝ', () => {
  it('🔴 δηλωμένος ιδιοκτήτης που δεν καλεί πια ⇒ orphan-owner', () => {
    const findings = auditOwners(new Map());
    expect(findings.map((f) => f.state)).toContain(GUARD_STATES.ORPHAN_OWNER);
    expect(findings.filter((f) => f.state === GUARD_STATES.ORPHAN_OWNER)).toHaveLength(
      Object.keys(CALL_OWNERS).length,
    );
  });

  it('🔴 δήλωση με λόγο-βιτρίνα ⇒ reasonless-owner', () => {
    const findings = auditOwners(new Map([['x/y.ts', []]]), { 'x/y.ts': 'γιατί ναι' });
    expect(findings.map((f) => f.state)).toContain(GUARD_STATES.REASONLESS_OWNER);
  });

  it('ιδιοκτήτης που καλεί ΚΑΙ έχει λόγο ⇒ κανένα εύρημα', () => {
    const callers = new Map(Object.keys(CALL_OWNERS).map((rel) => [rel, ['withPublishedModels']]));
    expect(auditOwners(callers)).toEqual([]);
  });
});

describe('Κ3 — ΤΟ ΣΥΜΒΟΛΟ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΚΑΛΕΙ (το περιστατικό `encodeModelDeclaration`)', () => {
  it('🔴 μηδέν καλούντες ⇒ orphan-symbol, ακόμη κι όταν όλα τα άλλα είναι πράσινα', () => {
    const findings = auditSymbolReach(new Map());
    expect(findings).not.toHaveLength(0);
    expect(findings.every((f) => f.state === GUARD_STATES.ORPHAN_SYMBOL)).toBe(true);
  });

  it('το εύρημα εξηγεί ΓΙΑΤΙ ένα νεκρό σύμβολο είναι χειρότερο από παράβαση', () => {
    expect(auditSymbolReach(new Map())[0].detail).toMatch(/ΝΕΚΡΟΣ/);
  });

  it('ένας καλών αρκεί για να σιωπήσει', () => {
    const full = new Map([
      ['withPublishedModels', 1],
      ['withdrawListingShelves', 1],
    ]);
    expect(auditSymbolReach(full)).toEqual([]);
  });
});

describe('Κ4 — Ο ΦΡΟΥΡΟΣ ΠΟΥ ΣΒΗΣΤΗΚΕ', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'custody-anchor-'));
  });
  afterEach(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
  });

  it('🔴 αρχείο άγκυρας που λείπει ⇒ anchor-absent', () => {
    const findings = auditAnchors(sandbox, { 'a/b.test.ts': ['Α-7'] });
    expect(findings.map((f) => f.state)).toEqual([GUARD_STATES.ANCHOR_ABSENT]);
  });

  it('🔴 άγκυρα που έχασε την ερώτησή της ⇒ anchor-question-lost', () => {
    fs.mkdirSync(path.join(sandbox, 'a'), { recursive: true });
    fs.writeFileSync(path.join(sandbox, 'a', 'b.test.ts'), "describe('κάτι άλλο', () => {});");
    const findings = auditAnchors(sandbox, { 'a/b.test.ts': ['Α-8 — Η ΑΠΟΣΥΡΣΗ'] });
    expect(findings.map((f) => f.state)).toEqual([GUARD_STATES.ANCHOR_QUESTION_LOST]);
  });

  it('οι ΠΡΑΓΜΑΤΙΚΕΣ άγκυρες του ADR-845 υπάρχουν και ρωτούν ακόμη', () => {
    expect(auditAnchors(REPO_ROOT)).toEqual([]);
    expect(Object.keys(REQUIRED_ANCHORS)).toHaveLength(2);
  });
});
