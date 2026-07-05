/**
 * ADR-419 §thickness-zones — RegionPerimeterPreviewStore SSoT smart constructors + pub/sub.
 *
 * The constructors (`regionPerimeterPreview` / `singleZoneRegionPreview`) are the ONLY
 * sanctioned way to mint a `RegionPerimeterPreview` (branded type), so every producer
 * emits the canonical `zones[]` shape. This locks the invariant the overlay relies on:
 * a non-null preview always exposes `zones.length` — the legacy `{polygon,label}` object
 * (which crashed the overlay at `preview.zones.length`) can no longer be constructed.
 */

import {
  regionPerimeterPreview,
  singleZoneRegionPreview,
  setRegionPerimeterPreview,
  getRegionPerimeterPreview,
  subscribeRegionPerimeterPreview,
  clearRegionPerimeterPreview,
} from '../RegionPerimeterPreviewStore';

const SQUARE = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
const TRI = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];

afterEach(() => clearRegionPerimeterPreview());

describe('RegionPerimeterPreviewStore — SSoT smart constructors', () => {
  it('singleZoneRegionPreview wraps one perimeter into a single canonical zone', () => {
    const p = singleZoneRegionPreview(SQUARE, '1.00 × 1.00 m', false);
    expect(p.zones).toHaveLength(1);
    // The field that crashed the overlay is always a real array now.
    expect(p.zones.length).toBe(1);
    expect(p.zones[0]!.polygon).toEqual(SQUARE);
    expect(p.zones[0]!.label).toBe('1.00 × 1.00 m');
    expect(p.oversized).toBe(false);
  });

  it('singleZoneRegionPreview carries oversized + optional reason / occupied', () => {
    const rejected = singleZoneRegionPreview(SQUARE, '', true, {
      reason: 'regionPerimeter.rejected.lengthTooShort',
    });
    expect(rejected.oversized).toBe(true);
    expect(rejected.zones[0]!.reason).toBe('regionPerimeter.rejected.lengthTooShort');

    const occupied = singleZoneRegionPreview(SQUARE, 'x', false, { occupied: true });
    expect(occupied.zones[0]!.occupied).toBe(true);
  });

  it('regionPerimeterPreview passes a multi-zone (thickness split) through unchanged', () => {
    const zones = [
      { polygon: SQUARE, label: 'a' },
      { polygon: SQUARE, label: '', reason: 'regionPerimeter.rejected.occupied' },
    ];
    const p = regionPerimeterPreview(zones, false);
    expect(p.zones).toBe(zones);
    expect(p.zones).toHaveLength(2);
    expect(p.oversized).toBe(false);
  });
});

describe('RegionPerimeterPreviewStore — pub/sub', () => {
  it('round-trips a constructed preview through set/get', () => {
    const p = singleZoneRegionPreview(TRI, 'z', false);
    setRegionPerimeterPreview(p);
    expect(getRegionPerimeterPreview()).toBe(p);
  });

  it('clears back to null', () => {
    setRegionPerimeterPreview(singleZoneRegionPreview(TRI, 'z', false));
    clearRegionPerimeterPreview();
    expect(getRegionPerimeterPreview()).toBeNull();
  });

  it('notifies subscribers on set, and stops after unsubscribe', () => {
    let hits = 0;
    const unsub = subscribeRegionPerimeterPreview(() => { hits += 1; });
    setRegionPerimeterPreview(singleZoneRegionPreview(TRI, 'z', false));
    expect(hits).toBe(1);
    unsub();
    setRegionPerimeterPreview(singleZoneRegionPreview(TRI, 'z2', false));
    expect(hits).toBe(1);
  });
});
