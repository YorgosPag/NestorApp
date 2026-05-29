/**
 * ADR-363 Phase 5.5a + 5.5b + 5.5c — `beam-grips` pure-function tests.
 *
 * Verifies:
 *   - `getBeamGrips` emits the correct count + ordering per kind
 *     (straight/cantilever → 5 grips, curved → 6 grips, including the Phase 5.5b
 *     width handle + Phase 5.5c depth handle).
 *   - Grip positions correspond to params.startPoint / endPoint / midpoint /
 *     curveControl, width-handle (+perpendicular × width/2) and depth-handle
 *     (-perpendicular × (width/2 + DEPTH_GRIP_OFFSET_MM)) in scene-unit (mm) space.
 *   - `applyBeamGripDrag` translates the right endpoint(s) per kind, seeds the
 *     curve control point when previously undefined, preserves foreign params
 *     (width/depth/elevation/material/supportType), and short-circuits zero
 *     delta + unknown grip kinds to the original params (referential identity).
 *   - Phase 5.5b — width drag: perpendicular projection × 2 → new width
 *     (symmetric γύρω από axis), parallel delta = no-op, clamps σε
 *     `MIN_BEAM_WIDTH_MM`.
 *   - Phase 5.5c — depth drag: outward perpendicular drag (negative perp
 *     direction) increases depth, parallel = no-op, clamps σε `MIN_BEAM_DEPTH_MM`.
 */

import {
  getBeamGrips,
  applyBeamGripDrag,
  beamWidthHandlePosition,
  beamDepthHandlePosition,
  DEPTH_GRIP_OFFSET_MM,
} from '../beam-grips';
import { buildDefaultBeamParams } from '../../../hooks/drawing/beam-completion';
import { MIN_BEAM_WIDTH_MM, MIN_BEAM_DEPTH_MM } from '../../types/beam-types';
import type { BeamEntity, BeamParams } from '../../types/beam-types';
import type { BeamGripKind } from '../../../hooks/grip-types';

function makeBeamEntity(params: BeamParams): BeamEntity {
  // Lightweight stub — `beam-grips` reads only `id`, `kind`, `params`. Geometry
  // / validation / layerId are not referenced, so we avoid the full builder
  // (keeps tests pure and decoupled from validator thresholds).
  return {
    id: 'beam_test',
    type: 'beam',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: undefined as never,
    validation: undefined as never,
    visible: true,
  } as unknown as BeamEntity;
}

function makeStraight(): BeamEntity {
  return makeBeamEntity(
    buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight'),
  );
}

function makeCantilever(): BeamEntity {
  return makeBeamEntity(
    buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'cantilever'),
  );
}

function makeCurvedWithControl(): BeamEntity {
  const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'curved');
  return makeBeamEntity({
    ...base,
    kind: 'curved',
    curveControl: { x: 2000, y: 800, z: 0 },
  });
}

function makeCurvedWithoutControl(): BeamEntity {
  const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'curved');
  return makeBeamEntity({ ...base, kind: 'curved' });
}

describe('beam-grips (Phase 5.5a)', () => {
  // ─── getBeamGrips ──────────────────────────────────────────────────────────

  it('1. straight beam emits 5 grips (start / end / midpoint / width / depth)', () => {
    const beam = makeStraight();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-midpoint',
      'beam-width',
      'beam-depth',
    ]);
  });

  it('2. cantilever beam emits 5 grips (same layout as straight)', () => {
    const beam = makeCantilever();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(5);
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-midpoint',
      'beam-width',
      'beam-depth',
    ]);
  });

  it('3. curved beam emits 6 grips (start / end / midpoint / curve / width / depth)', () => {
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(6);
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-midpoint',
      'beam-curve',
      'beam-width',
      'beam-depth',
    ]);
  });

  it('4. grip positions match params.startPoint / endPoint / midpoint / curveControl', () => {
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    expect(grips[0].position).toEqual({ x: 0, y: 0 });
    expect(grips[1].position).toEqual({ x: 4000, y: 0 });
    expect(grips[2].position).toEqual({ x: 2000, y: 0 });
    expect(grips[3].position).toEqual({ x: 2000, y: 800 });
  });

  it('5. curved beam without curveControl seeds curve grip at axis midpoint', () => {
    const beam = makeCurvedWithoutControl();
    const grips = getBeamGrips(beam);
    // start + end + midpoint + curve + width + depth (Phase 5.5b/5.5c added the
    // width/depth dimension handles for every non-degenerate beam, incl. curved).
    expect(grips).toHaveLength(6);
    expect(grips[3].beamGripKind).toBe('beam-curve');
    // Axis midpoint of (0,0)→(4000,0) is (2000,0).
    expect(grips[3].position).toEqual({ x: 2000, y: 0 });
    expect(grips[4].beamGripKind).toBe('beam-width');
    expect(grips[5].beamGripKind).toBe('beam-depth');
  });

  it('6. midpoint grip carries movesEntity=true, others false (incl. width + depth)', () => {
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    expect(grips[0].movesEntity).toBe(false);
    expect(grips[1].movesEntity).toBe(false);
    expect(grips[2].movesEntity).toBe(true);
    expect(grips[3].movesEntity).toBe(false);
    expect(grips[4].movesEntity).toBe(false);
    expect(grips[5].movesEntity).toBe(false);
  });

  // ─── applyBeamGripDrag ─────────────────────────────────────────────────────

  it('7. beam-start drag translates startPoint only', () => {
    const beam = makeStraight();
    const next = applyBeamGripDrag('beam-start', {
      originalParams: beam.params,
      delta: { x: 100, y: 50 },
    });
    expect(next.startPoint).toEqual({ x: 100, y: 50, z: 0 });
    expect(next.endPoint).toEqual(beam.params.endPoint);
  });

  it('8. beam-end drag translates endPoint only', () => {
    const beam = makeStraight();
    const next = applyBeamGripDrag('beam-end', {
      originalParams: beam.params,
      delta: { x: -200, y: 75 },
    });
    expect(next.endPoint).toEqual({ x: 3800, y: 75, z: 0 });
    expect(next.startPoint).toEqual(beam.params.startPoint);
  });

  it('9. beam-midpoint drag translates both endpoints by delta', () => {
    const beam = makeStraight();
    const next = applyBeamGripDrag('beam-midpoint', {
      originalParams: beam.params,
      delta: { x: 500, y: 300 },
    });
    expect(next.startPoint).toEqual({ x: 500, y: 300, z: 0 });
    expect(next.endPoint).toEqual({ x: 4500, y: 300, z: 0 });
  });

  it('10. beam-midpoint drag also translates curveControl when present', () => {
    const beam = makeCurvedWithControl();
    const next = applyBeamGripDrag('beam-midpoint', {
      originalParams: beam.params,
      delta: { x: 100, y: 100 },
    });
    expect(next.curveControl).toEqual({ x: 2100, y: 900, z: 0 });
  });

  it('11. beam-curve drag seeds curveControl from axis midpoint when undefined', () => {
    const beam = makeCurvedWithoutControl();
    const next = applyBeamGripDrag('beam-curve', {
      originalParams: beam.params,
      delta: { x: 0, y: 600 },
    });
    // Seed = midpoint(0,0)+(0,600) = (2000, 600).
    expect(next.curveControl).toEqual({ x: 2000, y: 600, z: 0 });
  });

  it('12. beam-curve drag translates existing curveControl', () => {
    const beam = makeCurvedWithControl();
    const next = applyBeamGripDrag('beam-curve', {
      originalParams: beam.params,
      delta: { x: 250, y: -100 },
    });
    expect(next.curveControl).toEqual({ x: 2250, y: 700, z: 0 });
  });

  it('13. zero delta returns originalParams referentially unchanged', () => {
    const beam = makeStraight();
    const next = applyBeamGripDrag('beam-midpoint', {
      originalParams: beam.params,
      delta: { x: 0, y: 0 },
    });
    expect(next).toBe(beam.params);
  });

  it('14. unknown grip kind returns originalParams referentially unchanged', () => {
    const beam = makeStraight();
    const next = applyBeamGripDrag(
      'beam-bogus' as unknown as BeamGripKind,
      { originalParams: beam.params, delta: { x: 10, y: 10 } },
    );
    expect(next).toBe(beam.params);
  });

  it('15. drag preserves foreign params (width / depth / elevation / supportType / material)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = {
      ...base,
      width: 333,
      depth: 555,
      topElevation: 2750,
      supportType: 'fixed',
      material: 'rc-c25',
    };
    const beam = makeBeamEntity(params);
    const next = applyBeamGripDrag('beam-start', {
      originalParams: beam.params,
      delta: { x: 10, y: 10 },
    });
    expect(next.width).toBe(333);
    expect(next.depth).toBe(555);
    expect(next.topElevation).toBe(2750);
    expect(next.supportType).toBe('fixed');
    expect(next.material).toBe('rc-c25');
  });

  // ─── Phase 5.5b — width dimension grip ─────────────────────────────────────

  it('16. width grip position = axis midpoint + perpendicular × width/2 (horizontal axis)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, width: 300 };
    const beam = makeBeamEntity(params);
    const grips = getBeamGrips(beam);
    const widthGrip = grips.find((g) => g.beamGripKind === 'beam-width');
    expect(widthGrip).toBeDefined();
    // Axis = (0,0)→(4000,0). perp = rot90(unit) = (0,1). mid = (2000,0).
    // Handle = mid + (width/2) × perp = (2000, 150).
    expect(widthGrip!.position).toEqual({ x: 2000, y: 150 });
    expect(beamWidthHandlePosition(params)).toEqual({ x: 2000, y: 150 });
  });

  it('17. width drag perpendicular to axis doubles delta into width (symmetric resize)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, width: 300 };
    const next = applyBeamGripDrag('beam-width', {
      originalParams: params,
      delta: { x: 0, y: 100 },
    });
    // axis horizontal → perp = (0,1). delta·perp = 100. newWidth = 300 + 2*100 = 500.
    expect(next.width).toBe(500);
  });

  it('18. width drag parallel to axis leaves width unchanged (projection = 0)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, width: 300 };
    const next = applyBeamGripDrag('beam-width', {
      originalParams: params,
      delta: { x: 100, y: 0 },
    });
    // axis horizontal → perp = (0,1). delta·perp = 0. width stays 300.
    expect(next.width).toBe(300);
  });

  it('19. width drag clamps to MIN_BEAM_WIDTH_MM on large negative perpendicular delta', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, width: 300 };
    const next = applyBeamGripDrag('beam-width', {
      originalParams: params,
      delta: { x: 0, y: -10000 },
    });
    // raw = 300 + 2*(-10000) = -19700 → clamped to MIN_BEAM_WIDTH_MM (150).
    expect(next.width).toBe(MIN_BEAM_WIDTH_MM);
  });

  // ─── Phase 5.5c — depth dimension grip (out-of-plane indicator) ───────────

  it('20. depth grip position = axis midpoint − perpendicular × (width/2 + DEPTH_GRIP_OFFSET_MM)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, width: 300 };
    const beam = makeBeamEntity(params);
    const grips = getBeamGrips(beam);
    const depthGrip = grips.find((g) => g.beamGripKind === 'beam-depth');
    expect(depthGrip).toBeDefined();
    // axis horizontal → perp = (0,1). mid = (2000,0). offset = -(150 + 250) = -400.
    // Handle = mid + offset × perp = (2000, -400).
    const expectedY = -(params.width / 2 + DEPTH_GRIP_OFFSET_MM);
    expect(depthGrip!.position).toEqual({ x: 2000, y: expectedY });
    expect(beamDepthHandlePosition(params)).toEqual({ x: 2000, y: expectedY });
  });

  it('21. depth drag OUTWARD (negative perp delta) INCREASES depth (symmetric × 2)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, depth: 500 };
    const next = applyBeamGripDrag('beam-depth', {
      originalParams: params,
      delta: { x: 0, y: -100 },
    });
    // axis horizontal → perp = (0,1). delta·perp = -100. newDepth = 500 − 2·(-100) = 700.
    expect(next.depth).toBe(700);
  });

  it('22. depth drag INWARD (positive perp delta) DECREASES depth', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, depth: 500 };
    const next = applyBeamGripDrag('beam-depth', {
      originalParams: params,
      delta: { x: 0, y: 100 },
    });
    // newDepth = 500 − 2·(100) = 300.
    expect(next.depth).toBe(300);
  });

  it('23. depth drag parallel to axis leaves depth unchanged (projection = 0)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, depth: 500 };
    const next = applyBeamGripDrag('beam-depth', {
      originalParams: params,
      delta: { x: 250, y: 0 },
    });
    expect(next.depth).toBe(500);
  });

  it('24. depth drag clamps to MIN_BEAM_DEPTH_MM on large inward delta', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, depth: 500 };
    const next = applyBeamGripDrag('beam-depth', {
      originalParams: params,
      delta: { x: 0, y: 10000 },
    });
    // raw = 500 − 2·10000 = -19500 → clamped.
    expect(next.depth).toBe(MIN_BEAM_DEPTH_MM);
  });

  it('25. depth drag preserves width (independent dimensions)', () => {
    const base = buildDefaultBeamParams({ x: 0, y: 0 }, { x: 4000, y: 0 }, 'straight');
    const params: BeamParams = { ...base, width: 300, depth: 500 };
    const next = applyBeamGripDrag('beam-depth', {
      originalParams: params,
      delta: { x: 0, y: -50 },
    });
    expect(next.width).toBe(300);
    expect(next.depth).toBe(600);
  });
});
