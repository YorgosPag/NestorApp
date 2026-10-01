/**
 * ADR-898 Φ2 — το πρόχειρο της οθόνης: «ρώτα μόνο ό,τι μετρά» **με τη μηχανή ως κριτή** (καμία δεύτερη υλοποίηση
 * του κανόνα στην οθόνη), και πιστή μετάφραση σε είσοδο της μηχανής.
 */

import { computeObjectiveValue } from '@/lib/objective-value/compute-objective-value';

import {
  draftToInput,
  INITIAL_DRAFT,
  missingOf,
  relevantQuestions,
  type ObjectiveValueDraft,
} from '../objective-value-draft';

const TODAY = '2026-10-01';

const residence = (patch: Partial<ObjectiveValueDraft>): ObjectiveValueDraft => ({
  ...INITIAL_DRAFT,
  zonePrice: 2000,
  levels: [{ floor: 1, area: 90 }],
  ...patch,
});

describe('relevantQuestions — η μηχανή αποφασίζει τι ρωτιέται', () => {
  it('χωρίς όροφο: ούτε ΣΕ ούτε ανελκυστήρας (δεν ξέρουμε ακόμη αν μετρούν)', () => {
    expect(relevantQuestions(INITIAL_DRAFT, TODAY)).toEqual(['frontage', 'hasCentralHeating', 'ageYears']);
  });

  it("Α' όροφος: ο ΣΕ μετρά, ο ανελκυστήρας όχι", () => {
    expect(relevantQuestions(residence({}), TODAY)).toEqual(['frontage', 'hasCentralHeating', 'commercialityFactor', 'ageYears']);
  });

  it("Ε' όροφος: ο ανελκυστήρας μετρά, ο ΣΕ όχι (ίδιος συντελεστής σε όλα τα κλιμάκια)", () => {
    expect(relevantQuestions(residence({ levels: [{ floor: 5, area: 90 }] }), TODAY)).toEqual([
      'frontage',
      'hasCentralHeating',
      'hasElevator',
      'ageYears',
    ]);
  });

  it('απάντηση που έπαψε να μετρά κρύβεται: ανελκυστήρας απαντημένος, όροφος → Α\'', () => {
    const draft = residence({ hasElevator: false, levels: [{ floor: 1, area: 90 }] });
    expect(relevantQuestions(draft, TODAY)).not.toContain('hasElevator');
  });

  it('ημιτελές: ΣΑΟ αντί για ημερομηνία άδειας', () => {
    const questions = relevantQuestions(residence({ residenceCompletion: 'masonry' }), TODAY);
    expect(questions).toContain('plotUtilisation');
    expect(questions).not.toContain('ageYears');
  });

  it('ανοιχτή θέση στάθμευσης: καμία από τις υπό όρο ερωτήσεις', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, form: 'parking', zonePrice: 1500, parkingPosition: 'yardOrRoof' };
    expect(relevantQuestions(draft, TODAY)).toEqual([]);
  });

  it('κλειστή θέση στάθμευσης: ΣΕ και παλαιότητα', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, form: 'parking', zonePrice: 1500, parkingPosition: 'closedBasement' };
    expect(relevantQuestions(draft, TODAY)).toEqual(['commercialityFactor', 'ageYears']);
  });
});

describe('draftToInput', () => {
  it('παλαιότητα από ημερομηνία άδειας με τον κανόνα του νόμου (τα 2 πρώτα έτη δεν μετρούν)', () => {
    const input = draftToInput(residence({ permitDate: '2010-03-15' }), TODAY);
    // 2012-03-15 → 2026-10-01: 14 έτη και 6 μήνες ⇒ 15.
    expect(input.ageYears).toBe(15);
  });

  it('ποσοστό κυριότητας σε % → κλάσμα· κενό = 100%', () => {
    expect(draftToInput(residence({ ownershipPct: 50 }), TODAY).ownershipShare).toBe(0.5);
    expect(draftToInput(residence({}), TODAY).ownershipShare).toBe(1);
  });

  it('πλήρες πρόχειρο κατοικίας ⇒ υπολογίζεται, ίδιο ποσό με απευθείας κλήση της μηχανής', () => {
    const draft = residence({
      frontage: 'single',
      hasCentralHeating: true,
      commercialityFactor: 1,
      permitDate: '2010-03-15',
    });
    const result = computeObjectiveValue(draftToInput(draft, TODAY));
    expect(result.kind).toBe('computed');
    expect(missingOf(result)).toEqual([]);
  });

  it('αποθήκη: θέση και ολοκλήρωση από τα δικά της πεδία', () => {
    const draft: ObjectiveValueDraft = { ...INITIAL_DRAFT, form: 'storage', area: 12, storagePosition: 'basementStreetEntrance' };
    expect(draftToInput(draft, TODAY)).toMatchObject({ form: 'storage', area: 12, position: 'basementStreetEntrance', completion: 'complete' });
  });
});
