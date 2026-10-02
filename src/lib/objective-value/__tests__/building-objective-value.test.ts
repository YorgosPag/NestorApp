/**
 * ADR-898 Φ4 — η αντικειμενική μιας μονάδας μέσα στο κτίριό της: η ΙΔΙΑ βάση με την αγγελία, με επικάλυψη σταδίου /
 * άδειας / ΣΑΟ του κτιρίου. Ποτέ τεκμήριο «αποπερατωμένο», ποτέ μερικό άθροισμα ως σύνολο.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

import {
  buildingObjectiveValueTotal,
  buildingStageOf,
  buildingUnitObjectiveValue,
  type BuildingObjectiveValueContext,
  type BuildingUnitObjectiveValue,
} from '../building-objective-value';
import { readBuildingObjectiveValueFacts, type BuildingObjectiveValueFacts } from '../building-objective-value-facts';
import { listingObjectiveValueBasis, objectiveValueBasisOf } from '../listing-objective-value';
import { objectiveValueBounds } from '../objective-value-bounds';
import { UNDECLARED_OBJECTIVE_VALUE, type ObjectiveValueDeclarations } from '../objective-value-declarations';
import { INITIAL_DRAFT } from '../objective-value-draft';

const TODAY = '2026-10-02';

const READY: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 'z1', name: 'Θ', price: 2000, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

const DECLARED_2000 = { provenance: 'declared' as const, value: 2000, at: '2026-09-02T00:00:00.000Z' };

/** Β' όροφος (κανένας ανελκυστήρας), με όλα όσα ξέρει μια αγγελία — ώστε μόνο το κτίριο να κρίνει. */
const unit = (overrides: Parameters<typeof listing>[0] = {}) =>
  listing({ floor: 2, areaSqm: 90, heatingType: 'central', amenities: [], frontage: 'single', constructionYear: DECLARED_2000, ...overrides });

/** Οι ωμές δηλώσεις της μονάδας (ο εργολάβος τις βλέπει χωρίς την απόκρυψη). */
function declared(overrides: Partial<ObjectiveValueDeclarations> = {}) {
  const { display: _display, frontage: _frontage, ...rest } = { ...UNDECLARED_OBJECTIVE_VALUE, ...overrides };
  return rest;
}

const facts = (overrides: Partial<BuildingObjectiveValueFacts> = {}): BuildingObjectiveValueFacts => ({
  ...readBuildingObjectiveValueFacts(undefined),
  ...overrides,
});

const context = (
  stage: BuildingObjectiveValueContext['stage'],
  overrides: Partial<BuildingObjectiveValueFacts> = {},
): BuildingObjectiveValueContext => ({ stage, facts: facts(overrides) });

const valueOf = (ctx: BuildingObjectiveValueContext, listingOverrides: Parameters<typeof listing>[0] = {}, own = declared()) =>
  buildingUnitObjectiveValue(objectiveValueBasisOf(unit(listingOverrides), own, READY), ctx, TODAY);

const BASE_DRAFT = {
  ...INITIAL_DRAFT,
  levels: [{ floor: 2, area: 90 }],
  area: 90,
  frontage: 'single' as const,
  hasCentralHeating: true,
  hasElevator: false,
};

describe('buildingStageOf — χρονοδιάγραμμα > δήλωση > άγνωστο', () => {
  it('το χρονοδιάγραμμα αποφασίζει όταν έχει ετικέτες, ακόμη κι αν υπάρχει δήλωση', () => {
    const phases = [{ legalStage: 'frame' as const, status: 'completed' }];
    expect(buildingStageOf(phases, facts({ declaredStage: 'plaster' }))).toEqual({ source: 'schedule', stage: 'frame' });
  });

  it('χωρίς ετικέτες ⇒ η δήλωση · χωρίς δήλωση ⇒ άγνωστο', () => {
    expect(buildingStageOf([{ status: 'completed' }], facts({ declaredStage: 'masonry' }))).toEqual({ source: 'declared', stage: 'masonry' });
    expect(buildingStageOf([], facts())).toEqual({ source: 'unknown' });
  });
});

describe('buildingUnitObjectiveValue', () => {
  it('στάδιο άγνωστο ⇒ «τι λείπει: στάδιο» — ΠΟΤΕ τεκμήριο αποπερατωμένου', () => {
    expect(valueOf(context({ source: 'unknown' }))).toMatchObject({
      kind: 'evaluated',
      bounds: { kind: 'unresolved', result: { kind: 'needsInput', missing: ['completion'] } },
    });
  });

  it('ημιτελές (σκελετός) ⇒ ζητά ΣΑΟ · με ΣΑΟ ⇒ ο συντελεστής του νόμου, όχι παλαιότητα', () => {
    const noSao = valueOf(context({ source: 'schedule', stage: 'frame' }));
    expect(noSao).toMatchObject({ bounds: { kind: 'unresolved', result: { missing: ['plotUtilisation'] } } });

    const withSao = valueOf(context({ source: 'schedule', stage: 'frame' }, { plotUtilisation: 0.8 }));
    const expected = objectiveValueBounds({ ...BASE_DRAFT, residenceCompletion: 'frame', plotUtilisation: 0.8 }, TODAY, [2000]);
    expect(withSao).toMatchObject({ kind: 'evaluated', bounds: expected });
    expect(expected).toMatchObject({ kind: 'exact', result: { factors: expect.arrayContaining([{ key: 'completion', factor: 0.5, ref: 'ΠΟΛ.1149/1994 άρθ.3 §9' }]) } });
  });

  it('ρεύμα ⇒ αποπερατωμένο · η άδεια του ΚΤΙΡΙΟΥ καταργεί την προσέγγιση από το έτος', () => {
    const value = valueOf(context({ source: 'schedule', stage: 'electricity' }, { permitDate: '2025-03-01' }));
    const expected = objectiveValueBounds({ ...BASE_DRAFT, residenceCompletion: 'complete', permitDate: '2025-03-01' }, TODAY, [2000]);
    expect(value).toMatchObject({ kind: 'evaluated', bounds: expected });
    expect(value).toMatchObject({ kind: 'evaluated' });
    const kinds = value.kind === 'evaluated' ? value.assumptions.map((assumption) => assumption.kind) : [];
    expect(kinds).not.toContain('ageFromConstructionYear');
  });

  it('η άδεια της ΜΟΝΑΔΑΣ (δήλωση) υπερισχύει της άδειας του κτιρίου', () => {
    const own = declared({ permitDate: '2010-05-01' });
    const value = valueOf(context({ source: 'declared', stage: 'electricity' }, { permitDate: '2025-03-01' }), {}, own);
    const expected = objectiveValueBounds({ ...BASE_DRAFT, residenceCompletion: 'complete', permitDate: '2010-05-01' }, TODAY, [2000]);
    expect(value).toMatchObject({ bounds: expected });
  });

  it('χωρίς καμία άδεια ⇒ η προσέγγιση από το έτος μένει, ΔΗΛΩΜΕΝΗ', () => {
    const value = valueOf(context({ source: 'declared', stage: 'electricity' }));
    expect(value).toMatchObject({ assumptions: expect.arrayContaining([{ kind: 'ageFromConstructionYear', year: 2000, provenance: 'declared' }]) });
  });

  it('`none` ⇒ καμία αποτίμηση ακόμη · αποθήκη σε θεμελίωση ⇒ το ίδιο (ο νόμος δεν έχει συντελεστή)', () => {
    expect(valueOf(context({ source: 'schedule', stage: 'none' }))).toEqual({ kind: 'beforeStage', stage: 'none' });
    expect(valueOf(context({ source: 'schedule', stage: 'foundation' }), { type: 'storage' })).toEqual({ kind: 'beforeStage', stage: 'foundation' });
  });

  it('αποθήκη σε δάπεδα ⇒ επιχρίσματα (0,90, άρθ. 6 §8)', () => {
    const value = valueOf(context({ source: 'schedule', stage: 'flooring' }), { type: 'storage', areaSqm: 10 });
    const expected = objectiveValueBounds(
      { ...INITIAL_DRAFT, form: 'storage', levels: [{ floor: 2, area: 10 }], area: 10, ancillaryCompletion: 'plaster', residenceCompletion: null, permitDate: '1998-07-01' },
      TODAY,
      [2000],
    );
    expect(value).toMatchObject({ kind: 'evaluated', bounds: expected });
  });

  it('η απόκρυψη αφορά το κοινό: η αγγελία κρυμμένη, ο εργολάβος υπολογίζει', () => {
    const hidden = unit({ objectiveValueDeclarations: { display: 'hidden' } });
    expect(listingObjectiveValueBasis(hidden, READY)).toEqual({ kind: 'hidden' });
    expect(objectiveValueBasisOf(hidden, declared(), READY)).toMatchObject({ kind: 'ready' });
  });
});

describe('ανελκυστήρας — παράμετρος ΤΥΠΟΥ με υπέρβαση ανά μονάδα (ADR-898 §17)', () => {
  const COMPLETE = { source: 'declared' as const, stage: 'electricity' as const };
  /** Δ' όροφος χωρίς χαρακτηριστικά (`amenities: null`) ⇒ η μονάδα δεν ξέρει αν υπάρχει ανελκυστήρας. */
  const COMPLETE_DRAFT = { ...BASE_DRAFT, levels: [{ floor: 4, area: 90 }], residenceCompletion: 'complete' as const, permitDate: '1998-07-01' };
  const fourth = { floor: 4, amenities: null };
  const elevatorOf = (value: BuildingUnitObjectiveValue) =>
    value.kind === 'evaluated' && value.bounds.kind === 'exact'
      ? value.bounds.result.factors.find((factor) => factor.key === 'floor')
      : undefined;

  it('ούτε μονάδα ούτε κτίριο ⇒ όρια με ανοιχτή ερώτηση — ΠΟΤΕ «όχι» από σιωπή', () => {
    expect(valueOf(context(COMPLETE), fourth)).toMatchObject({ bounds: { kind: 'range', open: ['hasElevator'] }, inherited: ['stage'] });
  });

  it('το κτίριο απαντά ⇒ ένα ποσό, και η μονάδα λέει «από το κτίριο»', () => {
    const value = valueOf(context(COMPLETE, { hasElevator: true }), fourth);
    const expected = objectiveValueBounds(
      { ...COMPLETE_DRAFT, hasElevator: true },
      TODAY,
      [2000],
    );
    expect(value).toMatchObject({ kind: 'evaluated', bounds: expected, inherited: ['stage', 'hasElevator'] });
    expect(elevatorOf(value)).toBeDefined();
  });

  it('το χαρακτηριστικό της μονάδας νικά το κτίριο — και η προέλευση ΔΕΝ λέει «από το κτίριο»', () => {
    const value = valueOf(context(COMPLETE, { hasElevator: true }), { floor: 4 });
    const expected = objectiveValueBounds(COMPLETE_DRAFT, TODAY, [2000]);
    expect(value).toMatchObject({ bounds: expected, inherited: ['stage'] });
  });

  it('η δήλωση της μονάδας νικά το κτίριο', () => {
    const value = valueOf(context(COMPLETE, { hasElevator: true }), fourth, declared({ hasElevator: false }));
    expect(value).toMatchObject({ inherited: ['stage'] });
    const expected = objectiveValueBounds(COMPLETE_DRAFT, TODAY, [2000]);
    expect(value).toMatchObject({ bounds: expected });
  });

  it('αποθήκη: ο ανελκυστήρας του κτιρίου ΔΕΝ μπαίνει (τα έντυπα 4/5 δεν τον ρωτούν)', () => {
    const value = valueOf(context(COMPLETE, { hasElevator: true }), { ...fourth, type: 'storage', areaSqm: 10 });
    expect(value).toMatchObject({ kind: 'evaluated', inherited: ['stage'] });
  });
});

describe('προέλευση — «από το κτίριο» ΜΟΝΟ όπου είναι αλήθεια', () => {
  it('ΣΑΟ μόνο σε ημιτελή κατοικία · άδεια μόνο όταν η μονάδα δεν έχει δική της', () => {
    const sao = { plotUtilisation: 0.8, permitDate: '2025-03-01' };
    expect(valueOf(context({ source: 'schedule', stage: 'frame' }, sao))).toMatchObject({ inherited: ['stage', 'permitDate', 'plotUtilisation'] });
    expect(valueOf(context({ source: 'schedule', stage: 'electricity' }, sao))).toMatchObject({ inherited: ['stage', 'permitDate'] });
    const own = declared({ permitDate: '2010-05-01' });
    expect(valueOf(context({ source: 'schedule', stage: 'electricity' }, sao), {}, own)).toMatchObject({ inherited: ['stage'] });
  });

  it('στάδιο άγνωστο ⇒ τίποτα κληρονομημένο', () => {
    expect(valueOf(context({ source: 'unknown' }))).toMatchObject({ inherited: [] });
  });
});

describe('buildingObjectiveValueTotal — σύνολο μόνο όταν είναι αληθινό', () => {
  const exact = (value: number): BuildingUnitObjectiveValue => ({
    kind: 'evaluated',
    bounds: { kind: 'exact', commercialityAssumed: false, result: { kind: 'computed', form: 'residence', value, zonePrice: 1, area: 1, factors: [] } },
    levelBasis: { kind: 'single' },
    assumptions: [],
    inherited: [],
  });

  it('όλα ακριβή ⇒ άθροισμα σε λεπτά (χωρίς σφάλμα κινητής υποδιαστολής)', () => {
    expect(buildingObjectiveValueTotal([exact(0.1), exact(0.2), { kind: 'unsupported', reason: 'type' }])).toEqual({ kind: 'exact', value: 0.3, units: 2 });
  });

  it('έστω μία ελλιπής ⇒ ΚΑΝΕΝΑ ποσό, μόνο πόσες εκκρεμούν', () => {
    expect(buildingObjectiveValueTotal([exact(100), { kind: 'beforeStage', stage: 'none' }, { kind: 'no-zone' }])).toEqual({
      kind: 'incomplete',
      pending: 2,
      units: 3,
    });
  });
});
