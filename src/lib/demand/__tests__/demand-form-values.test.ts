/**
 * Άγκυρες — **ΦΟΡΜΑ ⇄ ΖΗΤΗΣΗ**, τα πλαίσια ζωής, και η επικύρωση (ADR-777 Α9 · Α14 §17.2).
 *
 * **Ρ — ΓΥΡΟΣ ΜΕΤ' ΕΠΙΣΤΡΟΦΗΣ.** Ζήτηση → φόρμα → ζήτηση οφείλει να είναι
 * **ταυτότητα** στους άξονες. Μια μετάφραση που χάνει κάτι στον έναν δρόμο το χάνει
 * **σιωπηλά** — και θα φαινόταν μόνο ως ζήτηση που «άλλαξε μόνη της» μετά από
 * επεξεργασία.
 *
 * **Ν — ΤΟ ΚΕΝΟ ΔΕΝ ΕΙΝΑΙ ΜΗΔΕΝ.** Ο πυρήνας του `DemandFeatures`.
 *
 * **Π — Η ΠΡΟΤΑΣΗ ΔΕΝ ΓΡΑΦΕΙ ΑΠΟ ΠΑΝΩ.** Το συμβόλαιο της Α14 §17.2 κανόνας 3.
 */

import {
  EMPTY_DEMAND_FORM,
  FORM_PLACE_KINDS,
  PLACE_KINDS_NOT_IN_FORM,
  demandDraftFrom,
  demandFormBlockers,
  demandFormFrom,
  demandFormSchema,
  type DemandFormValues,
} from '../demand-form-values';
import { validateDemandForm } from '../demand-form-validation';
import { DEMAND_LIFE_PRESETS, applyLifePreset } from '../demand-life-presets';
import { DEMAND_LIFE_CONTEXTS, NO_DEMAND_FEATURES } from '@/types/property-demand';
import { demand } from './demand-fixtures';

/** Οι τιμές που περνούν από zod — ό,τι δέχεται η μετάφραση. */
function parse(values: DemandFormValues) {
  return demandFormSchema.parse(values);
}

/** Μια φόρμα «γεμάτη», με κάθε άξονα δηλωμένο. */
const FULL: DemandFormValues = {
  ...EMPTY_DEMAND_FORM,
  seeks: ['sell', 'exchange'],
  placeKind: 'near',
  placeQuery: 'Θεσσαλονίκη',
  placeCenter: { lat: 40.64, lng: 22.94 },
  radiusKm: 7,
  timingKind: 'window',
  fromDate: '2027-03-01',
  toDate: '2027-06-30',
  types: ['apartment', 'maisonette'],
  priceMin: 100_000,
  priceMax: 250_000,
  areaMin: 80,
  areaMax: 160,
  bedroomsMin: 2,
  floorMin: 1,
  floorMax: 4,
  proximity: [{ kind: 'school', maxMetres: 800 }],
  lifeContext: 'family',
};

// =============================================================================
// Ρ — ΓΥΡΟΣ ΜΕΤ' ΕΠΙΣΤΡΟΦΗΣ
// =============================================================================

describe('🔴 Ρ — ζήτηση → φόρμα → ζήτηση είναι ΤΑΥΤΟΤΗΤΑ στους άξονες', () => {
  it('γεμάτη ζήτηση επιβιώνει ακέραιη', () => {
    const original = demandDraftFrom(parse(FULL));
    const roundTrip = demandFormFrom({ ...demand(), ...original });

    expect(roundTrip.kind).toBe('editable');
    if (roundTrip.kind !== 'editable') return;
    expect(demandDraftFrom(parse(roundTrip.values))).toEqual(original);
  });

  it('κενή ζήτηση επιβιώνει ακέραιη', () => {
    const original = demandDraftFrom(parse(EMPTY_DEMAND_FORM));
    const roundTrip = demandFormFrom({ ...demand(), ...original });

    if (roundTrip.kind !== 'editable') throw new Error('αναμενόταν editable');
    expect(demandDraftFrom(parse(roundTrip.values))).toEqual(original);
  });

  it('🔴 μορφή χώρου ΕΚΤΟΣ φόρμας ⇒ ονομασμένη άρνηση, ΠΟΤΕ σιωπηλή πτώση σε «anywhere»', () => {
    // Χωρίς αυτό, ένα άνοιγμα για επεξεργασία θα μετέτρεπε «αυτό το κτίριο» σε
    // «οπουδήποτε» — και θα αποθηκευόταν έτσι με το πρώτο «Αποθήκευση».
    for (const kind of PLACE_KINDS_NOT_IN_FORM) {
      const source =
        kind === 'place'
          ? demand({ place: { kind: 'place', landId: 'land_1', buildingId: null } })
          : demand({
              place: {
                kind: 'area',
                outline: [
                  { lat: 40.6, lng: 22.9 },
                  { lat: 40.7, lng: 22.9 },
                  { lat: 40.7, lng: 23.0 },
                ],
              },
            });

      const load = demandFormFrom(source);
      expect(load).toEqual({ kind: 'place-not-editable', placeKind: kind });
    }
  });

  it('🔑 οι δύο λίστες μορφών χώρου δεν επικαλύπτονται και καλύπτουν το μοντέλο', () => {
    // Μια μορφή σε **καμία** από τις δύο θα ήταν η περίπτωση που κανείς δεν σκέφτηκε.
    expect([...FORM_PLACE_KINDS, ...PLACE_KINDS_NOT_IN_FORM].sort()).toEqual([
      'anywhere',
      'area',
      'near',
      'place',
    ]);
  });
});

// =============================================================================
// Ν — ΤΟ ΚΕΝΟ ΔΕΝ ΕΙΝΑΙ ΜΗΔΕΝ
// =============================================================================

describe('🔴 Ν — κενό πεδίο ⇒ `null`, ΠΟΤΕ `0`', () => {
  it('κενή συμβολοσειρά γίνεται `null` σε κάθε αριθμητικό', () => {
    const parsed = parse({ ...EMPTY_DEMAND_FORM, priceMax: '', areaMin: '', floorMin: '' });
    expect(parsed.priceMax).toBeNull();
    expect(parsed.areaMin).toBeNull();
    expect(parsed.floorMin).toBeNull();
  });

  it('🔑 το `0` ΕΠΙΒΙΩΝΕΙ — αλλιώς καμία ζήτηση δεν θα μπορούσε να ζητήσει ΙΣΟΓΕΙΟ', () => {
    const parsed = parse({ ...EMPTY_DEMAND_FORM, floorMin: 0, floorMax: 0, bedroomsMin: 0 });
    expect(parsed.floorMin).toBe(0);
    expect(parsed.floorMax).toBe(0);
    expect(parsed.bedroomsMin).toBe(0);
    expect(demandDraftFrom(parsed).features.floorMin).toBe(0);
  });

  it('σκουπίδια γίνονται `null`, όχι `NaN`', () => {
    // `Number('abc')` είναι NaN, και ένα NaN σε εύρος περνά κάθε σύγκριση ως `false`
    // — δηλαδή θα φίλτραρε τα πάντα, σιωπηλά.
    expect(parse({ ...EMPTY_DEMAND_FORM, priceMax: 'χίλια' }).priceMax).toBeNull();
  });
});

// =============================================================================
// Η ΕΠΙΚΥΡΩΣΗ — ΜΙΑ ΑΡΧΗ
// =============================================================================

describe('🔴 η επικύρωση καλεί την ΙΔΙΑ αρχή με την πύλη γραφής', () => {
  it('κενό `seeks` ⇒ `seeks-empty` (το invariant της ΟΝΤΟΤΗΤΑΣ)', () => {
    const result = validateDemandForm(EMPTY_DEMAND_FORM);
    expect(result.kind).toBe('incomplete');
    if (result.kind !== 'incomplete') return;
    expect(result.violations).toContain('seeks-empty');
  });

  it('«σε αυτή την περιοχή» χωρίς λυμένο σημείο ⇒ ΕΜΠΟΔΙΟ ΦΟΡΜΑΣ, όχι invariant', () => {
    // Δεν είναι **άκυρη** ζήτηση — δεν είναι ζήτηση **ακόμη**. Δύο διαφορετικές
    // θεραπείες για τον άνθρωπο.
    const values: DemandFormValues = { ...FULL, placeCenter: null };
    expect(demandFormBlockers(parse(values))).toEqual(['place-unresolved']);

    const result = validateDemandForm(values);
    if (result.kind !== 'incomplete') throw new Error('αναμενόταν incomplete');
    expect(result.blockers).toContain('place-unresolved');
    expect(result.violations).toHaveLength(0);
  });

  it('αντεστραμμένο παράθυρο ⇒ `window-inverted`, ΚΑΙ ΤΑΥΤΟΧΡΟΝΑ κάθε άλλη παραβίαση', () => {
    // Το «όλες μαζί» είναι το συμβόλαιο της Α14 §17.2: ο χρήστης δεν μπορεί να ξέρει
    // πόσο κοντά είναι αν του λέμε ένα-ένα.
    const values: DemandFormValues = {
      ...FULL,
      fromDate: '2027-06-30',
      toDate: '2027-03-01',
      priceMin: 300_000,
      priceMax: 100_000,
    };
    const result = validateDemandForm(values);
    if (result.kind !== 'incomplete') throw new Error('αναμενόταν incomplete');

    expect(result.violations).toContain('window-inverted');
    expect(result.violations).toContain('range-inverted');
  });

  it('πλήρης, συνεπής φόρμα ⇒ `ready` με προσχέδιο', () => {
    const result = validateDemandForm(FULL);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.draft.seeks).toEqual(['sell', 'exchange']);
    expect(result.draft.place).toEqual({
      kind: 'near',
      center: { lat: 40.64, lng: 22.94 },
      radiusKm: 7,
    });
  });
});

// =============================================================================
// Π — Η ΠΡΟΤΑΣΗ ΤΟΥ ΠΛΑΙΣΙΟΥ ΖΩΗΣ
// =============================================================================

describe('🔴 Π — το πλαίσιο ζωής γεμίζει ΚΕΝΑ, ποτέ δεν γράφει από πάνω', () => {
  it('σε κενή φόρμα γεμίζει και αναφέρει ΤΙ γέμισε', () => {
    const outcome = applyLifePreset(EMPTY_DEMAND_FORM, 'family');
    expect(outcome.values.bedroomsMin).toBe(DEMAND_LIFE_PRESETS.family.bedroomsMin);
    expect(outcome.filled).toContain('bedroomsMin');
    expect(outcome.filled).toContain('proximity');
    expect(outcome.values.lifeContext).toBe('family');
  });

  it('🔴 ΔΕΝ αγγίζει ό,τι έχει ήδη απαντήσει ο άνθρωπος', () => {
    const answered: DemandFormValues = {
      ...EMPTY_DEMAND_FORM,
      bedroomsMin: 1,
      types: ['loft'],
      proximity: [{ kind: 'trainStation', maxMetres: 300 }],
    };
    const outcome = applyLifePreset(answered, 'family');

    expect(outcome.values.bedroomsMin).toBe(1);
    expect(outcome.values.types).toEqual(['loft']);
    expect(outcome.values.proximity).toEqual([{ kind: 'trainStation', maxMetres: 300 }]);
    expect(outcome.filled).not.toContain('bedroomsMin');
    expect(outcome.filled).not.toContain('types');
  });

  it('κενό `filled` ΔΕΝ είναι σφάλμα — σημαίνει «τα είχες ήδη»', () => {
    const complete: DemandFormValues = {
      ...EMPTY_DEMAND_FORM,
      bedroomsMin: 3,
      areaMin: 100,
      areaMax: 200,
      types: ['villa'],
      proximity: [{ kind: 'school', maxMetres: 300 }],
    };
    expect(applyLifePreset(complete, 'family').filled).toHaveLength(0);
  });

  it('🔑 ο ΦΟΙΤΗΤΗΣ προτείνει `bedroomsMin: 0` — ρητή απάντηση, ΟΧΙ «δεν ρωτήθηκε»', () => {
    // `0` = «δέξου και γκαρσονιέρα»· `null` θα σήμαινε ότι δεν το έθεσε ως όρο.
    expect(DEMAND_LIFE_PRESETS.student.bedroomsMin).toBe(0);
    expect(applyLifePreset(EMPTY_DEMAND_FORM, 'student').values.bedroomsMin).toBe(0);
  });

  it('🔑 ΚΑΘΕ πλαίσιο ζωής έχει πρόταση — καμία ετικέτα χωρίς καταναλωτή', () => {
    for (const context of DEMAND_LIFE_CONTEXTS) {
      const outcome = applyLifePreset(EMPTY_DEMAND_FORM, context);
      expect(outcome.filled.length).toBeGreaterThan(0);
    }
  });

  it('⚠️ η πρόταση ΔΕΝ αγγίζει την ΤΙΜΗ — τεκμηριωμένη απουσία, όχι παράλειψη', () => {
    // Ένας αριθμός μόνος του σε πεδίο τιμής **αγκυρώνει**: θα διαμόρφωνε τη ζήτηση
    // αντί να την καταγράψει, και ο θερμοχάρτης του Ε2 θα μετρούσε τις υποθέσεις μας.
    for (const context of DEMAND_LIFE_CONTEXTS) {
      const outcome = applyLifePreset(EMPTY_DEMAND_FORM, context);
      expect(outcome.values.priceMin).toBe(NO_DEMAND_FEATURES.priceMin);
      expect(outcome.values.priceMax).toBe(NO_DEMAND_FEATURES.priceMax);
    }
  });
});
