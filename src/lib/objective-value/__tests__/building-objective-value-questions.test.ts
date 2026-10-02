/**
 * ADR-898 Φ4β — «απάντησε μία φορά για όλο το κτίριο»: ποιες ερωτήσεις των μονάδων κλείνει ένα γεγονός του κτιρίου.
 * Η μηχανή λέει τι λείπει· εδώ μόνο μετράμε και ταξινομούμε.
 */

import type { BuildingUnitObjectiveValue } from '../building-objective-value';
import {
  buildingPatchOfDraft,
  buildingQuestionsOf,
  clearedBuildingFactPatch,
  draftOfBuildingFacts,
} from '../building-objective-value-questions';
import type { ObjectiveValueMissing } from '../objective-value-types';
import type { OpenQuestion } from '../objective-value-bounds';

const evaluated = (bounds: Extract<BuildingUnitObjectiveValue, { kind: 'evaluated' }>['bounds']): BuildingUnitObjectiveValue => ({
  kind: 'evaluated',
  bounds,
  levelBasis: { kind: 'single' },
  assumptions: [],
  inherited: [],
});

const missing = (...gaps: ObjectiveValueMissing[]) =>
  evaluated({ kind: 'unresolved', result: { kind: 'needsInput', form: 'residence', missing: gaps } });

const open = (...gaps: OpenQuestion[]) =>
  evaluated({ kind: 'range', low: 1, high: 2, open: gaps, commercialityAssumed: false });

describe('buildingQuestionsOf', () => {
  it('μετρά μονάδες ανά γεγονός κτιρίου — από `missing` ΚΑΙ από `open`', () => {
    expect(buildingQuestionsOf([missing('completion'), missing('completion', 'area'), open('hasElevator'), missing('hasElevator')])).toEqual([
      { fact: 'declaredStage', units: 2 },
      { fact: 'hasElevator', units: 2 },
    ]);
  });

  it('η παλαιότητα κλείνει με την άδεια του κτιρίου · ο ΣΑΟ με τον ΣΑΟ', () => {
    expect(buildingQuestionsOf([missing('ageYears'), missing('plotUtilisation')])).toEqual([
      { fact: 'permitDate', units: 1 },
      { fact: 'plotUtilisation', units: 1 },
    ]);
  });

  it('ερωτήσεις της ΜΟΝΑΔΑΣ (πρόσοψη, εμβαδόν, μέτωπο) δεν γίνονται ερωτήσεις του κτιρίου', () => {
    expect(buildingQuestionsOf([missing('frontage', 'area', 'floor'), open('zoneFront', 'frontage')])).toEqual([]);
  });

  it('η θέρμανση ΕΙΝΑΙ πλέον ερώτηση του κτιρίου (ADR-898 §18.3) — μετά τον ανελκυστήρα', () => {
    expect(buildingQuestionsOf([open('hasCentralHeating', 'hasElevator'), missing('hasCentralHeating')])).toEqual([
      { fact: 'hasElevator', units: 1 },
      { fact: 'hasCentralHeating', units: 2 },
    ]);
  });

  it('ακριβές ποσό, «πριν από στάδιο», χωρίς ζώνη ⇒ τίποτα να ρωτηθεί', () => {
    const exact = evaluated({
      kind: 'exact',
      commercialityAssumed: false,
      result: { kind: 'computed', form: 'residence', value: 1, zonePrice: 1, area: 1, factors: [] },
    });
    expect(buildingQuestionsOf([exact, { kind: 'beforeStage', stage: 'none' }, { kind: 'no-zone' }])).toEqual([]);
  });

  it('η άκυρη είσοδος δεν κρύβει ό,τι ΕΠΙΣΗΣ λείπει', () => {
    const invalid = evaluated({ kind: 'unresolved', result: { kind: 'invalid', form: 'residence', problems: ['negativeAge'], missing: ['plotUtilisation'] } });
    expect(buildingQuestionsOf([invalid])).toEqual([{ fact: 'plotUtilisation', units: 1 }]);
  });
});

describe('γεγονότα κτιρίου ↔ πρόχειρο του υπολογιστή (ίδια χειριστήρια, ίδια διατύπωση)', () => {
  it('το πρόχειρο δείχνει ΜΟΝΟ τα γεγονότα που ρωτά ο υπολογιστής', () => {
    const facts = { permitDate: '2001-05-01', plotUtilisation: 0.8, declaredStage: 'frame' as const, hasElevator: true, hasCentralHeating: false };
    expect(draftOfBuildingFacts(facts)).toMatchObject({ permitDate: '2001-05-01', plotUtilisation: 0.8, hasElevator: true, hasCentralHeating: false });
  });

  it('αλλαγή προχείρου ⇒ διόρθωση ΜΟΝΟ με τα πεδία του κτιρίου · ξένα πεδία ⇒ τίποτα', () => {
    expect(buildingPatchOfDraft({ hasElevator: false })).toEqual({ hasElevator: false });
    expect(buildingPatchOfDraft({ hasCentralHeating: null })).toEqual({ hasCentralHeating: null });
    expect(buildingPatchOfDraft({ permitDate: null, frontage: 'single' })).toEqual({ permitDate: null });
    expect(buildingPatchOfDraft({ frontage: 'single' })).toBeNull();
  });

  it('καθαρισμός ⇒ ρητό `null` μόνο στο γεγονός', () => {
    expect(clearedBuildingFactPatch('hasElevator')).toEqual({ hasElevator: null });
    expect(clearedBuildingFactPatch('hasCentralHeating')).toEqual({ hasCentralHeating: null });
    expect(clearedBuildingFactPatch('declaredStage')).toEqual({ declaredStage: null });
  });
});
