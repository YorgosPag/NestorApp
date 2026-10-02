/**
 * ADR-898 Φ3 — η αντικειμενική αξία μιας δημόσιας αγγελίας: ΜΙΑ πηγή ανά είσοδο, δηλωμένες υποθέσεις, και ποτέ
 * σιωπηλή μαντεψιά (πρόσοψη/μέτωπο ⇒ όρια).
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { PublicListing } from '@/types/public-listing';

import { CENTRAL_HEATING_OF, listingObjectiveValue } from '../listing-objective-value';
import { legalAgeYears } from '../objective-value-common';
import { objectiveValueBounds } from '../objective-value-bounds';
import {
  listingObjectiveValueDeclarationsOf,
  UNDECLARED_OBJECTIVE_VALUE,
  type ObjectiveValueDeclarations,
} from '../objective-value-declarations';
import { INITIAL_DRAFT } from '../objective-value-draft';

const TODAY = '2026-10-01';

const READY: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 'z1', name: 'Θ', price: 2000, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

const DECLARED_2000 = { provenance: 'declared' as const, value: 2000, at: '2026-09-02T00:00:00.000Z' };

/** Οι δηλώσεις του αγγελιοδότη στη δημόσια μορφή — η πρόσοψη ζει στο `frontage` της αγγελίας. */
const declared = (declarations: Partial<ObjectiveValueDeclarations>) =>
  listingObjectiveValueDeclarationsOf({ ...UNDECLARED_OBJECTIVE_VALUE, ...declarations });

const FRONTED: ValueZoneVerdict = {
  ...READY,
  fronts: [{ id: 'f1', name: 'Μ1', price: 2600, validFrom: '2022-01-01', street: 'Ακαδημίας', distanceM: 10 }],
};

const home = (overrides: Parameters<typeof listing>[0] = {}) =>
  listing({ floor: 4, areaSqm: 90, heatingType: 'central', amenities: ['elevator'], constructionYear: DECLARED_2000, ...overrides });

describe('listingObjectiveValue', () => {
  it('διαμέρισμα με όλα τα στοιχεία της αγγελίας ⇒ μόνο η πρόσοψη ανοιχτή (η θέση δεν την αποδεικνύει)', () => {
    const value = listingObjectiveValue(home(), READY, TODAY);
    expect(value).toMatchObject({ kind: 'evaluated', bounds: { kind: 'range', open: ['frontage'], commercialityAssumed: false } });
  });

  it('η αντιστοίχιση είναι ακριβώς: όροφος · μικτό · θέρμανση · ανελκυστήρας · άδεια = έτος − 2, στο μέσο του έτους', () => {
    const value = listingObjectiveValue(home(), READY, TODAY);
    const draft = {
      ...INITIAL_DRAFT,
      levels: [{ floor: 4, area: 90 }],
      area: 90,
      hasCentralHeating: true,
      hasElevator: true,
      permitDate: '1998-07-01',
    };
    expect(value).toMatchObject({ bounds: objectiveValueBounds(draft, TODAY, [2000]) });
    expect(legalAgeYears('1998-07-01', TODAY)).toBe(26);
  });

  it('οι υποθέσεις δηλώνονται: παλαιότητα από έτος (με την πηγή του) · εμβαδόν χωρίς κοινόχρηστους', () => {
    expect(listingObjectiveValue(home(), READY, TODAY)).toMatchObject({
      assumptions: [{ kind: 'ageFromConstructionYear', year: 2000, provenance: 'declared' }, { kind: 'areaWithoutCommon' }],
    });
  });

  it('θέρμανση: ο νόμος κρίνει την ΕΓΚΑΤΑΣΤΑΣΗ (άρθ. 3 §11) — αυτόνομη = ναι · αντλία/ηλιακά = ανοιχτό', () => {
    expect(CENTRAL_HEATING_OF).toEqual({ central: true, autonomous: true, 'heat-pump': null, solar: null, none: false });
    const value = listingObjectiveValue(home({ heatingType: 'heat-pump' }), READY, TODAY);
    expect(value).toMatchObject({ bounds: { kind: 'range', open: expect.arrayContaining(['hasCentralHeating']) } });
  });

  it('ανελκυστήρας: `amenities: null` = δεν ρωτήθηκε ⇒ ανοιχτό · `[]` = ρωτήθηκε, όχι ⇒ συντελεστής 0,90', () => {
    const unasked = listingObjectiveValue(home({ amenities: null }), READY, TODAY);
    expect(unasked).toMatchObject({ bounds: { open: expect.arrayContaining(['hasElevator']) } });
    const without = listingObjectiveValue(home({ amenities: [] }), READY, TODAY);
    expect(without).toMatchObject({ prefill: { hasElevator: false } });
  });

  it('μέτωπα υπό όρο ⇒ ανοίγει και το `zoneFront`', () => {
    const fronted: ValueZoneVerdict = {
      ...READY,
      fronts: [{ id: 'f1', name: 'Μ1', price: 2600, validFrom: '2022-01-01', street: 'Ακαδημίας', distanceM: 10 }],
    };
    expect(listingObjectiveValue(home(), fronted, TODAY)).toMatchObject({ bounds: { open: ['zoneFront', 'frontage'] } });
  });

  it('χωρίς έτος κατασκευής ⇒ τι λείπει (η παλαιότητα δεν απαριθμείται)', () => {
    const value = listingObjectiveValue(home({ constructionYear: null }), READY, TODAY);
    expect(value).toMatchObject({ bounds: { kind: 'unresolved', result: { missing: expect.arrayContaining(['ageYears']) } } });
  });

  it.each(['shop', 'office', 'hall', 'plot', 'parcel'] as const)('%s ⇒ εκτός εμβέλειας (ADR-898 §7)', (type) => {
    expect(listingObjectiveValue(home({ type }), READY, TODAY)).toEqual({ kind: 'unsupported', reason: 'type' });
  });

  describe('ADR-898 Φ3β-3β — πολυεπίπεδο: ένα επίπεδο ανά όροφο (ΠΟΛ.1149/1994 άρθ. 3 §6.β), ποτέ εικασία', () => {
    const twoLevels = { provenance: 'declared' as const, value: 2, at: '2026-09-02T00:00:00.000Z' };
    const maisonette = (levelAreas: PublicListing['levelAreas']) =>
      home({ floor: 0, areaSqm: 100, levels: twoLevels, levelAreas });
    const perLevelDraft = {
      ...INITIAL_DRAFT,
      levels: [{ floor: 0, area: 60 }, { floor: 1, area: 40 }],
      area: 100,
      hasCentralHeating: true,
      hasElevator: true,
      permitDate: '1998-07-01',
    };

    it('με βάση ανά όροφο ⇒ ο υπολογισμός της μηχανής πάνω στα ΔΥΟ επίπεδα', () => {
      const value = listingObjectiveValue(maisonette([{ floor: 0, grossSqm: 60 }, { floor: 1, grossSqm: 40 }]), READY, TODAY);
      expect(value).toMatchObject({ kind: 'evaluated', levelBasis: { kind: 'perLevel' }, bounds: objectiveValueBounds(perLevelDraft, TODAY, [2000]) });
      expect(value).toMatchObject({ prefill: { floor: null, area: null, levels: perLevelDraft.levels } });
    });

    it('ΟΧΙ ο κανόνας του Ε9 ούτε όλο το εμβαδόν στον όροφο εισόδου: διαφορετικό ποσό από το «ένα επίπεδο»', () => {
      const perLevel = listingObjectiveValue(maisonette([{ floor: 0, grossSqm: 60 }, { floor: 1, grossSqm: 40 }]), READY, TODAY);
      for (const floor of [0, 1]) {
        const lumped = objectiveValueBounds({ ...perLevelDraft, levels: [{ floor, area: 100 }] }, TODAY, [2000]);
        expect(perLevel).not.toMatchObject({ bounds: lumped });
      }
    });

    it('χωρίς βάση ανά όροφο ⇒ «τι λείπει» (όροφος, επιφάνεια) — και ο υπολογιστής ΔΕΝ προσυμπληρώνεται με το σύνολο', () => {
      const value = listingObjectiveValue(maisonette(null), READY, TODAY);
      expect(value).toMatchObject({
        kind: 'evaluated',
        levelBasis: { kind: 'missing', count: 2 },
        bounds: { kind: 'unresolved', result: { missing: expect.arrayContaining(['floor', 'area']) } },
        prefill: { floor: null, area: null, levels: null },
      });
    });

    it('πλήθος επιπέδων ≠ βάση ⇒ «τι λείπει», ποτέ μερικός υπολογισμός', () => {
      const three = { ...twoLevels, value: 3 };
      const value = listingObjectiveValue(
        home({ areaSqm: 100, levels: three, levelAreas: [{ floor: 0, grossSqm: 60 }, { floor: 1, grossSqm: 40 }] }),
        READY,
        TODAY,
      );
      expect(value).toMatchObject({ levelBasis: { kind: 'missing', count: 3 }, bounds: { kind: 'unresolved' } });
    });

    it('ένα επίπεδο ⇒ όροφος + μικτό της αγγελίας, όπως πάντα', () => {
      expect(listingObjectiveValue(home(), READY, TODAY)).toMatchObject({ levelBasis: { kind: 'single' }, prefill: { floor: 4, area: 90, levels: null } });
    });
  });

  it.each<ValueZoneVerdict>([{ kind: 'imprecise' }, { kind: 'outside' }, { kind: 'unavailable' }])('ζώνη $kind ⇒ no-zone', (verdict) => {
    expect(listingObjectiveValue(home(), verdict, TODAY)).toEqual({ kind: 'no-zone' });
  });

  it('αποθήκη ⇒ έντυπο 4, η θέση της ανοιχτή', () => {
    expect(listingObjectiveValue(home({ type: 'storage', areaSqm: 12 }), READY, TODAY)).toMatchObject({
      bounds: { kind: 'range', open: ['position'] },
      assumptions: [{ kind: 'ageFromConstructionYear' }],
      prefill: { form: 'storage', area: 12 },
    });
  });
});

describe('listingObjectiveValue — οι δηλώσεις του αγγελιοδότη (ADR-898 Φ3β)', () => {
  const evaluated = (value: ReturnType<typeof listingObjectiveValue>) => {
    if (value.kind !== 'evaluated') throw new Error(`αναμενόταν αποτίμηση, ήρθε ${value.kind}`);
    return value;
  };
  const exact = (value: ReturnType<typeof listingObjectiveValue>) => {
    const { bounds } = evaluated(value);
    if (bounds.kind !== 'exact') throw new Error(`αναμενόταν ποσό, ήρθε ${bounds.kind}`);
    return bounds.result;
  };

  it('απόκρυψη ⇒ `hidden`, πριν από οτιδήποτε άλλο (ούτε είδος, ούτε ζώνη)', () => {
    const hidden = { objectiveValueDeclarations: { display: 'hidden' as const } };
    expect(listingObjectiveValue(home(hidden), READY, TODAY)).toEqual({ kind: 'hidden' });
    expect(listingObjectiveValue(home({ ...hidden, type: 'shop' }), { kind: 'outside' }, TODAY)).toEqual({ kind: 'hidden' });
  });

  it('η πρόσοψη κλείνει το εύρος σε ποσό — και φαίνεται ως δήλωση του αγγελιοδότη', () => {
    const value = listingObjectiveValue(home({ frontage: 'multiple' }), READY, TODAY);
    expect(exact(value).zonePrice).toBe(2000);
    expect(evaluated(value).assumptions).toContainEqual({ kind: 'declaredByLister', fields: ['frontage'] });
  });

  it('δηλωμένη άδεια νικά την προσέγγιση από το έτος — και η υπόθεση της προσέγγισης ΦΕΥΓΕΙ', () => {
    const value = listingObjectiveValue(home({ objectiveValueDeclarations: declared({ permitDate: '1990-03-15' }) }), READY, TODAY);
    const draft = {
      ...INITIAL_DRAFT,
      levels: [{ floor: 4, area: 90 }],
      area: 90,
      hasCentralHeating: true,
      hasElevator: true,
      permitDate: '1990-03-15',
    };
    expect(value).toMatchObject({ bounds: objectiveValueBounds(draft, TODAY, [2000]), prefill: { permitDate: '1990-03-15' } });
    expect(evaluated(value).assumptions).toEqual([{ kind: 'areaWithoutCommon' }, { kind: 'declaredByLister', fields: ['permitDate'] }]);
  });

  it('η προσέγγιση από το έτος ΔΕΝ προσυμπληρώνεται ποτέ στον υπολογιστή', () => {
    expect(evaluated(listingObjectiveValue(home(), READY, TODAY)).prefill).toMatchObject({ permitDate: null, areaIncludesCommon: null });
  });

  it('μικτά με κοινόχρηστους: δήλωση ⇒ × 0,90 και καμία υπόθεση `areaWithoutCommon`', () => {
    const base = listingObjectiveValue(home({ frontage: 'single' }), READY, TODAY);
    const common = listingObjectiveValue(
      home({ frontage: 'single', objectiveValueDeclarations: declared({ areaIncludesCommon: true }) }),
      READY,
      TODAY,
    );
    expect(exact(common).value).toBeLessThan(exact(base).value);
    expect(evaluated(common).assumptions).not.toContainEqual({ kind: 'areaWithoutCommon' });
    expect(evaluated(common).prefill.areaIncludesCommon).toBe(true);
  });

  it('ιεραρχία: το γενικό χαρακτηριστικό νικά τη δήλωση — και η δήλωση που νικήθηκε ΔΕΝ αναφέρεται', () => {
    const value = listingObjectiveValue(
      home({ frontage: 'single', heatingType: 'central', objectiveValueDeclarations: declared({ hasCentralHeating: false }) }),
      READY,
      TODAY,
    );
    expect(evaluated(value).prefill.hasCentralHeating).toBe(true);
    expect(evaluated(value).assumptions).toContainEqual({ kind: 'declaredByLister', fields: ['frontage'] });
  });

  it('η δήλωση γεμίζει το κενό: αντλία θερμότητας + «έχει καλοριφέρ» · `amenities: null` + «έχει ανελκυστήρα»', () => {
    const value = listingObjectiveValue(
      home({
        frontage: 'single',
        heatingType: 'heat-pump',
        amenities: null,
        objectiveValueDeclarations: declared({ hasCentralHeating: true, hasElevator: true }),
      }),
      READY,
      TODAY,
    );
    exact(value);
    expect(evaluated(value).prefill).toMatchObject({ hasCentralHeating: true, hasElevator: true });
    expect(evaluated(value).assumptions).toContainEqual({
      kind: 'declaredByLister',
      fields: ['frontage', 'hasCentralHeating', 'hasElevator'],
    });
  });

  it('μέτωπο: «καμία πρόσοψη σε μέτωπο» ⇒ μόνο η ζώνη · ο δηλωμένος δρόμος ⇒ η τιμή του', () => {
    const none = home({ frontage: 'single', objectiveValueDeclarations: declared({ zoneFront: { kind: 'none' } }) });
    const street = home({
      frontage: 'single',
      objectiveValueDeclarations: declared({ zoneFront: { kind: 'street', street: 'Ακαδημίας' } }),
    });
    expect(exact(listingObjectiveValue(none, FRONTED, TODAY)).zonePrice).toBe(2000);
    const onStreet = listingObjectiveValue(street, FRONTED, TODAY);
    expect(exact(onStreet).zonePrice).toBe(2600);
    expect(evaluated(onStreet).assumptions).toContainEqual({ kind: 'declaredByLister', fields: ['frontage', 'zoneFront'] });
  });

  it('δρόμος που μια αναθεώρηση έβγαλε από τα μέτωπα ⇒ η ερώτηση ξαναγίνεται ανοιχτή, ΠΟΤΕ μαντεψιά', () => {
    const stale = listingObjectiveValue(
      home({ frontage: 'single', objectiveValueDeclarations: declared({ zoneFront: { kind: 'street', street: 'Πανεπιστημίου' } }) }),
      FRONTED,
      TODAY,
    );
    expect(stale).toMatchObject({ bounds: { kind: 'range', open: ['zoneFront'] } });
    expect(evaluated(stale).assumptions).toContainEqual({ kind: 'declaredByLister', fields: ['frontage'] });
  });

  it('αποθήκη: οι δηλώσεις κατοικίας (ανελκυστήρας · κοινόχρηστοι) δεν μπαίνουν και δεν αναφέρονται', () => {
    const value = listingObjectiveValue(
      home({ type: 'storage', areaSqm: 12, objectiveValueDeclarations: declared({ hasElevator: true, areaIncludesCommon: true }) }),
      READY,
      TODAY,
    );
    expect(evaluated(value).assumptions).toEqual([{ kind: 'ageFromConstructionYear', year: 2000, provenance: 'declared' }]);
  });
});
