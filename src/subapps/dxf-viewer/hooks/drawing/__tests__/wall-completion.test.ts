/**
 * ADR-363 Phase 1 — `wall-completion` builders tests.
 *
 * Coverage:
 *   - buildDefaultWallParams: category default, DNA preset selection, thickness
 *     derived from DNA, height defaults, scene-unit scaling
 *   - buildWallEntity: ok path returns entity with geometry + validation;
 *     fail path returns hardErrors for invalid params
 *   - completeWallFromTwoClicks: convenience wrapper end-to-end
 */

import {
  buildDefaultWallParams,
  buildWallEntity,
  completeWallFromTwoClicks,
  computeWallAlignmentOffset,
} from '../wall-completion';
import { DEFAULT_WALL_HEIGHT_MM } from '../../../bim/types/wall-types';
import { useActiveStoreyStore } from '../../../systems/levels/active-storey-store';
import { buildActiveStoreyContext } from '../../../systems/levels/active-storey-context';

describe('buildDefaultWallParams', () => {
  it('returns exterior category + DNA preset by default', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(params.category).toBe('exterior');
    expect(params.dna).toBeDefined();
    expect(params.dna?.totalThickness).toBe(250); // exterior preset
    expect(params.thickness).toBe(250);
  });

  it('matches thickness to DNA total when DNA preset is used', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      category: 'interior',
    });
    expect(params.thickness).toBe(params.dna?.totalThickness);
  });

  it('honours explicit thickness override even with DNA', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      thickness: 300,
    });
    expect(params.thickness).toBe(300);
  });

  it('uses DEFAULT_WALL_HEIGHT_MM when no override', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(params.height).toBe(DEFAULT_WALL_HEIGHT_MM);
  });

  it('honours height override', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      height: 2400,
    });
    expect(params.height).toBe(2400);
  });

  it('z-coordinate of start/end defaults to 0', () => {
    const params = buildDefaultWallParams({ x: 5, y: 10 }, { x: 100, y: 200 });
    expect(params.start.z).toBe(0);
    expect(params.end.z).toBe(0);
  });

  it('flip override propagates', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      flip: true,
    });
    expect(params.flip).toBe(true);
  });

  it('scene-unit m: scalar params stay in mm (SSoT — boundary conversion lives in computeWallGeometry)', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1, y: 0 }, undefined, 'm');
    // Spec (wall-completion.ts L65): "Scalars (height, thickness) stored in mm
    // — always, regardless of sceneUnits. Boundary conversion (mm → canvas
    // units) happens in computeWallGeometry." So height stays at 3000 mm even
    // when sceneUnits = 'm', and the DNA preset stays at its raw mm value.
    expect(params.height).toBe(DEFAULT_WALL_HEIGHT_MM);
    expect(params.thickness).toBe(250); // exterior preset, raw mm
    expect(params.dna?.totalThickness).toBe(250);
    expect(params.sceneUnits).toBe('m');
  });
});

// ADR-448 Phase 2 — storey-aware default height (via active-storey store).
describe('buildDefaultWallParams — storey-aware height (ADR-448 Phase 2)', () => {
  afterEach(() => useActiveStoreyStore.setState({ context: null }));

  it('inherits the active storey height when no override (3.5m floor → 3500)', () => {
    useActiveStoreyStore.setState({
      context: buildActiveStoreyContext(
        [{ id: 'f1', number: 1, elevation: 0, height: 3.5, kind: 'standard' }],
        'f1',
      ),
    });
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(params.height).toBe(3500);
  });

  it('explicit height override still wins over the storey default', () => {
    useActiveStoreyStore.setState({
      context: buildActiveStoreyContext(
        [{ id: 'f1', number: 1, elevation: 0, height: 3.5, kind: 'standard' }],
        'f1',
      ),
    });
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, { height: 2400 });
    expect(params.height).toBe(2400);
  });

  it('falls back to DEFAULT_WALL_HEIGHT_MM when no active storey', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(params.height).toBe(DEFAULT_WALL_HEIGHT_MM);
  });
});

describe('buildWallEntity', () => {
  it('returns ok=true on valid params with id, kind, layerId, geometry, validation', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const r = buildWallEntity(params, 'lyr_test', 'straight');
    expect(r.ok).toBe(true);
    if (!r.ok) return; // type narrow
    expect(r.entity.type).toBe('wall');
    expect(r.entity.kind).toBe('straight');
    expect(r.entity.layerId).toBe('lyr_test');
    expect(r.entity.id).toMatch(/^wall_/);
    expect(r.entity.geometry.length).toBeCloseTo(1.0, 6);
    expect(r.entity.validation.hasCodeViolations).toBe(false);
  });

  it('returns ok=false with hardErrors on zero-length wall', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 0, y: 0 });
    const r = buildWallEntity(params, 'lyr_test');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.hardErrors.length).toBeGreaterThan(0);
    expect(r.hardErrors).toContain('wall.validation.hardErrors.lengthTooShort');
  });

  it('exterior wall with NOK-thin thickness still creates entity but flags violation', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 }, {
      thickness: 100,
      category: 'exterior',
    });
    const r = buildWallEntity(params, 'lyr_test');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entity.validation.hasCodeViolations).toBe(true);
  });
});

describe('completeWallFromTwoClicks', () => {
  it('builds entity from 2 click points', () => {
    const r = completeWallFromTwoClicks({ x: 0, y: 0 }, { x: 2000, y: 0 }, 'lyr_x');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entity.geometry.length).toBeCloseTo(2.0, 6);
  });

  it('propagates overrides to params', () => {
    const r = completeWallFromTwoClicks(
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      'lyr_x',
      { category: 'partition', height: 2400 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entity.params.category).toBe('partition');
    expect(r.entity.params.height).toBe(2400);
  });
});

// ─── ADR-363 Phase 1F — alignment offset ────────────────────────────────────

describe('computeWallAlignmentOffset', () => {
  it('returns zero offset when alignment point is colinear with axis', () => {
    const offset = computeWallAlignmentOffset(
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      { x: 500, y: 0 }, // on the axis line
      200, 'mm',
    );
    expect(offset.x).toBeCloseTo(0, 9);
    expect(offset.y).toBeCloseTo(0, 9);
  });

  it('returns zero offset when start == end (degenerate axis)', () => {
    const offset = computeWallAlignmentOffset(
      { x: 100, y: 100 }, { x: 100, y: 100 },
      { x: 500, y: 500 },
      200, 'mm',
    );
    expect(offset.x).toBe(0);
    expect(offset.y).toBe(0);
  });

  it('shifts axis +Y when alignment point is on +Y side (cross > 0, axis +X)', () => {
    // Axis A→B along +X; CCW perpendicular = +Y. C at (500, 100) → cross > 0.
    // halfThickness = 200/2 = 100 mm → shift by +100 along +Y.
    const offset = computeWallAlignmentOffset(
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      { x: 500, y: 100 },
      200, 'mm',
    );
    expect(offset.x).toBeCloseTo(0, 6);
    expect(offset.y).toBeCloseTo(100, 6);
  });

  it('shifts axis -Y when alignment point is on -Y side (cross < 0, axis +X)', () => {
    const offset = computeWallAlignmentOffset(
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      { x: 500, y: -100 },
      200, 'mm',
    );
    expect(offset.x).toBeCloseTo(0, 6);
    expect(offset.y).toBeCloseTo(-100, 6);
  });

  it('handles diagonal axis: perpendicular shift, not parallel', () => {
    // Axis at 45° along (+X, +Y). CCW perp = (-1, 1)/√2.
    // halfThickness 200/2 = 100 mm. Shift magnitude = 100, along (-1, 1)/√2.
    // C at (0, 100) → cross = 1*100 - 1*0 = 100 > 0 → sign +1.
    const offset = computeWallAlignmentOffset(
      { x: 0, y: 0 }, { x: 1000, y: 1000 },
      { x: 0, y: 100 },
      200, 'mm',
    );
    const expected = 100 / Math.SQRT2;
    expect(offset.x).toBeCloseTo(-expected, 6);
    expect(offset.y).toBeCloseTo(+expected, 6);
  });

  it('scales offset magnitude with sceneUnits = m', () => {
    // halfThickness 100 mm × mmToSceneUnits('m')=0.001 → 0.1 in metres.
    const offset = computeWallAlignmentOffset(
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 0.5, y: 1 },
      200, 'm',
    );
    expect(offset.x).toBeCloseTo(0, 9);
    expect(offset.y).toBeCloseTo(0.1, 9);
  });
});

describe('buildDefaultWallParams alignment integration', () => {
  it('omits alignment when alignmentPoint is undefined (back-compat)', () => {
    const params = buildDefaultWallParams({ x: 0, y: 0 }, { x: 1000, y: 0 });
    expect(params.start).toMatchObject({ x: 0, y: 0 });
    expect(params.end).toMatchObject({ x: 1000, y: 0 });
  });

  it('shifts both start and end by the same offset toward alignmentPoint', () => {
    const params = buildDefaultWallParams(
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      undefined, 'mm',
      { x: 500, y: 100 }, // +Y side
    );
    // exterior DNA thickness = 250 mm → half = 125 → shift +Y by 125.
    expect(params.start.x).toBeCloseTo(0, 6);
    expect(params.start.y).toBeCloseTo(125, 6);
    expect(params.end.x).toBeCloseTo(1000, 6);
    expect(params.end.y).toBeCloseTo(125, 6);
  });

  it('alignment offset uses overridden thickness when provided', () => {
    const params = buildDefaultWallParams(
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      { thickness: 400 }, 'mm',
      { x: 500, y: 100 },
    );
    // thickness override → half = 200, no DNA.
    expect(params.thickness).toBe(400);
    expect(params.dna).toBeUndefined();
    expect(params.start.y).toBeCloseTo(200, 6);
    expect(params.end.y).toBeCloseTo(200, 6);
  });
});
