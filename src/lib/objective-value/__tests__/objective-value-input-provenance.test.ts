/**
 * ADR-947 Φ1β — η προέλευση κάθε εισόδου του υπολογιστή: τέσσερα σκέλη, παράγωγα του προχείρου · προσυμπλήρωσης ·
 * θέσης. Ίση τιμή ≠ παράκαμψη · η επαναφορά επαναφέρει ακριβώς · το άρθρο έρχεται από τη μηχανή.
 */

import { computeObjectiveValue } from '../compute-objective-value';
import type { ObjectiveValueDeclaredReading } from '../objective-value-declared-reading';
import { draftToInput, INITIAL_DRAFT, type ObjectiveValueDraft } from '../objective-value-draft';
import {
  deriveInputProvenance,
  INPUT_FACTORS_OF,
  lawRefOf,
  PREFILL_PROVENANCE,
  type ObjectiveValueLocationFacts,
} from '../objective-value-input-provenance';

const TODAY = '2026-10-01';

const NO_ZONE: ObjectiveValueLocationFacts = { zonePrice: null, zonePriceFromSource: false, sourcedCommercialityFactor: null };

/** Ό,τι θα έφερνε μια αγγελία: κατοικία στον 2ο, 85 τ.μ., χωρίς κεντρική θέρμανση, με ανελκυστήρα. */
const PREFILL: Partial<ObjectiveValueDraft> = {
  form: 'residence',
  levels: [{ floor: 2, area: 85 }],
  hasCentralHeating: false,
  hasElevator: true,
};

const PREFILLED: ObjectiveValueDraft = { ...INITIAL_DRAFT, ...PREFILL };

function derive(draft: ObjectiveValueDraft, prefill: Partial<ObjectiveValueDraft> | null = PREFILL, location = NO_ZONE) {
  return deriveInputProvenance({ draft, prefill, location });
}

describe('σκέλος 1 — από το ακίνητο', () => {
  it('ό,τι ήρθε με την προσυμπλήρωση και δεν άλλαξε ⇒ «από το ακίνητο», δήλωση', () => {
    const provenance = derive(PREFILLED);
    const fromProperty = { kind: 'property', provenance: PREFILL_PROVENANCE };
    expect(provenance.fields.form).toEqual(fromProperty);
    expect(provenance.fields.hasCentralHeating).toEqual(fromProperty);
    expect(provenance.levels[0]).toEqual({ floor: fromProperty, area: fromProperty });
    expect(provenance.overrideCount).toBe(0);
    expect(provenance.revertAll).toBeNull();
  });

  it('η προέλευση της διεύθυνσης είναι ΔΗΛΩΣΗ — ποτέ κάτι ισχυρότερο (το URL το φτιάχνει οποιοσδήποτε)', () => {
    expect(PREFILL_PROVENANCE).toBe('declared');
  });

  it('ίση τιμή ≠ παράκαμψη: ξαναγραμμένη η ίδια τιμή μένει «από το ακίνητο»', () => {
    const provenance = derive({ ...PREFILLED, levels: [{ floor: 2, area: 85 }] });
    expect(provenance.levels[0]?.area).toEqual({ kind: 'property', provenance: 'declared' });
  });
});

describe('σκέλος 4 — δική σας τιμή, παράκαμψη με επαναφορά', () => {
  it('αλλαγμένο εμβαδόν ⇒ παράκαμψη με την αρχική τιμή, και η επαναφορά την ξαναγράφει ακριβώς', () => {
    const changed: ObjectiveValueDraft = { ...PREFILLED, levels: [{ floor: 2, area: 90 }] };
    const source = derive(changed).levels[0]?.area;
    expect(source).toMatchObject({ kind: 'user', overrides: { original: 85 } });
    if (source?.kind !== 'user' || source.overrides === null) throw new Error('αναμενόταν παράκαμψη');
    const reverted = { ...changed, ...source.overrides.revert };
    expect(reverted.levels).toEqual([{ floor: 2, area: 85 }]);
    expect(derive(reverted).overrideCount).toBe(0);
  });

  it('αλλαγμένη σημαία ⇒ παράκαμψη· η επαναφορά αγγίζει ΜΟΝΟ αυτό το πεδίο', () => {
    const source = derive({ ...PREFILLED, hasElevator: false }).fields.hasElevator;
    expect(source).toEqual({ kind: 'user', overrides: { original: true, revert: { hasElevator: true } } });
  });

  it('«επαναφορά όλων» επαναφέρει κάθε παράκαμψη — και τα επίπεδα ως σύνολο', () => {
    const changed: ObjectiveValueDraft = {
      ...PREFILLED,
      hasCentralHeating: true,
      levels: [{ floor: 3, area: 90 }],
    };
    const provenance = derive(changed);
    expect(provenance.overrideCount).toBe(3);
    const reverted = { ...changed, ...provenance.revertAll };
    expect(derive(reverted).overrideCount).toBe(0);
    expect(reverted.levels).toEqual(PREFILL.levels);
  });

  it('επίπεδο που πρόσθεσε ο άνθρωπος ⇒ «δική σας τιμή» χωρίς παράκαμψη', () => {
    const provenance = derive({ ...PREFILLED, levels: [{ floor: 2, area: 85 }, { floor: 3, area: 40 }] });
    expect(provenance.levels[1]).toEqual({ floor: { kind: 'user', overrides: null }, area: { kind: 'user', overrides: null } });
  });

  it('χωρίς προσυμπλήρωση: καμία «δική σας τιμή» (όλες είναι δικές σας — σήμα παντού θα ήταν θόρυβος)', () => {
    const provenance = derive({ ...INITIAL_DRAFT, levels: [{ floor: 2, area: 85 }], hasElevator: true }, null);
    expect(provenance.fields.hasElevator).toBeNull();
    expect(provenance.fields.form).toBeNull();
    expect(provenance.levels[0]).toEqual({ floor: null, area: null });
  });
});

describe('σκέλος 2 και 3 — ανοιχτά δεδομένα και υποθέσεις', () => {
  it('τιμή ζώνης από τα δεδομένα ζωνών ⇒ ανοιχτά δεδομένα· χειροκίνητη ⇒ δική σας', () => {
    const fromZones = derive(PREFILLED, PREFILL, { zonePrice: 2000, zonePriceFromSource: true, sourcedCommercialityFactor: null });
    expect(fromZones.zonePrice).toEqual({ kind: 'openData', source: 'valueZones' });
    const manual = derive(PREFILLED, PREFILL, { zonePrice: 2000, zonePriceFromSource: false, sourcedCommercialityFactor: null });
    expect(manual.zonePrice).toEqual({ kind: 'user', overrides: null });
  });

  it('ΣΕ: πηγή ⇒ ανοιχτά δεδομένα · «δεν τον ξέρω» ⇒ υπόθεση · πληκτρολογημένος ⇒ δική σας', () => {
    const sourced = derive(PREFILLED, PREFILL, { zonePrice: 2000, zonePriceFromSource: true, sourcedCommercialityFactor: 1.2 });
    expect(sourced.commercialityFactor).toEqual({ kind: 'openData', source: 'valueZones' });
    const assumed = derive({ ...PREFILLED, commercialityFactor: 1, commercialityAssumed: true });
    expect(assumed.commercialityFactor).toEqual({ kind: 'assumption', assumption: 'commercialityUnknown' });
    const typed = derive({ ...PREFILLED, commercialityFactor: 1.3 });
    expect(typed.commercialityFactor).toEqual({ kind: 'user', overrides: null });
  });

  it('μικτά χωρίς κοινόχρηστους χωρίς δήλωση ⇒ η κανονική υπόθεση του νόμου', () => {
    expect(derive(PREFILLED).fields.areaIncludesCommon).toEqual({ kind: 'assumption', assumption: 'areaWithoutCommon' });
  });

  it('θέση στάθμευσης χωρίς εμβαδόν ⇒ υπόθεση 20 τ.μ.· και τα πεδία κατοικίας δεν παίρνουν σήμα', () => {
    const provenance = derive({ ...INITIAL_DRAFT, form: 'parking' }, null);
    expect(provenance.fields.area).toEqual({ kind: 'assumption', assumption: 'parkingDefaultArea' });
    expect(provenance.fields.areaIncludesCommon).toBeNull();
    expect(provenance.levels).toEqual([]);
  });
});

describe('το άρθρο του νόμου — από την ανάλυση της μηχανής', () => {
  const computed = computeObjectiveValue(
    draftToInput(
      { ...PREFILLED, zonePrice: 2000, commercialityFactor: 1, frontage: 'single', permitDate: '2000-01-01' },
      TODAY,
    ),
  );

  it('ο υπολογισμός βγήκε ποσό (προϋπόθεση των υπολοίπων)', () => {
    expect(computed.kind).toBe('computed');
  });

  it('χωρίς κεντρική θέρμανση ⇒ το άρθρο και ο συντελεστής της μηχανής', () => {
    expect(lawRefOf('hasCentralHeating', computed)).toMatchObject({ kind: 'applied', ref: expect.stringContaining('§11α') });
  });

  it('με ανελκυστήρα ⇒ μετρά, αλλά ο συντελεστής είναι 1 (η μηχανή δεν τον καταγράφει) ⇒ «ουδέτερο», όχι σιωπή', () => {
    expect(lawRefOf('hasElevator', computed)).toEqual({ kind: 'neutral' });
  });

  it('είσοδος που δεν είναι συντελεστής, ή υπολογισμός χωρίς ποσό ⇒ κανένα άρθρο', () => {
    expect(lawRefOf('zonePrice', computed)).toEqual({ kind: 'none' });
    expect(lawRefOf('hasCentralHeating', computeObjectiveValue(draftToInput(INITIAL_DRAFT, TODAY)))).toEqual({ kind: 'none' });
  });

  it('κάθε είσοδος έχει γραμμή στον πίνακα συντελεστών (ολικότητα)', () => {
    expect(Object.keys(INPUT_FACTORS_OF).sort()).toEqual(
      [
        'area',
        'areaIncludesCommon',
        'commercialityFactor',
        'form',
        'frontage',
        'hasCentralHeating',
        'hasElevator',
        'levelArea',
        'levelFloor',
        'permitDate',
        'zonePrice',
      ].sort(),
    );
  });
});

describe('ADR-949 Α4 — «δηλώσατε από το έγγραφο»', () => {
  const source = { document: 'owner-e9', page: 2 } as const;
  const declared: readonly ObjectiveValueDeclaredReading[] = [
    { target: { input: 'levelFloor', level: 0 }, value: 1, source },
    { target: { input: 'levelArea', level: 0 }, value: 93.51, source },
  ];
  const fromE9: ObjectiveValueDraft = { ...INITIAL_DRAFT, levels: [{ floor: 1, area: 93.51 }] };

  it('χωρίς προσυμπλήρωση: η τιμή που αποδέχθηκε ο άνθρωπος παίρνει σήμα «δική σας, από το Ε9, σελ. 2»', () => {
    const provenance = deriveInputProvenance({ draft: fromE9, prefill: null, location: NO_ZONE, declared });
    expect(provenance.levels[0]).toEqual({
      floor: { kind: 'user', overrides: null, declaredFrom: source },
      area: { kind: 'user', overrides: null, declaredFrom: source },
    });
  });

  it('την άλλαξε μετά ⇒ η δήλωση χάνεται (παράγωγο, όχι αποθηκευμένο)', () => {
    const edited: ObjectiveValueDraft = { ...fromE9, levels: [{ floor: 1, area: 90 }] };
    const provenance = deriveInputProvenance({ draft: edited, prefill: null, location: NO_ZONE, declared });
    expect(provenance.levels[0].area).toBeNull();
    expect(provenance.levels[0].floor).toEqual({ kind: 'user', overrides: null, declaredFrom: source });
  });

  it('παρακάμπτει τιμή του ακινήτου ⇒ μένει παράκαμψη (με επαναφορά) ΚΑΙ λέει από πού', () => {
    const draft: ObjectiveValueDraft = { ...PREFILLED, levels: [{ floor: 1, area: 93.51 }] };
    const provenance = deriveInputProvenance({ draft, prefill: PREFILL, location: NO_ZONE, declared });
    expect(provenance.levels[0].area).toMatchObject({ kind: 'user', overrides: { original: 85 }, declaredFrom: source });
    expect(provenance.overrideCount).toBe(2);
  });

  it('ίδια τιμή με το ακίνητο ⇒ μένει «από το ακίνητο»', () => {
    const same: readonly ObjectiveValueDeclaredReading[] = [{ target: { input: 'levelArea', level: 0 }, value: 85, source }];
    const provenance = deriveInputProvenance({ draft: PREFILLED, prefill: PREFILL, location: NO_ZONE, declared: same });
    expect(provenance.levels[0].area).toEqual({ kind: 'property', provenance: PREFILL_PROVENANCE });
  });

  it('η επιφάνεια αποθήκης δηλώνεται στο πεδίο `area`, όχι στα επίπεδα', () => {
    const storage: ObjectiveValueDraft = { ...INITIAL_DRAFT, form: 'storage', area: 8.61 };
    const area: readonly ObjectiveValueDeclaredReading[] = [{ target: { input: 'area' }, value: 8.61, source }];
    const provenance = deriveInputProvenance({ draft: storage, prefill: null, location: NO_ZONE, declared: area });
    expect(provenance.fields.area).toEqual({ kind: 'user', overrides: null, declaredFrom: source });
  });

  it('ADR-949 Α-3: η ημερομηνία άδειας από την πράξη e-Άδειες ⇒ «δική σας, από την άδεια, σελ. 1» — όσο μένει ίδια', () => {
    const permitSource = { document: 'unit-permit', page: 1 } as const;
    const permit: readonly ObjectiveValueDeclaredReading[] = [{ target: { input: 'permitDate' }, value: '2020-06-09', source: permitSource }];
    const dated: ObjectiveValueDraft = { ...INITIAL_DRAFT, permitDate: '2020-06-09' };
    const provenance = deriveInputProvenance({ draft: dated, prefill: null, location: NO_ZONE, declared: permit });
    expect(provenance.fields.permitDate).toEqual({ kind: 'user', overrides: null, declaredFrom: permitSource });
    const edited = deriveInputProvenance({ draft: { ...dated, permitDate: '2019-01-01' }, prefill: null, location: NO_ZONE, declared: permit });
    expect(edited.fields.permitDate).toBeNull();
  });
});
