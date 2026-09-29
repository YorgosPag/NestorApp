/**
 * @fileoverview **ΑΓΚΥΡΑ — Ο ΧΑΡΤΗΣ ΓΕΝΝΙΕΤΑΙ ΗΔΗ ΣΤΟ ΚΑΡΕ** *(ADR-847 §9.5)*.
 * @related components/geo/use-camera-frame · components/geo/PlaceMap · lib/geo/camera-motion
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΣΥΜΠΤΩΜΑ (μετρημένο 2026-09-29, `/area/municipality:0701`, ορατή καρτέλα)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `PlaceMap` άνοιγε στο `BUILDING_ZOOM` (18) στο κέντρο του bbox — για παραλιακό δήμο,
 * **θάλασσα** — και μόνο μετά το `load` πετούσε στην έκταση: **36 αιτήματα πλακιδίων**
 * z19/18/17 που κανείς δεν είδε, ~3 s κίνησης σε σελίδα που μόλις άνοιξε.
 *
 * ⚠️ **Η ερώτηση «καδράρει τελικά;» ΔΕΝ ΤΟ ΠΙΑΝΕΙ** — καδράριζε μια χαρά. Οι ερωτήσεις είναι
 * *«πού γεννήθηκε;»* και *«πέταξε χωρίς λόγο;»*, και αυτό το αρχείο μετρά ακριβώς αυτά:
 * τα props του `<Map>` και τις κλήσεις πάνω στον χάρτη.
 *
 * ⚠️ **Καμία εξάρτηση από MapLibre**: ο χάρτης είναι `jest.fn()`, το `<Map>` καταγραφέας props.
 */

import React from 'react';
import { render } from '@testing-library/react';
import type { MapRef } from 'react-map-gl/maplibre';

const mockMapProps = jest.fn<void, [Record<string, unknown>]>();
jest.mock('@/lib/maps/maplibre', () => ({
  Map: (props: Record<string, unknown>) => {
    mockMapProps(props);
    return null;
  },
  Source: () => null,
  Layer: () => null,
  Marker: () => null,
}));

import { PlaceMap } from '../PlaceMap';
import { cameraBirthView, useCameraFrame } from '../use-camera-frame';
import type { CameraFrame } from '@/types/geo/camera-frame';

/** Ο Δήμος Θεσσαλονίκης, όπως τον δίνει το αρχείο ορίων (ADR-883). */
const THESSALONIKI: CameraFrame = {
  kind: 'extent',
  extent: { south: 40.5856, west: 22.8898, north: 40.6552, east: 22.997 },
};
const MYKONOS: CameraFrame = {
  kind: 'extent',
  extent: { south: 37.3871, west: 25.2073, north: 37.5064, east: 25.4679 },
};

function fakeMap() {
  const flyTo = jest.fn();
  const fitBounds = jest.fn();
  const ref = { current: { flyTo, fitBounds } as unknown as MapRef };
  return { ref, flyTo, fitBounds };
}

function Harness({
  mapRef,
  ready,
  frame,
  bornWith,
}: {
  readonly mapRef: React.RefObject<MapRef | null>;
  readonly ready: boolean;
  readonly frame: CameraFrame | null;
  readonly bornWith: CameraFrame | null;
}): React.ReactElement {
  useCameraFrame(mapRef, ready, frame, bornWith);
  return <div />;
}

// =============================================================================
// Κ1 — ΚΑΜΙΑ ΠΤΗΣΗ ΠΡΟΣ ΕΚΕΙ ΠΟΥ ΗΔΗ ΕΙΣΑΙ
// =============================================================================

describe('Κ1 · γεννημένος στο καρέ ⇒ καμία πτήση στο load', () => {
  /** ⛔ ΜΕΤΑΛΛΑΞΗ: αγνόησε το `bornWith` ⇒ **κόκκινο** (1 `fitBounds`). */
  it('🔴 ready με ΙΔΙΟ καρέ με τη γέννηση ⇒ ΜΗΔΕΝ κινήσεις', () => {
    const { ref, flyTo, fitBounds } = fakeMap();
    const { rerender } = render(<Harness mapRef={ref} ready={false} frame={THESSALONIKI} bornWith={THESSALONIKI} />);
    rerender(<Harness mapRef={ref} ready frame={THESSALONIKI} bornWith={THESSALONIKI} />);

    expect(fitBounds).not.toHaveBeenCalled();
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('🔑 χωρίς γέννηση (`null`) η συμπεριφορά μένει ίδια: πτήση στο ready', () => {
    const { ref, fitBounds } = fakeMap();
    render(<Harness mapRef={ref} ready frame={THESSALONIKI} bornWith={null} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });

  it('🔑 το καρέ άλλαξε ΠΡΙΝ το load ⇒ πετά στο ΝΕΟ, όχι σιωπή', () => {
    const { ref, fitBounds } = fakeMap();
    const { rerender } = render(<Harness mapRef={ref} ready={false} frame={THESSALONIKI} bornWith={THESSALONIKI} />);
    rerender(<Harness mapRef={ref} ready frame={MYKONOS} bornWith={THESSALONIKI} />);
    expect(fitBounds).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Κ2 — Η ΓΕΝΝΗΣΗ ΚΑΤΑΝΑΛΩΝΕΤΑΙ ΜΙΑ ΦΟΡΑ
// =============================================================================

describe('Κ2 · μετά τη γέννηση, κάθε ΑΛΛΑΓΗ καρέ αξίζει πτήση', () => {
  it('🔴 A (γέννηση) → null → A πριν το load ⇒ καμία κίνηση · → B ⇒ πτήση · → A ⇒ ξανά πτήση', () => {
    const { ref, fitBounds } = fakeMap();
    const view = (frame: CameraFrame | null, ready = true) => (
      <Harness mapRef={ref} ready={ready} frame={frame} bornWith={THESSALONIKI} />
    );
    // Το `null` («μην κουνηθείς») ΔΕΝ καταναλώνει τη γέννηση: ο χάρτης είναι ακόμη στο A.
    const { rerender } = render(view(THESSALONIKI, false));
    rerender(view(null, false));
    rerender(view(THESSALONIKI, false));
    rerender(view(THESSALONIKI));
    expect(fitBounds).toHaveBeenCalledTimes(0);

    rerender(view(MYKONOS));
    expect(fitBounds).toHaveBeenCalledTimes(1);

    // Η υπογραφή της γέννησης ΔΕΝ επιτρέπεται να «θυμάται» το A για πάντα.
    rerender(view(THESSALONIKI));
    expect(fitBounds).toHaveBeenCalledTimes(2);
  });
});

// =============================================================================
// Κ3 — ΕΝΑ ΚΑΔΡΑΡΙΣΜΑ: Η ΓΕΝΝΗΣΗ ΚΑΙ Η ΠΤΗΣΗ ΚΑΤΑΛΗΓΟΥΝ ΣΤΟ ΙΔΙΟ ΣΗΜΕΙΟ
// =============================================================================

describe('Κ3 · γέννηση ≡ τέλος πτήσης', () => {
  /**
   * ⛔ Αν η γέννηση είχε δικό της `padding`/`maxZoom`, ο ίδιος δήμος θα φαινόταν **άλλος**
   * όταν ανοίγει και άλλος όταν έρχεσαι πετώντας — δύο αρχές για μία ερώτηση.
   */
  it('🔴 ίδια bounds, ίδιο padding, ίδιο maxZoom με το fitBounds της πτήσης', () => {
    const { ref, fitBounds } = fakeMap();
    render(<Harness mapRef={ref} ready frame={THESSALONIKI} bornWith={null} />);
    const [bounds, flight] = fitBounds.mock.calls[0] as [unknown, { padding: number; maxZoom: number }];

    const birth = cameraBirthView(THESSALONIKI);
    if (!('bounds' in birth)) throw new Error('περιμέναμε γέννηση σε έκταση');
    expect(birth.bounds).toEqual(bounds);
    expect(birth.fitBoundsOptions).toEqual({ padding: flight.padding, maxZoom: flight.maxZoom });
  });

  it('καρέ σημείου ⇒ γέννηση στο σημείο, στο ζουμ του καρέ', () => {
    expect(cameraBirthView({ kind: 'point', point: { lat: 40.63, lng: 22.94 }, zoom: 13 })).toEqual({
      latitude: 40.63,
      longitude: 22.94,
      zoom: 13,
    });
  });
});

// =============================================================================
// Κ4 — ΤΟ PlaceMap ΠΕΡΝΑ ΤΗ ΓΕΝΝΗΣΗ ΣΤΟ <Map>
// =============================================================================

describe('Κ4 · το PlaceMap γεννιέται στο fit της προσάρτησης', () => {
  beforeEach(() => mockMapProps.mockClear());

  const initialViewStates = () => mockMapProps.mock.calls.map(([props]) => props.initialViewState);

  /** ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `initialViewState` σε `center`/`initialZoom` ⇒ **κόκκινο**. */
  it('🔴 με fit ⇒ initialViewState = bounds (ΟΧΙ κέντρο στο BUILDING_ZOOM)', () => {
    render(<PlaceMap center={{ lat: 40.62, lng: 22.94 }} fit={THESSALONIKI} />);
    expect(initialViewStates()[0]).toEqual(cameraBirthView(THESSALONIKI));
  });

  it('χωρίς fit ⇒ initialViewState = center + initialZoom, όπως πριν', () => {
    render(<PlaceMap center={{ lat: 40.62, lng: 22.94 }} initialZoom={12} />);
    expect(initialViewStates()[0]).toEqual({ latitude: 40.62, longitude: 22.94, zoom: 12 });
  });

  it('🔑 το fit που φτάνει ΜΕΤΑ την προσάρτηση ΔΕΝ ξαναγεννά τον χάρτη (πετά, μέσω useCameraFrame)', () => {
    const { rerender } = render(<PlaceMap center={{ lat: 40.62, lng: 22.94 }} fit={null} />);
    rerender(<PlaceMap center={{ lat: 40.62, lng: 22.94 }} fit={THESSALONIKI} />);
    for (const state of initialViewStates()) {
      expect(state).toEqual({ latitude: 40.62, longitude: 22.94, zoom: expect.any(Number) });
    }
  });
});
