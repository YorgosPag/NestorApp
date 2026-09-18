/**
 * ΑΓΚΥΡΕΣ — **ποιες αγγελίες δείχνουν τιμή στον χάρτη** (ADR-777 §8.60, Ε2).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΗΜΑΝΤΙΚΟΤΕΡΗ ΟΜΑΔΑ ΔΕΝ ΕΙΝΑΙ ΟΙ ΤΡΕΙΣ ΚΑΝΟΝΕΣ — ΕΙΝΑΙ Η **Κ5**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η Κ5 **εκτελεί** τον ισχυρισμό ότι το ποσό που ζωγραφίζεται είναι **το ίδιο** με το
 * `priceSortKey`. Χωρίς αυτήν, ο ισχυρισμός θα ήταν σχόλιο — και το `CLAUDE.md`
 * καταγράφει ρητά τι αξίζει ένα σχόλιο χωρίς πύλη (*«ένα anchor χωρίς gate δεν είναι
 * anchor — είναι σχόλιο»*). Αν κάποια μέρα ο κριτής τιμής αποκτήσει δεύτερη διαδρομή,
 * αυτή η ομάδα κοκκινίζει **πριν** η οθόνη δείξει έναν αριθμό και ταξινομήσει με άλλον.
 *
 * ⚠️ Η **Κ1** είναι το κανάλι ειλικρίνειας: πινακίδα σε θέση με αβεβαιότητα πάνω από
 * όσο δέχεται ο κλάδος (Airbnb: < 1 χλμ) λέει **ακριβή τιμή σε ανακριβή θέση**.
 * Ελέγχονται **όλα** τα σχήματα, όχι δείγμα — αλλιώς μια μελλοντική χαλάρωση θα
 * περνούσε στο μισό. (Ως 2026-09-17 ο κανόνας ήταν «μόνο `pin`» και έκρυβε κάθε
 * γεωκωδικοποιημένη διεύθυνση χωρίς αριθμό — δες ADR-777 §8.60.)
 */

import {
  listingPriceMarkers,
  PLAQUE_MAX_UNCERTAINTY_M,
  PRICE_MARKER_LIMIT,
  type ListingPriceMarker,
} from '../listing-price-markers';
import { listingsToGeoJson, type ListingFeatureProperties } from '../listings-geojson';
import { LISTING_UNCERTAINTY_KM } from '../listing-map-shape';
import { priceSortKey } from '@/lib/properties/price-resolver';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

const AT = '2026-09-06T10:00:00.000Z';

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l1',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    exchange: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'known', provenance: 'manual', point: { lat: 40.64, lng: 22.94 }, locatedAt: AT },
    floor: 1,
    bedrooms: 3,
    title: 'Δοκιμή',
    ...UNASKED_LISTING_ATTRIBUTES,
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    legality: [],
    projectedAt: AT,
    listedAt: { kind: 'unknown', reason: 'predates-record' },
    priceReduction: null,
    ...over,
  };
}

/** Αγγελία με **ακριβή πινέζα** και τιμή — η μόνη μορφή που δικαιούται πινακίδα. */
function priced(id: string, amount: number, lng = 22.94, lat = 40.64): PublicListing {
  return listing({
    id,
    title: `Ακίνητο ${id}`,
    commercial: { askingPrice: amount, finalPrice: null, rentPrice: null, nightlyRate: null },
    position: { kind: 'known', provenance: 'manual', point: { lat, lng }, locatedAt: AT },
  });
}

/** Ο ζωγράφος και ο κριτής βλέπουν **τα ίδια** δεδομένα — όπως στην οθόνη. */
function markersOf(listings: readonly PublicListing[], limit?: number): readonly ListingPriceMarker[] {
  return listingPriceMarkers(listings, listingsToGeoJson(listings), limit);
}

// ============================================================================
// Κ1 — ΞΕΡΟΥΜΕ **ΠΟΥ**: πινακίδα μόνο μέσα στο όριο αβεβαιότητας
// ============================================================================

describe('Κ1 — πινακίδα μόνο όσο η θέση είναι αρκετά γνωστή', () => {
  it('η ακριβής πινέζα (χειροκίνητη) παίρνει πινακίδα', () => {
    expect(markersOf([priced('a', 100)]).map((m) => m.id)).toEqual(['a']);
  });

  it('η γεωκωδικοποιημένη ΑΚΡΙΒΗΣ διεύθυνση παίρνει πινακίδα', () => {
    const l = listing({
      id: 'exact',
      position: {
        kind: 'known', provenance: 'geocoded', accuracy: 'exact',
        point: { lat: 40.6, lng: 22.9 }, locatedAt: AT,
      },
    });
    expect(markersOf([l]).map((m) => m.id)).toEqual(['exact']);
  });

  /*
    🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΠΕΡΙΣΤΑΤΙΚΟΥ 2026-09-17.** Κατάλυμα στη Θεσσαλονίκη, διεύθυνση
    χωρίς αριθμό ⇒ `interpolated` ⇒ δακτύλιος 250 μ. — και **καμία** τιμή στον χάρτη,
    ενώ η κάρτα δίπλα έγραφε «50 €». Το Airbnb δείχνει τιμή σε αβεβαιότητα έως ~1 χλμ.
  */
  it('η γεωκωδικοποιημένη διεύθυνση ΧΩΡΙΣ αριθμό (δακτύλιος) παίρνει πινακίδα', () => {
    const l = listing({
      id: 'ring',
      position: {
        kind: 'known', provenance: 'geocoded', accuracy: 'interpolated',
        point: { lat: 40.67, lng: 22.91 }, locatedAt: AT,
      },
    });
    expect(markersOf([l]).map((m) => m.id)).toEqual(['ring']);
  });

  it('το όριο διαχωρίζει τα σχήματα ΑΚΡΙΒΩΣ όπως δηλώνει ο πίνακας αβεβαιότητας', () => {
    expect(PLAQUE_MAX_UNCERTAINTY_M).toBeLessThanOrEqual(1000);
    expect((LISTING_UNCERTAINTY_KM['pin-with-ring'] ?? Infinity) * 1000).toBeLessThanOrEqual(PLAQUE_MAX_UNCERTAINTY_M);
    expect((LISTING_UNCERTAINTY_KM['shaded-circle'] ?? 0) * 1000).toBeGreaterThan(PLAQUE_MAX_UNCERTAINTY_M);
  });

  it.each([
    ['shaded-circle — συνοικία', 'approximate'],
    ['shaded-city — μόνο πόλη', 'center'],
  ] as const)('ΔΕΝ παίρνει πινακίδα: %s', (_label, accuracy) => {
    const l = listing({
      id: 'x',
      position: {
        kind: 'known', provenance: 'geocoded', accuracy,
        point: { lat: 40.6, lng: 22.9 }, locatedAt: AT,
      },
    });
    expect(markersOf([l])).toEqual([]);
  });

  it('ΔΕΝ παίρνει πινακίδα το μετρημένο περίγραμμα (outline)', () => {
    const l = listing({
      id: 'outline',
      position: {
        kind: 'known', provenance: 'survey', point: { lat: 40.6, lng: 22.9 }, locatedAt: AT,
        outline: [
          { lat: 40.60, lng: 22.90 }, { lat: 40.61, lng: 22.90 }, { lat: 40.61, lng: 22.91 },
        ],
      },
    });
    expect(markersOf([l])).toEqual([]);
  });

  it('ΔΕΝ παίρνει πινακίδα αγγελία χωρίς δηλωμένη θέση', () => {
    const l = listing({ id: 'nowhere', position: { kind: 'unknown', reason: 'never-asked' } });
    expect(markersOf([l])).toEqual([]);
  });
});

// ============================================================================
// Κ2 — ΞΕΡΟΥΜΕ **ΠΟΣΟ**: χωρίς τιμή, κουκίδα
// ============================================================================

describe('Κ2 — χωρίς τιμή δεν υπάρχει πινακίδα', () => {
  it('ακριβής πινέζα ΧΩΡΙΣ καταχωρημένη τιμή μένει κουκίδα', () => {
    const l = listing({
      id: 'unpriced',
      commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null },
    });
    expect(markersOf([l])).toEqual([]);
  });

  it('ακίνητο εκτός αγοράς ΧΩΡΙΣ αριθμό μένει κουκίδα', () => {
    const l = listing({
      id: 'off-market',
      commercialStatus: 'not-listed',
      offerKinds: [],
      commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: null },
    });
    expect(markersOf([l])).toEqual([]);
  });

  /*
    🔴 **ΚΑΝΕΝΑ ΔΕΥΤΕΡΟ ΦΙΛΤΡΟ ΚΑΤΑΣΤΑΣΗΣ ΕΔΩ — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Η ΑΓΚΥΡΑ.**
    Η πρώτη γραφή αυτού του αρχείου **υπέθεσε** ότι `commercialStatus: 'not-listed'`
    σημαίνει «καμία πινακίδα», και **κοκκίνισε**: ο κριτής επιστρέφει `priced` όταν
    υπάρχει καταχωρημένο ποσό, **ανεξάρτητα** από την κατάσταση — γιατί, γραμμένο στην
    πηγή του, *«ο παλιός πίνακας συμβουλεύεται πρώτος επειδή ό,τι λέει είναι
    αποδεδειγμένο… μιλά μόνο μέσα σε δηλωμένη σιωπή»*.
    ⇒ Η πινακίδα **δεν κρίνει, ρωτά**. Αν εδώ γεννιόταν δικό μας φίλτρο κατάστασης, ο
    χάρτης θα έλεγε «χωρίς τιμή» για ακίνητο που η κάρτα δίπλα του τιμολογεί — το σχήμα
    ADR-749 (δύο μηχανές, δύο αριθμοί) σε δύο στοιχεία της ίδιας οθόνης.
  */
  it('ό,τι τιμολογεί ο κριτής, τιμολογεί και η πινακίδα — καμία δεύτερη κρίση', () => {
    const l = listing({ id: 'off-market-priced', commercialStatus: 'not-listed' });
    expect(markersOf([l]).map((m) => m.amount)).toEqual([priceSortKey(l)]);
  });

  it('το ενοίκιο ΕΙΝΑΙ τιμή — παίρνει πινακίδα', () => {
    const l = listing({
      id: 'rent',
      commercialStatus: 'for-rent',
      offerKinds: ['leaseOut'],
      commercial: { askingPrice: null, finalPrice: null, rentPrice: 500, nightlyRate: null },
    });
    expect(markersOf([l]).map((m) => m.amount)).toEqual([500]);
  });
});

// ============================================================================
// Κ3 — ΦΡΑΓΜΕΝΟ ΠΛΗΘΟΣ, ΚΑΙ Η ΣΕΙΡΑ ΕΙΝΑΙ «ΤΙΜΗ ↑»
// ============================================================================

describe('Κ3 — το ανώτατο όριο', () => {
  const many = [priced('e', 500), priced('a', 100), priced('c', 300), priced('b', 200), priced('d', 400)];

  it('κρατά τα ΦΘΗΝΟΤΕΡΑ όταν το όριο κόβει', () => {
    expect(markersOf(many, 3).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('η σειρά είναι αύξουσα τιμή, ανεξάρτητα από τη σειρά εισόδου', () => {
    const reversed = [...many].reverse();
    expect(markersOf(reversed).map((m) => m.amount)).toEqual([100, 200, 300, 400, 500]);
  });

  it('όριο 0 ή αρνητικό ⇒ καμία πινακίδα', () => {
    expect(markersOf(many, 0)).toEqual([]);
    expect(markersOf(many, -1)).toEqual([]);
  });

  it('η προεπιλογή είναι το PRICE_MARKER_LIMIT, μέσα στο εύρος 30-50 του Airbnb', () => {
    expect(PRICE_MARKER_LIMIT).toBeGreaterThanOrEqual(30);
    expect(PRICE_MARKER_LIMIT).toBeLessThanOrEqual(50);

    const crowd = Array.from({ length: PRICE_MARKER_LIMIT + 7 }, (_, i) =>
      priced(`p${String(i).padStart(3, '0')}`, 1000 + i));
    expect(markersOf(crowd)).toHaveLength(PRICE_MARKER_LIMIT);
  });

  it('ισοπαλία τιμής ⇒ σταθερή σειρά κατά ταυτότητα, όχι κατά σειρά εισόδου', () => {
    const tied = [priced('z', 100), priced('m', 100), priced('a', 100)];
    expect(markersOf(tied).map((m) => m.id)).toEqual(['a', 'm', 'z']);
    expect(markersOf([...tied].reverse()).map((m) => m.id)).toEqual(['a', 'm', 'z']);
  });
});

// ============================================================================
// Κ4 — ΟΛΙΚΟΤΗΤΑ: παραμορφωμένο feature δεν ρίχνει τίποτα
// ============================================================================

describe('Κ4 — η στένωση τύπου εκτελείται', () => {
  it('feature με shape "pin" αλλά γεωμετρία Polygon παραλείπεται σιωπηλά', () => {
    const malformed: GeoJSON.FeatureCollection<
      GeoJSON.Point | GeoJSON.Polygon,
      ListingFeatureProperties
    > = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        id: 'bad',
        geometry: { type: 'Polygon', coordinates: [[[22.9, 40.6], [22.91, 40.6], [22.91, 40.61], [22.9, 40.6]]] },
        properties: {
          id: 'bad',
          shape: 'pin',
          title: 'Παραμορφωμένο',
          uncertaintyM: 0,
          mercatorScale: 1.316,
        },
      }],
    };

    expect(listingPriceMarkers([priced('bad', 100)], malformed)).toEqual([]);
  });
});

// ============================================================================
// Κ5 — ΔΕΥΤΕΡΟ ΚΛΕΙΔΙ ΔΙΑΤΑΞΗΣ ΔΕΝ ΓΕΝΝΗΘΗΚΕ  🔴 Η ΚΡΙΣΙΜΗ ΟΜΑΔΑ
// ============================================================================

describe('Κ5 — το ποσό της πινακίδας ΕΙΝΑΙ το priceSortKey', () => {
  it('κάθε πινακίδα δείχνει ακριβώς ό,τι θα ταξινομούσε ο SSoT', () => {
    const listings = [
      priced('sale', 250000),
      listing({
        id: 'rent',
        commercialStatus: 'for-rent',
        offerKinds: ['leaseOut'],
        commercial: { askingPrice: null, finalPrice: null, rentPrice: 750, nightlyRate: null },
      }),
      listing({
        id: 'sold',
        commercialStatus: 'sold',
        commercial: { askingPrice: 200000, finalPrice: 185000, rentPrice: null, nightlyRate: null },
      }),
    ];

    const markers = markersOf(listings);
    expect(markers).toHaveLength(3);

    for (const marker of markers) {
      const source = listings.find((l) => l.id === marker.id);
      expect(source).toBeDefined();
      expect(marker.amount).toBe(priceSortKey(source as PublicListing));
    }
  });

  it('το πωλημένο δείχνει την ΤΕΛΙΚΗ τιμή, όχι τη ζητούμενη — όπως ο κριτής', () => {
    const sold = listing({
      id: 'sold',
      commercialStatus: 'sold',
      commercial: { askingPrice: 200000, finalPrice: 185000, rentPrice: null, nightlyRate: null },
    });
    expect(markersOf([sold]).map((m) => m.amount)).toEqual([185000]);
  });
});

// ============================================================================
// Κ6 — Η ΘΕΣΗ ΕΙΝΑΙ Η ΙΔΙΑ ΣΥΝΤΕΤΑΓΜΕΝΗ ΜΕ ΤΟ ΣΧΗΜΑ
// ============================================================================

describe('Κ6 — καμία δεύτερη μετατροπή σε [lng, lat]', () => {
  it('η πινακίδα κάθεται ακριβώς στο σημείο του feature, χωρίς αντιστροφή ζεύγους', () => {
    const l = priced('geo', 100, 22.9444, 40.6401);
    const geoJson = listingsToGeoJson([l]);
    const point = geoJson.features[0].geometry as GeoJSON.Point;

    const [marker] = listingPriceMarkers([l], geoJson);
    expect([marker.lng, marker.lat]).toEqual(point.coordinates);
    // ⚠️ Ρητά: το πλάτος μένει πλάτος. Αντιστροφή θα έστελνε το ακίνητο στη Σομαλία.
    expect(marker.lat).toBeCloseTo(40.6401, 6);
    expect(marker.lng).toBeCloseTo(22.9444, 6);
  });

  it('ο τίτλος ταξιδεύει, για το προσβάσιμο όνομα', () => {
    expect(markersOf([priced('t', 100)])[0].title).toBe('Ακίνητο t');
  });
});

// ============================================================================
// Κ7 — ΡΟΛΟΣ ΚΑΙ ΣΕΙΡΑ ΑΝΑΜΕΣΑ ΣΕ ΑΝΟΜΟΙΑ ΠΟΣΑ (2026-09-17)
// ============================================================================

describe('Κ7 — η πινακίδα ξέρει ΤΙ ΕΙΔΟΥΣ ποσό είναι, και η σειρά δεν συγκρίνει ανόμοια', () => {
  function rent(id: string, amount: number): PublicListing {
    return listing({
      id,
      commercialStatus: 'for-rent',
      offerKinds: ['leaseOut'],
      commercial: { askingPrice: null, finalPrice: null, rentPrice: amount, nightlyRate: null },
    });
  }

  function nightly(id: string, amount: number): PublicListing {
    return listing({
      id,
      commercialStatus: 'unavailable',
      offerKinds: ['leaseShort'],
      commercial: { askingPrice: null, finalPrice: null, rentPrice: null, nightlyRate: amount },
    });
  }

  it('ο ρόλος ταξιδεύει από τον κριτή — πώληση, μίσθωμα, διανυκτέρευση', () => {
    const roles = Object.fromEntries(
      markersOf([priced('s', 170000), rent('r', 900), nightly('n', 50)]).map((m) => [m.id, m.role]),
    );
    expect(roles).toEqual({ s: 'sale', r: 'rent', n: 'nightly' });
  });

  it('το κατάλυμα ΜΟΝΟ βραχυχρόνιας μίσθωσης παίρνει πινακίδα με την τιμή ανά νύχτα', () => {
    expect(markersOf([nightly('stay', 50)]).map((m) => [m.amount, m.role])).toEqual([[50, 'nightly']]);
  });

  /*
    🔴 **Η βλάβη που φυλάει**: με έναν άξονα «τιμή ↑», 50 €/νύχτα < 900 €/μήνα < 170.000 €
    ⇒ ένα όριο 3 θα γέμιζε ΜΟΝΟ με διανυκτερεύσεις. Εναλλάξ ανά ρόλο, κάθε είδος
    παίρνει μερίδιο.
  */
  it('όταν το όριο κόβει, κάθε ρόλος παίρνει μερίδιο — όχι ο φθηνότερος σε μονάδα', () => {
    const crowd = [
      nightly('n1', 40), nightly('n2', 45), nightly('n3', 50),
      rent('r1', 700), rent('r2', 800),
      priced('s1', 150000), priced('s2', 160000),
    ];
    expect(markersOf(crowd, 3).map((m) => m.id)).toEqual(['s1', 'r1', 'n1']);
    expect(markersOf(crowd, 5).map((m) => m.id)).toEqual(['s1', 'r1', 'n1', 's2', 'r2']);
  });

  it('μέσα στον ίδιο ρόλο ισχύει η «τιμή ↑», ανεξάρτητα από τη σειρά εισόδου', () => {
    const stays = [nightly('c', 90), nightly('a', 30), nightly('b', 60)];
    expect(markersOf(stays).map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(markersOf([...stays].reverse()).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});
