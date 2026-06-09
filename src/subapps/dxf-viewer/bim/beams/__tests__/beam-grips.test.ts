/**
 * ADR-363 Phase 5.5a + 5.5b + 5.5c — `beam-grips` pure-function tests.
 *
 * Verifies:
 *   - `getBeamGrips` emits the correct count + ordering per kind
 *     (straight/cantilever → 5 grips, curved → 6 grips — ADR-363 Φ1G.5 Slice 2:
 *     beam-midpoint grip removed; Phase 5.5b width + Phase 5.5c depth remain).
 *   - Grip positions correspond to params.startPoint / endPoint /
 *     curveControl (curved kind), width-handle (+perpendicular × width/2) and depth-handle
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

  it('1. straight beam emits 5 grips (start / end / width / depth / rotation)', () => {
    // ADR-363 Φ1G.5 Slice 2: beam-midpoint no longer emitted — count drops 6→5
    const beam = makeStraight();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(5); // ADR-363 Φ1G.5 Slice 2
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-width',
      'beam-depth',
      'beam-rotation',
    ]); // ADR-363 Φ1G.5 Slice 2: 'beam-midpoint' removed
  });

  it('2. cantilever beam emits 5 grips (same layout as straight)', () => {
    // ADR-363 Φ1G.5 Slice 2: beam-midpoint no longer emitted — count drops 6→5
    const beam = makeCantilever();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(5); // ADR-363 Φ1G.5 Slice 2
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-width',
      'beam-depth',
      'beam-rotation',
    ]); // ADR-363 Φ1G.5 Slice 2: 'beam-midpoint' removed
  });

  it('3. curved beam emits 6 grips (start / end / curve / width / depth / rotation)', () => {
    // ADR-363 Φ1G.5 Slice 2: beam-midpoint no longer emitted — count drops 7→6
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(6); // ADR-363 Φ1G.5 Slice 2
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-curve',
      'beam-width',
      'beam-depth',
      'beam-rotation',
    ]); // ADR-363 Φ1G.5 Slice 2: 'beam-midpoint' removed
  });

  it('4. grip positions match params.startPoint / endPoint / curveControl', () => {
    // ADR-363 Φ1G.5 Slice 2: grips[2] is now beam-curve (was beam-midpoint).
    // grips[3] is now beam-width. Indices shifted down by 1 after the midpoint removal.
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    expect(grips[0].position).toEqual({ x: 0, y: 0 });
    expect(grips[1].position).toEqual({ x: 4000, y: 0 });
    // ADR-363 Φ1G.5 Slice 2: grips[2] = beam-curve (was grips[3])
    expect(grips[2].beamGripKind).toBe('beam-curve');
    expect(grips[2].position).toEqual({ x: 2000, y: 800 });
  });

  it('5. curved beam without curveControl seeds curve grip at axis midpoint', () => {
    // ADR-363 Φ1G.5 Slice 2: beam-midpoint removed → 7→6 grips; indices shift down by 1.
    // New array: start(0) / end(1) / curve(2) / width(3) / depth(4) / rotation(5).
    const beam = makeCurvedWithoutControl();
    const grips = getBeamGrips(beam);
    // start + end + curve + width + depth + rotation (Phase 5.5b/5.5c/5.5d)
    expect(grips).toHaveLength(6); // ADR-363 Φ1G.5 Slice 2
    // ADR-363 Φ1G.5 Slice 2: grips[2] = beam-curve (was grips[3])
    expect(grips[2].beamGripKind).toBe('beam-curve');
    // Axis midpoint of (0,0)→(4000,0) is (2000,0).
    expect(grips[2].position).toEqual({ x: 2000, y: 0 });
    expect(grips[3].beamGripKind).toBe('beam-width'); // ADR-363 Φ1G.5 Slice 2: was grips[4]
    expect(grips[4].beamGripKind).toBe('beam-depth'); // ADR-363 Φ1G.5 Slice 2: was grips[5]
    expect(grips[5].beamGripKind).toBe('beam-rotation'); // ADR-363 Φ1G.5 Slice 2: was grips[6]
  });

  it('6. beam-midpoint is NOT emitted; all remaining grips have movesEntity=false', () => {
    // ADR-363 Φ1G.5 Slice 2: beam-midpoint grip removed — no grip has movesEntity=true.
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    // Confirm beam-midpoint is absent entirely
    expect(grips.some((g) => g.beamGripKind === 'beam-midpoint')).toBe(false); // ADR-363 Φ1G.5 Slice 2
    // All remaining grips must have movesEntity=false
    expect(grips.every((g) => g.movesEntity === false)).toBe(true); // ADR-363 Φ1G.5 Slice 2
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

  // ─── Phase 5.5d — rotation grip (wall parity) ──────────────────────────────

  it('26. rotation grip stands at axis 0.75 fraction, renders rotation glyph kind', () => {
    const beam = makeStraight(); // (0,0)→(4000,0)
    const grips = getBeamGrips(beam);
    const rot = grips.find((g) => g.beamGripKind === 'beam-rotation');
    expect(rot).toBeDefined();
    // lerp(start, end, 0.75) of (0,0)→(4000,0) = (3000, 0). Scale-free fraction.
    expect(rot!.position).toEqual({ x: 3000, y: 0 });
    expect(rot!.movesEntity).toBe(false);
  });

  it('27. degenerate axis (start === end) emits NO rotation grip', () => {
    const beam = makeBeamEntity(
      buildDefaultBeamParams({ x: 1000, y: 1000 }, { x: 1000, y: 1000 }, 'straight'),
    );
    const grips = getBeamGrips(beam);
    expect(grips.some((g) => g.beamGripKind === 'beam-rotation')).toBe(false);
  });

  it('28. beam-rotation 90° CCW about the axis midpoint spins both endpoints', () => {
    const beam = makeStraight(); // (0,0)→(4000,0), midpoint (2000,0)
    // anchor-relative swept angle: anchor at pivot+(1,0) → 0°, current at
    // pivot+(0,1) → 90°. delta = current − anchor. No pivot ⇒ axis midpoint.
    const currentPos = { x: 2000, y: 1 };
    const delta = { x: currentPos.x - 2001, y: currentPos.y - 0 }; // anchor=(2001,0)
    const next = applyBeamGripDrag('beam-rotation', {
      originalParams: beam.params,
      delta,
      currentPos,
    });
    // 90° CCW about (2000,0): start (0,0)→(2000,−2000), end (4000,0)→(2000,2000).
    expect(next.startPoint.x).toBeCloseTo(2000, 6);
    expect(next.startPoint.y).toBeCloseTo(-2000, 6);
    expect(next.endPoint.x).toBeCloseTo(2000, 6);
    expect(next.endPoint.y).toBeCloseTo(2000, 6);
  });

  it('29. beam-rotation about a picked pivot rotates the whole beam around it', () => {
    const beam = makeStraight(); // (0,0)→(4000,0)
    const pivot = { x: 0, y: 0 }; // rotate about the start endpoint
    const currentPos = { x: 0, y: 1 }; // pivot+(0,1) → 90°
    const delta = { x: currentPos.x - 1, y: currentPos.y - 0 }; // anchor=(1,0) → 0°
    const next = applyBeamGripDrag('beam-rotation', {
      originalParams: beam.params,
      delta,
      currentPos,
      pivot,
    });
    // 90° CCW about (0,0): start stays (0,0); end (4000,0)→(0,4000).
    expect(next.startPoint.x).toBeCloseTo(0, 6);
    expect(next.startPoint.y).toBeCloseTo(0, 6);
    expect(next.endPoint.x).toBeCloseTo(0, 6);
    expect(next.endPoint.y).toBeCloseTo(4000, 6);
  });

  it('30. beam-rotation also rotates curveControl when present', () => {
    const beam = makeCurvedWithControl(); // control (2000,800)
    const pivot = { x: 2000, y: 0 }; // axis midpoint
    const currentPos = { x: 2000, y: 1 };
    const delta = { x: currentPos.x - 2001, y: currentPos.y - 0 };
    const next = applyBeamGripDrag('beam-rotation', {
      originalParams: beam.params,
      delta,
      currentPos,
      pivot,
    });
    // 90° CCW about (2000,0): control (2000,800) rel (0,800) → (−800,0) → (1200,0).
    expect(next.curveControl!.x).toBeCloseTo(1200, 6);
    expect(next.curveControl!.y).toBeCloseTo(0, 6);
  });

  it('31. beam-rotation without currentPos is a no-op (referential identity)', () => {
    const beam = makeStraight();
    const next = applyBeamGripDrag('beam-rotation', {
      originalParams: beam.params,
      delta: { x: 10, y: 10 },
    });
    expect(next).toBe(beam.params);
  });

  it('32. beam-rotation with cursor on the pivot is a no-op (degenerate swept angle)', () => {
    const beam = makeStraight();
    const pivot = { x: 2000, y: 0 };
    // currentPos === pivot → degenerate → null swept → originalParams unchanged.
    const next = applyBeamGripDrag('beam-rotation', {
      originalParams: beam.params,
      delta: { x: 5, y: 5 },
      currentPos: { x: 2000, y: 0 },
      pivot,
    });
    expect(next).toBe(beam.params);
  });
});
