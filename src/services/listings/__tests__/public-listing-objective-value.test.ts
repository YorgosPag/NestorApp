/**
 * ADR-898 Φ3β — **οι δηλώσεις της αντικειμενικής στη δημόσια αγγελία**: ιδιώτης και εταιρεία από τον ΙΔΙΟ δρόμο
 * (ωμό πεδίο ⇒ ο ένας αναγνώστης), πρόσοψη μόνο σε κατοικία, και απόκρυψη χωρίς κανένα στοιχείο υπολογισμού.
 */

import { UNDECLARED_LISTING_OBJECTIVE_VALUE } from '@/lib/objective-value/objective-value-declarations';

import { projectFrontage, projectObjectiveValueDeclarations } from '../public-listing-objective-value';

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
