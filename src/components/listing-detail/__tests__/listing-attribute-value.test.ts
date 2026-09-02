/**
 * Άγκυρες για τις **ετικέτες τιμών** της οθόνης 3 (ADR-842 Φ3).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΓΚΥΡΑ ΠΟΥ ΕΠΙΑΣΕ ΤΟ ΠΡΩΤΟ ΠΡΑΓΜΑΤΙΚΟ ΚΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το SSoT audit της Φ3 μέτρησε ότι το `properties-enums` είχε **έντεκα** από τους
 * δεκατρείς καταλόγους ετικετών. Έλειπαν **τρεις**: `features.amenities.*` ·
 * `systems.fuel.*` · `systems.waterHeating.*`. Το `propertyAmenities` έφευγε ήδη
 * **ωμό** σε PDF · email · Telegram μέσω του `snapshot-field-builders.ts` — δηλαδή ο
 * παραλήπτης διάβαζε `parking-garage` — και **καμία** πύλη δεν το έβλεπε, γιατί καμία
 * δεν ρωτούσε *«έχει ετικέτα κάθε τιμή του λεξιλογίου;»*.
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ Η ΑΥΘΕΝΤΙΑ ΤΗΣ Φ1, ΟΧΙ ΤΟ LOCALE.** Αν διαβάζαμε τα
 * κλειδιά που *υπάρχουν* και ελέγχαμε ότι υπάρχουν, θα ήταν ταυτολογία. Εδώ ρωτιέται
 * ο **κατάλογος τιμών** (`constants/property-features-enterprise.ts`) — άρα μια τιμή
 * που προστίθεται εκεί **κοκκινίζει** μέχρι να ονομαστεί, και στις δύο γλώσσες.
 *
 * 🔑 **Και η διαδρομή του κλειδιού ΕΚΤΕΛΕΙΤΑΙ, δεν αντιγράφεται**: η άγκυρα καλεί την
 * **πραγματική** {@link vocabularyLabel} με ένα `t` που καταγράφει. Μια χειρόγραφη
 * λίστα προθεμάτων εδώ θα ήταν δεύτερη λίστα, ελεύθερη να αποκλίνει (ADR-587 §6.1:
 * *«ένα anchor που δεν εκτελεί δεν είναι anchor»*).
 */

import fs from 'fs';
import path from 'path';

import type { TFunction } from 'i18next';

import {
  AMENITIES,
  CONDITIONS,
  COOLING_TYPES,
  FLOORINGS,
  FRAMES,
  FUEL_TYPES,
  GLAZINGS,
  HEATING_TYPES,
  INTERIOR_FEATURES,
  ORIENTATIONS,
  SECURITY_FEATURES,
  WATER_HEATING_TYPES,
} from '@/constants/property-features-enterprise';
import {
  LISTING_ATTRIBUTE_KEYS,
  LISTING_FEATURE_SET_KEYS,
} from '@/lib/listings/listing-disclosure';
import type { PublicListing } from '@/types/public-listing';

import {
  attributeValue,
  FEATURE_SET_VOCABULARY,
  vocabularyLabel,
  type AttributeVocabulary,
} from '../listing-attribute-value';

/**
 * **Κάθε λεξιλόγιο, και ο κατάλογος τιμών του** — χειρόγραφο επίτηδες, ως **δεύτερη
 * φωνή**. Είναι `Record` πάνω στο {@link AttributeVocabulary}, άρα νέο λεξιλόγιο
 * **σπάει τη μεταγλώττιση εδώ** μέχρι να δηλώσει ποιες τιμές οφείλει να ονομάζει.
 */
const VOCABULARY_VALUES: Record<AttributeVocabulary, readonly string[]> = {
  condition: CONDITIONS,
  heating: HEATING_TYPES,
  fuel: FUEL_TYPES,
  cooling: COOLING_TYPES,
  waterHeating: WATER_HEATING_TYPES,
  frames: FRAMES,
  glazing: GLAZINGS,
  flooring: FLOORINGS,
  orientation: ORIENTATIONS,
  interiorFeature: INTERIOR_FEATURES,
  securityFeature: SECURITY_FEATURES,
  amenity: AMENITIES,
};

/**
 * `t` που **καταγράφει το κλειδί** αντί να μεταφράζει.
 *
 * ⚠️ Ο ισχυρισμός τύπου είναι το ιδίωμα του test double: η `TFunction` του i18next
 * έχει δεκάδες υπερφορτώσεις που κανένα διπλό δεν υλοποιεί, και **δεν** είναι `any` —
 * το σώμα δέχεται και επιστρέφει `string`.
 */
function recordingT(): { t: TFunction; keys: string[] } {
  const keys: string[] = [];
  const t = ((key: string) => {
    keys.push(key);
    return key;
  }) as unknown as TFunction;
  return { t, keys };
}

function readEnums(language: 'el' | 'en'): Record<string, unknown> {
  const file = path.join(
    __dirname, '..', '..', '..', 'i18n', 'locales', language, 'properties-enums.json'
  );
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** Επίλυση κλειδιού με τελείες, χωρίς το πρόθεμα namespace. */
function lookup(bundle: Record<string, unknown>, key: string): unknown {
  const withoutNs = key.startsWith('properties-enums:')
    ? key.slice('properties-enums:'.length)
    : key;
  let node: unknown = bundle;
  for (const part of withoutNs.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Κάθε (λεξιλόγιο, τιμή) → το κλειδί που **πράγματι** ζητά η οθόνη. */
const EVERY_VALUE_KEY: ReadonlyArray<readonly [AttributeVocabulary, string, string]> = (
  Object.entries(VOCABULARY_VALUES) as ReadonlyArray<[AttributeVocabulary, readonly string[]]>
).flatMap(([vocabulary, values]) =>
  values.map((value) => {
    const { t, keys } = recordingT();
    vocabularyLabel(t, vocabulary, value);
    return [vocabulary, value, keys[0]] as const;
  })
);

// ============================================================================
// Τ1 — ΚΑΘΕ ΤΙΜΗ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ ΕΧΕΙ ΕΤΙΚΕΤΑ, ΚΑΙ ΣΤΙΣ ΔΥΟ ΓΛΩΣΣΕΣ
// ============================================================================

describe.each(['el', 'en'] as const)('Τ1 — καμία ωμή τιμή στην οθόνη 3 [%s]', (language) => {
  const bundle = readEnums(language);

  it.each(EVERY_VALUE_KEY)('%s / %s → %s', (_vocabulary, _value, key) => {
    const label = lookup(bundle, key);
    expect(typeof label).toBe('string');
    expect((label as string).trim().length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Τ2 — ΚΑΘΕ ΣΥΝΟΛΟ ΞΕΡΕΙ ΜΕ ΠΟΙΟ ΛΕΞΙΛΟΓΙΟ ΟΝΟΜΑΖΟΝΤΑΙ ΟΙ ΤΙΜΕΣ ΤΟΥ
// ============================================================================

describe('Τ2 — ο δεύτερος φρουρός των συνόλων', () => {
  it('κάθε `feature-set` έχει λεξιλόγιο', () => {
    expect(Object.keys(FEATURE_SET_VOCABULARY).sort()).toEqual(
      [...LISTING_FEATURE_SET_KEYS].sort()
    );
  });

  it('κάθε δηλωμένο λεξιλόγιο είναι γνωστό — όχι όνομα που κανείς δεν ονομάζει', () => {
    for (const vocabulary of Object.values(FEATURE_SET_VOCABULARY)) {
      expect(Object.keys(VOCABULARY_VALUES)).toContain(vocabulary);
    }
  });
});

// ============================================================================
// Τ3 — ΤΑ ΠΡΟΘΕΜΑΤΑ ΕΙΝΑΙ ΤΟΥ `properties-enums`, ΟΧΙ ΔΕΥΤΕΡΟ ΜΗΤΡΩΟ
// ============================================================================

describe('Τ3 — καμία δεύτερη πηγή ετικετών τιμής', () => {
  it('κάθε κλειδί τιμής ζητιέται ρητά από το `properties-enums`', () => {
    // Ένα κλειδί χωρίς πρόθεμα θα έπεφτε στο **πρώτο** namespace του `useTranslation`
    // (`search-results`) — δηλαδή θα γεννούσε σιωπηλά δεύτερο μητρώο ετικετών.
    for (const [, , key] of EVERY_VALUE_KEY) {
      expect(key.startsWith('properties-enums:')).toBe(true);
    }
  });
});

// ============================================================================
// Τ4 — 🔴 ΚΑΜΙΑ ΙΔΙΟΤΗΤΑ ΔΕΝ ΖΩΓΡΑΦΙΖΕΙ `[object Object]` (ADR-842 Φ5)
// ============================================================================

/**
 * 🔴 **Η ΟΙΚΟΓΕΝΕΙΑ ΤΟΥ ΩΜΟΥ ΚΛΕΙΔΙΟΥ, ΑΠΟ ΑΛΛΗ ΠΟΡΤΑ.**
 *
 * Το `'verbatim'` κάνει `String(listing[key])`. Όσο **κάθε** ιδιότητα ήταν αριθμός ή
 * συμβολοσειρά αυτό ήταν ασφαλές· η Φ5 έδωσε στο `levels` δοχείο **με προέλευση**
 * (§8 #7), και ένα `verbatim` πάνω σε αντικείμενο **μεταγλωττίζεται μια χαρά** και
 * ζωγραφίζει `[object Object]` στον ανώνυμο επισκέπτη.
 *
 * 🔑 **Ο τύπος το απαγορεύει ήδη** (`AttributeValueKindFor`: μη βαθμωτό κλειδί δέχεται
 * **μόνο** `'custom'`). Αυτή η άγκυρα είναι η **εκτελέσιμη** μισή του ζεύγους: ο
 * μεταγλωττιστής δεν τρέχει στο CI ως πύλη για πράκτορα (N.17), και μια εγγύηση που
 * κανείς δεν **εκτελεί** είναι σχόλιο.
 */
describe('Τ4 — 🔴 καμία τιμή ιδιότητας δεν γίνεται `[object Object]`', () => {
  /** Αγγελία με **κάθε** ιδιότητα δηλωμένη — ώστε να ζωγραφιστούν όλες. */
  const FULL: PublicListing = {
    id: 'prop_τ4',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 1, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'maisonette',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    floor: 1,
    bedrooms: 3,
    energyClass: 'B',
    condition: 'good',
    renovationYear: 2015,
    bathrooms: 2,
    wc: 1,
    totalRooms: 5,
    levels: { provenance: 'measured', value: 2, at: '2026-09-02T00:00:00.000Z', sourceRef: 'property-model:levels' },
    balconies: 2,
    netAreaSqm: 85,
    balconyAreaSqm: 10,
    terraceAreaSqm: 5,
    gardenAreaSqm: 0,
    heatingType: 'autonomous',
    heatingFuel: 'natural-gas',
    coolingType: 'split-units',
    waterHeating: 'electric',
    windowFrames: 'aluminium',
    glazing: 'double',
    flooring: ['tiles'],
    orientations: ['northeast'],
    interiorFeatures: ['fireplace'],
    securityFeatures: ['alarm'],
    amenities: [],
    title: 'Μεζονέτα',
    legality: [],
    projectedAt: '2026-09-02T00:00:00.000Z',
  };

  it.each([...LISTING_ATTRIBUTE_KEYS])('«%s» δεν παράγει ποτέ `[object Object]`', (key) => {
    const { t } = recordingT();
    expect(attributeValue(t, FULL, key)).not.toContain('object Object');
  });

  it('…και καμία δεν είναι κενή για δηλωμένη τιμή', () => {
    const { t } = recordingT();
    for (const key of LISTING_ATTRIBUTE_KEYS) {
      expect([key, attributeValue(t, FULL, key).length > 0]).toEqual([key, true]);
    }
  });

  it('🔴 τα επίπεδα ζωγραφίζουν την ΤΙΜΗ, όχι το δοχείο', () => {
    const { t } = recordingT();
    expect(attributeValue(t, FULL, 'levels')).toBe('2');
  });
});
