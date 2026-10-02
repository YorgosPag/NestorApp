/**
 * ADR-898 Φ3β — **οι δηλώσεις της αντικειμενικής στη δημόσια αγγελία**: ιδιώτης και εταιρεία από τον ΙΔΙΟ δρόμο
 * (ωμό πεδίο ⇒ ο ένας αναγνώστης), πρόσοψη μόνο σε κατοικία, και απόκρυψη χωρίς κανένα στοιχείο υπολογισμού.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import {
  readObjectiveValueDeclarations,
  UNDECLARED_LISTING_OBJECTIVE_VALUE,
} from '@/lib/objective-value/objective-value-declarations';

import {
  projectFrontage,
  projectLevelAreas,
  projectObjectiveValueBasis,
  projectObjectiveValueDeclarations,
  withObjectiveValueDeclarations,
} from '../public-listing-objective-value';

const RAW = {
  display: 'shown',
  frontage: 'multiple',
  zoneFront: { kind: 'none' },
  areaIncludesCommon: true,
  permitDate: '1998-03-15',
  hasCentralHeating: null,
  hasElevator: false,
};

describe('projectFrontage — η πρόσοψη ως χαρακτηριστικό', () => {
  it('κατοικία ⇒ η δηλωμένη πρόσοψη', () => {
    expect(projectFrontage({ id: 'p1', type: 'apartment', objectiveValueDeclarations: RAW })).toEqual({ frontage: 'multiple' });
  });

  it('παλαιά ελληνική τιμή είδους κανονικοποιείται πριν κριθεί (`Μεζονέτα` = κατοικία)', () => {
    expect(projectFrontage({ id: 'p1', type: 'Μεζονέτα', objectiveValueDeclarations: RAW })).toEqual({ frontage: 'multiple' });
  });

  it.each(['storage', 'shop', 'plot', null])('είδος %s ⇒ `null` (η πρόσοψη του εντύπου 1 δεν ισχύει)', (type) => {
    expect(projectFrontage({ id: 'p1', type, objectiveValueDeclarations: RAW })).toEqual({ frontage: null });
  });

  it('άκυρη ή απούσα δήλωση ⇒ `null`, ποτέ μαντεψιά', () => {
    expect(projectFrontage({ id: 'p1', type: 'apartment', objectiveValueDeclarations: { frontage: 'corner' } })).toEqual({ frontage: null });
    expect(projectFrontage({ id: 'p1', type: 'apartment' })).toEqual({ frontage: null });
  });
});

describe('projectObjectiveValueDeclarations — τα στοιχεία υπολογισμού', () => {
  it('εμφάνιση ⇒ τα στοιχεία, χωρίς την πρόσοψη', () => {
    expect(projectObjectiveValueDeclarations({ id: 'p1', objectiveValueDeclarations: RAW })).toEqual({
      display: 'shown',
      declared: { zoneFront: { kind: 'none' }, areaIncludesCommon: true, permitDate: '1998-03-15', hasCentralHeating: null, hasElevator: false },
    });
  });

  it('🔴 απόκρυψη ⇒ ΜΟΝΟ η απόκρυψη', () => {
    expect(projectObjectiveValueDeclarations({ id: 'p1', objectiveValueDeclarations: { ...RAW, display: 'hidden' } })).toEqual({
      display: 'hidden',
    });
  });

  it('εταιρεία χωρίς το πεδίο (σημερινή αλήθεια) ⇒ τίποτα δηλωμένο, εμφάνιση εξ ορισμού', () => {
    expect(projectObjectiveValueDeclarations({ id: 'prop_1' })).toEqual(UNDECLARED_LISTING_OBJECTIVE_VALUE);
  });
});

describe('withObjectiveValueDeclarations — η βάση του server με άλλες δηλώσεις (ADR-898 Φ3β-3)', () => {
  const declarations = readObjectiveValueDeclarations(RAW);

  it('ΙΔΙΟ αποτέλεσμα με την προβολή: πρόσοψη + στοιχεία από τις ίδιες συναρτήσεις· τα υπόλοιπα πεδία ανέγγιχτα', () => {
    const base = listing({ type: 'apartment', frontage: null, areaSqm: 77 });
    const out = withObjectiveValueDeclarations(base, declarations);
    const source = { id: base.id, type: 'apartment', objectiveValueDeclarations: RAW };
    expect(out.frontage).toEqual(projectFrontage(source).frontage);
    expect(out.objectiveValueDeclarations).toEqual(projectObjectiveValueDeclarations(source));
    expect(out.areaSqm).toBe(77);
  });

  it('απόκρυψη ⇒ κανένα στοιχείο υπολογισμού, η πρόσοψη μένει (χαρακτηριστικό του ακινήτου)', () => {
    const out = withObjectiveValueDeclarations(listing({ type: 'apartment' }), { ...declarations, display: 'hidden' });
    expect(out.objectiveValueDeclarations).toEqual({ display: 'hidden' });
    expect(out.frontage).toBe('multiple');
  });

  it('ιδιοδύναμο', () => {
    const once = withObjectiveValueDeclarations(listing({ type: 'apartment' }), declarations);
    expect(withObjectiveValueDeclarations(once, declarations)).toEqual(once);
  });
});

describe('ADR-898 Φ3β-3β — το μικτό ανά όροφο: βάση υπολογισμού, πίσω από ΜΙΑ πύλη απόκρυψης', () => {
  const MAISONETTE = {
    id: 'p1',
    type: 'maisonette',
    levels: [
      { floorId: 'flr_0', floorNumber: 0 },
      { floorId: 'flr_1', floorNumber: 1 },
    ],
    levelData: { flr_0: { areas: { gross: 60 } }, flr_1: { areas: { gross: 40 } } },
    objectiveValueDeclarations: RAW,
  };
  const AREAS = [{ floor: 0, grossSqm: 60 }, { floor: 1, grossSqm: 40 }];

  it('κατοικία με συνεπή στοιχεία ⇒ ένα επίπεδο ανά όροφο', () => {
    expect(projectLevelAreas(MAISONETTE, 100)).toEqual(AREAS);
  });

  it('το άθροισμα ελέγχεται απέναντι στο εμβαδόν που ΔΗΜΟΣΙΕΥΕΙ η αγγελία', () => {
    expect(projectLevelAreas(MAISONETTE, 120)).toBeNull();
  });

  it('το δηλωμένο πλήθος (`layout.levels`) πρέπει να συμφωνεί', () => {
    expect(projectLevelAreas({ ...MAISONETTE, layout: { levels: 3 } }, 100)).toBeNull();
    expect(projectLevelAreas({ ...MAISONETTE, layout: { levels: 2 } }, 100)).toEqual(AREAS);
  });

  it.each(['storage', 'shop', null])('είδος %s ⇒ `null` (μόνο το έντυπο 1 υπολογίζει ανά όροφο)', (type) => {
    expect(projectLevelAreas({ ...MAISONETTE, type }, 100)).toBeNull();
  });

  it('ιδιώτης (χωρίς επίπεδα στο έγγραφο) ⇒ `null`', () => {
    expect(projectLevelAreas({ id: 'p1', type: 'apartment', objectiveValueDeclarations: RAW }, 100)).toBeNull();
  });

  it('εμφάνιση ⇒ οι δηλώσεις ΚΑΙ το μικτό ανά όροφο', () => {
    expect(projectObjectiveValueBasis(MAISONETTE, 100)).toMatchObject({ objectiveValueDeclarations: { display: 'shown' }, levelAreas: AREAS });
  });

  it('🔴 απόκρυψη ⇒ ΟΥΤΕ το μικτό ανά όροφο (ελαχιστοποίηση δεδομένων)', () => {
    const hidden = { ...MAISONETTE, objectiveValueDeclarations: { ...RAW, display: 'hidden' } };
    expect(projectObjectiveValueBasis(hidden, 100)).toEqual({ objectiveValueDeclarations: { display: 'hidden' }, levelAreas: null });
  });

  it('🔴 η επικάλυψη περνά από την ΙΔΙΑ πύλη: κρυμμένη ⇒ `null`, εμφανής ⇒ η βάση μένει', () => {
    const basis = listing({ type: 'maisonette', levelAreas: AREAS });
    const hidden = readObjectiveValueDeclarations({ ...RAW, display: 'hidden' });
    expect(withObjectiveValueDeclarations(basis, hidden).levelAreas).toBeNull();
    expect(withObjectiveValueDeclarations(basis, readObjectiveValueDeclarations(RAW)).levelAreas).toEqual(AREAS);
  });
});
