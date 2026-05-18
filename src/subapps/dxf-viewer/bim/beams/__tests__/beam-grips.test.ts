/**
 * ADR-363 Phase 5.5a — `beam-grips` pure-function tests.
 *
 * Verifies:
 *   - `getBeamGrips` emits the correct count + ordering per kind
 *     (straight/cantilever → 3 grips, curved → 4 grips).
 *   - Grip positions correspond to params.startPoint / endPoint / midpoint /
 *     curveControl in scene-unit (mm) space.
 *   - `applyBeamGripDrag` translates the right endpoint(s) per kind, seeds the
 *     curve control point when previously undefined, preserves foreign params
 *     (width/depth/elevation/material/supportType), and short-circuits zero
 *     delta + unknown grip kinds to the original params (referential identity).
 */

import { getBeamGrips, applyBeamGripDrag } from '../beam-grips';
import { buildDefaultBeamParams } from '../../../hooks/drawing/beam-completion';
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

  it('1. straight beam emits 3 grips (start / end / midpoint)', () => {
    const beam = makeStraight();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(3);
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-midpoint',
    ]);
  });

  it('2. cantilever beam emits 3 grips (same as straight)', () => {
    const beam = makeCantilever();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(3);
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-midpoint',
    ]);
  });

  it('3. curved beam emits 4 grips (start / end / midpoint / curve)', () => {
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    expect(grips).toHaveLength(4);
    expect(grips.map((g) => g.beamGripKind)).toEqual([
      'beam-start',
      'beam-end',
      'beam-midpoint',
      'beam-curve',
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
    expect(grips).toHaveLength(4);
    expect(grips[3].beamGripKind).toBe('beam-curve');
    // Axis midpoint of (0,0)→(4000,0) is (2000,0).
    expect(grips[3].position).toEqual({ x: 2000, y: 0 });
  });

  it('6. midpoint grip carries movesEntity=true, others false', () => {
    const beam = makeCurvedWithControl();
    const grips = getBeamGrips(beam);
    expect(grips[0].movesEntity).toBe(false);
    expect(grips[1].movesEntity).toBe(false);
    expect(grips[2].movesEntity).toBe(true);
    expect(grips[3].movesEntity).toBe(false);
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
      elevation: 2750,
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
    expect(next.elevation).toBe(2750);
    expect(next.supportType).toBe('fixed');
    expect(next.material).toBe('rc-c25');
  });
});
