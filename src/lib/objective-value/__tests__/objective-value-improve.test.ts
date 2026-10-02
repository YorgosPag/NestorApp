/**
 * ADR-898 Φ3β-2 — η οθόνη «Βελτίωσε την αγγελία σου»: ποιες ερωτήσεις (η μηχανή κρίνει), σε ποια κατάσταση, και με
 * ποια σειρά (minimax κέρδος — ό,τι λέει η ίδια η μηχανή, ποτέ δεύτερη αριθμητική).
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

import { listingObjectiveValue } from '../listing-objective-value';
import { objectiveValueBounds } from '../objective-value-bounds';
import {
  applyObjectiveValuePatch,
  listingObjectiveValueDeclarationsOf,
  OBJECTIVE_VALUE_DECLARED_FIELDS,
  UNDECLARED_OBJECTIVE_VALUE,
  type ObjectiveValueDeclarations,
} from '../objective-value-declarations';
import {
  boundsWidth,
  clearedPatchOf,
  draftOfDeclarations,
  objectiveValueImprovement,
  patchOfDraft,
  type ObjectiveValueImprovement,
} from '../objective-value-improve';
import { INITIAL_DRAFT } from '../objective-value-draft';
import { RESIDENCE_FRONTAGES } from '../objective-value-types';
import { zoneFrontAnswers } from '../objective-value-zone';

const TODAY = '2026-10-01';

const READY: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 'z1', name: 'Θ', price: 2000, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

const FRONTED: ValueZoneVerdict = {
  ...READY,
  fronts: [
    { id: 'f1', name: 'Μ1', price: 2600, validFrom: '2022-01-01', street: 'Ακαδημίας', distanceM: 10 },
    { id: 'f2', name: 'Μ2', price: 2300, validFrom: '2022-01-01', street: 'Σίνα', distanceM: 30 },
  ],
};

const DECLARED_2000 = { provenance: 'declared' as const, value: 2000, at: '2026-09-02T00:00:00.000Z' };

const declared = (declarations: Partial<ObjectiveValueDeclarations>) =>
  listingObjectiveValueDeclarationsOf({ ...UNDECLARED_OBJECTIVE_VALUE, ...declarations });

const home = (overrides: Parameters<typeof listing>[0] = {}) =>
  listing({ floor: 4, areaSqm: 90, heatingType: 'central', amenities: ['elevator'], constructionYear: DECLARED_2000, ...overrides });

/** Το πλάτος των ορίων της ΑΓΓΕΛΙΑΣ — το ανεξάρτητο μέτρο σύγκρισης του κέρδους. */
function widthOf(subject: ReturnType<typeof home>): number {
  const value = listingObjectiveValue(subject, FRONTED, TODAY);
  if (value.kind !== 'evaluated') throw new Error(`αναμενόταν evaluated, ήρθε ${value.kind}`);
  return boundsWidth(value.bounds) ?? Number.NaN;
}

function ready(improvement: ObjectiveValueImprovement) {
  if (improvement.kind !== 'ready') throw new Error(`αναμενόταν ready, ήρθε ${improvement.kind}`);
  return improvement;
}

const fields = (improvement: ObjectiveValueImprovement) => ready(improvement).questions.map((question) => question.field);
const question = (improvement: ObjectiveValueImprovement, field: string) =>
  ready(improvement).questions.find((candidate) => candidate.field === field);

describe('objectiveValueImprovement — ποιες ερωτήσεις', () => {
  it('η μηχανή κρίνει: διαμέρισμα σε Δ\' με όλα τα χαρακτηριστικά ⇒ πρόσοψη ανοιχτή, θέρμανση/ανελκυστήρας από χαρακτηριστικό', () => {
    const improvement = objectiveValueImprovement(home(), READY, TODAY);
    expect(question(improvement, 'frontage')).toMatchObject({ state: 'open' });
    expect(question(improvement, 'hasCentralHeating')).toMatchObject({ state: 'byAttribute' });
    expect(question(improvement, 'hasElevator')).toMatchObject({ state: 'byAttribute' });
    expect(question(improvement, 'permitDate')).toMatchObject({ state: 'assumed' });
    expect(question(improvement, 'areaIncludesCommon')).toMatchObject({ state: 'assumed' });
  });

  it('ανελκυστήρας σε Α\' όροφο ΔΕΝ ρωτιέται (ο νόμος δεν τον μετρά εκεί — το λέει η μηχανή, όχι κανόνας εδώ)', () => {
    expect(fields(objectiveValueImprovement(home({ floor: 1, amenities: null }), READY, TODAY))).not.toContain('hasElevator');
    expect(fields(objectiveValueImprovement(home({ floor: 4, amenities: null }), READY, TODAY))).toContain('hasElevator');
  });

  it('μέτωπο: ρωτιέται ΜΟΝΟ όταν υπάρχουν υποψήφια μέτωπα', () => {
    expect(fields(objectiveValueImprovement(home(), READY, TODAY))).not.toContain('zoneFront');
    expect(fields(objectiveValueImprovement(home(), FRONTED, TODAY))).toContain('zoneFront');
  });

  it('απαντημένη ερώτηση μένει ορατή (για διόρθωση), ως `answered`', () => {
    const improvement = objectiveValueImprovement(home({ frontage: 'single' }), READY, TODAY);
    expect(question(improvement, 'frontage')).toMatchObject({ state: 'answered', impact: { kind: 'none' } });
  });

  it('η δήλωση που νικήθηκε από χαρακτηριστικό ΔΕΝ λέγεται «answered»', () => {
    const improvement = objectiveValueImprovement(home({ objectiveValueDeclarations: declared({ hasElevator: false }) }), READY, TODAY);
    expect(question(improvement, 'hasElevator')).toMatchObject({ state: 'byAttribute' });
  });

  it('εκτός εντύπου 1 / χωρίς ζώνη ⇒ η ίδια απάντηση με την αγγελία (μία βάση)', () => {
    expect(objectiveValueImprovement(home(), { kind: 'outside' }, TODAY)).toEqual({ kind: 'no-zone' });
    expect(objectiveValueImprovement(home({ type: 'plot' }), READY, TODAY)).toEqual({ kind: 'unsupported', reason: 'type' });
  });
});

describe('objectiveValueImprovement — σειρά κατά κέρδος (minimax)', () => {
  it('τα όρια είναι ΑΚΡΙΒΩΣ της αγγελίας (καμία δεύτερη αντιστοίχιση)', () => {
    const value = listingObjectiveValue(home(), FRONTED, TODAY);
    expect(ready(objectiveValueImprovement(home(), FRONTED, TODAY)).bounds).toEqual(value.kind === 'evaluated' ? value.bounds : null);
  });

  it('κέρδος = πλάτος τώρα − το ΧΕΙΡΟΤΕΡΟ πλάτος μετά από κάθε απάντηση, υπολογισμένο από τη μηχανή', () => {
    const improvement = ready(objectiveValueImprovement(home(), FRONTED, TODAY));
    const after = RESIDENCE_FRONTAGES.map((frontage) => widthOf(home({ frontage })));
    expect(question(improvement, 'frontage')).toEqual({
      field: 'frontage',
      state: 'open',
      impact: { kind: 'narrows', amount: widthOf(home()) - Math.max(...after) },
    });
  });

  it('μέτωπο: κάθε απάντηση της λίστας (κανένα + κάθε δρόμος) περνά από τη μηχανή', () => {
    expect(zoneFrontAnswers(FRONTED)).toEqual([
      { kind: 'none' },
      { kind: 'street', street: 'Ακαδημίας' },
      { kind: 'street', street: 'Σίνα' },
    ]);
    const improvement = ready(objectiveValueImprovement(home({ frontage: 'single' }), FRONTED, TODAY));
    const width = boundsWidth(improvement.bounds) ?? Number.NaN;
    expect(width).toBeGreaterThan(0);
    // Με γνωστή πρόσοψη, κάθε απάντηση στο μέτωπο δίνει ποσό ⇒ το κέρδος είναι ΟΛΟ το εύρος.
    expect(question(improvement, 'zoneFront')).toMatchObject({ state: 'open', impact: { kind: 'narrows', amount: width } });
  });

  it('ανοιχτές πρώτες, κατά φθίνον κέρδος· οι υπόλοιπες μετά', () => {
    const improvement = ready(objectiveValueImprovement(home({ heatingType: 'heat-pump' }), FRONTED, TODAY));
    const open = improvement.questions.filter((candidate) => candidate.state === 'open');
    expect(improvement.questions.slice(0, open.length)).toEqual(open);
    const amounts = open.map((candidate) => (candidate.impact.kind === 'narrows' ? candidate.impact.amount : 0));
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it('χωρίς έτος κατασκευής ⇒ η άδεια ΞΕΚΛΕΙΔΩΝΕΙ τον υπολογισμό και έρχεται πρώτη', () => {
    const improvement = ready(objectiveValueImprovement(home({ constructionYear: null }), FRONTED, TODAY));
    expect(improvement.bounds.kind).toBe('unresolved');
    expect(improvement.questions[0]).toEqual({ field: 'permitDate', state: 'open', impact: { kind: 'unblocks' } });
    // Η πρόσοψη είναι κι αυτή στο `missing`, αλλά απαριθμείται (θα γινόταν όρια) — ΔΕΝ ξεκλειδώνει.
    expect(question(improvement, 'frontage')).toMatchObject({ state: 'open', impact: { kind: 'none' } });
  });

  it('ποσό ⇒ κανένα κέρδος να υποσχεθεί', () => {
    const improvement = ready(objectiveValueImprovement(home({ frontage: 'single' }), READY, TODAY));
    expect(improvement.bounds.kind).toBe('exact');
    expect(improvement.questions.every((candidate) => candidate.impact.kind === 'none')).toBe(true);
  });

  it('`boundsWidth`: ποσό = 0 · εύρος = high − low · χωρίς εύρος = null', () => {
    const draft = { ...INITIAL_DRAFT, levels: [{ floor: 4, area: 90 }], hasCentralHeating: true, hasElevator: true, permitDate: '1998-07-01' };
    expect(boundsWidth(objectiveValueBounds({ ...draft, frontage: 'single' }, TODAY, [2000]))).toBe(0);
    const range = objectiveValueBounds(draft, TODAY, [2000]);
    expect(boundsWidth(range)).toBe(range.kind === 'range' ? range.high - range.low : Number.NaN);
    expect(boundsWidth(objectiveValueBounds({ ...draft, permitDate: null }, TODAY, [2000]))).toBeNull();
  });
});

describe('πρόχειρο ⇄ δηλώσεις (τα ίδια χειριστήρια με τον υπολογιστή)', () => {
  const declarations: ObjectiveValueDeclarations = {
    ...UNDECLARED_OBJECTIVE_VALUE,
    frontage: 'multiple',
    hasElevator: true,
    permitDate: '2001-03-15',
    areaIncludesCommon: true,
  };

  it('οι δηλώσεις γίνονται πρόχειρο μόνο στα κοινά πεδία', () => {
    expect(draftOfDeclarations(declarations)).toEqual({
      ...INITIAL_DRAFT,
      frontage: 'multiple',
      hasCentralHeating: null,
      hasElevator: true,
      permitDate: '2001-03-15',
    });
  });

  it('αλλαγή του προχείρου ⇒ διόρθωση ΜΟΝΟ με τα πεδία που άλλαξαν· ξένα πεδία αγνοούνται', () => {
    expect(patchOfDraft({ hasElevator: false })).toEqual({ hasElevator: false });
    expect(patchOfDraft({ permitDate: null })).toEqual({ permitDate: null });
    expect(patchOfDraft({ commercialityFactor: 1.2 })).toBeNull();
  });

  it('ο καθαρισμός σβήνει ΑΚΡΙΒΩΣ ένα πεδίο, για κάθε δηλώσιμο', () => {
    for (const field of OBJECTIVE_VALUE_DECLARED_FIELDS) {
      const after = applyObjectiveValuePatch(declarations, clearedPatchOf(field));
      expect(after[field]).toBeNull();
      expect({ ...after, [field]: declarations[field] }).toEqual(declarations);
    }
  });
});
