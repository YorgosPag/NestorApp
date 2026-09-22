/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΑΝΑΛΛΟΙΩΤΟΥ ΤΗΣ ΠΛΗΡΟΥΣ ΜΗΤΡΑΣ** — ADR-298 Α21.16.
 * @related scripts/lib/firestore-rules/completeness ·
 *   tests/firestore-rules/_registry/coverage-completeness
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η CHECK 3.16 απέκτησε **Validation G**: «καμία μήτρα δεν είναι μερική σιωπηλά».
 * Το ερώτημα που κάθε νέα πύλη οφείλει να απαντήσει πριν την εμπιστευτεί κανείς
 * *(CHECK 3.54, ADR-783)* είναι:
 *
 *     «**ΜΠΟΡΕΙ** αυτή η πύλη να κοκκινίσει κάτι;»
 *
 * Οι ομάδες Α-Β **εκτελούν** τον κατασκευαστή και τον συγκριτή με πραγματικές
 * μεταλλάξεις. Χωρίς αυτές, ένα «✔ OK» θα σήμαινε «κανείς δεν κοίταξε» — η
 * ακριβής κλάση σφάλματος που η Validation G υπάρχει για να κλείσει.
 *
 * 🏆 **Η Ομάδα Γ είναι η σημαντική.** Ένα ratchet σε **σύνολο** αφήνει την
 * **ανταλλαγή** να περάσει: κλείνεις ένα κελί, ανοίγεις ένα άλλο, ο αριθμός δεν
 * αλλάζει, και το χρέος **μετακινήθηκε** αντί να μικρύνει. Ακριβώς αυτό
 * μετρήθηκε στο ADR-749 (το ratchet συνέκρινε δύο ΔΙΑΦΟΡΕΤΙΚΕΣ μηχανές, με
 * baseline φουσκωμένη κατά 69% ⇒ αρχείο μπορούσε να **κερδίσει** παραβιάσεις και
 * να περάσει). Η Γ2 το εκτελεί.
 */

'use strict';

const {
  compare,
  measure,
  REQUIRED_CELLS,
} = require('../lib/firestore-rules/completeness');
const { loadCoverageManifest } = require('../lib/firestore-rules/load-manifest');

/** Ο κατασκευαστής ζει σε TypeScript· ο loader έχει ήδη κάνει το register. */
function completenessModule() {
  loadCoverageManifest();
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(
    require('node:path').join(
      __dirname,
      '..',
      '..',
      'tests',
      'firestore-rules',
      '_registry',
      'coverage-completeness.ts',
    ),
  );
}

const GOOD_META = {
  why: 'Δοκιμαστικός λόγος με αρκετό μήκος ώστε να περάσει το κατώφλι των 40 χαρακτήρων.',
  owner: 'Giorgio',
  since: '2026-09-08',
  review: '2026-12-08',
};

const cellOf = (persona, operation, outcome = 'deny') => ({
  persona,
  operation,
  outcome,
});

const PERSONAS = [
  'super_admin',
  'same_tenant_admin',
  'same_tenant_user',
  'cross_tenant_admin',
  'cross_tenant_user',
  'anonymous',
  'external_user',
];
const OPS = ['read', 'list', 'create', 'update', 'delete'];

/** Πλήρης μήτρα 35 κελιών — η αφετηρία κάθε μετάλλαξης. */
function fullDeclared() {
  return PERSONAS.flatMap((p) => OPS.map((o) => cellOf(p, o)));
}

// ---------------------------------------------------------------------------
describe('Α. Ο κατασκευαστής αρνείται τη μερική μήτρα', () => {
  test('Α1 — πλήρης μήτρα κατασκευάζεται', () => {
    const { defineMatrix } = completenessModule();
    const def = defineMatrix('probeFull', fullDeclared());
    expect(def.matrix).toHaveLength(REQUIRED_CELLS);
    expect(def.exemptions).toHaveLength(0);
    expect(def.matrixId).toBe('probeFull');
  });

  test('Α2 — ΜΕΡΙΚΗ μήτρα πετάει, και το μήνυμα ΟΝΟΜΑΖΕΙ τα κελιά που λείπουν', () => {
    const { defineMatrix } = completenessModule();
    const partial = fullDeclared().filter(
      (c) => !(c.persona === 'external_user' && c.operation === 'read'),
    );
    expect(() => defineMatrix('probePartial', partial)).toThrow(
      /ΜΕΡΙΚΗ ΜΗΤΡΑ.*34\/35.*external_user:read/s,
    );
  });

  test('Α3 — εξαίρεση ΣΥΜΠΛΗΡΩΝΕΙ το κενό, δεν το κρύβει', () => {
    const { defineMatrix, exempt } = completenessModule();
    const partial = fullDeclared().filter((c) => c.persona !== 'external_user');
    const def = defineMatrix(
      'probeExempt',
      partial,
      exempt(['external_user'], OPS, GOOD_META),
    );
    expect(def.matrix).toHaveLength(30);
    expect(def.exemptions).toHaveLength(5);
    expect(def.matrix.length + def.exemptions.length).toBe(REQUIRED_CELLS);
  });

  test('Α4 — διπλό κελί πετάει', () => {
    const { defineMatrix } = completenessModule();
    const dup = [...fullDeclared(), cellOf('super_admin', 'read')];
    expect(() => defineMatrix('probeDup', dup)).toThrow(/ΔΥΟ ΦΟΡΕΣ/);
  });

  test('Α5 — κελί ταυτόχρονα δηλωμένο ΚΑΙ εξαιρεμένο πετάει', () => {
    const { defineMatrix, exempt } = completenessModule();
    expect(() =>
      defineMatrix(
        'probeBoth',
        fullDeclared(),
        exempt(['super_admin'], ['read'], GOOD_META),
      ),
    ).toThrow(/ΔΗΛΩΜΕΝΟ και ΕΞΑΙΡΕΜΕΝΟ/);
  });
});

// ---------------------------------------------------------------------------
describe('Β. Η εξαίρεση οφείλει να είναι ΑΠΑΝΤΗΣΙΜΗ', () => {
  const base = () => fullDeclared().filter((c) => c.persona !== 'external_user');

  test.each([
    ['κοντός λόγος', { ...GOOD_META, why: 'εκκρεμεί' }, /χαρακτήρες.*ελάχιστο 40/s],
    ['χωρίς ιδιοκτήτη', { ...GOOD_META, owner: '   ' }, /λείπει `owner`/],
    ['κακή ημερομηνία', { ...GOOD_META, review: '08-12-2026' }, /δεν \n?είναι ISO/s],
    [
      'επανεξέταση πριν τη δήλωση',
      { ...GOOD_META, review: '2026-01-01' },
      /δεν είναι \n?μετά το `since`/s,
    ],
  ])('Β — %s ⇒ πετάει', (_name, meta, rx) => {
    const { defineMatrix, exempt } = completenessModule();
    expect(() =>
      defineMatrix('probeMeta', base(), exempt(['external_user'], OPS, meta)),
    ).toThrow(rx);
  });

  test('Β5 — `overrideDefinition` ΑΦΑΙΡΕΙ την εξαίρεση του κελιού που δηλώνεται', () => {
    const { defineMatrix, exempt, overrideDefinition } = completenessModule();
    const def = defineMatrix(
      'probeOverride',
      base(),
      exempt(['external_user'], OPS, GOOD_META),
    );
    const narrowed = overrideDefinition(def, [
      cellOf('external_user', 'read', 'allow'),
    ]);
    expect(narrowed.matrix).toHaveLength(31);
    expect(narrowed.exemptions).toHaveLength(4);
    expect(narrowed.exemptions.some((e) => e.operation === 'read')).toBe(false);
    expect(narrowed.matrixId).toBe('probeOverride');
  });
});

// ---------------------------------------------------------------------------
describe('Γ. Το ratchet — ΜΟΝΟ προς τα κάτω', () => {
  const baseline = {
    totals: { collections: 2, cells: 60, exemptions: 10 },
    builders: {
      tenantDirectMatrix: { 'external_user:read': 2, 'external_user:list': 2 },
    },
    perCollection: {
      alpha: ['external_user:list', 'external_user:read'],
      beta: ['external_user:list', 'external_user:read'],
    },
  };
  const cur = (perCollection, builderOf) => ({
    builders: baseline.builders,
    perCollection,
    builderOf,
    totals: { collections: Object.keys(perCollection).length, cells: 0, exemptions: 0 },
  });

  test('Γ1 — ίδια εικόνα ⇒ καμία παραβίαση', () => {
    const { violations } = compare(
      cur(baseline.perCollection, { alpha: 'tenantDirectMatrix', beta: 'tenantDirectMatrix' }),
      baseline,
    );
    expect(violations).toHaveLength(0);
  });

  test('🏆 Γ2 — ΑΝΤΑΛΛΑΓΗ (ίδιο πλήθος, άλλο κελί) ΜΠΛΟΚΑΡΕΙ', () => {
    const { violations } = compare(
      cur(
        {
          alpha: ['external_user:list', 'anonymous:delete'], // read → anonymous:delete
          beta: ['external_user:list', 'external_user:read'],
        },
        { alpha: 'tenantDirectMatrix', beta: 'tenantDirectMatrix' },
      ),
      baseline,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/ΤΟ ΧΡΕΟΣ ΜΕΓΑΛΩΣΕ.*alpha.*anonymous:delete/s);
  });

  test('Γ3 — υπάρχουσα συλλογή που ΜΕΙΩΝΕΙ το χρέος περνάει', () => {
    const { violations } = compare(
      cur(
        { alpha: ['external_user:read'], beta: baseline.perCollection.beta },
        { alpha: 'tenantDirectMatrix', beta: 'tenantDirectMatrix' },
      ),
      baseline,
    );
    expect(violations).toHaveLength(0);
  });

  test('Γ4 — ΝΕΑ συλλογή με ΓΝΩΣΤΟ χρέος του builder της περνάει (και αναφέρεται)', () => {
    const { violations, notes } = compare(
      cur(
        { ...baseline.perCollection, gamma: ['external_user:read'] },
        {
          alpha: 'tenantDirectMatrix',
          beta: 'tenantDirectMatrix',
          gamma: 'tenantDirectMatrix',
        },
      ),
      baseline,
    );
    expect(violations).toHaveLength(0);
    expect(notes.join('\n')).toMatch(/gamma.*νέα συλλογή/s);
  });

  test('Γ5 — ΝΕΑ συλλογή με ΑΓΝΩΣΤΟ κελί μπλοκάρει', () => {
    const { violations } = compare(
      cur(
        { ...baseline.perCollection, gamma: ['same_tenant_user:delete'] },
        {
          alpha: 'tenantDirectMatrix',
          beta: 'tenantDirectMatrix',
          gamma: 'tenantDirectMatrix',
        },
      ),
      baseline,
    );
    expect(violations.join('\n')).toMatch(
      /ΝΕΑ ΣΥΛΛΟΓΗ ΜΕ ΑΓΝΩΣΤΟ ΧΡΕΟΣ.*gamma.*same_tenant_user:delete/s,
    );
  });

  test('Γ6 — baseline που λείπει ή είναι χαλασμένη ΔΕΝ διαβάζεται ως «0 παραβιάσεις»', () => {
    expect(compare(cur({}, {}), null).violations).toHaveLength(1);
    expect(compare(cur({}, {}), { __invalid: true }).violations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe('Δ. Το ΠΡΑΓΜΑΤΙΚΟ μητρώο', () => {
  // 🔑 Ο αριθμός είναι ΠΑΡΑΓΟΜΕΝΟΣ, όχι γραμμένος: η χειρόγραφη εκδοχή του έλεγε «127» ενώ
  // το μητρώο είχε ήδη 129 — το ίδιο σχήμα που το CLAUDE.md καταγγέλλει («άνοιξε το αρχείο
  // πριν επικαλεστείς αριθμό»). Ένα όνομα test που ψεύδεται είναι χειρότερο από κανένα.
  test(`Δ1 — και οι ${measure().totals.collections} εγγραφές είναι πλήρεις (${REQUIRED_CELLS}/${REQUIRED_CELLS})`, () => {
    const current = measure();
    expect(current.partial).toEqual([]);
    expect(current.malformed).toEqual([]);
    expect(current.totals.cells + current.totals.exemptions).toBe(
      current.totals.collections * REQUIRED_CELLS,
    );
  });

  test('Δ2 — ληγμένη επανεξέταση είναι ΠΡΟΕΙΔΟΠΟΙΗΣΗ, όχι μπλόκο', () => {
    // Με «σημερινή» ημερομηνία μετά το review όλων, τίποτα δεν γίνεται violation.
    const future = measure('2099-01-01');
    expect(future.expired.length).toBeGreaterThan(0);
    expect(future.partial).toEqual([]);
    expect(future.malformed).toEqual([]);
  });
});
