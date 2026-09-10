/**
 * @fileoverview **ΠΟΙΟΣ ΑΠΟΦΑΣΙΖΕΙ ΠΟΥ ΕΙΝΑΙ Η ΠΙΝΕΖΑ ΠΟΥ ΣΥΡΘΗΚΕ;** — ADR-332 **D27**.
 * @related components/shared/addresses/useAddressMapGeocoding
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
 * Οι τιμές είναι **μετρημένες** (ζωντανό Nominatim, 2026-09-10), όχι επινοημένες.
 */

import { renderHook, act } from '@testing-library/react';
import type { ReverseGeocodingResult } from '@/lib/geocoding/geocoding-service';

jest.mock('@/lib/maps/maplibre', () => ({ LngLatBounds: class {} }));
jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn(),
  reverseGeocode: jest.fn(),
}));

import { reverseGeocode } from '@/lib/geocoding/geocoding-service';
import { useAddressMapGeocoding } from '../useAddressMapGeocoding';
import { reverseResultToAddress } from '../useAddressMapGeocoding.helpers';

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
    jest.mocked(reverseGeocode).mockReset();
  });

  it('ο γονέας λαμβάνει το σημείο της αφής — ό,τι κι αν απαντήσει η μηχανή', async () => {
    jest.mocked(reverseGeocode).mockResolvedValue(MACHINE_ANSWER);
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

    expect(reverseGeocode).toHaveBeenCalledWith(DOOR.lat, DOOR.lng);
    expect(onAddressDragUpdate).toHaveBeenCalledTimes(1);
    const [payload, index] = onAddressDragUpdate.mock.calls[0];
    expect(index).toBe(0);
    expect(payload.coordinates).toEqual({ lat: DOOR.lat, lng: DOOR.lng });
    expect(payload.coordinates).not.toEqual(MACHINE_POINT);
  });

  it('η πινέζα στην οθόνη μένει εκεί που την άφησε το χέρι (ίδιο σημείο με αυτό που αποθηκεύεται)', async () => {
    jest.mocked(reverseGeocode).mockResolvedValue(MACHINE_ANSWER);
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

    const shown = result.current.dragPositions.get('addr-16');
    const saved = onAddressDragUpdate.mock.calls[0][0].coordinates;
    expect(shown).toEqual({ lng: DOOR.lng, lat: DOOR.lat });
    expect(saved).toEqual({ lat: shown?.lat, lng: shown?.lng });
  });
});
