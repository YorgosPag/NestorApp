/**
 * Tests for column-beam-align (ADR-496) — έξυπνη ευθυγράμμιση κολώνας στο πλαισιωτικό
 * δοκάρι κατά την αλλαγή τύπου σε L-shape.
 *
 * Επαληθεύουμε τις 4 απαιτήσεις (Revit-canonical, το δοκάρι = reference):
 *   (1) όψη «α» (near-end centerline του bearing arm) flush στην παρειά #1 του δοκαριού
 *   (2) άξονας bearing arm ≡ άξονας δοκαριού (rotateVector({0,1}, rotation) == u_span)
 *   (3) armWidth == beam.width
 *   (4) anchor='center', flipY=false (deterministic placement)
 * + catalog fallback (κανένα δοκάρι → null) + non-L kind → null + width clamp.
 */

import { alignColumnToFramingBeam } from '../column-beam-align';
import { rotateVector } from '../../grips/grip-math';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { Point2D } from '../../../rendering/types/Types';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';

/** Ορθογωνική κολώνα (current geometry) — footprint κεντραρισμένο στο (cx,cy), 2h × 2h. */
function rectColumn(cx: number, cy: number, h = 200): ColumnEntity {
  return {
    id: 'col_1', type: 'column', kind: 'rectangular',
    params: { kind: 'rectangular', position: { x: cx, y: cy, z: 0 }, width: 2 * h, depth: 2 * h, sceneUnits: 'mm' },
    geometry: {
      footprint: {
        vertices: [
          { x: cx - h, y: cy - h, z: 0 }, { x: cx + h, y: cy - h, z: 0 },
          { x: cx + h, y: cy + h, z: 0 }, { x: cx - h, y: cy + h, z: 0 },
        ],
      },
    },
  } as unknown as ColumnEntity;
}

function beam(start: Point2D, end: Point2D, width = 250): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: start.x, y: start.y, z: 0 }, endPoint: { x: end.x, y: end.y, z: 0 },
      width, depth: 700, topElevation: 3000, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

/** L-shape catalog nextParams (placeholder armWidth — το smart-fit το υπερισχύει). */
function lshapeNext(width = 400, depth = 400): ColumnParams {
  return {
    kind: 'L-shape', position: { x: 0, y: 0, z: 0 }, anchor: 'center',
    width, depth, height: 3000, rotation: 0, sceneUnits: 'mm',
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    lshape: { armWidth: width / 3, armLength: depth / 3 },
  } as unknown as ColumnParams;
}

/** Reconstruct world θέσης ενός LOCAL mm σημείου (anchor='center' → centredPolyToWorld). */
function worldOfLocal(params: ColumnParams, localMm: Point2D): Point2D {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const r = rotateVector({ x: localMm.x * s, y: localMm.y * s }, params.rotation);
  return { x: params.position.x + r.x, y: params.position.y + r.y };
}

/** Near-end centerline του bearing arm σε LOCAL mm (flipY=false). */
function bearingNearEndLocal(p: ColumnParams): Point2D {
  const armWidth = p.lshape?.armWidth ?? 0;
  return { x: -p.width / 2 + armWidth / 2, y: p.depth / 2 };
}

describe('alignColumnToFramingBeam (ADR-496)', () => {
  it('horizontal beam — flush + axis-coincidence + width-match', () => {
    // Δοκάρι από την παρειά της κολώνας (0,0) προς +X. near-end = (0,0), u_span = (1,0).
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 0, y: 0 }, { x: 3000, y: 0 })]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    // (3) armWidth == beam.width· (4) anchor/flip deterministic.
    expect(fit.lshape?.armWidth).toBe(250);
    expect(fit.anchor).toBe('center');
    expect(fit.lshape?.flipY).toBe(false);

    // (2) τοπικό +Y → u_span (1,0).
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(1, 6);
    expect(dir.y).toBeCloseTo(0, 6);

    // (1) near-end centerline flush στο near-end του δοκαριού (0,0).
    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('vertical beam — bearing arm follows the +Y axis', () => {
    // Κολώνα στο (0,0)· δοκάρι προς +Y. near-end = (0,0), u_span = (0,1).
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 0, y: 0 }, { x: 0, y: 3000 })]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(0, 6);
    expect(dir.y).toBeCloseTo(1, 6);

    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('diagonal beam — generic axis alignment (no hard-coded X/Y)', () => {
    const col = rectColumn(0, 0);
    const end = { x: 3000, y: 3000 };
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 0, y: 0 }, end)]);
    expect(fit).not.toBeNull();
    if (!fit) return;

    const len = Math.hypot(end.x, end.y);
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(end.x / len, 6);
    expect(dir.y).toBeCloseTo(end.y / len, 6);

    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('picks the near-end (closest beam endpoint to the column)', () => {
    // Δοκάρι (3000,0)→(0,0): το κοντινό άκρο στην κολώνα-(0,0) είναι το end (0,0)·
    // u_span δείχνει προς το ΜΑΚΡΙΝΟ άκρο (3000,0) = +X — ανεξάρτητα της σειράς start/end.
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(), [beam({ x: 3000, y: 0 }, { x: 0, y: 0 })]);
    expect(fit).not.toBeNull();
    if (!fit) return;
    const dir = rotateVector({ x: 0, y: 1 }, fit.rotation);
    expect(dir.x).toBeCloseTo(1, 6);
    expect(dir.y).toBeCloseTo(0, 6);
    const w = worldOfLocal(fit, bearingNearEndLocal(fit));
    expect(w.x).toBeCloseTo(0, 6);
    expect(w.y).toBeCloseTo(0, 6);
  });

  it('width clamp — beam wider than catalog bbox grows the bbox', () => {
    const col = rectColumn(0, 0);
    const fit = alignColumnToFramingBeam(col, lshapeNext(400, 400), [beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, 600)]);
    expect(fit).not.toBeNull();
    if (!fit) return;
    expect(fit.lshape?.armWidth).toBe(600);
    expect(fit.width).toBe(600); // max(400, 600)
    expect(fit.depth).toBe(600);
  });

  it('no framing beam → null (catalog fallback, μηδέν regression)', () => {
    const col = rectColumn(0, 0);
    // Δοκάρι μακριά (perp >> halfWidth) → δεν πλαισιώνει.
    expect(alignColumnToFramingBeam(col, lshapeNext(), [])).toBeNull();
  });

  it('non-L kind → null (v1 scope)', () => {
    const col = rectColumn(0, 0);
    const tShape = { ...lshapeNext(), kind: 'T-shape' } as unknown as ColumnParams;
    expect(alignColumnToFramingBeam(col, tShape, [beam({ x: 0, y: 0 }, { x: 3000, y: 0 })])).toBeNull();
  });
});
