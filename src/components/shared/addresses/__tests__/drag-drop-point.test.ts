/**
 * @fileoverview **ΠΟΙΟΣ ΑΠΟΦΑΣΙΖΕΙ ΠΟΥ ΕΙΝΑΙ Η ΠΙΝΕΖΑ ΠΟΥ ΣΥΡΘΗΚΕ;** — ADR-332 **D27**.
 * @related components/shared/addresses/useAddressMapGeocoding · components/shared/addresses/pin-drop
 *
 * **Το χέρι.** Η αντίστροφη γεωκωδικοποίηση απαντά «τι γράφει εδώ», όχι «πού είναι».
 * Ο διακομιστής αντίστροφης (`/api/geocoding/reverse`) επιστρέφει το σημείο του
 * αντικειμένου OSM που ταίριαξε — για «Σαμοθράκης 16» τον **δρόμο**, 19,5 μ. από την
 * πόρτα. Ως τις 2026-09-10 αυτό το σημείο γραφόταν στη βάση ως `source: 'dragged'`:
 * «Ακριβής διεύθυνση · Πινέζα που έβαλε άνθρωπος» πάνω στον άξονα του δρόμου.
 *
 * Τα 333 πράσινα tests του D27 δεν το είδαν, γιατί το `applyDraggedPin` δοκιμαζόταν με
 * **έτοιμες** συντεταγμένες. Γι' αυτό η δεύτερη ομάδα εδώ εκτελεί τον **πραγματικό**
 * `handleDragEnd` — mock μόνο στα σύνορα (δίκτυο, WebGL).
 *
 * 🔴 **Βήμα Β (Β6)**: σε 404 / timeout / όριο ρυθμού ο `handleDragEnd` **δεν καλούσε καν**
 * τον γονιό — η πινέζα έμενε μετακινημένη στην οθόνη και δεν αποθηκευόταν ποτέ. Η τρίτη
 * ομάδα εκτελεί ακριβώς αυτές τις δύο εκβάσεις.
 *
 * Οι τιμές είναι **μετρημένες** (ζωντανό Nominatim, 2026-09-10), όχι επινοημένες.
 */

import { renderHook, act } from '@testing-library/react';
import type { ReverseGeocodingResult } from '@/lib/geocoding/geocoding-service';

jest.mock('@/lib/maps/maplibre', () => ({ LngLatBounds: class {} }));
jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn(),
  reverseGeocodeDetailed: jest.fn(),
}));

import { reverseGeocodeDetailed } from '@/lib/geocoding/geocoding-service';
import { useAddressMapGeocoding } from '../useAddressMapGeocoding';
import { reverseResultToAddress } from '../useAddressMapGeocoding.helpers';
import type { PinDrop } from '../pin-drop';

/** Εκεί που άφησε ο άνθρωπος την πινέζα: η πόρτα του 16 (Google place `/g/11rzbn6ljd`). */
const DOOR = { lat: 40.6641899, lng: 22.8974273 } as const;

/** Τι απάντησε το Nominatim για το `DOOR`: ο δρόμος (way 15743648), χωρίς αριθμό. */
const MACHINE_ANSWER: ReverseGeocodingResult = {
  street: 'Σαμοθράκης',
  number: '',
  city: 'Ελευθέριο Κορδελιό',
  neighborhood: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  region: 'Περιφέρεια Κεντρικής Μακεδονίας',
  country: 'Ελλάδα',
  displayName: 'Σαμοθράκης, Ελευθέριο Κορδελιό',
  lat: 40.6643548,
  lng: 22.8975059,
};

const MACHINE_POINT = { lat: MACHINE_ANSWER.lat, lng: MACHINE_ANSWER.lng };

/** Ο πραγματικός `handleDragEnd`, με έναν γονιό που καταγράφει ό,τι λαμβάνει. */
async function dropAtDoor(): Promise<{ drops: PinDrop[]; shown: unknown }> {
  const onAddressDragUpdate = jest.fn();
  const { result } = renderHook(() => useAddressMapGeocoding({
    addresses: [],
    draggableMarkers: true,
    mapRef: { current: null },
    mapReady: false,
    onAddressDragUpdate,
  }));

  await act(async () => {
    await result.current.handleDragEnd({ lngLat: { lng: DOOR.lng, lat: DOOR.lat } }, 'addr-16', 0);
  });

  expect(reverseGeocodeDetailed).toHaveBeenCalledWith(DOOR.lat, DOOR.lng);
  for (const call of onAddressDragUpdate.mock.calls) expect(call[1]).toBe(0);
  return {
    drops: onAddressDragUpdate.mock.calls.map((call) => call[0] as PinDrop),
    shown: result.current.dragPositions.get('addr-16'),
  };
}

describe('reverseResultToAddress — η θέση είναι του χεριού, το κείμενο της μηχανής', () => {
  it('οι συντεταγμένες είναι το σημείο της αφής, όχι το σημείο που ταίριαξε η μηχανή', () => {
    const out = reverseResultToAddress(MACHINE_ANSWER, DOOR);

    expect(out.coordinates).toEqual({ lat: DOOR.lat, lng: DOOR.lng });
    expect(out.coordinates).not.toEqual(MACHINE_POINT);
  });

  it('το κείμενο έρχεται από τη μηχανή — αυτή είναι όλη η δουλειά της', () => {
    const out = reverseResultToAddress(MACHINE_ANSWER, DOOR);

    expect(out.street).toBe('Σαμοθράκης');
    // Ο δρόμος χωρίς αριθμό στο OSM: το κενό γίνεται «απών», όχι «''».
    expect(out.number).toBeUndefined();
  });
});

describe('useAddressMapGeocoding.handleDragEnd — η ΠΡΑΓΜΑΤΙΚΗ διαδρομή του συρσίματος', () => {
  beforeEach(() => {
    jest.mocked(reverseGeocodeDetailed).mockReset();
  });

  it('ο γονέας λαμβάνει το σημείο της αφής — ό,τι κι αν απαντήσει η μηχανή', async () => {
    jest.mocked(reverseGeocodeDetailed).mockResolvedValue({ kind: 'found', result: MACHINE_ANSWER });

    const { drops } = await dropAtDoor();

    expect(drops).toHaveLength(1);
    const [drop] = drops;
    expect(drop.point).toEqual({ lat: DOOR.lat, lng: DOOR.lng });
    expect(drop.text.kind).toBe('resolved');
    if (drop.text.kind !== 'resolved') return;
    expect(drop.text.address.coordinates).toEqual({ lat: DOOR.lat, lng: DOOR.lng });
    expect(drop.text.address.coordinates).not.toEqual(MACHINE_POINT);
  });

  it('η πινέζα στην οθόνη μένει εκεί που την άφησε το χέρι (ίδιο σημείο με αυτό που αποθηκεύεται)', async () => {
    jest.mocked(reverseGeocodeDetailed).mockResolvedValue({ kind: 'found', result: MACHINE_ANSWER });

    const { drops, shown } = await dropAtDoor();

    expect(shown).toEqual({ lng: DOOR.lng, lat: DOOR.lat });
    expect(drops[0].point).toEqual({ lat: DOOR.lat, lng: DOOR.lng });
  });
});

describe('Βήμα Β (Β6) — σύρσιμο ΧΩΡΙΣ κείμενο: η θέση φτάνει ΠΑΝΤΑ στον γονιό', () => {
  beforeEach(() => {
    jest.mocked(reverseGeocodeDetailed).mockReset();
  });

  it('404 («εδώ δεν γράφει τίποτα») ⇒ ο γονιός λαμβάνει το σημείο, με έκβαση `not-found`', async () => {
    jest.mocked(reverseGeocodeDetailed).mockResolvedValue({ kind: 'not-found' });

    const { drops, shown } = await dropAtDoor();

    // Πριν: μηδέν κλήσεις — η πινέζα έμενε στην οθόνη και δεν αποθηκευόταν ποτέ.
    expect(drops).toEqual([{ point: { lat: DOOR.lat, lng: DOOR.lng }, text: { kind: 'not-found' } }]);
    expect(shown).toEqual({ lng: DOOR.lng, lat: DOOR.lat });
  });

  it('timeout / 429 / 500 («δεν ρώτησα») ⇒ ο γονιός λαμβάνει το σημείο, με έκβαση `unavailable`', async () => {
    jest.mocked(reverseGeocodeDetailed).mockResolvedValue({ kind: 'error', reason: 'rate-limit' });

    const { drops } = await dropAtDoor();

    expect(drops).toEqual([{ point: { lat: DOOR.lat, lng: DOOR.lng }, text: { kind: 'unavailable' } }]);
  });
});
