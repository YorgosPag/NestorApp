/**
 * @jest-environment node
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ ΙΣΟΤΙΜΙΑΣ — η μικρογραφία της κάρτας ΕΙΝΑΙ το καρέ άφιξης του ζωντανού χάρτη.**
 * @related lib/maps/capture-map-snapshot.ts · lib/listings/listing-map-bounds.ts · search-results/results-map-contract.ts
 *          · ADR-847 §9.6 · ADR-777 §8.70.7
 *
 * 🔴 **Γιατί υπάρχει**: μέχρι 2026-09-29 η μικρογραφία είχε **δεύτερη** μηχανή καδραρίσματος (χειρόγραφο
 * zoom-to-fit, ταβάνι 16, δική της έκταση αγγελίας). Το ίδιο ακίνητο φαινόταν αλλιώς στην κάρτα και αλλιώς
 * όταν άνοιγε ο χάρτης — και η κάρτα μπορούσε να ισχυριστεί **περισσότερη** ακρίβεια (z16) από τον χάρτη (z15).
 *
 * 🔑 Η άγκυρα **δεν** καρφώνει αριθμούς: περνά **και τα δύο** μονοπάτια από τον πραγματικό τους κώδικα
 * (`fitMapToArea(listingArrivalArea(…))` · `captureMapSnapshot(listingFeatureExtent(…))`) και ζητά να
 * φτάσουν στην **ίδια** κλήση `fitBounds` — ίδια έκταση, ίδιο ταβάνι, ίδια κίνηση. Μόνο το περιθώριο
 * διαφέρει, και αυτό **επίτηδες** (§9.6: σύμβολο σε pixel εκεί, λόγος του κουτιού εδώ).
 *
 * | Μετάλλαξη | Αποτέλεσμα |
 * |---|---|
 * | ταβάνι της λήψης `'suggested'` → `'area'` | `maxZoom` 17 ≠ 15 ⇒ 🔴 |
 * | η λήψη ξαναγυρνά σε `jumpTo` | καμία κλήση `fitBounds` ⇒ 🔴 (και ο φρουρός του `camera-motion.test.ts`) |
 * | η άφιξη ξαναγράφει δική της έκταση (π.χ. σημείο αντί για κύκλο) | άνισες εκτάσεις ⇒ 🔴 |
 */

import type { Map as MapLibreMap } from 'maplibre-gl';

import { SNAPSHOT_VIEWPORT } from '@/components/listing-map-snapshot/snapshot-frame';
import { fitMapToArea, type MapEventTarget } from '@/components/search-results/results-map-contract';
import type { ListingMapMark, MappedListingShape } from '@/lib/listings/listing-map-mark';
import { listingArrivalArea, listingFeatureExtent } from '@/lib/listings/listing-map-bounds';
import { listingFeature } from '@/lib/listings/listings-geojson';
import type { GeoBoundingBox } from '@/types/geo/coordinates';

import { captureMapSnapshot } from '../capture-map-snapshot';

const POINT = { lat: 40.63, lng: 22.95 };
const OUTLINE = [
  { lat: 40.6301, lng: 22.9501 },
  { lat: 40.6301, lng: 22.9504 },
  { lat: 40.6303, lng: 22.9504 },
  { lat: 40.6303, lng: 22.9501 },
];

const MARKS: Readonly<Record<MappedListingShape, ListingMapMark>> = {
  pin: { shape: 'pin', point: POINT },
  'pin-with-ring': { shape: 'pin-with-ring', point: POINT },
  'shaded-circle': { shape: 'shaded-circle', point: POINT },
  'shaded-city': { shape: 'shaded-city', point: POINT },
  outline: { shape: 'outline', point: POINT, outline: OUTLINE },
};

type FitBoundsCall = readonly [bounds: unknown, options: Record<string, unknown>];

/** Η άφιξη του ζωντανού χάρτη σε ΜΙΑ αγγελία — ό,τι κάνει το `useListingArrival`. */
function liveArrival(mark: ListingMapMark): FitBoundsCall {
  const calls: FitBoundsCall[] = [];
  const target = { fitBounds: (bounds: unknown, options: Record<string, unknown>) => calls.push([bounds, options]) };
  const data = { type: 'FeatureCollection' as const, features: [listingFeature('live', 'Τίτλος', mark)] };
  const area = listingArrivalArea(data, 'live');
  if (area === null) throw new Error('η αγγελία ζωγραφίζεται — η άφιξη δεν μπορεί να είναι null');
  fitMapToArea(target as unknown as MapEventTarget, area);
  expect(calls).toHaveLength(1);
  return calls[0];
}

/** Η λήψη της μικρογραφίας — ό,τι κάνει το `ListingMapSnapshotStage`. */
function snapshotCapture(mark: ListingMapMark): FitBoundsCall {
  const calls: FitBoundsCall[] = [];
  const map = {
    fitBounds: (bounds: unknown, options: Record<string, unknown>) => calls.push([bounds, options]),
    once: () => undefined,
    off: () => undefined,
    triggerRepaint: () => undefined,
  };
  const extent = listingFeatureExtent(listingFeature('snapshot', '', mark));
  if (extent === null) throw new Error('το σημάδι έχει γεωμετρία — η έκταση δεν μπορεί να είναι null');
  const cancel = captureMapSnapshot(map as unknown as MapLibreMap, extent, SNAPSHOT_VIEWPORT, () => undefined);
  cancel();
  expect(calls).toHaveLength(1);
  return calls[0];
}

function motionOf(options: Record<string, unknown>): Record<string, unknown> {
  const { padding: _padding, maxZoom: _maxZoom, ...motion } = options;
  return motion;
}

describe('ισοτιμία κάρτας ↔ χάρτη — ένα καρέ, δύο μεγέθη', () => {
  it.each(Object.keys(MARKS) as MappedListingShape[])('%s ⇒ ΙΔΙΑ έκταση, ΙΔΙΟ ταβάνι, ΙΔΙΑ κίνηση', (shape) => {
    const [liveBounds, liveOptions] = liveArrival(MARKS[shape]);
    const [cardBounds, cardOptions] = snapshotCapture(MARKS[shape]);

    expect(cardBounds).toEqual(liveBounds);
    expect(cardOptions.maxZoom).toBe(liveOptions.maxZoom);
    expect(motionOf(cardOptions)).toEqual(motionOf(liveOptions));
  });

  it('🔴 η κάρτα ΠΟΤΕ δεν ισχυρίζεται περισσότερη ακρίβεια από τον χάρτη που ανοίγει', () => {
    for (const mark of Object.values(MARKS)) {
      expect(Number(snapshotCapture(mark)[1].maxZoom)).toBeLessThanOrEqual(Number(liveArrival(mark)[1].maxZoom));
    }
  });

  it('ο κύκλος αβεβαιότητας ΠΕΡΙΚΛΕΙΕΤΑΙ — η πόλη πιάνει μεγαλύτερη έκταση από τη συνοικία', () => {
    const span = (extent: GeoBoundingBox | null): number => (extent === null ? 0 : extent.north - extent.south);
    const city = span(listingFeatureExtent(listingFeature('c', '', MARKS['shaded-city'])));
    const hood = span(listingFeatureExtent(listingFeature('h', '', MARKS['shaded-circle'])));
    expect(city).toBeGreaterThan(hood);
    expect(hood).toBeGreaterThan(0);
  });

  it('ακριβής πινέζα ⇒ σημείο· το ζουμ το ορίζει το ΤΑΒΑΝΙ, όχι δεύτερη σταθερά «ζουμ γειτονιάς»', () => {
    expect(listingFeatureExtent(listingFeature('p', '', MARKS.pin))).toEqual({
      west: POINT.lng,
      south: POINT.lat,
      east: POINT.lng,
      north: POINT.lat,
    });
  });
});

describe('το περιθώριο της κάρτας — λόγος του κουτιού, όχι σύμβολο σε pixel', () => {
  it('κάθε άξονας παίρνει αέρα ανάλογο της ΔΙΚΗΣ του διάστασης', () => {
    const padding = snapshotCapture(MARKS['shaded-circle'])[1].padding as Record<string, number>;
    expect(padding.left / SNAPSHOT_VIEWPORT.widthPx).toBeCloseTo(padding.top / SNAPSHOT_VIEWPORT.heightPx, 9);
    expect(padding.left).toBe(padding.right);
    expect(padding.top).toBe(padding.bottom);
  });

  it('το σχήμα κρατά την ΠΛΕΙΟΝΟΤΗΤΑ του κουτιού — ο αέρας δεν τρώει την κάρτα', () => {
    const padding = snapshotCapture(MARKS.outline)[1].padding as Record<string, number>;
    expect(SNAPSHOT_VIEWPORT.heightPx - padding.top - padding.bottom).toBeGreaterThan(SNAPSHOT_VIEWPORT.heightPx / 2);
    expect(SNAPSHOT_VIEWPORT.widthPx - padding.left - padding.right).toBeGreaterThan(SNAPSHOT_VIEWPORT.widthPx / 2);
  });
});

describe('χωρίς γεωμετρία ⇒ δηλωμένη απουσία, ποτέ χάρτης «κάπου»', () => {
  it('περίγραμμα χωρίς κορυφές ⇒ null (όχι [0,0])', () => {
    const empty = listingFeature('e', '', MARKS.outline);
    const hollow = { ...empty, geometry: { type: 'Polygon' as const, coordinates: [[]] } };
    expect(listingFeatureExtent(hollow)).toBeNull();
  });
});
