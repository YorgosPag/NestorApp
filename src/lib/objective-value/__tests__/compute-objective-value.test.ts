/**
 * Μηχανή αντικειμενικής αξίας (ADR-898) — παραδείγματα υπολογισμένα **με το χέρι** από τους πίνακες της
 * ΠΟΛ.1149/1994. Κάθε αναμενόμενο ποσό γράφεται ως γινόμενο, ώστε να διαβάζεται ποιος συντελεστής μπήκε.
 */

import { computeObjectiveValue } from '../compute-objective-value';
import { legalAgeYears } from '../objective-value-common';
import type { ObjectiveValueResult, ResidenceInput } from '../objective-value-types';

const flat = (overrides: Partial<ResidenceInput> = {}): ResidenceInput => ({
  form: 'residence',
  zonePrice: 2000,
  commercialityFactor: 1,
  levels: [{ floor: 2, area: 90 }],
  frontage: 'single',
  hasCentralHeating: true,
  ageYears: 30,
  ...overrides,
});

function valueOf(result: ObjectiveValueResult): number {
  if (result.kind !== 'computed') throw new Error(`αναμενόταν υπολογισμός, ήρθε ${result.kind}`);
  return result.value;
}

describe('έντυπο 1 — κατοικία', () => {
  it('Β όροφος, 90 τ.μ., 30 ετών: ΤΖ × Ε × όροφος 1,05 × παλαιότητα 0,60', () => {
    expect(valueOf(computeObjectiveValue(flat()))).toBeCloseTo(2000 * 90 * 1.05 * 0.6, 2);
  });

  it('Ε όροφος: ΔΕΝ ζητά ΣΕ (ίδιος συντελεστής σε όλα τα κλιμάκια), ζητά ανελκυστήρα', () => {
    const result = computeObjectiveValue(flat({ commercialityFactor: null, levels: [{ floor: 5, area: 90 }] }));
    expect(result).toEqual({ kind: 'needsInput', form: 'residence', missing: ['hasElevator'] });
  });

  it('Ε όροφος χωρίς ανελκυστήρα: 1,20 × 0,90', () => {
    const input = flat({ commercialityFactor: null, levels: [{ floor: 5, area: 90 }], hasElevator: false });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * 90 * 1.2 * 0.9 * 0.6, 2);
  });

  it('ισόγειο χωρίς ΣΕ: τον ζητά — ο συντελεστής του ισογείου κυμαίνεται 0,90-1,30', () => {
    const result = computeObjectiveValue(flat({ commercialityFactor: null, levels: [{ floor: 0, area: 90 }] }));
    expect(result).toEqual({ kind: 'needsInput', form: 'residence', missing: ['commercialityFactor'] });
  });

  it('ισόγειο με ΣΕ 2,0 ⇒ 1,20', () => {
    const input = flat({ commercialityFactor: 2, levels: [{ floor: 0, area: 90 }] });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * 90 * 1.2 * 0.6, 2);
  });

  it('ισόγειο με ΣΕ 4 ⇒ 1,25 · με ΣΕ 6 ⇒ 1,30 (κλιμάκια 3–5 και ≥5)', () => {
    const at = (se: number) => flat({ commercialityFactor: se, levels: [{ floor: 0, area: 90 }] });
    expect(valueOf(computeObjectiveValue(at(4)))).toBeCloseTo(2000 * 90 * 1.25 * 0.6, 2);
    expect(valueOf(computeObjectiveValue(at(6)))).toBeCloseTo(2000 * 90 * 1.3 * 0.6, 2);
  });

  it('Γ όροφος: ΖΗΤΑ ΣΕ (1,10 κάτω από 5, 1,15 από 5) — ο Δ ΔΕΝ ζητά (1,15 παντού)', () => {
    const third = computeObjectiveValue(flat({ commercialityFactor: null, levels: [{ floor: 3, area: 90 }], hasElevator: true }));
    expect(third).toEqual({ kind: 'needsInput', form: 'residence', missing: ['commercialityFactor'] });
    const fourth = flat({ commercialityFactor: null, levels: [{ floor: 4, area: 90 }], hasElevator: true });
    expect(valueOf(computeObjectiveValue(fourth))).toBeCloseTo(2000 * 90 * 1.15 * 0.6, 2);
    const thirdLowSe = flat({ levels: [{ floor: 3, area: 90 }], hasElevator: true });
    expect(valueOf(computeObjectiveValue(thirdLowSe))).toBeCloseTo(2000 * 90 * 1.1 * 0.6, 2);
  });

  it('μεζονέτα: όροφος ανά επίπεδο, ΕΝΙΑΙΟΣ συντελεστής επιφάνειας από το άθροισμα (130 τ.μ. ⇒ 1,05)', () => {
    const input = flat({ levels: [{ floor: 1, area: 70 }, { floor: 2, area: 60 }], ageYears: 0, commercialityFactor: 1.2 });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * (70 * 1.0 + 60 * 1.05) * 1.05, 2);
  });

  it('μικτή επιφάνεια 110 τ.μ.: × 0,90 και το κλιμάκιο κρίνεται στα 99 (1,00, όχι 1,05)', () => {
    const input = flat({ levels: [{ floor: 1, area: 110 }], areaIncludesCommon: true });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * 110 * 0.9 * 1.0 * 0.6, 2);
  });

  it('ημιτελές στον σκελετό με ΣΑΟ 1,6 ⇒ 0,40, χωρίς παλαιότητα', () => {
    const input = flat({ levels: [{ floor: 1, area: 100 }], ageYears: null, completion: 'frame', plotUtilisation: 1.6 });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * 100 * 1.0 * 0.4, 2);
  });

  it('ημιτελές χωρίς ΣΑΟ: τον ζητά', () => {
    const result = computeObjectiveValue(flat({ ageYears: null, completion: 'masonry' }));
    expect(result).toEqual({ kind: 'needsInput', form: 'residence', missing: ['plotUtilisation'] });
  });

  it('στάδιο θεμελίωσης σε όροφο: άκυρο (μόνο υπόγειο/ισόγειο)', () => {
    const result = computeObjectiveValue(flat({ completion: 'foundation', plotUtilisation: 0.8 }));
    expect(result).toEqual({ kind: 'invalid', form: 'residence', problems: ['foundationStageAboveGround'], missing: [] });
  });

  it('συνιδιοκτησία 50%: × 0,90 × 0,50', () => {
    const input = flat({ coOwned: true, ownershipShare: 0.5 });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * 90 * 1.05 * 0.6 * 0.9 * 0.5, 2);
  });

  it('ζημιές: 1 − δαπάνη / αξία ⇒ αφαιρείται ακριβώς η δαπάνη', () => {
    const before = 2000 * 90 * 1.05 * 0.6;
    expect(valueOf(computeObjectiveValue(flat({ damageRestorationCost: 13_400 })))).toBeCloseTo(before - 13_400, 2);
  });

  it('απαλλοτριωτέο με δύο προσόψεις: η προσαύξηση 1,05 ΔΕΝ ισχύει, μένει 0,75', () => {
    const input = flat({ frontage: 'multiple', encumbrance: 'expropriated' });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * 90 * 1.05 * 0.6 * 0.75, 2);
  });

  it('χωρίς κεντρική θέρμανση, πέτρινοι τοίχοι, διατηρητέο', () => {
    const input = flat({ hasCentralHeating: false, thickWalls: true, encumbrance: 'listed' });
    expect(valueOf(computeObjectiveValue(input))).toBeCloseTo(2000 * 90 * 1.05 * 0.6 * 0.95 * 0.9 * 0.8, 2);
  });

  it('η ανάλυση κρατά παραπομπή στον νόμο για κάθε συντελεστή', () => {
    const result = computeObjectiveValue(flat());
    if (result.kind !== 'computed') throw new Error(result.kind);
    expect(result.factors.map((f) => [f.key, f.factor, f.ref])).toEqual([
      ['floor', 1.05, 'ΠΟΛ.1149/1994 άρθ.3 §4'],
      ['age', 0.6, 'ΠΟΛ.1149/1994 άρθ.3 §7'],
    ]);
  });

  it('άκυρη τιμή ΚΑΙ ελλείψεις: το `invalid` κρατά και το `missing` (η φόρμα δεν ξεχνά ερωτήσεις)', () => {
    const result = computeObjectiveValue(flat({ commercialityFactor: 0.8, hasCentralHeating: null }));
    expect(result).toEqual({
      kind: 'invalid',
      form: 'residence',
      problems: ['commercialityBelowOne'],
      missing: ['hasCentralHeating'],
    });
  });

  it('άκυρες τιμές: ΤΖ 0, ΣΕ < 1', () => {
    const result = computeObjectiveValue(flat({ zonePrice: 0, commercialityFactor: 0.8 }));
    expect(result).toEqual({ kind: 'invalid', form: 'residence', problems: ['nonPositiveZonePrice', 'commercialityBelowOne'], missing: [] });
  });
});

describe('έντυπο 4 — αποθήκη', () => {
  it('υπόγειο με είσοδο από δρόμο: 0,25 × ΣΕ, παλαιότητα αποθήκης 0,70 (όχι 0,60)', () => {
    const result = computeObjectiveValue({
      form: 'storage', zonePrice: 2000, commercialityFactor: 1.2, area: 10, position: 'basementStreetEntrance', ageYears: 30,
    });
    expect(valueOf(result)).toBeCloseTo(2000 * 10 * 0.25 * 1.2 * 0.7, 2);
  });

  it('υπόγειο με είσοδο από κλιμακοστάσιο: σταθερό 0,15, χωρίς ΣΕ', () => {
    const result = computeObjectiveValue({
      form: 'storage', zonePrice: 2000, area: 10, position: 'basementInternalEntrance', ageYears: 3,
    });
    expect(valueOf(result)).toBeCloseTo(2000 * 10 * 0.15 * 0.95, 2);
  });
});

describe('έντυπο 5 — θέση στάθμευσης', () => {
  it('κλειστή υπόγεια, ΣΕ 1, χωρίς επιφάνεια στον τίτλο ⇒ 20 τ.μ., 10 ετών 0,90', () => {
    const result = computeObjectiveValue({
      form: 'parking', zonePrice: 2000, commercialityFactor: 1, area: null, position: 'closedBasement', ageYears: 10,
    });
    expect(valueOf(result)).toBeCloseTo(2000 * 20 * 0.2 * 0.9, 2);
  });

  it('πυλωτή: μόνο 0,15 — καμία παλαιότητα, κανένας ΣΕ', () => {
    const result = computeObjectiveValue({ form: 'parking', zonePrice: 2000, area: 12, position: 'pilotis' });
    expect(valueOf(result)).toBeCloseTo(2000 * 12 * 0.15, 2);
  });

  it('πρόχειρη κλειστή θέση με λαμαρίνα: 0,80 × 0,90 — ΟΧΙ οι 0,70 × 0,80 της αποθήκης', () => {
    const shared = { zonePrice: 2000, commercialityFactor: 1, area: 10, ageYears: 0, construction: 'makeshift', lightRoof: true } as const;
    const parking = computeObjectiveValue({ form: 'parking', position: 'closedBasement', ...shared });
    expect(valueOf(parking)).toBeCloseTo(2000 * 10 * 0.2 * 0.8 * 0.9, 2);
    const storage = computeObjectiveValue({ form: 'storage', position: 'basementInternalEntrance', ...shared });
    expect(valueOf(storage)).toBeCloseTo(2000 * 10 * 0.15 * 0.7 * 0.8, 2);
  });

  it('κλειστή ισόγεια με ΣΕ 2,5 ⇒ 0,40', () => {
    const result = computeObjectiveValue({
      form: 'parking', zonePrice: 2000, commercialityFactor: 2.5, area: 15, position: 'closedGround', ageYears: 0,
    });
    expect(valueOf(result)).toBeCloseTo(2000 * 15 * 0.4, 2);
  });
});

describe('παλαιότητα κατά νόμο (άρθ. 2 §20)', () => {
  it('το παράδειγμα του νόμου: άδεια 30.9.1978 ⇒ μετράει από 30.9.1980', () => {
    expect(legalAgeYears('1978-09-30', '1980-09-29')).toBe(0);
    expect(legalAgeYears('1978-09-30', '2026-09-30')).toBe(46);
  });

  it('υπόλοιπο < 6 μηνών δεν μετρά, ≥ 6 μηνών μετρά ως έτος', () => {
    expect(legalAgeYears('1978-09-30', '2026-03-29')).toBe(45);
    expect(legalAgeYears('1978-09-30', '2026-03-30')).toBe(46);
  });

  it('μη έγκυρη ημερομηνία ⇒ null', () => {
    expect(legalAgeYears('30/09/1978', '2026-03-30')).toBeNull();
  });
});
