/**
 * @jest-environment node
 *
 * =============================================================================
 * CHECK 3.53 — σουίτα μετάλλαξης  (ADR-739 §0.3 / ADR-777 §0.4)
 * =============================================================================
 *
 *  · **Μ0**  βαθμονόμηση στο **πραγματικό** δέντρο — «0» δεν σημαίνει «καθαρό».
 *  · **Μ1+** μεταλλάξεις **ΣΤΙΣ ΕΙΣΟΔΟΥΣ** (ποτέ στην πύλη), σε μίνι-repo με
 *            **πραγματικό `git init`** — η πύλη διαβάζει το index του git, οπότε
 *            προσομοίωση θα τη δοκίμαζε σε κόσμο που δεν υπάρχει.
 *  · **Κ**   άγκυρες κριτηρίου: κλειδώνουν αποφάσεις που μια «απλοποίηση» θα έσβηνε.
 *  · **Π**   χειρόγραφες αποδείξεις στο πραγματικό δέντρο — δεύτερη φωνή.
 *
 * ⚠️ Ο `miniRepo` **ουρλιάζει** αν η μετάλλαξη δεν άλλαξε τίποτα: μια μετάλλαξη που
 * δεν αλλάζει συμπεριφορά δεν αποδεικνύει τίποτα (μάθημα CHECK 3.44/3.50).
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const GATE = require('../check-adr-section-refs');
const R = require('../lib/adr-sections/resolve');
const S = require('../lib/adr-sections/scan');

const REPO = path.resolve(__dirname, '../..');
const ADRS = 'docs/centralized-systems/reference/adrs';

// ---------------------------------------------------------------------------
// Μίνι-repo: πραγματικά αρχεία, πραγματικό git.
// ---------------------------------------------------------------------------
const HUB_REL = `${ADRS}/ADR-900-mini.md`;
const SPEC_REL = `${ADRS}/specs/SPEC-900A-mini.md`;

function baseFiles() {
  return {
    '.adr-section-refs.json': JSON.stringify({
      families: {
        'ADR-900': { why: 'δοκιμή', hub: HUB_REL, members: [SPEC_REL] },
      },
    }, null, 2),
    [HUB_REL]: [
      '---', 'id: ADR-900', 'kind: decision', 'title: Μίνι', 'status: accepted',
      'sections: ["§1"]', 'links:', '  - kind: specified-by', '    target: SPEC-900A', '---',
      '', '# ADR-900', '', '## 1. Η απόφαση', '', 'Δες το §2 για λεπτομέρειες.', '',
    ].join('\n'),
    [SPEC_REL]: [
      '---', 'id: SPEC-900A', 'kind: specification', 'parent: ADR-900',
      'title: Μίνι spec', 'status: accepted', 'sections: ["§2"]',
      'links:', '  - kind: specifies', '    target: ADR-900', '---',
      '', '# SPEC-900A', '', '## 2. Η υλοποίηση', '', 'Λεπτομέρειες.', '',
    ].join('\n'),
    'src/consumer.ts': '// ADR-900 §2 — ο καταναλωτής δείχνει εδώ\nexport const x = 1;\n',
  };
}

/**
 * @param {(files: Record<string,string>) => void} [mutate]
 * @param {{ analyse?: boolean }} [opts] — `analyse:false` όταν το ίδιο το φόρτωμα του
 *   config οφείλει να πετάξει (Κ10): αλλιώς ο helper σκάει πριν επιστρέψει τη ρίζα.
 */
function miniRepo(mutate, { analyse = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adr-section-refs-'));
  const files = baseFiles();
  const before = JSON.stringify(files);
  if (mutate) mutate(files);
  if (mutate && JSON.stringify(files) === before) {
    throw new Error('Η ΜΕΤΑΛΛΑΞΗ ΔΕΝ ΑΛΛΑΞΕ ΤΙΠΟΤΑ — δεν αποδεικνύει τίποτα.');
  }
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git(['init', '-q']);
  git(['config', 'user.email', 'gate@test']);
  git(['config', 'user.name', 'gate']);
  git(['add', '-A']);
  return { root, result: analyse ? GATE.analyse(root) : null };
}

const refStates = result => result.refs.map(f => f.state);
const docStates = result => result.docs.map(f => f.state);
const countRef = (result, state) => refStates(result).filter(s => s === state).length;
const countDoc = (result, state) => docStates(result).filter(s => s === state).length;

// ===========================================================================
describe('Μ0 — βαθμονόμηση στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  let real;
  beforeAll(() => { real = GATE.analyse(REPO); });

  test('Μ0.1 — η πύλη ΒΛΕΠΕΙ: χιλιάδες δείκτες επιλύονται, όχι μηδέν', () => {
    expect(countRef(real, R.REF_STATES.RESOLVED)).toBeGreaterThan(2000);
  });

  test('Μ0.2 — η οικογένεια ADR-739 έχει και τα 7 αρχεία της', () => {
    const fam = real.families.get('ADR-739');
    expect(fam.files).toHaveLength(7);
    expect(fam.files.every(f => !f.missing)).toBe(true);
  });

  test('Μ0.3 — τα zero-tolerance είναι ΜΗΔΕΝ στο σημερινό δέντρο', () => {
    expect(countDoc(real, R.DOC_STATES.ORPHAN_SECTION)).toBe(0);
    expect(countDoc(real, R.DOC_STATES.BROKEN_BOND)).toBe(0);
  });

  test('Μ0.4 — κάθε λογιστική κλείνει (fail-closed)', () => {
    expect(Object.values(real.ledgers.refs).reduce((a, b) => a + b, 0)).toBe(real.refs.length);
    expect(Object.values(real.ledgers.docs).reduce((a, b) => a + b, 0)).toBe(real.docs.length);
  });
});

// ===========================================================================
describe('Μ1-Μ8 — μεταλλάξεις ΣΤΙΣ ΕΙΣΟΔΟΥΣ', () => {
  test('Μ0-base — το αμετάβλητο μίνι-repo είναι καθαρό', () => {
    const { result } = miniRepo();
    expect(GATE.blockingOf(result)).toHaveLength(0);
    expect(countRef(result, R.REF_STATES.RESOLVED)).toBeGreaterThan(0);
  });

  test('Μ1 — δείκτης σε ανύπαρκτη ενότητα ⇒ dangling-section', () => {
    const { result } = miniRepo(f => { f['src/consumer.ts'] = '// ADR-900 §77 — πουθενά\n'; });
    expect(countRef(result, R.REF_STATES.DANGLING)).toBe(1);
    expect(GATE.ratchetIds(result).dangling).toEqual(['ADR-900 §77']);
  });

  test('Μ2 — δύο επικεφαλίδες με το ίδιο ID ⇒ duplicate-heading ΚΑΙ ambiguous', () => {
    const { result } = miniRepo(f => { f[SPEC_REL] += '\n## 2. Δεύτερη φορά\n'; });
    expect(countDoc(result, R.DOC_STATES.DUPLICATE_HEADING)).toBe(1);
    expect(countRef(result, R.REF_STATES.AMBIGUOUS)).toBeGreaterThan(0);
  });

  test('Μ3 — ενότητα που υπάρχει αλλά δεν δηλώνεται ⇒ orphan-section', () => {
    const { result } = miniRepo(f => { f[SPEC_REL] += '\n## 3. Αδήλωτη\n'; });
    const orphans = result.docs.filter(d => d.state === R.DOC_STATES.ORPHAN_SECTION);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].why).toMatch(/δεν δηλώνεται/);
  });

  test('Μ4 — δήλωση χωρίς αντίστοιχη ενότητα ⇒ orphan-section (η άλλη φορά)', () => {
    const { result } = miniRepo(f => { f[SPEC_REL] = f[SPEC_REL].replace('sections: ["§2"]', 'sections: ["§2", "§9"]'); });
    const orphans = result.docs.filter(d => d.state === R.DOC_STATES.ORPHAN_SECTION);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].why).toMatch(/δεν υπάρχει/);
  });

  test('Μ5 — παιδί χωρίς parent: ⇒ broken-bond', () => {
    const { result } = miniRepo(f => { f[SPEC_REL] = f[SPEC_REL].replace('parent: ADR-900\n', ''); });
    const bonds = result.docs.filter(d => d.state === R.DOC_STATES.BROKEN_BOND);
    expect(bonds).toHaveLength(1);
    expect(bonds[0].why).toMatch(/parent/);
  });

  test('Μ6 — δεσμός χωρίς αντίστροφο ζεύγος ⇒ broken-bond', () => {
    const { result } = miniRepo(f => {
      f[SPEC_REL] = f[SPEC_REL].replace('  - kind: specifies\n    target: ADR-900\n', '');
    });
    const bonds = result.docs.filter(d => d.state === R.DOC_STATES.BROKEN_BOND);
    expect(bonds).toHaveLength(1);
    expect(bonds[0].why).toMatch(/αντίστροφ/);
  });

  test('Μ7 — ο hub δεν δηλώνει το παιδί ⇒ broken-bond', () => {
    const { result } = miniRepo(f => {
      f[HUB_REL] = f[HUB_REL].replace('  - kind: specified-by\n    target: SPEC-900A\n', '');
    });
    expect(countDoc(result, R.DOC_STATES.BROKEN_BOND)).toBe(1);
  });

  test('Μ8 — δείκτης σε ID που υπάρχει μόνο σε πρόζα ⇒ prose-only, ΟΧΙ dangling', () => {
    const { result } = miniRepo(f => {
      f[SPEC_REL] += '\nΗ ενότητα §2.5 συζητιέται εδώ χωρίς δική της επικεφαλίδα.\n';
      f['src/consumer.ts'] = '// ADR-900 §2.5\n';
    });
    expect(countRef(result, R.REF_STATES.PROSE_ONLY)).toBeGreaterThan(0);
    expect(countRef(result, R.REF_STATES.DANGLING)).toBe(0);
  });
});

// ===========================================================================
describe('Κ — άγκυρες κριτηρίου', () => {
  test('Κ1 — μη μονότονη αρίθμηση: ρητός πίνακας, ΟΧΙ «πλησιέστερη προηγούμενη»', () => {
    const text = ['## 42 Πρώτη', 'κείμενο', '## 36.9 Εκτός σειράς', 'κείμενο', '## 43 Τρίτη'].join('\n');
    const idx = S.indexHeadings(text, 'x.md');
    expect(idx.map(h => h.id)).toEqual(['42', '36.9', '43']);
    expect(idx.find(h => h.id === '36.9').line).toBe(3);
  });

  test('Κ2 — ελληνικός τελικός τόνος ΔΥΟ γραμμάτων («στ») δεν κόβεται σε §67.10', () => {
    expect(S.headingId('§67.10.στ Άγκυρες')).toBe('67.10.στ');
    expect(S.headingId('§19.9.α Πρώτο')).toBe('19.9.α');
    expect(S.headingId('§27.17.Φ2 — Και η μορφοποίηση')).toBe('27.17.Φ2');
  });

  test('Κ3 — επικεφαλίδα ΜΕΣΑ σε code fence ΔΕΝ είναι ενότητα (φάντασμα)', () => {
    const text = ['## 1 Αληθινή', '```md', '## 99 Παράδειγμα σε μπλοκ κώδικα', '```', '## 2 Αληθινή'].join('\n');
    expect(S.indexHeadings(text, 'x.md').map(h => h.id)).toEqual(['1', '2']);
  });

  test('Κ4 — δείκτης μέσα σε σχόλιο κώδικα ΜΕΤΡΑΕΙ (είναι εξίσου σπασμένος)', () => {
    const refs = S.scanReferences('/* ADR-900 §5 */', { file: 'a.ts', familyIds: ['ADR-900'] });
    expect(refs).toHaveLength(1);
    expect(refs[0].section).toBe('5');
  });

  test('Κ5 — σκέτο §NN μετράει ΜΟΝΟ μέσα στην οικογένεια (αλλιώς διφορούμενο)', () => {
    const opts = { file: 'x.md', familyIds: ['ADR-900'] };
    expect(S.scanReferences('βλ. §7', opts)).toHaveLength(0);
    expect(S.scanReferences('βλ. §7', { ...opts, ownFamily: 'ADR-900' })).toHaveLength(1);
  });

  test('Κ6 — φασική αναφορά είναι ΔΙΚΗ ΤΗΣ κατάσταση, όχι σιωπηλή παράλειψη', () => {
    const refs = S.scanReferences('ADR-900 Φ.Δ και ADR-900 Φάση Ε', { file: 'a.ts', familyIds: ['ADR-900'] });
    expect(refs.map(r => r.phase)).toEqual(['Δ', 'Ε']);
    expect(refs.every(r => r.form === 'phase')).toBe(true);
  });

  test('Κ7 — ταυτότητα ratchet ΧΩΡΙΣ γραμμή και ΧΩΡΙΣ πλήθος (μετακίνηση ≠ regression)', () => {
    const one = miniRepo(f => { f['src/consumer.ts'] = '// ADR-900 §77\n'; });
    const many = miniRepo(f => {
      f['src/consumer.ts'] = '// ADR-900 §77\n// ADR-900 §77\n';
      f['src/other.ts'] = '// ADR-900 §77 αλλού\n';
    });
    expect(GATE.ratchetIds(one.result).dangling).toEqual(['ADR-900 §77']);
    expect(GATE.ratchetIds(many.result).dangling).toEqual(GATE.ratchetIds(one.result).dangling);
    // ⚠️ …ενώ ο ΑΡΙΘΜΟΣ των δεικτών όντως άλλαξε: η ταυτότητα δεν τον κοιτά.
    expect(countRef(many.result, R.REF_STATES.DANGLING))
      .toBeGreaterThan(countRef(one.result, R.REF_STATES.DANGLING));
  });

  test('Κ8 — το buildPayload ΑΡΝΕΙΤΑΙ να κλειδώσει zero-tolerance ευρήματα', () => {
    const { result } = miniRepo(f => { f[SPEC_REL] = f[SPEC_REL].replace('parent: ADR-900\n', ''); });
    expect(() => GATE.buildPayload(result)).toThrow(/άρνηση εγγραφής baseline/);
  });

  test('Κ9 — άγνωστη κατάσταση ⇒ throw ΜΕ ΟΝΟΜΑ (κλειστή λογιστική)', () => {
    expect(() => R.tally([{ state: 'φαντασία' }], R.REF_ORDER, 'δοκιμή'))
      .toThrow(/άγνωστη κατάσταση «φαντασία»/);
    expect(() => R.tally([], ['a'], 'δοκιμή')).not.toThrow();
  });

  test('Κ10 — κλειστό σύνολο: config χωρίς «why» ή χωρίς families ΜΠΛΟΚΑΡΕΙ', () => {
    const { root } = miniRepo(f => {
      f['.adr-section-refs.json'] = JSON.stringify({ families: { 'ADR-900': { hub: HUB_REL } } });
    }, { analyse: false });
    expect(() => GATE.loadConfig(root)).toThrow(/why/);

    const { root: empty } = miniRepo(f => {
      f['.adr-section-refs.json'] = JSON.stringify({ families: {} });
    }, { analyse: false });
    expect(() => GATE.loadConfig(empty)).toThrow(/φρουρός που δεν μπορεί να πυροδοτήσει/);
  });

  test('Κ12 — το ΚΑΤΑΣΤΙΧΟ της πύλης ΔΕΝ είναι είσοδός της (αυτο-τροφοδοτούμενος βρόχος)', () => {
    // Πιάστηκε ζωντανά: η baseline γράφει ταυτότητες «ADR-900 §77», ο σαρωτής τις
    // διάβαζε ως ΑΝΑΦΟΡΕΣ ⇒ κάθε καταγραφή γεννούσε νέο εύρημα, που θα γραφόταν στην
    // επόμενη baseline. Βρόχος που δεν συγκλίνει ποτέ.
    const { result } = miniRepo(f => {
      f['.adr-section-refs-baseline.json'] = JSON.stringify({ dangling: ['ADR-900 §77'] });
      f['.adr-section-refs.json'] = JSON.parse(f['.adr-section-refs.json']) && f['.adr-section-refs.json']
        .replace('"δοκιμή"', '"δοκιμή — η ενότητα ADR-900 §77 περιγράφεται εδώ, δεν ασκείται"');
    });
    expect(countRef(result, R.REF_STATES.DANGLING)).toBe(0);
    expect(GATE.ratchetIds(result).dangling).toEqual([]);
  });

  test('Κ11 — η σκανδάλη πιάνει ADR/SPEC και την ίδια την πύλη, όχι άσχετα αρχεία', () => {
    expect(GATE.triggers([`${ADRS}/ADR-739-canvas-table-system.md`])).toBe(true);
    expect(GATE.triggers([`${ADRS}/specs/SPEC-739A-model-and-rendering.md`])).toBe(true);
    expect(GATE.triggers(['scripts/lib/adr-sections/scan.js'])).toBe(true);
    expect(GATE.triggers(['.adr-section-refs.json'])).toBe(true);
    expect(GATE.triggers(['src/app/page.tsx'])).toBe(false);
  });
});

// ===========================================================================
describe('Π — χειρόγραφες αποδείξεις στο πραγματικό δέντρο', () => {
  test('Π1 — το ADR-739 έγινε hub: κάτω από 1.000 γραμμές', () => {
    const hub = fs.readFileSync(path.join(REPO, ADRS, 'ADR-739-canvas-table-system.md'), 'utf8');
    expect(hub.split(/\r?\n/).length).toBeLessThan(1000);
  });

  test('Π2 — κάθε SPEC-739* δηλώνει parent ADR-739 και αντίστροφο δεσμό', () => {
    const specs = fs.readdirSync(path.join(REPO, ADRS, 'specs')).filter(f => /^SPEC-739/.test(f));
    expect(specs.length).toBeGreaterThanOrEqual(6);
    for (const file of specs) {
      const fm = S.parseFrontmatter(fs.readFileSync(path.join(REPO, ADRS, 'specs', file), 'utf8'));
      expect(fm).not.toBeNull();
      expect(fm.parent).toBe('ADR-739');
      expect(fm.links.some(l => l.target === 'ADR-739')).toBe(true);
    }
  });

  test('Π3 — καμία ενότητα του ADR-739 δεν ζει σε ΔΥΟ αρχεία της οικογένειας', () => {
    const fam = GATE.analyse(REPO).families.get('ADR-739');
    for (const [id, hits] of fam.byId) {
      const files = new Set(hits.map(h => h.file));
      expect({ id, files: [...files] }).toEqual({ id, files: [...files].slice(0, 1) });
    }
  });

  test('Π4 — ο hub δηλώνει ΚΑΘΕ SPEC της οικογένειας στα links του', () => {
    const fm = S.parseFrontmatter(fs.readFileSync(path.join(REPO, ADRS, 'ADR-739-canvas-table-system.md'), 'utf8'));
    const targets = fm.links.map(l => l.target);
    for (const id of ['SPEC-739A', 'SPEC-739B1', 'SPEC-739B2', 'SPEC-739C', 'SPEC-739D', 'SPEC-739-CHANGELOG']) {
      expect(targets).toContain(id);
    }
  });
});
