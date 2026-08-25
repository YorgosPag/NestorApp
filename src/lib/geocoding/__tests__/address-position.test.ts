/**
 * Άγκυρες του **ΕΝΟΣ ΓΡΑΦΕΑ ΤΗΣ ΘΕΣΗΣ** (`lib/geocoding/address-position.ts`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ, ΚΑΙ ΓΙΑΤΙ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΜΕΣΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι ομάδες **Π** είναι βαθμονόμηση: τρέχουν την **ΠΡΑΓΜΑΤΙΚΗ** αλυσίδα
 * (`addressToPositionCandidate` → `listingMapShape`) και αποδεικνύουν **και τις δύο**
 * κατευθύνσεις:
 *
 *   - ο **παρονομαστής**: με τα σημερινά δεδομένα (σημείο **χωρίς** μεταδεδομένα) η
 *     αλυσίδα βγάζει `manual` ⇒ **ακριβή πινέζα**, ό,τι κι αν γράφτηκε·
 *   - η **θεραπεία**: με τον γραφέα, μια «Θεσσαλονίκη» βγάζει `shaded-city` και μια
 *     «Εγνατίας 147» βγάζει `pin` — **διαφορετικά σχήματα**.
 *
 * Χωρίς τον παρονομαστή, το «βγάζει pin» θα μπορούσε να είναι πράσινο επειδή **δεν
 * υπήρξε ποτέ βλάβη**.
 *
 * ⚠️ Η **Κ7** συγκρίνει το `ADDRESS_IDENTITY_FIELDS` με το `ADDRESS_GEOCODING_FIELDS`
 * του επεξεργαστή διευθύνσεων. Είναι ο μόνος φρουρός που εμποδίζει τις **δύο λίστες**
 * να αποκλίνουν σιωπηλά — το σχήμα που στο CHECK 3.34 είχε αποκλίνει κατά **63**.
 */

import {
  ADDRESS_IDENTITY_FIELDS,
  ADDRESS_POSITION_OUTCOMES,
  addressIdentityChanged,
  applyAddressPosition,
  resolveAddressPosition,
  resolveAddressPositions,
  type AddressGeocoder,
  type AddressLike,
  type GeocodeHit,
} from '../address-position';
import { ADDRESS_GEOCODING_FIELDS } from '@/components/shared/addresses/address-map-config';
import { addressToPositionCandidate } from '@/services/listings/public-listing-projection';
import { listingMapShape } from '@/lib/listings/listing-map-shape';

const NOW = 1_756_000_000_000;
const AT = '2026-08-25T00:00:00.000Z';

/** Ο γεωκωδικοποιητής-μάρτυρας: **μετρά** τι ρωτήθηκε, ώστε το «μηδέν αιτήματα» να είναι απόδειξη. */
function spyGeocoder(answer: GeocodeHit | null | Error): {
  geocode: AddressGeocoder;
  calls: Array<Record<string, string | undefined>>;
} {
  const calls: Array<Record<string, string | undefined>> = [];
  const geocode: AddressGeocoder = async (query) => {
    calls.push({ ...query });
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { geocode, calls };
}

const HIT_EXACT: GeocodeHit = {
  lat: 40.6401,
  lng: 22.9444,
  accuracy: 'exact',
  confidence: 0.93,
  variantUsed: 2,
  osmType: 'way',
};

const HIT_CITY: GeocodeHit = {
  lat: 40.6401,
  lng: 22.9444,
  accuracy: 'center',
  confidence: 0.55,
  variantUsed: 5,
};

const EGNATIA: AddressLike = { street: 'Εγνατίας', number: '147', city: 'Θεσσαλονίκη' };
const CITY_ONLY: AddressLike = { city: 'Θεσσαλονίκη' };

// ============================================================================
// Κ — ΤΟ ΣΥΜΒΟΛΑΙΟ
// ============================================================================

describe('Κ — ο κλειστός κανόνας της θέσης', () => {
  it('Κ1 — ο ΑΝΘΡΩΠΟΣ πρώτος: σημείο άλλαξε, κείμενο ίδιο ⇒ human-pinned, ΚΑΜΙΑ κλήση', async () => {
    const { geocode, calls } = spyGeocoder(HIT_EXACT);
    const stored: AddressLike = { ...EGNATIA, coordinates: { lat: 40.60, lng: 22.90 } };
    const incoming: AddressLike = { ...EGNATIA, coordinates: { lat: 40.65, lng: 22.95 } };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    expect(outcome).toBe('human-pinned');
    expect(position.coordinates).toEqual({ lat: 40.65, lng: 22.95 });
    expect(position.source).toBe('dragged');
    // 🔑 Τα μεταδεδομένα **σβήνονται**: αλλιώς ανθρώπινη πινέζα θα φορούσε ετικέτα μηχανής.
    expect(position.geocodingMetadata).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('Κ2 — ΤΙΠΟΤΑ δεν άλλαξε ⇒ η αποθηκευμένη θέση μένει ΑΥΤΟΥΣΙΑ, με τα μεταδεδομένα της', async () => {
    const { geocode, calls } = spyGeocoder(HIT_CITY);
    const stored: AddressLike = {
      ...EGNATIA,
      coordinates: { lat: 40.6401, lng: 22.9444 },
      geocodingMetadata: { confidence: 0.93, accuracy: 'exact', variantUsed: 2 },
    };
    // Ο πελάτης ξαναστέλνει το ίδιο (συν μια ετικέτα που δεν είναι πεδίο ταυτότητας).
    const incoming: AddressLike = { ...stored };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    expect(outcome).toBe('unchanged');
    // 🔴 Ο φρουρός της παρανόησης: χωρίς αυτό, μια άσχετη αποθήκευση θα ξαναβάφτιζε
    // γεωκωδικοποιημένη διεύθυνση σε «ανθρώπινη πινέζα» και το σχήμα θα γινόταν pin.
    expect(position.geocodingMetadata).toEqual({ confidence: 0.93, accuracy: 'exact', variantUsed: 2 });
    expect(position.source).toBe('geocoded');
    expect(calls).toHaveLength(0);
  });

  it('Κ3 — κείμενο άλλαξε ⇒ geocoded, και η ΑΚΡΙΒΕΙΑ ταξιδεύει μαζί', async () => {
    const { geocode, calls } = spyGeocoder(HIT_EXACT);
    const { outcome, position } = await resolveAddressPosition(null, EGNATIA, geocode, NOW);

    expect(outcome).toBe('geocoded');
    expect(position.coordinates).toEqual({ lat: 40.6401, lng: 22.9444 });
    expect(position.geocodingMetadata).toEqual({
      confidence: 0.93,
      accuracy: 'exact',
      variantUsed: 2,
      osmType: 'way',
    });
    expect(position.source).toBe('geocoded');
    expect(position.verifiedAt).toBe(NOW);
    expect(calls[0]).toEqual({ street: 'Εγνατίας', number: '147', city: 'Θεσσαλονίκη' });
  });

  it('Κ4 — ρωτήθηκε και ΔΕΝ υπάρχει ⇒ η θέση ΣΒΗΝΕΤΑΙ (η παλιά θα ήταν ψέμα)', async () => {
    const { geocode } = spyGeocoder(null);
    const stored: AddressLike = { ...EGNATIA, coordinates: { lat: 40.6401, lng: 22.9444 } };
    const incoming: AddressLike = { street: 'Ανύπαρκτη', number: '9', city: 'Θεσσαλονίκη' };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    expect(outcome).toBe('unresolved');
    expect(position.coordinates).toBeNull();
    expect(position.geocodingMetadata).toBeNull();
  });

  it('Κ5 — ο γεωκωδικοποιητής ΔΕΝ ΑΠΑΝΤΗΣΕ ⇒ η αποθηκευμένη θέση μένει ΑΘΙΚΤΗ', async () => {
    const { geocode } = spyGeocoder(new Error('rate limited'));
    const stored: AddressLike = {
      ...EGNATIA,
      coordinates: { lat: 40.6401, lng: 22.9444 },
      geocodingMetadata: { confidence: 0.93, accuracy: 'exact', variantUsed: 2 },
    };
    const incoming: AddressLike = { ...EGNATIA, street: 'Τσιμισκή' };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    // 🔴 Η διάκριση που σώζει δεδομένα: «δεν υπάρχει» σβήνει, «δεν ρώτησα» ΔΕΝ σβήνει.
    expect(outcome).toBe('geocoder-unavailable');
    expect(position.coordinates).toEqual({ lat: 40.6401, lng: 22.9444 });
    expect(position.geocodingMetadata).not.toBeNull();
  });

  it('Κ5β — ΠΑΡΟΝΟΜΑΣΤΗΣ: το ΙΔΙΟ σενάριο με `null` αντί για εξαίρεση ΣΒΗΝΕΙ', async () => {
    const { geocode } = spyGeocoder(null);
    const stored: AddressLike = { ...EGNATIA, coordinates: { lat: 40.6401, lng: 22.9444 } };
    const incoming: AddressLike = { ...EGNATIA, street: 'Τσιμισκή' };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    // Αν αυτό ΚΑΙ το Κ5 έδιναν το ίδιο, η διάκριση θα ήταν διακοσμητική.
    expect(outcome).toBe('unresolved');
    expect(position.coordinates).toBeNull();
  });

  it('Κ6 — ούτε οδός ούτε πόλη ⇒ insufficient-address, ΚΑΜΙΑ κλήση', async () => {
    const { geocode, calls } = spyGeocoder(HIT_EXACT);
    const { outcome } = await resolveAddressPosition(null, { postalCode: '54625' }, geocode, NOW);

    expect(outcome).toBe('insufficient-address');
    expect(calls).toHaveLength(0);
  });

  it('Κ7 — ΜΙΑ λίστα πεδίων ταυτότητας: συμφωνεί με το ADDRESS_GEOCODING_FIELDS του επεξεργαστή', () => {
    // 🔴 Ο φρουρός των «δύο λιστών». Προσθήκη πεδίου εκεί ⇒ ΚΟΚΚΙΝΟ εδώ, αντί για
    // σιωπηλή απόκλιση (CHECK 3.34: δύο λίστες namespace είχαν αποκλίνει κατά 63).
    expect([...ADDRESS_IDENTITY_FIELDS].sort()).toEqual([...ADDRESS_GEOCODING_FIELDS].sort());
  });

  it('Κ8 — κενό, null και undefined είναι Η ΙΔΙΑ απουσία (αλλιώς κάθε αποθήκευση ρωτά)', async () => {
    const { geocode, calls } = spyGeocoder(HIT_EXACT);
    const stored: AddressLike = { street: 'Εγνατίας', number: undefined, city: 'Θεσσαλονίκη' };
    const incoming: AddressLike = { street: 'Εγνατίας ', number: '', city: 'Θεσσαλονίκη' };

    const { outcome } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    expect(addressIdentityChanged(stored, incoming)).toBe(false);
    expect(outcome).toBe('unchanged');
    expect(calls).toHaveLength(0);
  });

  it('Κ9 — αντιστοίχιση με `id`, ΠΟΤΕ με τη θέση στον πίνακα', async () => {
    const { geocode, calls } = spyGeocoder(HIT_EXACT);
    const stored = [
      { id: 'a', ...EGNATIA, coordinates: { lat: 1, lng: 1 } },
      { id: 'b', ...CITY_ONLY, coordinates: { lat: 2, lng: 2 } },
    ];
    // Ο πελάτης τις **αναδιέταξε**. Κατά δείκτη, καμία δεν θα ταίριαζε με τον εαυτό της.
    const incoming = [stored[1]!, stored[0]!];

    const { tally } = await resolveAddressPositions(stored, incoming, geocode, NOW);

    expect(tally.unchanged).toBe(2);
    expect(calls).toHaveLength(0);
  });

  it('Κ10 — ΣΕΙΡΙΑΚΑ, ποτέ παράλληλα (πολιτική Nominatim: 1 αίτημα/δευτερόλεπτο)', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const geocode: AddressGeocoder = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return HIT_EXACT;
    };

    const incoming = [
      { id: 'a', street: 'Α', city: 'Θεσσαλονίκη' },
      { id: 'b', street: 'Β', city: 'Θεσσαλονίκη' },
      { id: 'c', street: 'Γ', city: 'Θεσσαλονίκη' },
    ];
    await resolveAddressPositions([], incoming, geocode, NOW);

    expect(maxInFlight).toBe(1);
  });

  it('Κ11 — ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ: κάθε διεύθυνση κρίνεται, το άθροισμα κλείνει', async () => {
    const { geocode } = spyGeocoder(HIT_EXACT);
    const incoming = [
      { id: 'a', street: 'Α', city: 'Θεσσαλονίκη' },
      { id: 'b', postalCode: '54625' },
    ];
    const { addresses, tally } = await resolveAddressPositions([], incoming, geocode, NOW);

    const sum = ADDRESS_POSITION_OUTCOMES.reduce((acc, k) => acc + tally[k], 0);
    expect(sum).toBe(incoming.length);
    expect(addresses).toHaveLength(incoming.length);
    // Κάθε κάδος υπάρχει **ακόμη και στο μηδέν** — ένα «0» που δεν τυπώνεται διαβάζεται
    // ως «δεν υπάρχει τέτοιος έλεγχος».
    expect(Object.keys(tally).sort()).toEqual([...ADDRESS_POSITION_OUTCOMES].sort());
  });

  it('Κ12 — «καμία θέση» ΑΦΑΙΡΕΙ τα κλειδιά (το `undefined` θα άφηνε την παλιά τιμή ζωντανή)', () => {
    const address = {
      id: 'a',
      street: 'Εγνατίας',
      coordinates: { lat: 1, lng: 1 },
      geocodingMetadata: { confidence: 1, accuracy: 'exact' as const, variantUsed: 1 },
      source: 'geocoded',
      verifiedAt: 123,
    };
    const out = applyAddressPosition(address, {
      coordinates: null,
      geocodingMetadata: null,
      source: null,
      verifiedAt: null,
    });

    expect(Object.keys(out)).toEqual(['id', 'street']);
    expect('coordinates' in out).toBe(false);
    expect('geocodingMetadata' in out).toBe(false);
  });

  it('Κ13 — νέα διεύθυνση ΜΕ σημείο και χωρίς μεταδεδομένα = ανθρώπινη πινέζα', async () => {
    const { geocode, calls } = spyGeocoder(HIT_EXACT);
    const incoming: AddressLike = { ...EGNATIA, coordinates: { lat: 40.7, lng: 23.0 } };

    const { outcome, position } = await resolveAddressPosition(null, incoming, geocode, NOW);

    expect(outcome).toBe('human-pinned');
    expect(position.source).toBe('dragged');
    expect(calls).toHaveLength(0);
  });

  it('Κ14 — το `0` είναι ΥΠΑΡΚΤΗ συντεταγμένη, όχι απουσία', async () => {
    const { geocode } = spyGeocoder(HIT_EXACT);
    const stored: AddressLike = { ...EGNATIA, coordinates: { lat: 0, lng: 0 } };
    const incoming: AddressLike = { ...EGNATIA, coordinates: { lat: 0, lng: 0 } };

    const { outcome, position } = await resolveAddressPosition(stored, incoming, geocode, NOW);

    expect(outcome).toBe('unchanged');
    expect(position.coordinates).toEqual({ lat: 0, lng: 0 });
  });
});

// ============================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ ΣΤΗΝ ΠΡΑΓΜΑΤΙΚΗ ΑΛΥΣΙΔΑ (ο παρονομαστής)
// ============================================================================

describe('Π — η αλυσίδα ως την οθόνη, και ο παρονομαστής της', () => {
  it('Π1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: σημείο ΧΩΡΙΣ μεταδεδομένα ⇒ `manual` ⇒ ΠΑΝΤΑ ακριβής πινέζα', () => {
    // Αυτή είναι η **σημερινή** κατάσταση: η μόνη διαδρομή που γράφει συντεταγμένες
    // είναι το σύρσιμο πινέζας, και δεν γράφει ποτέ ακρίβεια.
    const city = addressToPositionCandidate({ coordinates: { lat: 40.64, lng: 22.94 } }, AT);
    const street = addressToPositionCandidate({ coordinates: { lat: 40.63, lng: 22.95 } }, AT);

    expect(city?.provenance).toBe('manual');
    expect(street?.provenance).toBe('manual');
    // 🔴 «Θεσσαλονίκη» και «Εγνατίας 147» — ΟΠΤΙΚΑ ΤΑΥΤΟΣΗΜΕΣ.
    expect(listingMapShape(city!)).toBe('pin');
    expect(listingMapShape(street!)).toBe('pin');
  });

  it('Π2 — ΘΕΡΑΠΕΙΑ: ο γραφέας δίνει ακρίβεια ⇒ ΔΙΑΦΟΡΕΤΙΚΑ σχήματα', async () => {
    const street = await resolveAddressPosition(null, EGNATIA, spyGeocoder(HIT_EXACT).geocode, NOW);
    const city = await resolveAddressPosition(null, CITY_ONLY, spyGeocoder(HIT_CITY).geocode, NOW);

    const streetCandidate = addressToPositionCandidate(
      { coordinates: street.position.coordinates, geocodingMetadata: street.position.geocodingMetadata },
      AT
    );
    const cityCandidate = addressToPositionCandidate(
      { coordinates: city.position.coordinates, geocodingMetadata: city.position.geocodingMetadata },
      AT
    );

    expect(streetCandidate?.provenance).toBe('geocoded');
    expect(cityCandidate?.provenance).toBe('geocoded');
    // 🏆 Η διαφορά που κανένα portal δεν κάνει: το σχήμα λέει **πόσο ξέρουμε**.
    expect(listingMapShape(streetCandidate!)).toBe('pin');
    expect(listingMapShape(cityCandidate!)).toBe('shaded-city');
  });

  it('Π3 — η ανθρώπινη πινέζα ΠΑΡΑΜΕΝΕΙ `manual` (και οφείλει: το σημείο ΕΙΝΑΙ η απάντηση)', async () => {
    const { geocode } = spyGeocoder(HIT_CITY);
    const stored: AddressLike = { ...CITY_ONLY, coordinates: { lat: 40.60, lng: 22.90 } };
    const incoming: AddressLike = { ...CITY_ONLY, coordinates: { lat: 40.65, lng: 22.95 } };

    const { position } = await resolveAddressPosition(stored, incoming, geocode, NOW);
    const candidate = addressToPositionCandidate(
      { coordinates: position.coordinates, geocodingMetadata: position.geocodingMetadata },
      AT
    );

    expect(candidate?.provenance).toBe('manual');
    expect(listingMapShape(candidate!)).toBe('pin');
  });

  it('Π4 — καμία θέση ⇒ ο υποψήφιος είναι `null` ⇒ η αγγελία μένει ρητά «χωρίς θέση»', async () => {
    const { geocode } = spyGeocoder(null);
    const { position } = await resolveAddressPosition(null, EGNATIA, geocode, NOW);

    expect(
      addressToPositionCandidate(
        { coordinates: position.coordinates, geocodingMetadata: position.geocodingMetadata },
        AT
      )
    ).toBeNull();
  });
});
