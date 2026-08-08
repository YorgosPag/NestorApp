/**
 * @jest-environment node
 *
 * CHECK 3.49 / ADR-779 — **τα mutation tests της πύλης ταυτότητας ADR**.
 *
 * Κάθε **Μ** φτιάχνει μίνι-repo με **πραγματικό `git init`** (η πύλη ρωτά το index του git, άρα
 * προσομοίωση θα τη δοκίμαζε σε κόσμο που δεν υπάρχει), αλλάζει **ένα** πράγμα, και απαιτεί να
 * αλλάξει η ετυμηγορία. Το `miniRepo` **ουρλιάζει** αν μια μετάλλαξη αφήσει το δέντρο ίδιο —
 * αλλιώς θα περνούσε πράσινο αποδεικνύοντας μηδέν (μάθημα Μ11 του CHECK 3.44).
 *
 * Τα **Κ** κλειδώνουν αποφάσεις σχεδιασμού που, αν «απλοποιηθούν», αφήνουν την πύλη πράσινη
 * πάνω στο ίδιο το ελάττωμα.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const {
  scanAdrIdentity,
  parseAdrFile,
  violationId,
  RATCHETED_STATES,
} = require('../lib/adr-identity/scan');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

let created = 0;

/**
 * ⚠️ `expectDifferentFrom` είναι το «ουρλιαχτό»: αν μια μετάλλαξη αφήσει το δέντρο ίδιο, το test
 * αποτυγχάνει **εκεί**, όχι στην ετυμηγορία.
 *
 * ⚠️ `stage: false` αφήνει τα αρχεία **εκτός index** — είναι το όχημα του Μ5, που κλειδώνει το
 * δηλωμένο όριο «η αυθεντία είναι το index, όχι ο δίσκος».
 */
function miniRepo(tree, { expectDifferentFrom, stage = true } = {}) {
  if (expectDifferentFrom !== undefined) {
    expect(JSON.stringify(tree)).not.toEqual(JSON.stringify(expectDifferentFrom));
  }
  created += 1;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `adr-identity-${created}-`));
  for (const [relative, content] of Object.entries(tree)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  cp.execSync('git init --quiet', { cwd: root });
  if (stage) cp.execSync('git add -A', { cwd: root, stdio: 'ignore' });
  return root;
}

const HOME = 'docs/centralized-systems/reference/adrs';

/** Το βασικό δέντρο: τρία έγγραφα, τρεις **διαφορετικοί** αριθμοί, ένα σπίτι. */
const BASE = {
  [`${HOME}/ADR-770-ui-contrast.md`]: '# ADR-770\n',
  [`${HOME}/ADR-771-state-channel.md`]: '# ADR-771\n',
  [`${HOME}/ADR-772-address-vocabulary.md`]: '# ADR-772\n',
  'README.md': '# repo\n',
};

/** Οι καταστάσεις με πλήθος > 0, ως χάρτης — διαβάζεται σαν πρόταση. */
function statesOf(scan) {
  return Object.fromEntries(Object.entries(scan.counts).filter(([, n]) => n > 0));
}

// ────────────────────────────────────────────────────────────────────────────────────
describe('Μ0 — βαθμονόμηση στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  let scan;
  beforeAll(() => { scan = scanAdrIdentity(PROJECT_ROOT); });

  it('Μ0.1 βρίσκει έγγραφα ADR — «0» θα σήμαινε ότι η πύλη γεννήθηκε τυφλή', () => {
    expect(scan.documents).toBeGreaterThan(100);
    expect(scan.numbers).toBeGreaterThan(100);
  });

  it('Μ0.2 η λογιστική κλείνει — κάθε έγγραφο σε ΕΝΑΝ κάδο, χωρίς υπόλοιπο', () => {
    const sum = scan.counts.unique
      + scan.counts['collided-same-home']
      + scan.counts['collided-cross-home'];
    expect(sum).toBe(scan.documents);
    expect(scan.balanced).toBe(true);
  });

  it('Μ0.3 το πραγματικό δέντρο ΕΧΕΙ συγκρούσεις — αυτός είναι ο λόγος ύπαρξης της πύλης', () => {
    expect(scan.violationIds.length).toBeGreaterThan(0);
  });

  it('Μ0.4 μία ταυτότητα ανά αρχείο, χωρίς διπλοεγγραφές', () => {
    expect(new Set(scan.violationIds).size).toBe(scan.violationIds.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────────────
describe('Μ — μεταλλάξεις στις ΕΙΣΟΔΟΥΣ', () => {
  it('Μ1 βάση: τρεις διαφορετικοί αριθμοί ⇒ ΚΑΜΙΑ σύγκρουση', () => {
    const scan = scanAdrIdentity(miniRepo(BASE));
    expect(scan.violationIds).toEqual([]);
    expect(statesOf(scan)).toEqual({ unique: 3 });
  });

  it('Μ2 δεύτερο έγγραφο με τον ΙΔΙΟ αριθμό στο ΙΔΙΟ σπίτι ⇒ collided-same-home ×2', () => {
    const mutated = { ...BASE, [`${HOME}/ADR-772-unified-property-map-search.md`]: '# ADR-772\n' };
    const scan = scanAdrIdentity(miniRepo(mutated, { expectDifferentFrom: BASE }));
    expect(statesOf(scan)).toEqual({ unique: 2, 'collided-same-home': 2 });
    // **Και τα δύο** έγγραφα είναι παραβίαση: κανένα δεν είναι «ο σωστός» — αυτό το κρίνει άνθρωπος.
    expect(scan.violationIds).toHaveLength(2);
  });

  it('Μ3 ίδιος αριθμός σε ΑΛΛΟ σπίτι ⇒ collided-cross-home (άλλη αιτία, άλλη θεραπεία)', () => {
    const mutated = { ...BASE, 'adrs/ADR-772-other-series.md': '# ADR-772\n' };
    const scan = scanAdrIdentity(miniRepo(mutated, { expectDifferentFrom: BASE }));
    expect(statesOf(scan)).toEqual({ unique: 2, 'collided-cross-home': 2 });
  });

  it('Μ4 ΤΡΙΤΟ έγγραφο ⇒ ΤΡΕΙΣ ταυτότητες, όχι δύο — αλλιώς η ανάπτυξη περνά αθόρυβα', () => {
    const two = { ...BASE, [`${HOME}/ADR-772-b.md`]: '# b\n' };
    const three = { ...two, [`${HOME}/ADR-772-c.md`]: '# c\n' };
    expect(scanAdrIdentity(miniRepo(two)).violationIds).toHaveLength(2);
    expect(scanAdrIdentity(miniRepo(three, { expectDifferentFrom: two })).violationIds).toHaveLength(3);
  });

  it('Μ5 🔴 ΤΟ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: αρχείο ΕΚΤΟΣ index ΔΕΝ μετριέται', () => {
    const mutated = { ...BASE, [`${HOME}/ADR-772-duplicate.md`]: '# dup\n' };
    const scan = scanAdrIdentity(miniRepo(mutated, { expectDifferentFrom: BASE, stage: false }));
    expect(scan.documents).toBe(0);
    expect(scan.violationIds).toEqual([]);
  });

  it('Μ6 …και το ΙΔΙΟ δέντρο σταδιοποιημένο ΜΠΛΟΚΑΡΕΙ — το `git add` είναι η στιγμή', () => {
    const mutated = { ...BASE, [`${HOME}/ADR-772-duplicate.md`]: '# dup\n' };
    const scan = scanAdrIdentity(miniRepo(mutated, { stage: true }));
    expect(scan.violationIds).toHaveLength(2);
  });

  it('Μ7 το μηδενικό μπροστά είναι ΟΡΘΟΓΡΑΦΙΑ, όχι ταυτότητα: ADR-034 ≡ ADR-34', () => {
    const mutated = {
      ...BASE,
      [`${HOME}/ADR-034-alpha.md`]: '# a\n',
      [`${HOME}/ADR-34-beta.md`]: '# b\n',
    };
    const scan = scanAdrIdentity(miniRepo(mutated, { expectDifferentFrom: BASE }));
    expect(statesOf(scan)).toEqual({ unique: 3, 'collided-same-home': 2 });
  });

  it('Μ8 νέο ΣΠΙΤΙ εμφανίζεται στις δηλώσεις — ακόμα κι όταν ΔΕΝ συγκρούεται τίποτα', () => {
    const mutated = { ...BASE, 'adrs/ADR-999-brand-new-series.md': '# new\n' };
    const scan = scanAdrIdentity(miniRepo(mutated, { expectDifferentFrom: BASE }));
    expect(scan.violationIds).toEqual([]);            // καμία σύγκρουση σήμερα…
    expect(scan.declarations).toContain('adrs');      // …και όμως μπλοκάρει ως νέα δήλωση
    expect(scan.declarations).toHaveLength(2);
  });

  it('Μ9 αρχείο που απλώς ΑΝΑΦΕΡΕΙ ADR στο όνομά του χωρίς πρόθεμα δεν είναι έγγραφο ADR', () => {
    const mutated = { ...BASE, [`${HOME}/2026-08-08_ADR-772_handoff.md`]: '# handoff\n' };
    const scan = scanAdrIdentity(miniRepo(mutated, { expectDifferentFrom: BASE }));
    expect(scan.documents).toBe(3);
    expect(scan.violationIds).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────────────
describe('Κ — αποφάσεις σχεδιασμού που ΔΕΝ επιτρέπεται να «απλοποιηθούν»', () => {
  it('Κ1 🔴 ΔΥΟ καταστάσεις, ποτέ μία με «ή» — έχουν ΔΙΑΦΟΡΕΤΙΚΗ θεραπεία', () => {
    expect(RATCHETED_STATES).toEqual(['collided-same-home', 'collided-cross-home']);
  });

  it('Κ2 🔴 η ταυτότητα είναι ΑΝΑ ΑΡΧΕΙΟ: η θεραπεία 3→2 ΑΦΑΙΡΕΙ ταυτότητα, δεν προσθέτει', () => {
    const three = {
      ...BASE,
      [`${HOME}/ADR-772-b.md`]: '# b\n',
      [`${HOME}/ADR-772-c.md`]: '# c\n',
    };
    const two = { ...three };
    delete two[`${HOME}/ADR-772-c.md`];

    const before = new Set(scanAdrIdentity(miniRepo(three)).violationIds);
    const after = new Set(scanAdrIdentity(miniRepo(two, { expectDifferentFrom: three })).violationIds);

    // Καμία ΝΕΑ ταυτότητα ⇒ ο ratchet δεν μπλοκάρει τη διόρθωση. Με ταυτότητα `ADR-772#3`
    // (αριθμός + πλήθος) το `#3` θα έσβηνε και θα γεννιόταν `#2`: η πύλη θα εμπόδιζε τη θεραπεία.
    expect([...after].filter((id) => !before.has(id))).toEqual([]);
    expect(before.size - after.size).toBe(1);
  });

  it('Κ3 🔴 το bumping ΛΥΝΕΙ τη σύγκρουση — η πράξη που συνιστά η πρακτική RFC', () => {
    const collided = { ...BASE, [`${HOME}/ADR-772-second.md`]: '# second\n' };
    const bumped = { ...BASE, [`${HOME}/ADR-773-second.md`]: '# second\n' };
    expect(scanAdrIdentity(miniRepo(collided)).violationIds).toHaveLength(2);
    expect(scanAdrIdentity(miniRepo(bumped, { expectDifferentFrom: collided })).violationIds).toEqual([]);
  });

  it('Κ4 η ταυτότητα κουβαλά ΚΑΙ τον αριθμό ΚΑΙ το μονοπάτι — αλλιώς δύο σπίτια συγχέονται', () => {
    expect(violationId({ number: 34, file: 'adrs/ADR-034-x.md' }))
      .toBe('ADR-034 :: adrs/ADR-034-x.md');
  });

  it('Κ5 τα ΣΠΙΤΙΑ παράγονται από τη μέτρηση — καμία χειρόγραφη λίστα να αποκλίνει', () => {
    const mutated = { ...BASE, 'somewhere/else/ADR-990-x.md': '# x\n' };
    const scan = scanAdrIdentity(miniRepo(mutated, { expectDifferentFrom: BASE }));
    expect(scan.declarations).toContain('somewhere/else');
  });

  it('Κ6 ο αναλυτής ονόματος δέχεται ΜΟΝΟ πρόθεμα, και κρατά σπίτι + αριθμό', () => {
    expect(parseAdrFile('docs/x/ADR-776-jest-partition.md'))
      .toEqual({ file: 'docs/x/ADR-776-jest-partition.md', number: 776, home: 'docs/x' });
    expect(parseAdrFile('docs/x/NOT-ADR-776.md')).toBeNull();
    expect(parseAdrFile('ADR-363-pending-summary.md')?.home).toBe('<ρίζα>');
  });
});
