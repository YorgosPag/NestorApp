/**
 * ADR-441 Slice 3-perf — deriveFollowGhostFootprints tests.
 *
 * Live-derived footprints των hosted strips από τα τρέχοντα guide offsets: moved
 * άξονας → footprint στη ΝΕΑ θέση· αμετάβλητος → κανένα footprint (only-changed).
 */

import { deriveFollowGhostFootprints } from '../guide-follow-ghost';
import type { GuideOffsetLookup } from '../derive-params-from-guides';
import type { FoundationEntity } from '../../types/foundation-types';
import type { GuideBinding } from '../guide-binding-types';

const vbind = (xId: string, yA: string, yB: string): GuideBinding[] => [
  { guideId: xId, slot: 'start-x' },
  { guideId: xId, slot: 'end-x' },
  { guideId: yA, slot: 'start-y' },
  { guideId: yB, slot: 'end-y' },
];

/** Vertical hosted strip στον άξονα x0, από y0→y1, committed στο x=0. */
const hostedStrip = (): FoundationEntity => ({
  id: 'strip1',
  type: 'foundation',
  kind: 'strip',
  guideBindings: vbind('x0', 'y0', 'y1'),
  params: {
    kind: 'strip',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 4000, z: 0 },
    width: 600,
    topElevationMm: -1000,
    thicknessMm: 400,
    sceneUnits: 'mm',
  },
} as unknown as FoundationEntity);

const lookup = (offsets: Record<string, number>): GuideOffsetLookup =>
  (id) => (id in offsets ? offsets[id] : undefined);

describe('deriveFollowGhostFootprints', () => {
  it('moved άξονας → footprint στη νέα θέση', () => {
    const fps = deriveFollowGhostFootprints([hostedStrip()], lookup({ x0: 500, y0: 0, y1: 4000 }));
    expect(fps).toHaveLength(1);
    expect(fps[0].id).toBe('strip1');
    // Vertical strip στο x=500 → όλες οι κορυφές γύρω από x≈500 (±width/2=300).
    expect(fps[0].vertices.every((v) => Math.abs(v.x - 500) <= 301)).toBe(true);
    expect(fps[0].vertices.some((v) => v.x > 400)).toBe(true);
  });

  it('αμετάβλητα offsets (== committed) → κανένα footprint (only-changed)', () => {
    const fps = deriveFollowGhostFootprints([hostedStrip()], lookup({ x0: 0, y0: 0, y1: 4000 }));
    expect(fps).toHaveLength(0);
  });

  it('strip χωρίς bindings αγνοείται (κανένα footprint)', () => {
    const orphan = { ...hostedStrip(), guideBindings: undefined } as unknown as FoundationEntity;
    expect(deriveFollowGhostFootprints([orphan], lookup({ x0: 500 }))).toHaveLength(0);
  });
});
