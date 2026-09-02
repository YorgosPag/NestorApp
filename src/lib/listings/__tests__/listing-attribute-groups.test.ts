/**
 * Άγκυρες για τις **ομάδες στοιχείων** και την **τρίτη κατάσταση των συνόλων**
 * (ADR-842 Φ3 · §8 #4).
 *
 * 🔑 Η σημαντικότερη ομάδα είναι η **Ο2**: ότι οι ομάδες **διαμερίζουν** τα στοιχεία —
 * κάθε στοιχείο σε **ακριβώς μία**. Χωρίς αυτήν, ένα πεδίο θα μπορούσε να λείπει από
 * **όλες** τις ομάδες και να μην εμφανιστεί ποτέ, ενώ η συνολική λογιστική από πάνω θα
 * συνέχιζε να λέει «6 από 27» — δηλαδή το ακριβές σχήμα *«η λίστα λέει 11 και ο χάρτης
 * δείχνει 10»* (κανόνας 27), μεταφερμένο μέσα σε μία κάρτα.
 *
 * ⚠️ Ο μεταγλωττιστής καλύπτει τη **μία** κατεύθυνση (`Record<…Key, …>`). Εδώ κρίνεται
 * η **άλλη**: ότι ό,τι ο πίνακας αναθέτει, η οθόνη το **βρίσκει**.
 */

import {
  LISTING_ATTRIBUTE_KEYS,
  LISTING_FEATURE_SET_KEYS,
} from '../listing-disclosure';
import {
  LISTING_ATTRIBUTE_GROUP,
  LISTING_ATTRIBUTE_GROUPS,
  listingGroupLedger,
  listingGroupMembers,
} from '../listing-attribute-groups';
import {
  featureSetState,
  listingAttributeLedger,
  listingFeatureSetValues,
} from '../listing-attribute-declared';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

const AT = '2026-09-02T10:00:00.000Z';

/** Ελάχιστη αγγελία — μόνο ό,τι χρειάζονται αυτές οι άγκυρες. */
function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'prop_a0000001',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 1, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    floor: 1,
    bedrooms: 3,
    // Η **ονομασμένη απουσία** των 23, αντί για είκοσι τρία `null` γραμμένα εδώ.
    ...UNASKED_LISTING_ATTRIBUTES,
    title: 'Δοκιμή',
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

// ============================================================================
// Ο1 — ΚΑΘΕ ΣΤΟΙΧΕΙΟ ΕΧΕΙ ΟΜΑΔΑ, ΚΑΙ ΚΑΘΕ ΟΜΑΔΑ ΕΙΝΑΙ ΔΗΛΩΜΕΝΗ
// ============================================================================

describe('Ο1 — ο πίνακας ομάδων καλύπτει ό,τι δημοσιεύεται', () => {
  it('κάθε ιδιότητα και κάθε σύνολο έχει γραμμή', () => {
    const assigned = Object.keys(LISTING_ATTRIBUTE_GROUP).sort();
    const published = [...LISTING_ATTRIBUTE_KEYS, ...LISTING_FEATURE_SET_KEYS].sort();
    expect(assigned).toEqual(published);
  });

  it('καμία ομάδα δεν αναφέρεται χωρίς να είναι δηλωμένη στη σειρά της οθόνης', () => {
    for (const group of Object.values(LISTING_ATTRIBUTE_GROUP)) {
      expect(LISTING_ATTRIBUTE_GROUPS).toContain(group);
    }
  });

  it('καμία δηλωμένη ομάδα δεν είναι κενή — μια ομάδα χωρίς μέλη είναι κεφαλίδα χωρίς λόγο', () => {
    for (const group of LISTING_ATTRIBUTE_GROUPS) {
      const members = listingGroupMembers(group);
      expect(members.attributes.length + members.featureSets.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Ο2 — 🔴 ΟΙ ΟΜΑΔΕΣ ΔΙΑΜΕΡΙΖΟΥΝ: ΤΙΠΟΤΑ ΔΕΝ ΧΑΝΕΤΑΙ, ΤΙΠΟΤΑ ΔΕΝ ΔΙΠΛΩΝΕΙ
// ============================================================================

describe('Ο2 — κάθε στοιχείο εμφανίζεται σε ΑΚΡΙΒΩΣ μία ομάδα', () => {
  const attributes = LISTING_ATTRIBUTE_GROUPS.flatMap(
    (group) => listingGroupMembers(group).attributes
  );
  const featureSets = LISTING_ATTRIBUTE_GROUPS.flatMap(
    (group) => listingGroupMembers(group).featureSets
  );

  it('η ένωση των ομάδων ΕΙΝΑΙ ο κατάλογος', () => {
    expect([...attributes].sort()).toEqual([...LISTING_ATTRIBUTE_KEYS].sort());
    expect([...featureSets].sort()).toEqual([...LISTING_FEATURE_SET_KEYS].sort());
  });

  it('χωρίς διπλοεμφανίσεις', () => {
    expect(new Set(attributes).size).toBe(attributes.length);
    expect(new Set(featureSets).size).toBe(featureSets.length);
  });

  it('η σειρά μέσα στην ομάδα ΕΙΝΑΙ η σειρά του πίνακα αποκάλυψης, όχι δεύτερη δήλωση', () => {
    const essentials = listingGroupMembers('essentials').attributes;
    const expected = LISTING_ATTRIBUTE_KEYS.filter((key) => essentials.includes(key));
    expect([...essentials]).toEqual([...expected]);
  });
});

// ============================================================================
// Ο3 — Η ΛΟΓΙΣΤΙΚΗ ΤΩΝ ΟΜΑΔΩΝ ΑΘΡΟΙΖΕΙ ΣΤΗ ΣΥΝΟΛΙΚΗ
// ============================================================================

describe('Ο3 — τα ισοζύγια των ομάδων κλείνουν στο συνολικό', () => {
  it.each([
    ['κενή αγγελία', listing()],
    ['με χαρακτηριστικά', listing({ energyClass: 'B', condition: 'good', amenities: ['pool'] })],
    ['σύνολο δηλωμένο άδειο', listing({ interiorFeatures: [] })],
  ])('%s', (_name, sample) => {
    const total = listingAttributeLedger(sample);
    const perGroup = LISTING_ATTRIBUTE_GROUPS.map((group) => listingGroupLedger(sample, group));

    expect(perGroup.reduce((sum, l) => sum + l.total, 0)).toBe(total.total);
    expect(perGroup.reduce((sum, l) => sum + l.declared, 0)).toBe(total.declared);
    expect(perGroup.reduce((sum, l) => sum + l.undeclared, 0)).toBe(total.undeclared);
  });
});

// ============================================================================
// Ο4 — 🏆 Η ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ: `null` ΚΑΙ `[]` ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ
// ============================================================================

describe('Ο4 — τα σύνολα έχουν ΤΡΕΙΣ καταστάσεις, όχι δύο', () => {
  it('`null` ⇒ κανείς δεν ρώτησε', () => {
    expect(featureSetState(listing({ amenities: null }), 'amenities')).toBe('never-asked');
  });

  it('`[]` ⇒ ο κάτοχος απάντησε «καμία» — ΔΕΝ είναι το ίδιο με το `null`', () => {
    expect(featureSetState(listing({ amenities: [] }), 'amenities')).toBe('declared-none');
  });

  it('τιμές ⇒ δηλωμένο', () => {
    expect(featureSetState(listing({ amenities: ['pool'] }), 'amenities')).toBe('declared');
  });

  it('οι τιμές διαβάζονται από ΤΟ ΔΙΚΟ ΤΟΥΣ πεδίο', () => {
    const sample = listing({ amenities: ['pool'], interiorFeatures: ['sauna'] });
    expect(listingFeatureSetValues(sample, 'amenities')).toEqual(['pool']);
    expect(listingFeatureSetValues(sample, 'interiorFeatures')).toEqual(['sauna']);
  });
});
