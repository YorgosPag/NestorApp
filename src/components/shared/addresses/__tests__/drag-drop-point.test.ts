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
import type { ProjectAddress } from '@/types/project/addresses';

jest.mock('@/lib/maps/maplibre', () => ({ LngLatBounds: class {} }));
jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn(),
  reverseGeocodeDetailed: jest.fn(),
}));

import { reverseGeocodeDetailed } from '@/lib/geocoding/geocoding-service';
import { useAddressMapGeocoding } from '../useAddressMapGeocoding';
import { reverseResultToAddress } from '../useAddressMapGeocoding.helpers';
import { pendingPinAddress, type PinDrop } from '../pin-drop';

describe('pendingPinAddress — η πινέζα σε αναμονή γράφει τον τύπο της ΦΟΡΜΑΣ (ADR-332 D27)', () => {
  it('🔴 η φόρμα λέει «postal» ⇒ η πινέζα λέει «postal», όχι πάντα «site» («Εργοτάξιο»)', () => {
    expect(pendingPinAddress({ lat: 40.66, lng: 22.89 }, '__pending__', 'postal').type).toBe('postal');
  });
});

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

/**
 * Η διεύθυνση που σέρνεται — **σταθερή** αναφορά, **με** το id της στα props.
 *
 * ⚠️ ADR-332 D27 Β12: ο χάρτης είναι ελεγχόμενος — id που **λείπει** από τα props του γονιού δεν
 * έχει υπερίσχυση. Ως τις 2026-09-10 αυτό το test έδινε `addresses: []` (νέος πίνακας σε κάθε
 * απόδοση) και πέρναγε μόνο επειδή η παλιά εκκαθάριση έτρεχε μετά από 500 ms που δεν περίμενε ποτέ.
 */
const DRAGGED: ProjectAddress[] = [{
  id: 'addr-16',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  type: 'site',
  isPrimary: true,
  coordinates: { lat: 40.66424640925561, lng: 22.8975135251753 },
}];

/** Ο πραγματικός `handleDragEnd`, με έναν γονιό που καταγράφει ό,τι λαμβάνει. */
async function dropAtDoor(): Promise<{ drops: PinDrop[]; shown: unknown }> {
  const onAddressDragUpdate = jest.fn();
  const { result } = renderHook(() => useAddressMapGeocoding({
    addresses: DRAGGED,
    draggableMarkers: true,
    mapRef: { current: null },
    mapReady: false,
    onAddressDragUpdate,
  }));

  await act(async () => {
    await result.current.handleDragEnd({ lngLat: { lng: DOOR.lng, lat: DOOR.lat } }, 'addr-16', 0);
  });

  expect(reverseGeocodeDetailed).toHaveBeenCalledWith(DOOR.lat, DOOR.lng, { signal: expect.any(AbortSignal) });
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

    // Β13: δύο ειδοποιήσεις της ΙΔΙΑΣ χειρονομίας — η αναμονή και η τελική έκβαση.
    expect(drops).toHaveLength(2);
    const drop = drops[1]!;
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
    expect(drops[1]!.point).toEqual({ lat: DOOR.lat, lng: DOOR.lng });
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
    const gesture = drops[0]!.gesture;
    expect(drops).toEqual([
      { point: { lat: DOOR.lat, lng: DOOR.lng }, gesture, text: { kind: 'pending' } },
      { point: { lat: DOOR.lat, lng: DOOR.lng }, gesture, text: { kind: 'not-found' } },
    ]);
    expect(shown).toEqual({ lng: DOOR.lng, lat: DOOR.lat });
  });

  it('timeout / 429 / 500 («δεν ρώτησα») ⇒ ο γονιός λαμβάνει το σημείο, με έκβαση `unavailable`', async () => {
    jest.mocked(reverseGeocodeDetailed).mockResolvedValue({ kind: 'error', reason: 'rate-limit' });

    const { drops } = await dropAtDoor();

    expect(drops[1]).toEqual({
      point: { lat: DOOR.lat, lng: DOOR.lng },
      gesture: drops[0]!.gesture,
      text: { kind: 'unavailable' },
    });
  });
});

describe('Β13 — το σημείο ΑΜΕΣΩΣ, η διεύθυνση όταν έρθει (Google «Dropped pin»)', () => {
  beforeEach(() => {
    jest.mocked(reverseGeocodeDetailed).mockReset();
  });

  it('🔴 ο γονιός μαθαίνει το σημείο ΠΡΙΝ απαντήσει η μηχανή — `pending`, με την ίδια χειρονομία', async () => {
    let answer: (value: { kind: 'not-found' }) => void = () => undefined;
    jest.mocked(reverseGeocodeDetailed).mockImplementation(
      () => new Promise((resolve) => { answer = resolve; }),
    );
    const onAddressDragUpdate = jest.fn();
    const { result } = renderHook(() => useAddressMapGeocoding({
      addresses: [], draggableMarkers: true, mapRef: { current: null }, mapReady: false, onAddressDragUpdate,
    }));

    let pendingDrag: Promise<void> = Promise.resolve();
    await act(async () => {
      pendingDrag = result.current.handleDragEnd({ lngLat: { lng: DOOR.lng, lat: DOOR.lat } }, 'addr-16', 0);
    });
    // Η μηχανή ΔΕΝ έχει απαντήσει — και ο γονιός έχει ήδη το σημείο.
    expect(onAddressDragUpdate).toHaveBeenCalledTimes(1);
    expect((onAddressDragUpdate.mock.calls[0]![0] as PinDrop).text).toEqual({ kind: 'pending' });

    await act(async () => { answer({ kind: 'not-found' }); await pendingDrag; });
    const [first, second] = onAddressDragUpdate.mock.calls.map((call) => call[0] as PinDrop);
    expect(second!.gesture).toBe(first!.gesture);
    expect(second!.text).toEqual({ kind: 'not-found' });
  });

  it('🔴 δεύτερο σύρσιμο πριν απαντήσει το πρώτο ⇒ η ερώτηση του πρώτου ΑΚΥΡΩΝΕΤΑΙ και ΔΕΝ παραδίδεται ποτέ', async () => {
    const signals: AbortSignal[] = [];
    jest.mocked(reverseGeocodeDetailed)
      .mockImplementationOnce((_lat, _lng, options) => new Promise((resolve) => {
        signals.push(options!.signal!);
        options!.signal!.addEventListener('abort', () => resolve({ kind: 'error', reason: 'timeout' }));
      }))
      .mockResolvedValueOnce({ kind: 'found', result: MACHINE_ANSWER });
    const onAddressDragUpdate = jest.fn();
    const { result } = renderHook(() => useAddressMapGeocoding({
      addresses: [], draggableMarkers: true, mapRef: { current: null }, mapReady: false, onAddressDragUpdate,
    }));

    await act(async () => {
      const first = result.current.handleDragEnd({ lngLat: { lng: 22.9, lat: 40.6 } }, 'addr-16', 0);
      await result.current.handleDragEnd({ lngLat: { lng: DOOR.lng, lat: DOOR.lat } }, 'addr-16', 0);
      await first;
    });

    expect(signals[0]!.aborted).toBe(true);
    const drops = onAddressDragUpdate.mock.calls.map((call) => call[0] as PinDrop);
    const firstGesture = drops[0]!.gesture;
    // Της πρώτης χειρονομίας: ΜΟΝΟ η αναμονή — ποτέ το «timeout» της ακύρωσης.
    expect(drops.filter((d) => d.gesture === firstGesture).map((d) => d.text.kind)).toEqual(['pending']);
    expect(drops[drops.length - 1]!.text.kind).toBe('resolved');
    expect(drops[drops.length - 1]!.gesture).toBeGreaterThan(firstGesture);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: αποπροσάρτηση ⇒ η ερώτηση ακυρώνεται (καμία ορφανή αναμονή)', async () => {
    const signals: AbortSignal[] = [];
    jest.mocked(reverseGeocodeDetailed).mockImplementation((_lat, _lng, options) => {
      signals.push(options!.signal!);
      return new Promise(() => undefined);
    });
    const { result, unmount } = renderHook(() => useAddressMapGeocoding({
      addresses: [], draggableMarkers: true, mapRef: { current: null }, mapReady: false, onAddressDragUpdate: jest.fn(),
    }));

    await act(async () => {
      void result.current.handleDragEnd({ lngLat: { lng: DOOR.lng, lat: DOOR.lat } }, 'addr-16', 0);
    });
    unmount();

    expect(signals[0]!.aborted).toBe(true);
  });
});
