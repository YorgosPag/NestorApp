/**
 * ADR-449 PART B Slice C (2D) — tests για το `collectFinishPickElements` (scene adapter).
 *
 * Καλύπτει: κολόνα → footprint· δοκάρι → outline· ανενεργός σοβάς / εκφυλισμένο → skip·
 * τοίχος → skip (follow-up)· footprint σε canvas units (toPt2).
 */

import { collectFinishPickElements } from '../finish-pick-scene';
import type { StructuralFinishSpec } from '../structural-finish-types';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

const VERTS = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const col = (id: string, finish?: StructuralFinishSpec, verts = VERTS): any =>
  ({ id, type: 'column', params: { finish }, geometry: { footprint: { vertices: verts } } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const beam = (id: string, finish?: StructuralFinishSpec): any =>
  ({ id, type: 'beam', params: { finish }, geometry: { outline: { vertices: VERTS } } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wall = (id: string): any => ({ id, type: 'wall', params: { finish: SPEC }, geometry: {} });

describe('collectFinishPickElements (ADR-449 Slice C 2D)', () => {
  it('κολόνα (footprint) + δοκάρι (outline) με ενεργό σοβά → και τα δύο', () => {
    const out = collectFinishPickElements([col('c1', SPEC), beam('b1', SPEC)]);
    expect(out.map((e) => e.id)).toEqual(['c1', 'b1']);
    expect(out[0].footprint).toHaveLength(4);
    expect(out[0].footprint[0]).toEqual({ x: 0, y: 0 });
  });

  it('ανενεργός / απών σοβάς → skip', () => {
    expect(collectFinishPickElements([col('c1', { ...SPEC, enabled: false }), col('c2', undefined)])).toHaveLength(0);
  });

  it('εκφυλισμένο footprint (<3) → skip', () => {
    expect(collectFinishPickElements([col('c1', SPEC, [{ x: 0, y: 0 }, { x: 1, y: 1 }])])).toHaveLength(0);
  });

  it('τοίχος → skip (follow-up, ο command δεν λύνει ακόμη wall footprint)', () => {
    expect(collectFinishPickElements([wall('w1')])).toHaveLength(0);
  });
});
