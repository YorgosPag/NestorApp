/**
 * @fileoverview **Ποιος κινεί την κάμερα του χάρτη διευθύνσεων** — ADR-948 §8.7.3.
 * @related components/shared/addresses/useAddressMapCamera · address-map-pins
 *
 * 🔴 **Η βλάβη (ζωντανά, ARIES Α.Ε., 2026-11-23)**: μετά την «Αναίρεση» της πρότασης έδρας η έδρα γύρισε κενή,
 *    αλλά ο χάρτης έμεινε πάνω στη διεύθυνση της πρότασης. Η εφεδρική πινέζα του άδειου χάρτη — η μόνη που
 *    μπορούσε να πιάσει ο άνθρωπος — στεκόταν εκτός οθόνης.
 *
 * 🔑 Ο κανόνας: στον χάρτη επεξεργασίας η κάμερα κινείται μόνο όταν μια πινέζα εμφανίστηκε ή μετακινήθηκε **και**
 *    είναι εκτός οθόνης. Οι παρονομαστές φυλάνε την άλλη πλευρά: η κάμερα **δεν** κλέβει το βλέμμα όταν η αλλαγή
 *    φαίνεται (σύρσιμο).
 *
 * ⚠️ Εκτελείται ο **πραγματικός** hook· mock μόνο στα σύνορα (δίκτυο, WebGL).
 */

import { renderHook, act } from '@testing-library/react';
import type { ProjectAddress } from '@/types/project/addresses';
import type { MapInstance } from '@/subapps/geo-canvas/hooks/map/useMapInteractions';
import { cameraFlight, cameraFraming } from '@/lib/geo/camera-motion';
import { DEFAULT_MAP_OVERVIEW } from '@/config/geographic-config';
import { DRAFT_ENTITY_ID } from '@/lib/draft-entity-id';

/** Ελάχιστο `LngLatBounds` — αρκετό για να τρέξει το ΠΡΑΓΜΑΤΙΚΟ καδράρισμα. */
jest.mock('@/lib/maps/maplibre', () => ({
  LngLatBounds: class {
    private readonly points: unknown[] = [];
    extend(point: unknown) { this.points.push(point); return this; }
    isEmpty() { return this.points.length === 0; }
  },
}));
jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn(),
  reverseGeocodeDetailed: jest.fn(),
}));

import { reverseGeocodeDetailed } from '@/lib/geocoding/geocoding-service';
import { useAddressMapGeocoding } from '../useAddressMapGeocoding';
import { addressMapPins, movedPins, pinPointSnapshot } from '../address-map-pins';

/** Η έδρα της πρότασης (Αθήνα) και μια παλιότερη έδρα (Θεσσαλονίκη). */
const PROPOSED = { lat: 37.9905, lng: 23.7316 };
const EARLIER = { lat: 40.6401, lng: 22.9444 };

const address = (coordinates: { lat: number; lng: number }): ProjectAddress => ({
  id: 'hq',
  street: 'Καλβου',
  city: 'Αθήνα',
  postalCode: '11474',
  country: 'Greece',
  type: 'legal',
  isPrimary: true,
  coordinates,
});

/** Ο χάρτης του τεστ: `inView` λέει αν το σημείο φαίνεται στην τρέχουσα οθόνη. */
function fakeMap(inView: boolean) {
  const fitBounds = jest.fn();
  const flyTo = jest.fn();
  const contains = jest.fn(() => inView);
  const map = { fitBounds, flyTo, getBounds: () => ({ contains }) } as unknown as MapInstance;
  return { map, fitBounds, flyTo, contains };
}

function mountEditMap(map: MapInstance, initial: ProjectAddress[]) {
  return renderHook(
    ({ addresses }: { addresses: ProjectAddress[] }) =>
      useAddressMapGeocoding({
        addresses,
        draggableMarkers: true,
        mapRef: { current: map },
        mapReady: true,
        onAddressDragUpdate: jest.fn(),
      }),
    { initialProps: { addresses: initial } },
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(reverseGeocodeDetailed).mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('§8.7.3 — η κάμερα ακολουθεί την πινέζα που βγήκε εκτός οθόνης', () => {
  it('🔴 η μετρημένη βλάβη: ο χάρτης ΑΔΕΙΑΖΕΙ (αναίρεση σε κενή έδρα) ⇒ ΠΤΗΣΗ στη θέαση επισκόπησης', () => {
    const { map, fitBounds, flyTo } = fakeMap(false);
    const mounted = mountEditMap(map, [address(PROPOSED)]);
    expect(fitBounds).toHaveBeenCalledWith(expect.anything(), cameraFraming('arrive', 'pin', 'confirmed'));

    act(() => { mounted.rerender({ addresses: [] }); });

    expect(flyTo).toHaveBeenCalledTimes(1);
    expect(flyTo).toHaveBeenCalledWith({
      center: [DEFAULT_MAP_OVERVIEW.longitude, DEFAULT_MAP_OVERVIEW.latitude],
      zoom: DEFAULT_MAP_OVERVIEW.zoom,
      // Ο άνθρωπος ΚΟΙΤΟΥΣΕ τον χάρτη ⇒ ταξίδι, όχι άλμα (ADR-847).
      ...cameraFlight('travel'),
    });
  });

  it('🔴 αναίρεση πάνω σε ΥΠΑΡΚΤΗ έδρα (πλήθος 1 → 1): η πινέζα γύρισε εκτός οθόνης ⇒ ταξίδι ως εκεί', () => {
    const { map, fitBounds } = fakeMap(false);
    const mounted = mountEditMap(map, [address(PROPOSED)]);

    act(() => { mounted.rerender({ addresses: [address(EARLIER)] }); });

    expect(fitBounds).toHaveBeenCalledTimes(2);
    expect(fitBounds.mock.calls[1]![1]).toEqual(cameraFraming('travel', 'pin', 'confirmed'));
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: η πινέζα άλλαξε θέση ΜΕΣΑ στην οθόνη ⇒ η κάμερα ΔΕΝ αγγίζεται', () => {
    const { map, fitBounds, flyTo, contains } = fakeMap(true);
    const mounted = mountEditMap(map, [address(PROPOSED)]);

    act(() => { mounted.rerender({ addresses: [address(EARLIER)] }); });

    expect(contains).toHaveBeenCalled();
    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: σύρσιμο — η πινέζα είναι κάτω από το δάχτυλο ⇒ η κάμερα ΔΕΝ πολεμά τον άνθρωπο', async () => {
    jest.mocked(reverseGeocodeDetailed).mockResolvedValue({ kind: 'not-found' });
    const { map, fitBounds, flyTo } = fakeMap(true);
    const mounted = mountEditMap(map, [address(PROPOSED)]);

    await act(async () => {
      await mounted.result.current.handleDragEnd({ lngLat: { lng: EARLIER.lng, lat: EARLIER.lat } }, 'hq', 0);
    });

    expect(fitBounds).toHaveBeenCalledTimes(1);
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: νέα απόδοση με τις ΙΔΙΕΣ θέσεις ⇒ ούτε ερώτηση οθόνης, ούτε κίνηση', () => {
    const { map, fitBounds, contains } = fakeMap(false);
    const mounted = mountEditMap(map, [address(PROPOSED)]);

    act(() => { mounted.rerender({ addresses: [address(PROPOSED)] }); });

    expect(contains).not.toHaveBeenCalled();
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });
});

describe('address-map-pins — μία πηγή θέσης για ζωγραφική και κάμερα', () => {
  const EMPTY = new Map();

  it('ο άδειος χάρτης επεξεργασίας έχει ΜΙΑ εφεδρική πινέζα, στο κέντρο της θέασης επισκόπησης', () => {
    const pins = addressMapPins({ addresses: [], draggableMarkers: true, dragPositions: EMPTY, geocodedAddresses: EMPTY });

    expect(pins).toEqual([expect.objectContaining({
      id: DRAFT_ENTITY_ID,
      point: { lng: DEFAULT_MAP_OVERVIEW.longitude, lat: DEFAULT_MAP_OVERVIEW.latitude },
      anchor: 'unanchored',
      draggable: true,
    })]);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: ο άδειος χάρτης ΠΡΟΒΟΛΗΣ δεν έχει καμία πινέζα', () => {
    expect(addressMapPins({ addresses: [], draggableMarkers: false, dragPositions: EMPTY, geocodedAddresses: EMPTY }))
      .toEqual([]);
  });

  it('θέση αναμονής δίπλα σε ΑΠΟΘΗΚΕΥΜΕΝΟ σημείο ⇒ `beside` (μπαίνει στο κάδρο), όχι στο κέντρο της Αθήνας', () => {
    const unlocated: ProjectAddress = { ...address(PROPOSED), id: 'branch', coordinates: undefined };
    const pins = addressMapPins({
      addresses: [address(EARLIER), unlocated],
      draggableMarkers: true,
      dragPositions: EMPTY,
      geocodedAddresses: EMPTY,
    });

    expect(pins[1]).toEqual(expect.objectContaining({ id: 'branch', anchor: 'beside' }));
    expect(pins[1]!.point.lat).toBeCloseTo(EARLIER.lat + 0.003, 6);
  });

  it('`movedPins`: όσες εμφανίστηκαν ή μετακινήθηκαν — όχι όσες χάθηκαν', () => {
    const before = addressMapPins({
      addresses: [address(PROPOSED)], draggableMarkers: true, dragPositions: EMPTY, geocodedAddresses: EMPTY,
    });
    const after = addressMapPins({ addresses: [], draggableMarkers: true, dragPositions: EMPTY, geocodedAddresses: EMPTY });

    expect(movedPins(pinPointSnapshot(before), after).map((pin) => pin.id)).toEqual([DRAFT_ENTITY_ID]);
    expect(movedPins(pinPointSnapshot(before), before)).toEqual([]);
  });
});
