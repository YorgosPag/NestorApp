/**
 * **Η ΑΓΚΥΡΑ ΤΗΣ ΚΑΛΥΨΗΣ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ ΕΙΔΩΝ** — ADR-842 Α6.
 *
 * Ερώτημα: *«έχει **κάθε** είδος του {@link PROPERTY_TYPES} απάντηση σε **κάθε**
 * μηχανή που το δεικτοδοτεί — και **εκτελείται** χωρίς να πετάξει;»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ — ΖΩΝΤΑΝΗ ΚΑΤΑΡΡΕΥΣΗ, ΜΕΤΡΗΜΕΝΗ 2026-09-02
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `https://www.nestorconstruct.gr/offers/ownp_330a5a4b-…` ⇒
 * **`TypeError: Cannot read properties of undefined (reading 'map')`**, ολόκληρη η
 * σελίδα λεπτομέρειας κάτω. Η αλυσίδα, ολόκληρη:
 *
 * ```
 * OwnerListingCompletion:94  useMemo
 *   → assessPropertyCompleteness            (constants/property-completion.ts:283)
 *     → weightEntries.map(…)                ← weightEntries === undefined
 *       ↑ getFieldWeightsForType('plot') → FIELD_WEIGHTS['plot'] → ΔΕΝ ΥΠΑΡΧΕΙ
 * ```
 *
 * **5 στα 5** ζωντανά `owner_properties` με γη είναι `plot`. Δεν ήταν ακραία
 * περίπτωση — ήταν **κάθε οικόπεδο**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Ο `Record<PropertyTypeCanonical, …>` ΔΕΝ ΤΟ ΕΠΙΑΣΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Το είχε πιάσει.** Ο τύπος είναι εξαντλητικός και ο μεταγλωττιστής **θα**
 * κοκκίνιζε — αλλά ο `npm run typecheck` πεθαίνει σε `JavaScript heap out of memory`
 * μετά από ~290s στα 4 GB *(μετρημένο 2026-09-02, `.claude-rules/pending-ratchet-work.md`)*.
 * Δηλαδή ο φρουρός που το ίδιο το `property-types.ts` διαφημίζει — *«ο Record κάνει
 * τον μεταγλωττιστή φρουρό: νέο είδος **δεν μεταγλωττίζεται** μέχρι κάποιος να
 * απαντήσει τι είναι»* — **ήταν σβηστός επί μήνες**.
 *
 * ⇒ Η δουλειά αυτής της άγκυρας δεν είναι να αντικαταστήσει τον μεταγλωττιστή. Είναι
 * να ρωτήσει την ίδια ερώτηση σε βαθμίδα που **τρέχει σε κάθε commit** (~1s), και να
 * την ρωτήσει με **εκτέλεση**: ένας πίνακας μπορεί να έχει το κλειδί και η μηχανή να
 * πέφτει παρακάτω για άλλον λόγο.
 *
 * ⚠️ **ΜΗΝ την «απλοποιήσεις» σε `Object.keys(X).length === PROPERTY_TYPES.length`.**
 * Δύο σύνολα ίδιου πλήθους με διαφορετικά κλειδιά είναι ακριβώς η αστοχία που
 * ψάχνουμε — και ένα μήκος δεν εκτελεί τίποτα.
 *
 * 🔴 **ΚΑΙ ΜΗΝ αφαιρέσεις την ομάδα Ε (απόδειξη ζωής).** Χωρίς αυτήν, ένα λάθος
 * `PROPERTY_TYPES` (κενός πίνακας, λάθος import) θα έκανε **κάθε** `for…of` παρακάτω
 * να διατρέξει το κενό σύνολο και να περάσει — «για κάθε στοιχείο του τίποτα» είναι
 * αληθές (ADR-749 §5).
 *
 * @see ADR-842 §8 — Α6 · docs/centralized-systems/reference/adrs/ADR-842-property-attributes-and-provenance.md
 * @see ADR-777 §8.32 — η μέρα που μπήκε η γη στο λεξιλόγιο (2026-08-20)
 */

import { PROPERTY_TYPES, LAND_PROPERTY_TYPES, type PropertyTypeCanonical } from '@/constants/property-types';
import {
  FIELD_KEYS,
  FIELD_WEIGHTS,
  completionFieldLabelKey,
  getFieldWeightsForType,
} from '@/constants/field-completion-weights';
import elProperties from '@/i18n/locales/el/properties.json';
import enProperties from '@/i18n/locales/en/properties.json';
import { assessPropertyCompleteness } from '@/constants/property-completion';
import { AREA_RULES, assessAreaPlausibility } from '@/constants/area-plausibility';
import { LAYOUT_RULES, assessLayoutPlausibility } from '@/constants/layout-plausibility';
import { ORIENTATION_RULES, assessOrientationPlausibility } from '@/constants/orientation-plausibility';
import { MEDIA_THRESHOLDS, getMediaThresholdForType } from '@/constants/media-completion-thresholds';
import { assessFloorTypePlausibility } from '@/constants/floor-type-plausibility';
import { assessInteriorFeaturesPlausibility } from '@/constants/interior-features-plausibility';
import { assessSystemsPlausibility } from '@/constants/systems-plausibility';

describe('🟢 Ε — απόδειξη ζωής: το σύνολο που διατρέχουμε ΔΕΝ είναι κενό', () => {
  it('Ε1 — το λεξιλόγιο έχει είδη, και η γη είναι μέσα', () => {
    expect(PROPERTY_TYPES.length).toBeGreaterThanOrEqual(14);
    expect(LAND_PROPERTY_TYPES.length).toBeGreaterThanOrEqual(2);
    expect(PROPERTY_TYPES).toEqual(expect.arrayContaining(['plot', 'parcel']));
  });
});

/**
 * 🔴 **Α — ΤΟ ΚΛΕΙΔΙ ΥΠΑΡΧΕΙ.** Η ερώτηση των πινάκων: κάθε `Record` που δηλώνει
 * εξαντλητικότητα στον τύπο, την έχει και στη **μνήμη**.
 */
describe('🔴 Α — κάθε πίνακας κλειδωμένος στο λεξιλόγιο έχει γραμμή για ΚΑΘΕ είδος', () => {
  const EXHAUSTIVE_TABLES: ReadonlyArray<readonly [string, Readonly<Record<string, unknown>>]> = [
    ['FIELD_WEIGHTS', FIELD_WEIGHTS],
    ['AREA_RULES', AREA_RULES],
    ['LAYOUT_RULES', LAYOUT_RULES],
    ['ORIENTATION_RULES', ORIENTATION_RULES],
    ['MEDIA_THRESHOLDS', MEDIA_THRESHOLDS],
  ];

  it.each(EXHAUSTIVE_TABLES)('Α — %s καλύπτει όλα τα είδη', (name, table) => {
    const missing = PROPERTY_TYPES.filter((type) => table[type] === undefined);
    expect({ table: name, missing }).toEqual({ table: name, missing: [] });
  });

  it('Α6 — και κανένας τους δεν έχει γραμμή για είδος που ΔΕΝ υπάρχει', () => {
    const vocabulary = new Set<string>(PROPERTY_TYPES);
    for (const [name, table] of EXHAUSTIVE_TABLES) {
      const orphans = Object.keys(table).filter((key) => !vocabulary.has(key));
      expect({ table: name, orphans }).toEqual({ table: name, orphans: [] });
    }
  });
});

/**
 * 🔴 **Β — Η ΜΗΧΑΝΗ ΕΚΤΕΛΕΙΤΑΙ.** Η ερώτηση που το «υπάρχει το κλειδί;» δεν απαντά:
 * ο πίνακας μπορεί να έχει γραμμή και η μηχανή να πέφτει τρεις γραμμές παρακάτω.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΘΕ ΜΗΧΑΝΗ ΚΑΛΕΙΤΑΙ **ΔΥΟ ΦΟΡΕΣ**, ΚΑΙ Η ΔΕΥΤΕΡΗ ΕΙΝΑΙ ΟΛΟ ΤΟ ΝΟΗΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή αυτής της ομάδας περνούσε **κενά** ορίσματα *(`floor: null`,
 * `bedrooms: null`, …)*. **Μετρήθηκε ότι δεν φύλαγε**: με μετάλλαξη που έσβηνε τον
 * κλάδο της γης στο {@link assessFloorTypePlausibility}, και τα **25** tests έμεναν
 * πράσινα — γιατί `floor: null` βγάζει τη μηχανή σε `insufficientData` **πριν** φτάσει
 * στο `FLOOR_TYPE_MATRIX[propertyType][band]`.
 *
 * ⚠️ Δηλαδή η ρηχή κλήση έκρυβε **δεύτερη ζωντανή κατάρρευση**: `plot` με δηλωμένο
 * όροφο ⇒ `FLOOR_TYPE_MATRIX['plot']` είναι `undefined` ⇒ `undefined[band]` ⇒
 * `TypeError`. Ίδια οικογένεια με το `.map` που έριξε τη `/offers/<id>`.
 *
 * ⇒ **`SPARSE`** = «ο άνθρωπος δεν συμπλήρωσε τίποτα» *(η μηχανή οφείλει να σιωπά)*.
 * **`DENSE`** = «ο άνθρωπος συμπλήρωσε» *(η μηχανή οφείλει να **κρίνει** — και εκεί
 * δεικτοδοτεί τον πίνακα)*. Χωρίς τη δεύτερη, αυτή η ομάδα ελέγχει την **έξοδο**, όχι
 * τη μηχανή.
 *
 * ⛔ **ΜΗΝ «απλοποιήσεις» πίσω σε μία κλήση με null.** Είναι μετρημένο ότι δεν πιάνει.
 */
describe('🔴 Β — κάθε μηχανή ΕΚΤΕΛΕΙΤΑΙ για κάθε είδος χωρίς να πετάξει', () => {
  /** «Τίποτα δηλωμένο» — η μηχανή οφείλει να βγει σιωπηλά, όχι να πέσει. */
  const SPARSE = {
    floor: null,
    bedrooms: null,
    bathrooms: null,
    wc: null,
    orientations: null,
    gross: null,
    interiorFeatures: null,
    securityFeatures: null,
    energyClass: null,
    heatingType: null,
    coolingType: null,
    condition: null,
  } as const;

  /**
   * «Όλα δηλωμένα» — η μηχανή **μπαίνει** στον πίνακά της.
   *
   * 🔑 Οι τιμές είναι επίτηδες *αληθοφανείς για κτίσμα* **και** εφαρμόσιμες σε γη:
   * δεν κρίνεται εδώ αν το ετυμηγόρημα είναι σωστό — κρίνεται ότι η μηχανή **φτάνει**
   * ως το ετυμηγόρημα. Το «τι λέει για τη γη» το ρωτά η ομάδα Γ.
   */
  const DENSE = {
    floor: 2,
    bedrooms: 2,
    bathrooms: 1,
    wc: 1,
    orientations: ['north', 'east'] as readonly string[],
    gross: 500,
    interiorFeatures: ['fireplace'] as readonly string[],
    securityFeatures: ['alarm'] as readonly string[],
    energyClass: 'B',
    heatingType: 'autonomous',
    coolingType: 'ac',
    condition: 'good',
  } as const;

  const ARGUMENT_SETS = [
    ['SPARSE', SPARSE],
    ['DENSE', DENSE],
  ] as const;

  it.each(
    PROPERTY_TYPES.flatMap((type) =>
      ARGUMENT_SETS.map(([label, args]) => [type, label, args] as const),
    ),
  )(
    'Β — «%s» × %s περνά και από τις οκτώ μηχανές',
    (
      type: PropertyTypeCanonical,
      _label: string,
      a: typeof SPARSE | typeof DENSE,
    ) => {
      expect(() => getFieldWeightsForType(type)).not.toThrow();
      expect(getFieldWeightsForType(type).length).toBeGreaterThan(0);

      expect(() =>
        assessPropertyCompleteness({
          formData: {
            type,
            areaGross: a.gross,
            bedrooms: a.bedrooms,
            operationalStatus: 'listed',
          },
          mediaCounts: { photos: 0, floorplan: 0 },
        }),
      ).not.toThrow();

      expect(() => assessAreaPlausibility({ propertyType: type, gross: a.gross })).not.toThrow();
      expect(() =>
        assessLayoutPlausibility({
          propertyType: type,
          bedrooms: a.bedrooms,
          bathrooms: a.bathrooms,
          wc: a.wc,
        }),
      ).not.toThrow();
      expect(() =>
        assessOrientationPlausibility({ propertyType: type, orientations: a.orientations }),
      ).not.toThrow();
      expect(() => assessFloorTypePlausibility({ propertyType: type, floor: a.floor })).not.toThrow();
      expect(() => getMediaThresholdForType(type)).not.toThrow();
      expect(() =>
        assessInteriorFeaturesPlausibility({
          propertyType: type,
          interiorFeatures: a.interiorFeatures,
          securityFeatures: a.securityFeatures,
          energyClass: a.energyClass,
          heatingType: a.heatingType,
          coolingType: a.coolingType,
          areaGross: a.gross,
        }),
      ).not.toThrow();
      expect(() =>
        assessSystemsPlausibility({
          propertyType: type,
          heatingType: a.heatingType,
          coolingType: a.coolingType,
          condition: a.condition,
          areaGross: a.gross,
        }),
      ).not.toThrow();
    },
  );
});

/**
 * 🔑 **Γ — Η ΓΗ ΔΕΝ ΕΙΝΑΙ ΔΙΑΜΕΡΙΣΜΑ ΜΕ ΑΛΛΟ ΟΝΟΜΑ.**
 *
 * Το «δεν πετά» ικανοποιείται και από ένα `?? FIELD_WEIGHTS.apartment`. Αυτή η ομάδα
 * είναι ο λόγος που τέτοιο fallback **δεν** είναι θεραπεία: θα ζητούσε από οικόπεδο
 * **υπνοδωμάτια** και **ενεργειακή κλάση** ως κρίσιμα, δηλαδή θα έλεγε στον άνθρωπο
 * ότι η αγγελία του είναι ελλιπής για πράγματα που **δεν υπάρχουν**.
 *
 * Είναι η ίδια αστοχία που το ADR-842 §8 #3 μέτρησε για την `'Αποθήκη'` — εκεί με
 * παρονομαστή 23,0 αντί 9,0 *(+156%)*.
 */
describe('🔑 Γ — η γη ρωτιέται ΓΙΑ ΓΗ', () => {
  const BUILDING_ONLY_KEYS = [
    'bedrooms',
    'bathrooms',
    'energyClass',
    'heatingType',
    'coolingType',
    'windowFrames',
    'glazing',
    'flooring',
    'interiorFeatures',
    'areaNet',
    'condition',
  ] as const;

  it.each(LAND_PROPERTY_TYPES.map((t) => [t] as const))(
    'Γ1 — «%s» δεν βαθμολογείται σε κανένα πεδίο κτίσματος',
    (type: PropertyTypeCanonical) => {
      const scored = getFieldWeightsForType(type).map((entry) => entry.key);
      const buildingLeaks = scored.filter((key) =>
        (BUILDING_ONLY_KEYS as readonly string[]).includes(key),
      );
      expect(buildingLeaks).toEqual([]);
    },
  );

  it('Γ2 — και το ζητούμενο της γης είναι το ΕΜΒΑΔΟΝ, κρίσιμο', () => {
    for (const type of LAND_PROPERTY_TYPES) {
      const area = getFieldWeightsForType(type).find((entry) => entry.key === 'areaGross');
      expect({ type, area }).toEqual({ type, area: expect.objectContaining({ critical: true }) });
    }
  });

  /**
   * ⚠️ Ο παρονομαστής της γης πρέπει να είναι **μικρότερος** από κάθε κτισμένου
   * είδους. Αν κάποτε γίνει ίσος ή μεγαλύτερος, κάποιος πρόσθεσε πεδίο κτίσματος στη
   * γη — και το Γ1 από πάνω μπορεί να μην το πιάσει αν το κλειδί είναι καινούργιο.
   */
  it('Γ3 — ο παρονομαστής της γης είναι μικρότερος από του διαμερίσματος', () => {
    const weightOf = (type: PropertyTypeCanonical): number =>
      getFieldWeightsForType(type).reduce((sum, entry) => sum + entry.weight, 0);
    for (const type of LAND_PROPERTY_TYPES) {
      expect(weightOf(type)).toBeLessThan(weightOf('apartment'));
    }
  });
});

/**
 * 🔴 **Λ — Η ΕΤΙΚΕΤΑ ΠΟΥ ΔΙΑΒΑΖΕΙ Ο ΑΝΘΡΩΠΟΣ** *(ADR-842 §7.6.8)*.
 *
 * Το εύρημα ήρθε **από την οθόνη**: η `/offers/<οικόπεδο>` απέδιδε σωστά, βαθμολογούσε
 * σωστά, όλα τα tests ήταν πράσινα — και έλεγε **«Τι λείπει: Κάτοψη»** σε ιδιοκτήτη
 * οικοπέδου. Καμία μηχανή δεν μπορούσε να το πιάσει· μόνο η **ανάγνωση** ήταν λάθος.
 *
 * ⚠️ Αυτή η ομάδα φυλάει **δύο** πράγματα, και το δεύτερο είναι το επικίνδυνο:
 * ότι κάθε κλειδί που **παράγει** η SSoT **λύνεται** σε πραγματικό κείμενο. Ένα κλειδί
 * χωρίς μετάφραση δεν κοκκινίζει πουθενά — **τυπώνεται αυτούσιο στην οθόνη**.
 */
describe('🔴 Λ — οι ετικέτες των πεδίων ανά κλάση ακινήτου', () => {
  const resolve = (bundle: Record<string, unknown>, key: string): unknown =>
    key.split('.').reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      bundle,
    );

  it.each(
    PROPERTY_TYPES.flatMap((type) =>
      FIELD_KEYS.map((fieldKey) => [type, fieldKey] as const),
    ),
  )('Λ1 — «%s» × «%s» λύνεται σε ΚΕΙΜΕΝΟ, σε el ΚΑΙ en', (type, fieldKey) => {
    const key = completionFieldLabelKey(fieldKey, type);
    for (const [lang, bundle] of [
      ['el', elProperties],
      ['en', enProperties],
    ] as const) {
      const label = resolve(bundle as unknown as Record<string, unknown>, key);
      expect({ lang, key, label }).toEqual({
        lang,
        key,
        label: expect.stringMatching(/\S/),
      });
    }
  });

  /** Η γη ΔΕΝ λέει «Κάτοψη» — το ίδιο το περιστατικό, ως άγκυρα. */
  it('Λ2 — η γη ονομάζει το `floorplan` ΑΛΛΙΩΣ από το διαμέρισμα', () => {
    for (const type of LAND_PROPERTY_TYPES) {
      expect(completionFieldLabelKey('floorplan', type)).not.toBe(
        completionFieldLabelKey('floorplan', 'apartment'),
      );
      expect(resolve(elProperties as unknown as Record<string, unknown>,
        completionFieldLabelKey('floorplan', type))).not.toBe('Κάτοψη');
    }
  });

  /**
   * ⚠️ **Και το αντίστροφο**: ό,τι ΔΕΝ δηλώνεται ως ειδικό της γης πέφτει στο γενικό.
   * Χωρίς αυτό, ένα νέο `FIELD_KEY` θα απαιτούσε γραμμή σε κάθε κλάση για να έχει όνομα.
   */
  it('Λ3 — τα πεδία που η γη ΔΕΝ ονομάζει αλλιώς πέφτουν στο γενικό', () => {
    expect(completionFieldLabelKey('bedrooms', 'plot')).toBe('completion.fields.bedrooms');
    expect(completionFieldLabelKey('type', 'plot')).toBe('completion.fields.type');
  });

  /** 🔑 Ωμές τιμές Firestore: «Οικόπεδο» ΕΙΝΑΙ γη, και η ετικέτα οφείλει να το ξέρει. */
  it('Λ4 — η ελληνική παλαιά τιμή «Οικόπεδο» παίρνει ΤΗΝ ΙΔΙΑ ετικέτα με το `plot`', () => {
    expect(completionFieldLabelKey('floorplan', 'Οικόπεδο')).toBe(
      completionFieldLabelKey('floorplan', 'plot'),
    );
  });
});
