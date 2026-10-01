/**
 * ADR-898 Φ3 — τα όρια του νόμου όταν κάτι έμεινε αναπάντητο. Οι αριθμοί του νόμου έχουν άγκυρες στο
 * `compute-objective-value.test.ts`· εδώ ελέγχεται η **απαρίθμηση**: κάθε όριο = η μηχανή σε έναν συνδυασμό απαντήσεων.
 */

import { computeObjectiveValue } from '../compute-objective-value';
import { ASSUMED_COMMERCIALITY_FACTOR, objectiveValueBounds } from '../objective-value-bounds';
import { draftToInput, INITIAL_DRAFT, type ObjectiveValueDraft } from '../objective-value-draft';
import { RESIDENCE_FRONTAGES, STORAGE_POSITIONS } from '../objective-value-types';

const TODAY = '2026-10-01';

const residence = (patch: Partial<ObjectiveValueDraft>): ObjectiveValueDraft => ({
  ...INITIAL_DRAFT,
  zonePrice: 2000,
  levels: [{ floor: 4, area: 90 }],
  frontage: 'single',
  hasCentralHeating: true,
  hasElevator: true,
  permitDate: '2000-03-15',
  ...patch,
});

function valueOf(draft: ObjectiveValueDraft): number {
  const result = computeObjectiveValue(draftToInput(draft, TODAY));
  if (result.kind !== 'computed') throw new Error(`αναμενόταν ποσό, ήρθε ${result.kind}`);
  return result.value;
}

describe('objectiveValueBounds', () => {
  it('τίποτα ανοιχτό ⇒ ακριβές ποσό, ίδιο με τη μηχανή, με την ανάλυσή της', () => {
    const draft = residence({});
    const bounds = objectiveValueBounds(draft, TODAY, []);
    expect(bounds.kind).toBe('exact');
    if (bounds.kind !== 'exact') return;
    expect(bounds.result.value).toBe(valueOf(draft));
    expect(bounds.commercialityAssumed).toBe(false);
  });

  it('πρόσοψη ανοιχτή ⇒ όρια = ελάχιστο/μέγιστο της μηχανής σε ΟΛΕΣ τις προσόψεις', () => {
    const bounds = objectiveValueBounds(residence({ frontage: null }), TODAY, []);
    const values = RESIDENCE_FRONTAGES.map((frontage) => valueOf(residence({ frontage })));
    expect(bounds).toEqual({
      kind: 'range',
      low: Math.min(...values),
      high: Math.max(...values),
      open: ['frontage'],
      commercialityAssumed: false,
    });
  });

  it('μέτωπο υπό όρο ⇒ η ζώνη και το μέτωπο είναι τα δύο άκρα (`zoneFront`)', () => {
    const bounds = objectiveValueBounds(residence({}), TODAY, [2000, 2600]);
    expect(bounds).toEqual({
      kind: 'range',
      low: valueOf(residence({ zonePrice: 2000 })),
      high: valueOf(residence({ zonePrice: 2600 })),
      open: ['zoneFront'],
      commercialityAssumed: false,
    });
  });

  it('πολλά ανοιχτά ⇒ όλοι οι συνδυασμοί, και η σειρά τους όπως τα ζήτησε η μηχανή', () => {
    const bounds = objectiveValueBounds(residence({ frontage: null, hasCentralHeating: null, hasElevator: null }), TODAY, []);
    expect(bounds.kind).toBe('range');
    if (bounds.kind !== 'range') return;
    expect([...bounds.open].sort()).toEqual(['frontage', 'hasCentralHeating', 'hasElevator']);
    expect(bounds.low).toBe(valueOf(residence({ frontage: 'narrow', hasCentralHeating: false, hasElevator: false })));
    expect(bounds.high).toBe(valueOf(residence({ frontage: 'multiple' })));
  });

  it('ανελκυστήρας σε Α\' όροφο δεν μετρά ⇒ δεν ανοίγει (η μηχανή είναι ο κριτής)', () => {
    const bounds = objectiveValueBounds(
      residence({ levels: [{ floor: 1, area: 90 }], commercialityFactor: 1.2, hasElevator: null }),
      TODAY,
      [],
    );
    expect(bounds.kind).toBe('exact');
  });

  it('ΣΕ άγνωστος όπου μετρά ⇒ 1,0 ΜΕ σήμανση — ποτέ σιωπηλά', () => {
    const draft = residence({ levels: [{ floor: 1, area: 90 }] });
    const bounds = objectiveValueBounds(draft, TODAY, []);
    expect(bounds).toMatchObject({ kind: 'exact', commercialityAssumed: true });
    if (bounds.kind !== 'exact') return;
    expect(bounds.result.value).toBe(valueOf({ ...draft, commercialityFactor: ASSUMED_COMMERCIALITY_FACTOR }));
  });

  it('ό,τι δεν απαριθμείται (επιφάνεια, παλαιότητα) ⇒ `unresolved` με το missing της μηχανής, όχι φαρδύ εύρος', () => {
    const bounds = objectiveValueBounds(residence({ levels: [{ floor: 4, area: null }], permitDate: null, frontage: null }), TODAY, []);
    expect(bounds.kind).toBe('unresolved');
    if (bounds.kind !== 'unresolved') return;
    expect(bounds.result.missing).toEqual(expect.arrayContaining(['area', 'ageYears', 'frontage']));
  });

  it('άκυρη είσοδος ⇒ `unresolved` με τα προβλήματα', () => {
    const bounds = objectiveValueBounds(residence({ levels: [{ floor: 4, area: -5 }] }), TODAY, []);
    expect(bounds).toMatchObject({ kind: 'unresolved', result: { kind: 'invalid' } });
  });

  it('αποθήκη χωρίς θέση ⇒ όρια σε όλες τις θέσεις του άρθ. 6 §4 (με ΣΕ 1,0 σημασμένο όπου μετρά)', () => {
    const storage: ObjectiveValueDraft = { ...INITIAL_DRAFT, form: 'storage', zonePrice: 2000, area: 10, permitDate: '2000-03-15' };
    const bounds = objectiveValueBounds(storage, TODAY, []);
    const values = STORAGE_POSITIONS.map((storagePosition) =>
      valueOf({ ...storage, storagePosition, commercialityFactor: ASSUMED_COMMERCIALITY_FACTOR }),
    );
    expect(bounds).toEqual({
      kind: 'range',
      low: Math.min(...values),
      high: Math.max(...values),
      open: ['position'],
      commercialityAssumed: true,
    });
  });
});
