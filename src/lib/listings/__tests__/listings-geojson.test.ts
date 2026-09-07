/**
 * @fileoverview ΑΓΚΥΡΕΣ — **το feature κουβαλά ό,τι χρειάζεται ο ζωγράφος, σε ΜΕΤΡΑ**.
 * @related ADR-777 §8.64 · lib/listings/listings-geojson.ts · lib/maps/metric-size.ts
 *
 * 🔴 **ΤΟ ΑΡΧΕΙΟ ΓΕΝΝΗΘΗΚΕ ΜΕ ΤΟ ΕΥΡΗΜΑ ΟΤΙ ΔΕΝ ΥΠΗΡΧΕ.** Το `listingsToGeoJson`
 * είναι ο **μοναδικός** δρόμος από την αγγελία στον χάρτη — και δεν είχε **καμία**
 * δική του σουίτα: το άγγιζαν έμμεσα δύο άλλες (`listing-filters`,
 * `listing-price-markers`), για δικούς τους λόγους. Δηλαδή η μετατροπή `[lng, lat]`,
 * το κλείσιμο του δακτυλίου και ο αποκλεισμός των άστεγων αγγελιών ζούσαν **χωρίς
 * φρουρό**.
 *
 * ⚠️ Χρησιμοποιεί το **κοινό** εργοστάσιο `listing()` (N.18/jscpd): μια δεύτερη
 * χειρόγραφη αγγελία 50 πεδίων θα απέκλινε στην πρώτη προσθήκη πεδίου.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { mercatorScaleAt } from '@/lib/maps/metric-size';
import type { GeocodingAccuracy } from '@/types/geo/public-place';
import type { PublicListing } from '@/types/public-listing';

import { LISTING_UNCERTAINTY_KM } from '../listing-map-shape';
import { listingsToGeoJson, LISTING_FEATURE_KEY } from '../listings-geojson';

/** Το ίδιο σημείο σε όλα τα δείγματα, ώστε η διαφορά να είναι **μόνο** η ακρίβεια. */
const POINT = { lat: 37.9838, lng: 23.7275 } as const;

function geocoded(accuracy: GeocodingAccuracy, overrides: Partial<PublicListing> = {}) {
  return listing({
    position: {
      kind: 'known',
      provenance: 'geocoded',
      point: POINT,
      locatedAt: '2026-08-11T00:00:00.000Z',
      accuracy,
    },
    ...overrides,
  });
}

function propertiesOf(input: readonly PublicListing[], index = 0) {
  return listingsToGeoJson(input).features[index].properties;
}

// ============================================================================
// Κ1 — Η ΑΒΕΒΑΙΟΤΗΤΑ ΦΤΑΝΕΙ ΣΤΟΝ ΖΩΓΡΑΦΟ ΣΕ ΜΕΤΡΑ  🔴 Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ
// ============================================================================

describe('Κ1 — uncertaintyM: ο ζωγράφος διαβάζει το ΙΔΙΟ νούμερο με τον κριτή', () => {
  it.each([
    ['exact', 'pin'],
    ['interpolated', 'pin-with-ring'],
    ['approximate', 'shaded-circle'],
    ['center', 'shaded-city'],
  ] as const)('ακρίβεια "%s" ⇒ σχήμα "%s" με τη δηλωμένη αβεβαιότητα', (accuracy, shape) => {
    const properties = propertiesOf([geocoded(accuracy)]);

    expect(properties.shape).toBe(shape);
    // 🔴 Ο έλεγχος διαβάζει τον **πίνακα**, όχι αντιγραμμένο αριθμό: ένα σκληρό `10_000`
    //    εδώ θα ήταν δεύτερη δήλωση της αβεβαιότητας — ακριβώς το σχήμα ADR-749.
    expect(properties.uncertaintyM).toBe((LISTING_UNCERTAINTY_KM[shape] ?? 0) * 1000);
  });

  it('🔴 ΕΙΝΑΙ ΜΕΤΡΑ, ΟΧΙ ΧΙΛΙΟΜΕΤΡΑ — η μονάδα είναι το ίδιο το ελάττωμα', () => {
    // Χωρίς τη μετατροπή, η «πόλη» θα ζητούσε κύκλο **10 μέτρων** αντί για 10 χλμ:
    // χίλιες φορές μικρότερο, δηλαδή αόρατο, δηλαδή η αγγελία εξαφανίζεται.
    expect(propertiesOf([geocoded('center')]).uncertaintyM).toBe(10_000);
    expect(propertiesOf([geocoded('approximate')]).uncertaintyM).toBe(1_500);
  });

  it('η βεβαιότητα δηλώνεται ως μηδέν, όχι ως απουσία', () => {
    expect(propertiesOf([geocoded('exact')]).uncertaintyM).toBe(0);
  });

  it('η αβεβαιότητα ΜΕΓΑΛΩΝΕΙ όσο πέφτει η ακρίβεια — η σειρά είναι ο ισχυρισμός', () => {
    const metres = (['exact', 'interpolated', 'approximate', 'center'] as const).map(
      (accuracy) => propertiesOf([geocoded(accuracy)]).uncertaintyM
    );
    expect(metres).toEqual([...metres].sort((a, b) => a - b));
    expect(new Set(metres).size).toBe(metres.length);
  });
});

// ============================================================================
// Κ2 — Ο ΣΥΝΤΕΛΕΣΤΗΣ MERCATOR ΤΑΞΙΔΕΥΕΙ ΜΕ ΤΟ FEATURE  🔴 Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ
// ============================================================================

describe('Κ2 — mercatorScale: ανά αγγελία, από το ΠΛΑΤΟΣ της', () => {
  it('βγαίνει από το γεωγραφικό ΠΛΑΤΟΣ, όχι από το μήκος', () => {
    // 🔴 Η κλασική εναλλαγή. Στην Αθήνα `lat 37,98` και `lng 23,73` δίνουν **και τα
    //    δύο** πεπερασμένο συντελεστή, άρα το λάθος **δεν σκάει** — απλώς ζωγραφίζει
    //    κάθε κύκλο ~9% λάθος, για πάντα, σιωπηλά.
    const properties = propertiesOf([geocoded('center')]);
    expect(properties.mercatorScale).toBeCloseTo(mercatorScaleAt(POINT.lat), 12);
    expect(properties.mercatorScale).not.toBeCloseTo(mercatorScaleAt(POINT.lng), 4);
  });

  it('δύο αγγελίες σε διαφορετικό πλάτος παίρνουν ΔΙΑΦΟΡΕΤΙΚΟ συντελεστή', () => {
    const north = geocoded('center', { id: 'prop_north' });
    const south = listing({
      id: 'prop_south',
      position: {
        kind: 'known',
        provenance: 'geocoded',
        point: { lat: 35.34, lng: 25.13 },
        locatedAt: '2026-08-11T00:00:00.000Z',
        accuracy: 'center',
      },
    });

    const [athens, crete] = listingsToGeoJson([north, south]).features;
    expect(athens.properties.mercatorScale).toBeGreaterThan(crete.properties.mercatorScale);
  });

  it('στα ελληνικά πλάτη είναι ουσιώδης, όχι στρογγυλοποίηση', () => {
    // Χωρίς αυτόν, κάθε κύκλος αβεβαιότητας ζωγραφιζόταν >20% μικρότερος.
    expect(propertiesOf([geocoded('center')]).mercatorScale).toBeGreaterThan(1.2);
  });
});

// ============================================================================
// Κ3 — ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΠΕΔΙΩΝ ΕΙΝΑΙ ΕΝΑ
// ============================================================================

describe('Κ3 — τα ονόματα που ζητά ο ζωγράφος ΥΠΑΡΧΟΥΝ', () => {
  it('κάθε κλειδί του LISTING_FEATURE_KEY δείχνει σε υπαρκτό πεδίο', () => {
    const properties = propertiesOf([geocoded('approximate')]);
    for (const key of Object.values(LISTING_FEATURE_KEY)) {
      expect(properties).toHaveProperty(key);
      expect(properties[key as keyof typeof properties]).toBeDefined();
    }
  });

  it('η τιμή κάθε καταχώρησης ΕΙΝΑΙ το όνομά της — αλλιώς το ["get"] αστοχεί σιωπηλά', () => {
    for (const [name, value] of Object.entries(LISTING_FEATURE_KEY)) {
      expect(value).toBe(name);
    }
  });
});

// ============================================================================
// Κ4 — ΟΣΑ ΙΣΧΥΑΝ ΗΔΗ ΚΑΙ ΔΕΝ ΕΙΧΑΝ ΦΡΟΥΡΟ
// ============================================================================

describe('Κ4 — η γεωμετρία, που ζούσε αφρούρητη', () => {
  it('το σημείο βγαίνει [lng, lat] — η ΑΝΤΙΣΤΡΟΦΗ σειρά από την ανθρώπινη', () => {
    const [feature] = listingsToGeoJson([geocoded('exact')]).features;
    expect(feature.geometry).toEqual({ type: 'Point', coordinates: [POINT.lng, POINT.lat] });
  });

  it('αγγελία χωρίς θέση ΔΕΝ μπαίνει — και δεν ρίχνει τίποτα', () => {
    const homeless = listing({ id: 'prop_nowhere', position: { kind: 'unknown' } });
    expect(listingsToGeoJson([homeless]).features).toEqual([]);
  });

  it('η ταυτότητα ταξιδεύει και στο feature και στις ιδιότητες', () => {
    const [feature] = listingsToGeoJson([geocoded('exact', { id: 'prop_42' })]).features;
    expect(feature.id).toBe('prop_42');
    expect(feature.properties.id).toBe('prop_42');
  });
});
