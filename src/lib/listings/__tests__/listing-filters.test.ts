/**
 * Άγκυρες φίλτρων + GeoJSON (ADR-777 Α3 · Α20 · Α5).
 */

import {
  parseListingFilters,
  serializeListingFilters,
  applyListingFilters,
  listingCriteriaMatch,
  stayQueryOf,
  EMPTY_LISTING_FILTERS,
  DEFAULT_SEARCH_RADIUS_KM,
  type ListingFilters,
} from '../listing-filters';
import {
  EMPTY_LISTING_CRITERIA,
  flagOf,
  rangeOf,
  valuesOf,
  withFlag,
  withRange,
  withValues,
  type ListingCriteria,
} from '@/lib/criteria/listing-criteria';
import { listingsToGeoJson } from '../listings-geojson';
import { UNASKED_LISTING_ATTRIBUTES, type PublicListing } from '@/types/public-listing';

const AT = '2026-08-10T10:00:00.000Z';

/** Φίλτρα **μόνο** με κριτήρια — οι τρεις ειδικοί άξονες μένουν ουδέτεροι. */
function onlyCriteria(criteria: ListingCriteria): ListingFilters {
  return { ...EMPTY_LISTING_FILTERS, criteria };
}

function listing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l1',
    commercialStatus: 'for-sale',
    commercial: { askingPrice: 200000, finalPrice: null, rentPrice: null, nightlyRate: null },
    stay: null,
    coverImage: null,
    gallery: [],
    type: 'apartment',
    areaSqm: 95,
    offerKinds: ['sell'],
    position: { kind: 'unknown', reason: 'never-asked' },
    floor: 1,
    bedrooms: 3,
    title: 'Δοκιμή',
    // ✅ **ADR-842 Φ3** — τα 23 χαρακτηριστικά, ως **μία** ονομασμένη απουσία.
    //    Οκτώ fixtures θα κρατούσαν ο καθένας τη δική του λίστα `null` — δηλαδή οκτώ
    //    λίστες που συμφωνούν μέχρι την πρώτη προσθήκη πεδίου.
    ...UNASKED_LISTING_ATTRIBUTES,
    place: null,
    authorship: 'agency',
    agencyName: null,
    agencyId: null,
    legality: [],
    projectedAt: AT,
    ...over,
  };
}

describe('Φ1 — τα φίλτρα ζουν στη διεύθυνση και επιβιώνουν', () => {
  it('γράψιμο → ανάγνωση επιστρέφει την ΙΔΙΑ κατάσταση', () => {
    // 🔴 **ΤΡΙΤΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΙΔΙΟΥ, 2026-09-04.** Οι επτά επίπεδοι άξονες έγιναν
    // **χάρτης κριτηρίων** (`lib/criteria/`), και αυτή η δοκιμή κοκκίνισε αμέσως —
    // δηλαδή έκανε ξανά τη δουλειά της. Οι δύο προηγούμενες φορές είναι γραμμένες
    // στο ιστορικό του αρχείου: ρητό `near: null` (Α3), ρητό `stayWindow: null` (Φ3).
    //
    // ⚠️ **Οι τρεις ειδικοί άξονες μένουν ΡΗΤΑ `null`** — δες `EMPTY_LISTING_FILTERS`.
    let criteria = withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['sell', 'exchange']);
    criteria = withValues(criteria, 'type', ['apartment']);
    criteria = withRange(criteria, 'price', { min: 100000, max: 300000 });
    criteria = withRange(criteria, 'areaSqm', { min: 50, max: null });
    criteria = withRange(criteria, 'bedrooms', { min: 2, max: null });
    criteria = withRange(criteria, 'floor', { min: 1, max: 4 });
    criteria = withValues(criteria, 'energyClass', ['A', 'B']);
    criteria = withValues(criteria, 'amenities', ['elevator']);
    criteria = withFlag(criteria, 'hasPhotos', true);

    const filters = { ...EMPTY_LISTING_FILTERS, criteria };
    expect(parseListingFilters(serializeListingFilters(filters))).toEqual(filters);
  });

  it('🔴 ΤΟ `false` ΤΗΣ ΣΗΜΑΙΑΣ ΕΠΙΒΙΩΝΕΙ — «μόνο ΧΩΡΙΣ φωτογραφίες» ≠ «δεν με νοιάζει»', () => {
    // Ένα `params.has()` ή ένα `Boolean(params.get())` θα ισοπέδωνε τις τρεις
    // καταστάσεις σε δύο, και η μία από αυτές θα γινόταν **ανέκφραστη**.
    const off = { ...EMPTY_LISTING_FILTERS, criteria: withFlag(EMPTY_LISTING_CRITERIA, 'hasPhotos', false) };
    const parsed = parseListingFilters(serializeListingFilters(off));
    expect(flagOf(parsed.criteria, 'hasPhotos')).toBe(false);
    expect(flagOf(EMPTY_LISTING_FILTERS.criteria, 'hasPhotos')).toBeUndefined();
  });

  it('τα κενά φίλτρα ΔΕΝ γράφονται — δύο ίδιες αναζητήσεις έχουν ΜΙΑ διεύθυνση', () => {
    expect(serializeListingFilters(EMPTY_LISTING_FILTERS).toString()).toBe('');
  });

  it('άγνωστη διάθεση στη διεύθυνση αγνοείται — η οθόνη δεν σκάει από ξένο σύνδεσμο', () => {
    const parsed = parseListingFilters(new URLSearchParams('offer=sell&offer=telepathy'));
    expect(valuesOf(parsed.criteria, 'offerKind')).toEqual(['sell']);
  });

  it('🔴 …και ο ΙΔΙΟΣ φρουρός ισχύει πλέον για ΚΑΘΕ λεξιλόγιο, όχι μόνο για τη διάθεση', () => {
    // Ως τις 2026-09-04 μόνο το `offer` επικυρωνόταν σε κλειστό σύνολο· το `type`
    // δεχόταν **οτιδήποτε**. Τώρα και οι δεκαέξι άξονες λεξιλογίου έχουν φρουρό.
    const parsed = parseListingFilters(new URLSearchParams('energy=A&energy=Ω&type=σπίτι'));
    expect(valuesOf(parsed.criteria, 'energyClass')).toEqual(['A']);
    expect(valuesOf(parsed.criteria, 'type')).toBeUndefined();
  });

  it('🔴 σκουπίδι σε αριθμό γίνεται null, ΟΧΙ 0 — το 0 θα φιλτράριζε τα πάντα', () => {
    const parsed = parseListingFilters(new URLSearchParams('pmin=abc&amin='));
    expect(rangeOf(parsed.criteria, 'price')).toBeUndefined();
    expect(rangeOf(parsed.criteria, 'areaSqm')).toBeUndefined();
  });

  it('🔴 ΤΟ ΠΑΛΙΟ `beds` ΕΞΑΚΟΛΟΥΘΕΙ ΝΑ ΔΙΑΒΑΖΕΤΑΙ — κοινοποιημένος σύνδεσμος δεν πεθαίνει σιωπηλά', () => {
    // Ο άξονας έγινε εύρος, άρα το κανονικό όνομα είναι `bedsmin`. Κάθε σύνδεσμος
    // που μοιράστηκε ως τώρα λέει `beds` — και ένας σύνδεσμος που **παύει σιωπηλά
    // να φιλτράρει** είναι χειρότερος από έναν που σπάει.
    expect(rangeOf(parseListingFilters(new URLSearchParams('beds=3')).criteria, 'bedrooms'))
      .toEqual({ min: 3, max: null });
    // ⚠️ Μονής κατεύθυνσης: γράφεται **μόνο** το κανονικό όνομα.
    const written = serializeListingFilters(
      parseListingFilters(new URLSearchParams('beds=3')),
    ).toString();
    expect(written).toBe('bedsmin=3');
  });
});

// ============================================================================
// Γ — Ο ΓΕΩΓΡΑΦΙΚΟΣ ΑΞΟΝΑΣ (ADR-777 Α3, η οθόνη 1 μιλά στην οθόνη 2)
// ============================================================================

/** Θεσσαλονίκη, κέντρο. Οι αποστάσεις παρακάτω μετρήθηκαν από αυτό το σημείο. */
const THESSALONIKI = { lat: 40.6403, lng: 22.9439 } as const;

function atPoint(id: string, lat: number, lng: number): PublicListing {
  return listing({
    id,
    position: { kind: 'known', provenance: 'manual', point: { lat, lng }, locatedAt: AT },
  });
}

describe('Γ1 — διεύθυνση ⇄ γεωγραφικό φίλτρο', () => {
  it('γράψιμο → ανάγνωση επιστρέφει το ΙΔΙΟ σημείο και την ίδια ακτίνα', () => {
    const near = { center: THESSALONIKI, radiusKm: 25 };
    const parsed = parseListingFilters(
      serializeListingFilters({ ...EMPTY_LISTING_FILTERS, near })
    );
    expect(parsed.near).toEqual(near);
  });

  it('🔴 ΜΙΣΟ ζεύγος συντεταγμένων αγνοείται — δεν γίνεται σημείο στον Ατλαντικό', () => {
    // `lat` χωρίς `lng` θα σήμαινε μεσημβρινός μηδέν. Ο χάρτης θα το ζωγράφιζε με
    // απόλυτη σιγουριά — το ίδιο ελάττωμα που ο τύπος `PlacePosition` απαγορεύει
    // με το ρητό `unknown`.
    expect(parseListingFilters(new URLSearchParams('lat=40.64')).near).toBeNull();
    expect(parseListingFilters(new URLSearchParams('lng=22.94')).near).toBeNull();
  });

  it('🔴 ακτίνα ≤ 0 ΑΚΥΡΩΝΕΙ το φίλτρο, δεν «διορθώνεται» σε 0 χλμ', () => {
    // Ακτίνα μηδέν φιλτράρει τα πάντα: ο επισκέπτης θα έβλεπε άδεια οθόνη χωρίς να
    // ξέρει ότι έφταιγε μια παράμετρος στη διεύθυνση.
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=22.94&r=0')).near).toBeNull();
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=22.94&r=-5')).near).toBeNull();
  });

  it('χωρίς ακτίνα ⇒ η προεπιλογή, όχι «άπειρο» ούτε «μηδέν»', () => {
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=22.94')).near?.radiusKm)
      .toBe(DEFAULT_SEARCH_RADIUS_KM);
  });

  it('αδύνατη συντεταγμένη αγνοείται — ξένος σύνδεσμος δεν σκάει την οθόνη', () => {
    expect(parseListingFilters(new URLSearchParams('lat=91&lng=22.94')).near).toBeNull();
    expect(parseListingFilters(new URLSearchParams('lat=40.64&lng=181')).near).toBeNull();
  });
});

describe('Γ2 — η εφαρμογή του φίλτρου', () => {
  const near = { center: THESSALONIKI, radiusKm: 10 };

  it('μέσα στην ακτίνα ⇒ περνά· έξω ⇒ κόβεται', () => {
    const inside = atPoint('in', 40.6503, 22.9539);   // ~1,3 χλμ
    const outside = atPoint('out', 41.0, 23.5);        // ~60 χλμ
    const result = applyListingFilters([inside, outside], { ...EMPTY_LISTING_FILTERS, near });
    expect(result.map((l) => l.id)).toEqual(['in']);
  });

  it('🔴 Η ΑΓΓΕΛΙΑ ΧΩΡΙΣ ΘΕΣΗ **ΔΕΝ** ΕΞΑΦΑΝΙΖΕΤΑΙ — Α5 §4.1, η σημαντικότερη άγκυρα', () => {
    // *«Δεν φιλτράρονται όταν μετακινείς τον χάρτη: δεν μπορούμε να τις αποκλείσουμε
    // από περιοχή που δεν ξέρουμε αν τους ανήκει.»* Ένα `return false` εκεί θα
    // μετέτρεπε το «δεν ξέρουμε πού είναι» σε «δεν είναι εδώ» — άλλος ισχυρισμός,
    // και ψευδής. Είναι και ο λόγος που η λογιστική έχει ΔΥΟ κάδους, όχι έναν.
    const unlocated = listing({ id: 'nowhere' });
    const far = atPoint('far', 41.0, 23.5);
    const result = applyListingFilters([unlocated, far], { ...EMPTY_LISTING_FILTERS, near });
    expect(result.map((l) => l.id)).toEqual(['nowhere']);
  });

  it('χωρίς `near` ⇒ ο άξονας δεν κρίνει τίποτα', () => {
    const far = atPoint('far', 41.0, 23.5);
    expect(applyListingFilters([far], EMPTY_LISTING_FILTERS)).toHaveLength(1);
  });
});

describe('Φ2 — φιλτράρεται ο ΣΩΣΤΟΣ άξονας (Α20)', () => {
  it('🔑 ακίνητο μόνο προς ΑΝΤΙΠΑΡΟΧΗ βρίσκεται από τον άξονα διάθεσης', () => {
    // ⚠️ **ΑΥΤΗ Η ΔΟΚΙΜΗ ΠΕΡΝΟΥΣΕ ΚΕΝΗ μετά τη μετακίνηση των αξόνων**, και το
    // γράφω γιατί είναι το ακριβές σχήμα «πράσινο = κανείς δεν κοίταξε»: το
    // `{ ...EMPTY_LISTING_FILTERS, offerKinds: [...] }` παρήγαγε αντικείμενο με
    // **άγνωστη** ιδιότητα και **κενά** κριτήρια, δηλαδή φίλτρο που δέχεται τα
    // πάντα — και το `toHaveLength(1)` ήταν αληθές για **λάθος λόγο**.
    const exchange = listing({ commercialStatus: 'unavailable', offerKinds: ['exchange'] });
    const other = listing({ id: 'sale-only', offerKinds: ['sell'] });
    const wantsExchange = onlyCriteria(
      withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['exchange']),
    );
    expect(applyListingFilters([exchange, other], wantsExchange).map((l) => l.id)).toEqual(['l1']);
  });

  it('κενό φίλτρο διαθέσεων σημαίνει «όλες», όχι «καμία»', () => {
    expect(applyListingFilters([listing()], EMPTY_LISTING_FILTERS)).toHaveLength(1);
  });

  it('η τιμή περνά από τον SSoT — ενοίκιο κρίνεται ως ενοίκιο, όχι ως τιμή πώλησης', () => {
    const rental = listing({
      commercialStatus: 'for-rent',
      commercial: { askingPrice: null, finalPrice: null, rentPrice: 500, nightlyRate: null },
      offerKinds: ['leaseOut'],
    });
    const upTo600 = onlyCriteria(withRange(EMPTY_LISTING_CRITERIA, 'price', { min: null, max: 600 }));
    const from600 = onlyCriteria(withRange(EMPTY_LISTING_CRITERIA, 'price', { min: 600, max: null }));
    expect(applyListingFilters([rental], upTo600)).toHaveLength(1);
    expect(applyListingFilters([rental], from600)).toHaveLength(0);
  });

  it('🔴 ΧΩΡΙΣ ΕΜΒΑΔΟΝ ΔΕΝ ΒΑΦΤΙΖΕΤΑΙ 0 τ.μ. — ΚΑΙ ΠΛΕΟΝ ΔΕΝ ΕΞΑΦΑΝΙΖΕΤΑΙ ΚΙΟΛΑΣ', () => {
    // 🔴 **ΑΛΛΑΞΕ Η ΠΟΛΙΤΙΚΗ, ΟΧΙ Ο ΚΑΝΟΝΑΣ (απόφαση Giorgio, 2026-09-04).**
    //
    // Ο κανόνας μένει ακέραιος: αγγελία χωρίς εμβαδόν **δεν** λογίζεται 0 τ.μ. Αυτό
    // που άλλαξε είναι τι κάνουμε με τη σιωπή της: ως τώρα την **εξαφανίζαμε**
    // (`false`), δηλαδή μετατρέπαμε το «δεν ξέρουμε» σε «δεν είναι» — ο ίδιος
    // ισχυρισμός που ο κανόνας Α5 απαγορεύει για τη θέση, και το ADR-835 §4.6 για
    // τον χρόνο. Πλέον **μένει ορατή** και **μετριέται χωριστά**.
    const noArea = listing({ areaSqm: null });
    const wantsArea = onlyCriteria(
      withRange(EMPTY_LISTING_CRITERIA, 'areaSqm', { min: 50, max: null }),
    );
    expect(applyListingFilters([noArea], wantsArea)).toHaveLength(1);
    expect(listingCriteriaMatch(noArea, wantsArea)).toEqual({
      verdict: 'undeclared',
      excludedBy: [],
      undeclaredOn: ['areaSqm'],
    });

    // ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: όποια **απαντά** και δεν χωρά, **αποκλείεται** κανονικά.
    const small = listing({ id: 'small', areaSqm: 30 });
    expect(applyListingFilters([small], wantsArea)).toHaveLength(0);
    expect(listingCriteriaMatch(small, wantsArea).excludedBy).toEqual(['areaSqm']);
  });
});

describe('Φ3 — GeoJSON: η γεωμετρία κουβαλά το νόημα', () => {
  const point = { lat: 40.64, lng: 22.94 } as const;

  it('οι αγγελίες ΧΩΡΙΣ θέση δεν μπαίνουν στον χάρτη — δεν έχουν γεωμετρία', () => {
    expect(listingsToGeoJson([listing()]).features).toHaveLength(0);
  });

  it('το σχήμα ταξιδεύει ως ΙΔΙΟΤΗΤΑ — ο ζωγράφος το διαβάζει, δεν το επιλέγει', () => {
    const city = listing({
      position: { kind: 'known', provenance: 'geocoded', point, locatedAt: AT, accuracy: 'center' },
    });
    const fc = listingsToGeoJson([city]);
    expect(fc.features[0].properties.shape).toBe('shaded-city');
  });

  it('🔴 [lng, lat] — η αντίστροφη σειρά γίνεται ΜΙΑ φορά, στο σύνορο εξόδου', () => {
    const exact = listing({
      position: { kind: 'known', provenance: 'manual', point, locatedAt: AT },
    });
    const geom = listingsToGeoJson([exact]).features[0].geometry as GeoJSON.Point;
    expect(geom.coordinates).toEqual([22.94, 40.64]);
  });

  it('το περίγραμμα ΚΛΕΙΝΕΙ (πρώτη κορυφή == τελευταία), όπως απαιτεί το GeoJSON', () => {
    const drawn = listing({
      position: {
        kind: 'known', provenance: 'drawn', point, locatedAt: AT,
        outline: [point, { lat: 40.641, lng: 22.945 }, { lat: 40.642, lng: 22.94 }],
      },
    });
    const geom = listingsToGeoJson([drawn]).features[0].geometry as GeoJSON.Polygon;
    const ring = geom.coordinates[0];
    expect(ring).toHaveLength(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
});

// =============================================================================
// Ο ΧΡΟΝΟΣ ΣΤΗ ΔΙΕΥΘΥΝΣΗ (ADR-835 Φ3)
// =============================================================================

describe('Χ — ο χρόνος ταξιδεύει στη διεύθυνση, ΚΑΙ ΓΥΡΝΑΕΙ ΙΔΙΟΣ', () => {
  const WITH_TIME = {
    ...EMPTY_LISTING_FILTERS,
    stayWindow: { checkIn: '2026-08-10', checkOut: '2026-08-17' },
    guests: 4,
  };

  it('🔴 ROUND-TRIP: κωδικοποίηση → αποκωδικοποίηση δίνει ΤΑ ΙΔΙΑ φίλτρα', () => {
    expect(parseListingFilters(serializeListingFilters(WITH_TIME))).toEqual(WITH_TIME);
  });

  it('🔴 …και παραμένει σταθερό σε ΔΕΥΤΕΡΟ πέρασμα (ιδεμποτεντικό)', () => {
    const once = parseListingFilters(serializeListingFilters(WITH_TIME));
    expect(parseListingFilters(serializeListingFilters(once))).toEqual(once);
  });

  it('τα κενά χρονικά φίλτρα ΔΕΝ γράφονται στη διεύθυνση', () => {
    expect(serializeListingFilters(EMPTY_LISTING_FILTERS).toString()).toBe('');
  });

  it('🔴 ΜΙΣΟ ΠΑΡΑΘΥΡΟ ΑΓΝΟΕΙΤΑΙ — `in` χωρίς `out` δεν είναι μισή ερώτηση', () => {
    expect(parseListingFilters(new URLSearchParams('in=2026-08-10')).stayWindow).toBeNull();
    expect(parseListingFilters(new URLSearchParams('out=2026-08-17')).stayWindow).toBeNull();
  });

  it('🔴 ΑΝΑΠΟΔΟ και ΚΕΝΟ διάστημα απορρίπτονται ΣΤΗΝ ΠΟΡΤΑ (Ε-10)', () => {
    expect(parseListingFilters(new URLSearchParams('in=2026-08-17&out=2026-08-10')).stayWindow).toBeNull();
    expect(parseListingFilters(new URLSearchParams('in=2026-08-10&out=2026-08-10')).stayWindow).toBeNull();
  });

  it('🔴 …ενώ ΓΝΗΣΙΟ διάστημα περνά — ο παρονομαστής', () => {
    expect(parseListingFilters(new URLSearchParams('in=2026-08-10&out=2026-08-11')).stayWindow).toEqual({
      checkIn: '2026-08-10',
      checkOut: '2026-08-11',
    });
  });

  it('🔴 ΣΤΙΓΜΗ ΜΕ ΩΡΑ ΔΕΝ ΕΙΝΑΙ ΗΜΕΡΑ — απορρίπτεται', () => {
    // Ο `intervalShape` θα τη διάβαζε μια χαρά· ο τύπος όμως υπόσχεται **ημέρα**, και
    // μισή μέρα μέσα σε ημι-ανοιχτό διάστημα νυχτών αλλάζει σιωπηλά τη διαδοχή.
    const params = new URLSearchParams('in=2026-08-10T12:00:00Z&out=2026-08-17');
    expect(parseListingFilters(params).stayWindow).toBeNull();
  });

  it('🔴 σκουπίδια στη διεύθυνση δεν σκάνε την οθόνη', () => {
    const params = new URLSearchParams('in=χθες&out=αύριο&guests=πολλοί');
    const filters = parseListingFilters(params);
    expect(filters.stayWindow).toBeNull();
    expect(filters.guests).toBeNull();
  });

  it('🔴 `guests` δέχεται ΜΟΝΟ θετικό ακέραιο — 0 και 2,5 δεν είναι άνθρωποι', () => {
    expect(parseListingFilters(new URLSearchParams('guests=0')).guests).toBeNull();
    expect(parseListingFilters(new URLSearchParams('guests=-2')).guests).toBeNull();
    expect(parseListingFilters(new URLSearchParams('guests=2.5')).guests).toBeNull();
    expect(parseListingFilters(new URLSearchParams('guests=2')).guests).toBe(2);
  });
});

describe('Χ2 — `stayQueryOf`: ο ΜΟΝΑΔΙΚΟΣ κατασκευαστής του χρονικού ερωτήματος', () => {
  it('παράθυρο + άτομα ⇒ ερώτημα', () => {
    expect(
      stayQueryOf({
        ...EMPTY_LISTING_FILTERS,
        stayWindow: { checkIn: '2026-08-10', checkOut: '2026-08-17' },
        guests: 4,
      }),
    ).toEqual({ checkIn: '2026-08-10', checkOut: '2026-08-17', guests: 4 });
  });

  it('🔴 ΧΩΡΙΣ παράθυρο ⇒ `null`, όσα άτομα κι αν δηλώθηκαν', () => {
    expect(stayQueryOf({ ...EMPTY_LISTING_FILTERS, guests: 4 })).toBeNull();
  });

  it('🔴 `guests: null` ΔΕΝ γίνεται 1 — δεν ρωτάμε σιωπηλά «ένα άτομο»', () => {
    const query = stayQueryOf({
      ...EMPTY_LISTING_FILTERS,
      stayWindow: { checkIn: '2026-08-10', checkOut: '2026-08-17' },
    });
    expect(query?.guests).toBeNull();
  });
});

describe('Χ3 — 🔴 Ο ΧΡΟΝΟΣ ΔΕΝ ΕΞΑΦΑΝΙΖΕΙ ΤΙΠΟΤΑ', () => {
  it('🔴 ημερομηνίες + άτομα ΔΕΝ αλλάζουν το ποιες αγγελίες δείχνονται', () => {
    // Η καρδιά του ADR-835 §4.6: όλοι οι άλλοι κρύβουν ό,τι δεν ταιριάζει στις
    // ημερομηνίες. Εμείς το **μετράμε** (`stay-ledger.ts`). Ένα `return false` στο
    // `matchesListingFilters` θα ισοπέδωνε και τους εννέα κάδους σε σιωπή.
    const listings = [listing({ id: 'a' }), listing({ id: 'b', offerKinds: ['leaseShort'] })];
    const withTime = {
      ...EMPTY_LISTING_FILTERS,
      stayWindow: { checkIn: '2026-08-10', checkOut: '2026-08-17' },
      guests: 8,
    };
    expect(applyListingFilters(listings, withTime)).toHaveLength(2);
    expect(applyListingFilters(listings, EMPTY_LISTING_FILTERS)).toHaveLength(2);
  });
});
