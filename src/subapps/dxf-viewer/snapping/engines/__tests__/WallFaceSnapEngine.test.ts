/**
 * ADR-363 Φ1G.5 Slice 2i — WallFaceSnapEngine tests.
 *
 * Verifies:
 *   - Non-wall / empty → no candidates.
 *   - Cursor near the OUTER face line projects onto it (clamped) + carries the face
 *     segment as `referenceSegment` (for the dashed alignment line).
 *   - Cursor near the INNER face picks the inner face (nearest of the two).
 *   - Candidate type = BIM_WALL_FACE, description = 'bim-wall-face', priority = -1.8.
 *   - excludeEntityId suppresses the wall (don't snap a moving wall to itself).
 *   - Cursor outside the radius → no candidates.
 */

import { WallFaceSnapEngine } from '../WallFaceSnapEngine';
import { ExtendedSnapType } from '../../extended-types';
import type { WallEntity, WallParams } from '../../../bim/types/wall-types';
import type { SnapEngineContext } from '../../shared/BaseSnapEngine';
import type { EntityModel } from '../../../rendering/types/Types';

function makeWallEntity(overrides: Partial<WallParams> = {}, id = 'wall_test'): WallEntity {
  const params = {
    category: 'exterior',
    start: { x: 0, y: 0 },
    end: { x: 1000, y: 0 },
    height: 3000,
    thickness: 200,
    flip: false,
    ...overrides,
  } as WallParams;
  return { id, type: 'wall', kind: 'straight', layerId: '0', params, geometry: undefined as never, validation: undefined as never, visible: true } as unknown as WallEntity;
}

function makeNonWall(id = 'line_1'): EntityModel {
  return { id, type: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, visible: true } as EntityModel;
}

function makeContext(overrides: Partial<SnapEngineContext> = {}): SnapEngineContext {
  return { entities: [], worldRadiusAt: () => 300, worldRadiusForType: () => 300, maxCandidates: 10, ...overrides };
}

describe('WallFaceSnapEngine', () => {
  let engine: WallFaceSnapEngine;
  beforeEach(() => { engine = new WallFaceSnapEngine(); });
  afterEach(() => { engine.dispose(); });

  it('no candidates for non-wall entities', () => {
    const ctx = makeContext({ entities: [makeNonWall()] });
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, ctx).candidates).toHaveLength(0);
  });

  it('no candidates for an empty scene', () => {
    expect(engine.findSnapCandidates({ x: 0, y: 0 }, makeContext()).candidates).toHaveLength(0);
  });

  it('projects the cursor onto the OUTER face line (clamped)', () => {
    const ctx = makeContext({ entities: [makeWallEntity({ thickness: 200 })] });
    const { candidates } = engine.findSnapCandidates({ x: 500, y: 150 }, ctx);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.point.x).toBeCloseTo(500, 5);
    expect(candidates[0]!.point.y).toBeCloseTo(100, 5); // outer face at +halfThickness
  });

  it('carries the face line as referenceSegment (for the alignment line)', () => {
    const ctx = makeContext({ entities: [makeWallEntity({ thickness: 200 })] });
    const ref = engine.findSnapCandidates({ x: 500, y: 150 }, ctx).candidates[0]!.referenceSegment;
    expect(ref).toBeDefined();
    expect(ref!.start.y).toBeCloseTo(100, 5);
    expect(ref!.end.y).toBeCloseTo(100, 5);
    expect(Math.abs(ref!.end.x - ref!.start.x)).toBeCloseTo(1000, 5); // spans the wall length
  });

  it('picks the INNER face when the cursor is on that side', () => {
    const ctx = makeContext({ entities: [makeWallEntity({ thickness: 200 })] });
    const { candidates } = engine.findSnapCandidates({ x: 500, y: -150 }, ctx);
    expect(candidates[0]!.point.y).toBeCloseTo(-100, 5);
  });

  it('type = BIM_WALL_FACE, description = bim-wall-face, priority = 9.5 (linear, below discrete points)', () => {
    const ctx = makeContext({ entities: [makeWallEntity()] });
    const hit = engine.findSnapCandidates({ x: 500, y: 150 }, ctx).candidates[0]!;
    expect(hit.type).toBe(ExtendedSnapType.BIM_WALL_FACE);
    expect(hit.description).toBe('bim-wall-face');
    expect(hit.priority).toBe(9.5);
  });

  it('excludeEntityId suppresses the wall (no self-snap)', () => {
    const ctx = makeContext({ entities: [makeWallEntity({}, 'wall_x')], excludeEntityId: 'wall_x' });
    expect(engine.findSnapCandidates({ x: 500, y: 150 }, ctx).candidates).toHaveLength(0);
  });

  it('cursor outside the radius returns no candidates', () => {
    const ctx = makeContext({ entities: [makeWallEntity({ thickness: 200 })], worldRadiusForType: () => 5 });
    expect(engine.findSnapCandidates({ x: 500, y: 5000 }, ctx).candidates).toHaveLength(0);
  });

  // ── ADR-363 Φ1G.5 Slice 2j — sidedness (flush, no penetration) ────────────────
  describe('sidedness (Slice 2j: T-junction overshoot fix)', () => {
    it('stops the probe flush at the NEAR face it approaches from outside', () => {
      // T-junction: a moving wall END probe approaching the static wall's top face.
      const ctx = makeContext({ entities: [makeWallEntity({ thickness: 200 })] });
      const { candidates } = engine.findSnapCandidates({ x: 500, y: 108 }, ctx);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.point.y).toBeCloseTo(100, 5); // flush against the near (outer) face
    });

    it('does NOT pull inward when the probe is inside the wall body (no penetration)', () => {
      // Probe between the two faces (y=40, body spans −100..+100) — no face faces it.
      const ctx = makeContext({ entities: [makeWallEntity({ thickness: 200 })] });
      expect(engine.findSnapCandidates({ x: 500, y: 40 }, ctx).candidates).toHaveLength(0);
    });

    it('does NOT grab the BACK face when the probe sits behind it', () => {
      // Pure-distance would snap (500,−40) onto the inner face (nearest), pulling the
      // dragged wall INTO the body. Sidedness rejects it: the probe is behind inner.
      const ctx = makeContext({ entities: [makeWallEntity({ thickness: 200 })] });
      expect(engine.findSnapCandidates({ x: 500, y: -40 }, ctx).candidates).toHaveLength(0);
    });

    it('degenerate (zero-thickness) wall falls back to plain nearest (gating disabled)', () => {
      const ctx = makeContext({ entities: [makeWallEntity({ thickness: 0 })] });
      const { candidates } = engine.findSnapCandidates({ x: 500, y: 50 }, ctx);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]!.point.y).toBeCloseTo(0, 5);
    });
  });
});
