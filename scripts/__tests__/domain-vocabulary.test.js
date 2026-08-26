/**
 * ΑΓΚΥΡΕΣ — CHECK 3.73 / ADR-812: πύλη λεξιλογίου τομέα.
 *
 * ⚠️ ΟΙ ΜΕΤΑΛΛΑΞΕΙΣ ΕΙΝΑΙ ΣΤΙΣ ΕΙΣΟΔΟΥΣ, όχι στην πύλη: μίνι-repo χτισμένο από
 * τα ΠΡΑΓΜΑΤΙΚΑ αρχεία του δέντρου, μία γραμμή αλλαγή τη φορά. Ένα fixture
 * γραμμένο στο χέρι θα αποδείκνυε ότι η πύλη διαβάζει σωστά ό,τι της έγραψα —
 * όχι ότι διαβάζει σωστά τον κώδικα που τρέχει.
 *
 * ⚠️ Ο μεταλλάκτης ΟΥΡΛΙΑΖΕΙ αν η μετάλλαξη δεν άλλαξε τίποτα (μάθημα CHECK
 * 3.44 Μ11): «RED» πάνω σε μετάλλαξη που δεν εφαρμόστηκε αποδεικνύει τίποτα.
 *
 * @jest-environment node
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const gate = require('../check-domain-vocabulary');
const { STATES } = require('../lib/domain-vocabulary/scan');

const REPO = path.resolve(__dirname, '..', '..');
const CONFIG = path.join(REPO, '.domain-vocabulary.json');

/** Τα αρχεία που συμμετέχουν, με τις ΠΡΑΓΜΑΤΙΚΕΣ διαδρομές τους. */
const REAL_FILES = [
  'src/constants/project-statuses.ts',
  'src/domain/cards/project/useProjectCardModel.ts',
  'src/config/project-mutation-impact.ts',
  'src/services/ai-pipeline/modules/uc-011-admin-project-status/project-status-formatter.ts',
];

let tmpRoot;

/** Μίνι-repo από τα πραγματικά αρχεία. Επιστρέφει τη ρίζα του. */
function miniRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'domvocab-'));
  for (const rel of REAL_FILES) {
    const src = path.join(REPO, rel);
    if (!fs.existsSync(src)) throw new Error(`ΦΡΟΥΡΟΣ: λείπει το πραγματικό αρχείο ${rel}`);
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  fs.copyFileSync(CONFIG, path.join(root, '.domain-vocabulary.json'));
  return root;
}

const filesOf = root => REAL_FILES.map(r => path.join(root, r));

function run(root, extra = {}) {
  return gate.measure({
    root,
    files: filesOf(root),
    configPath: path.join(root, '.domain-vocabulary.json'),
    ...extra,
  });
}

/** Μεταλλάσσει ΜΙΑ φορά και ΟΥΡΛΙΑΖΕΙ αν δεν άλλαξε τίποτα. */
function mutate(root, rel, from, to) {
  const p = path.join(root, rel);
  const before = fs.readFileSync(p, 'utf8');
  if (!before.includes(from)) throw new Error(`ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ: το pattern δεν βρέθηκε στο ${rel}`);
  const after = before.replace(from, to);
  if (after === before) throw new Error(`ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ: δεν άλλαξε τίποτα στο ${rel}`);
  fs.writeFileSync(p, after);
}

function mutateConfig(root, fn) {
  const p = path.join(root, '.domain-vocabulary.json');
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const before = JSON.stringify(cfg);
  fn(cfg);
  if (JSON.stringify(cfg) === before) throw new Error('ΑΚΥΡΗ ΜΕΤΑΛΛΑΞΗ: το μητρώο δεν άλλαξε');
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
}

const blocking = result => result.findings.filter(f => gate.BLOCKING.includes(f.state));

beforeEach(() => { tmpRoot = miniRepo(); });
afterEach(() => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

describe('CHECK 3.73 — Μ0: το καθαρό δέντρο', () => {
  it('Μ0α ΠΑΡΟΝΟΜΑΣΤΗΣ — η πύλη ΚΟΙΤΑΖΕΙ: βρίσκει ρίζα και δεμένα σώματα', () => {
    const r = run(tmpRoot);
    expect(r.tally[STATES.ROOT]).toBe(1);
    expect(r.tally[STATES.BOUND]).toBeGreaterThanOrEqual(3);
  });

  it('Μ0β — καμία μπλοκάρουσα παραβίαση σε καθαρό δέντρο', () => {
    expect(blocking(run(tmpRoot))).toEqual([]);
  });

  it('Μ0γ — το ΠΡΑΓΜΑΤΙΚΟ δέντρο είναι πράσινο (όχι μόνο το μίνι-repo)', () => {
    expect(blocking(gate.measure())).toEqual([]);
  });
});

describe('CHECK 3.73 — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ', () => {
  it('Μ1 — χαλαρός τύπος σε σώμα του λεξιλογίου ⇒ untyped-vocabulary', () => {
    mutate(tmpRoot, 'src/domain/cards/project/useProjectCardModel.ts',
      'Record<ProjectStatus, GridCardBadgeVariant>', 'Record<string, GridCardBadgeVariant>');
    const found = blocking(run(tmpRoot));
    expect(found.map(f => f.state)).toContain(STATES.UNTYPED_VOCABULARY);
    expect(found[0].file).toContain('useProjectCardModel');
  });

  it('Μ2 — χειρόγραφο literal union ⇒ untyped-vocabulary', () => {
    // ⚠️ Το pattern ΔΕΝ πιάνει νέα γραμμή: τα αρχεία είναι CRLF σε Windows
    // (core.autocrlf=true) και ένα «\n» δεν θα ταίριαζε ΠΟΤΕ. Ο φρουρός «ΑΚΥΡΗ
    // ΜΕΤΑΛΛΑΞΗ» το έπιασε — χωρίς αυτόν, μια μετάλλαξη που δεν εφαρμόστηκε θα
    // «αποδείκνυε» φρουρό που στην πραγματικότητα δεν δοκιμάστηκε ποτέ.
    // ⚠️ ΚΑΙ Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΤΗΣ ΜΕΤΑΛΛΑΞΗΣ ΗΤΑΝ ΛΑΘΟΣ ΣΤΟΧΟΣ: άλλαζε το
    // `Extract<` σε `Exclude<`, που εξακολουθεί να αναφέρει τη ρίζα — άρα η
    // δήλωση παρέμενε ΣΩΣΤΑ δεμένη και η άγκυρα κοκκίνιζε χωρίς λόγο. Ο δεσμός
    // είναι το ΟΝΟΜΑ ΤΗΣ ΡΙΖΑΣ μέσα στον τύπο, όχι ο τελεστής γύρω του.
    mutate(tmpRoot, 'src/config/project-mutation-impact.ts', '  ProjectStatus,', '  string,');
    expect(blocking(run(tmpRoot)).map(f => f.state)).toContain(STATES.UNTYPED_VOCABULARY);
  });

  it('Μ3 — Partial<Record<…>> που χάνει τη ρίζα ⇒ untyped-vocabulary', () => {
    mutate(tmpRoot, 'src/services/ai-pipeline/modules/uc-011-admin-project-status/project-status-formatter.ts',
      'Partial<Record<ProjectStatus, string[]>>', 'Record<string, string[]>');
    expect(blocking(run(tmpRoot)).map(f => f.state)).toContain(STATES.UNTYPED_VOCABULARY);
  });

  it('Μ4 — η ρίζα χάνει τιμή ⇒ root-drift (ΟΧΙ σιωπηλά «καθαρό»)', () => {
    mutate(tmpRoot, 'src/constants/project-statuses.ts', "  'deleted',\n]", ']');
    const found = blocking(run(tmpRoot));
    expect(found.map(f => f.state)).toContain(STATES.ROOT_DRIFT);
  });

  it('Μ5 — η ρίζα αποκτά τιμή που το μητρώο δεν ξέρει ⇒ root-drift', () => {
    mutate(tmpRoot, 'src/constants/project-statuses.ts', "  'deleted',\n]", "  'deleted',\n  'review',\n]");
    expect(blocking(run(tmpRoot)).map(f => f.state)).toContain(STATES.ROOT_DRIFT);
  });

  it('Μ6 — η ρίζα λείπει τελείως ⇒ root-drift, ποτέ σιωπηλή παράλειψη', () => {
    fs.unlinkSync(path.join(tmpRoot, 'src/constants/project-statuses.ts'));
    const found = blocking(run(tmpRoot));
    expect(found.map(f => f.state)).toContain(STATES.ROOT_DRIFT);
  });
});

describe('CHECK 3.73 — το κλειστό σύνολο δηλώσεων', () => {
  it('Μ7 — δηλωμένη εξαίρεση για ανύπαρκτο αρχείο ⇒ orphan-declaration', () => {
    mutateConfig(tmpRoot, cfg => {
      cfg.vocabularies[0].exemptions = [{
        file: 'src/does/not/exist.ts',
        reason: 'λόγος αρκετά μακρύς ώστε να περάσει το κατώφλι των σαράντα χαρακτήρων',
      }];
    });
    expect(blocking(run(tmpRoot)).map(f => f.state)).toContain(STATES.ORPHAN_DECLARATION);
  });

  it('Μ8 — εξαίρεση χωρίς επαρκή λόγο ⇒ reasonless-declaration', () => {
    mutateConfig(tmpRoot, cfg => {
      cfg.vocabularies[0].exemptions = [{ file: 'src/constants/project-statuses.ts', reason: 'γιατί ναι' }];
    });
    expect(blocking(run(tmpRoot)).map(f => f.state)).toContain(STATES.REASONLESS_DECLARATION);
  });

  it('Μ9 — εξαίρεση ΜΕ λόγο σιωπά το εύρημα, χωρίς να το εξαφανίζει από τη λογιστική', () => {
    mutate(tmpRoot, 'src/domain/cards/project/useProjectCardModel.ts',
      'Record<ProjectStatus, GridCardBadgeVariant>', 'Record<string, GridCardBadgeVariant>');
    mutateConfig(tmpRoot, cfg => {
      cfg.vocabularies[0].exemptions = [{
        file: 'src/domain/cards/project/useProjectCardModel.ts',
        reason: 'δοκιμαστική εξαίρεση με λόγο αρκετά μακρύ για το κατώφλι των σαράντα χαρακτήρων',
      }];
    });
    const r = run(tmpRoot);
    expect(blocking(r)).toEqual([]);
    expect(r.tally[STATES.DECLARED_EXEMPT]).toBe(1);   // ΜΕΤΡΙΕΤΑΙ, δεν εξαφανίζεται
  });

  it('Μ10 — κενό μητρώο ⇒ ΑΡΝΗΣΗ, ποτέ «0 παραβιάσεις»', () => {
    mutateConfig(tmpRoot, cfg => { cfg.vocabularies = []; });
    expect(() => run(tmpRoot)).toThrow(/κενό vocabularies/);
  });

  it('Μ11 — λεξιλόγιο χωρίς λόγο ⇒ ΑΡΝΗΣΗ κατά τη φόρτωση', () => {
    mutateConfig(tmpRoot, cfg => { cfg.vocabularies[0].reason = 'λίγα'; });
    expect(() => run(tmpRoot)).toThrow(/λόγος είναι υποχρεωτικός/);
  });
});

describe('CHECK 3.73 — συμβόλαια', () => {
  it('Κ1 — κλειστή λογιστική: άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ', () => {
    const r = run(tmpRoot);
    for (const state of Object.values(STATES)) expect(r.tally).toHaveProperty(state);
    expect(Object.keys(r.tally).sort()).toEqual(Object.values(STATES).sort());
  });

  it('Κ2 — ΟΛΕΣ οι μπλοκάρουσες τυπώνονται, ακόμα και στο μηδέν', () => {
    const lines = [];
    gate.report(run(tmpRoot), l => lines.push(l));
    const text = lines.join('\n');
    for (const s of gate.BLOCKING) expect(text).toContain(s);
  });

  it('Κ3 — η αναφορά ονομάζει τη ΘΕΡΑΠΕΙΑ, όχι μόνο το πρόβλημα', () => {
    mutate(tmpRoot, 'src/domain/cards/project/useProjectCardModel.ts',
      'Record<ProjectStatus, GridCardBadgeVariant>', 'Record<string, GridCardBadgeVariant>');
    const lines = [];
    gate.report(run(tmpRoot), l => lines.push(l));
    expect(lines.join('\n')).toContain('ΘΕΡΑΠΕΙΑ');
  });

  it('Κ4 — το προφίλτρο δίνει ΤΑΥΤΟΣΗΜΟ αποτέλεσμα με την πλήρη σάρωση', () => {
    mutate(tmpRoot, 'src/domain/cards/project/useProjectCardModel.ts',
      'Record<ProjectStatus, GridCardBadgeVariant>', 'Record<string, GridCardBadgeVariant>');
    const withPre = run(tmpRoot);
    const without = run(tmpRoot, { noPrefilter: true });
    expect(withPre.tally).toEqual(without.tally);
    expect(withPre.findings).toEqual(without.findings);
  });

  it('Κ5 — τα ΣΧΟΛΙΑ δεν γεννούν ευρήματα (το AST τα αγνοεί εξ ορισμού)', () => {
    const p = path.join(tmpRoot, 'src/domain/cards/project/useProjectCardModel.ts');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8') +
      "\n// planning in_progress completed on_hold cancelled deleted — τεκμηρίωση της βλάβης\n");
    expect(blocking(run(tmpRoot))).toEqual([]);
  });

  it('Κ6 — η ίδια η ρίζα ΔΕΝ κατηγορείται για το λεξιλόγιο που ορίζει', () => {
    const r = run(tmpRoot);
    expect(r.findings.filter(f => f.file && f.file.includes('project-statuses.ts'))).toEqual([]);
  });

  it('Κ7 — σάρωση χωρίς αρχεία ⇒ ΑΡΝΗΣΗ, ποτέ σιωπηλό πράσινο', () => {
    expect(() => gate.measure({ root: tmpRoot, configPath: path.join(tmpRoot, '.domain-vocabulary.json') }))
      .toThrow(/δεν κοίταξε/);
  });

  it('Κ8 — το SKIP_ είναι ρητό και τυπώνεται', () => {
    const prev = process.env.SKIP_DOMAIN_VOCABULARY;
    process.env.SKIP_DOMAIN_VOCABULARY = '1';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(gate.main()).toBe(0);
      expect(spy.mock.calls.flat().join(' ')).toContain('παραλείφθηκε');
    } finally {
      spy.mockRestore();
      if (prev === undefined) delete process.env.SKIP_DOMAIN_VOCABULARY;
      else process.env.SKIP_DOMAIN_VOCABULARY = prev;
    }
  });
});
