/**
 * ADR-898 Φ3β — οι δηλώσεις του αγγελιοδότη: αυστηρή ανάγνωση (άκυρο ⇒ `null`, ποτέ «διόρθωση»), μερική διόρθωση
 * (μόνο ό,τι στάλθηκε· ρητό `null` σβήνει), σχήμα που απορρίπτει ό,τι δεν ξέρει, και δημόσια μορφή που στην
 * απόκρυψη δεν κρατά **κανένα** στοιχείο υπολογισμού.
 */

import {
  applyObjectiveValuePatch,
  declaredFieldsOf,
  isObjectiveValuePatchViolation,
  listingObjectiveValueDeclarationsOf,
  objectiveValueDeclarationsPatchSchema,
  objectiveValuePatchViolations,
  readListingObjectiveValueDeclarations,
  readObjectiveValueDeclarations,
  UNDECLARED_LISTING_OBJECTIVE_VALUE,
  UNDECLARED_OBJECTIVE_VALUE,
  type ObjectiveValueDeclarations,
} from '../objective-value-declarations';

const TODAY = '2026-10-01';

const FULL: ObjectiveValueDeclarations = {
  display: 'shown',
  frontage: 'multiple',
  zoneFront: { kind: 'street', street: 'Ακαδημίας' },
  areaIncludesCommon: true,
  permitDate: '1998-03-15',
  hasCentralHeating: false,
  hasElevator: true,
};

describe('readObjectiveValueDeclarations — το σύνορο ανάγνωσης', () => {
  it('απουσία (παλιό έγγραφο) ⇒ τίποτα δηλωμένο, εμφάνιση εξ ορισμού — ποτέ «κρυμμένη»', () => {
    expect(readObjectiveValueDeclarations(undefined)).toEqual(UNDECLARED_OBJECTIVE_VALUE);
    expect(readObjectiveValueDeclarations(null)).toEqual(UNDECLARED_OBJECTIVE_VALUE);
    expect(readObjectiveValueDeclarations([])).toEqual(UNDECLARED_OBJECTIVE_VALUE);
    expect(UNDECLARED_OBJECTIVE_VALUE.display).toBe('shown');
  });

  it('έγκυρη τιμή περνά αυτούσια — και η ανάγνωση είναι ιδιοδύναμη', () => {
    expect(readObjectiveValueDeclarations(FULL)).toEqual(FULL);
    expect(readObjectiveValueDeclarations(readObjectiveValueDeclarations(FULL))).toEqual(FULL);
  });

  it('κάθε άκυρο πεδίο ⇒ `null` για ΕΚΕΙΝΟ το πεδίο, τα υπόλοιπα μένουν', () => {
    const read = readObjectiveValueDeclarations({
      ...FULL,
      frontage: 'corner',
      permitDate: '1998-02-30',
      areaIncludesCommon: 'yes',
      zoneFront: { kind: 'street', street: '  Ακαδημίας' },
    });
    expect(read).toEqual({ ...FULL, frontage: null, permitDate: null, areaIncludesCommon: null, zoneFront: null });
  });

  it('`display` άγνωστο ⇒ εμφάνιση· μόνο το ρητό `hidden` κρύβει', () => {
    expect(readObjectiveValueDeclarations({ display: 'invisible' }).display).toBe('shown');
    expect(readObjectiveValueDeclarations({ display: 'hidden' }).display).toBe('hidden');
  });
});

describe('objectiveValueDeclarationsPatchSchema — η διόρθωση που δέχεται ο διακομιστής', () => {
  it.each([
    [{ frontage: 'single' }],
    [{ frontage: null }],
    [{ zoneFront: { kind: 'none' } }],
    [{ zoneFront: { kind: 'street', street: 'Ακαδημίας' } }],
    [{ permitDate: '1998-03-15', areaIncludesCommon: false }],
    [{ display: 'hidden' }],
  ])('δέχεται %j', (patch) => {
    expect(objectiveValueDeclarationsPatchSchema.safeParse(patch).success).toBe(true);
  });

  it.each([
    [{}],
    [{ unknownKey: true }],
    [{ frontage: 'corner' }],
    [{ permitDate: '1998-02-30' }],
    [{ permitDate: '15/03/1998' }],
    [{ zoneFront: { kind: 'street', street: '' } }],
    [{ zoneFront: { kind: 'street', street: ' Ακαδημίας ' } }],
    [{ zoneFront: { kind: 'street', street: 'Α'.repeat(201) } }],
    [{ zoneFront: { kind: 'none', street: 'Ακαδημίας' } }],
    [{ display: 'visible' }],
    [{ hasElevator: 'yes' }],
  ])('απορρίπτει %j', (patch) => {
    expect(objectiveValueDeclarationsPatchSchema.safeParse(patch).success).toBe(false);
  });

  it('ημερομηνία άδειας στο μέλλον ⇒ ονομασμένη άρνηση · σήμερα και χθες περνούν', () => {
    expect(objectiveValuePatchViolations({ permitDate: '2026-10-02' }, TODAY)).toEqual(['permitDateInFuture']);
    expect(objectiveValuePatchViolations({ permitDate: TODAY }, TODAY)).toEqual([]);
    expect(objectiveValuePatchViolations({ permitDate: null }, TODAY)).toEqual([]);
  });

  it('οι κωδικοί άρνησης αναγνωρίζονται στον πελάτη — και μόνο αυτοί', () => {
    expect(isObjectiveValuePatchViolation('permitDateInFuture')).toBe(true);
    expect(isObjectiveValuePatchViolation('zoneFrontNotCandidate')).toBe(true);
    expect(isObjectiveValuePatchViolation('area-required')).toBe(false);
  });
});

describe('applyObjectiveValuePatch — μερική διόρθωση', () => {
  it('αλλάζουν ΜΟΝΟ τα κλειδιά που στάλθηκαν', () => {
    expect(applyObjectiveValuePatch(FULL, { frontage: 'single' })).toEqual({ ...FULL, frontage: 'single' });
  });

  it('ρητό `null` σβήνει την απάντηση — δεν σημαίνει «όχι»', () => {
    expect(applyObjectiveValuePatch(FULL, { hasElevator: null }).hasElevator).toBeNull();
  });

  it('δύο διαδοχικές διορθώσεις συντίθενται (η δεύτερη δεν σβήνει την πρώτη)', () => {
    const once = applyObjectiveValuePatch(UNDECLARED_OBJECTIVE_VALUE, { frontage: 'single' });
    const twice = applyObjectiveValuePatch(once, { permitDate: '1998-03-15' });
    expect(twice).toEqual({ ...UNDECLARED_OBJECTIVE_VALUE, frontage: 'single', permitDate: '1998-03-15' });
  });
});

describe('η δημόσια μορφή — ελαχιστοποίηση δεδομένων', () => {
  it('εμφάνιση ⇒ τα στοιχεία υπολογισμού, ΧΩΡΙΣ την πρόσοψη (ζει ως χαρακτηριστικό)', () => {
    expect(listingObjectiveValueDeclarationsOf(FULL)).toEqual({
      display: 'shown',
      declared: {
        zoneFront: FULL.zoneFront,
        areaIncludesCommon: true,
        permitDate: '1998-03-15',
        hasCentralHeating: false,
        hasElevator: true,
      },
    });
  });

  it('🔴 απόκρυψη ⇒ ΚΑΝΕΝΑ στοιχείο από το οποίο ξαναβγαίνει το ποσό', () => {
    expect(listingObjectiveValueDeclarationsOf({ ...FULL, display: 'hidden' })).toEqual({ display: 'hidden' });
  });

  it('ο αναγνώστης της δημόσιας μορφής: απουσία ή μισό κουτί ⇒ τίποτα δηλωμένο · ιδιοδύναμος', () => {
    expect(readListingObjectiveValueDeclarations(undefined)).toEqual(UNDECLARED_LISTING_OBJECTIVE_VALUE);
    expect(readListingObjectiveValueDeclarations({ declared: {} })).toEqual(UNDECLARED_LISTING_OBJECTIVE_VALUE);
    const shown = listingObjectiveValueDeclarationsOf(FULL);
    expect(readListingObjectiveValueDeclarations(shown)).toEqual(shown);
    expect(readListingObjectiveValueDeclarations({ display: 'hidden', declared: FULL })).toEqual({ display: 'hidden' });
  });

  it('τα δηλωμένα στοιχεία, με τη σειρά της λίστας-πηγής', () => {
    expect(declaredFieldsOf({ hasElevator: true, frontage: 'single', permitDate: null })).toEqual(['frontage', 'hasElevator']);
  });
});
