/**
 * ADR-363 Phase 5.5e — `wall-axis-projection` pure helpers tests.
 *
 * Coverage:
 *   - `projectPointOnWallAxis` (clamped, NEAREST semantics):
 *       straight wall   — cursor within segment / before start / after end
 *       polyline wall   — cursor over closest segment
 *       curved wall     — cursor near Bezier mid (cached subdivision)
 *       null cases      — wall χωρίς cached geometry
 *   - `getWallAxisPerpendicularFeet` (unclamped per-segment, PERPENDICULAR):
 *       straight wall   — foot εντός snap radius / εκτός
 *       polyline wall   — multiple feet per segment
 *       curved wall     — N feet ανά tessellated segment
 *       radius filter   — εκτός radius → κενή λίστα
 */

import {
  projectPointOnWallAxis,
  getWallAxisPerpendicularFeet,
} from '../wall-axis-projection';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import type { WallEntity, WallParams } from '../../types/wall-types';

function unwrap(entity: ReturnType<typeof buildWallEntity>): WallEntity {
  if (!entity.ok) throw new Error('expected ok wall entity: ' + entity.hardErrors.join(','));
  return entity.entity;
}

describe('wall-axis-projection (Phase 5.5e)', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 1000, y: 0 };

  function makeStraight(): WallEntity {
    const params = buildDefaultWallParams(start, end);
    return unwrap(buildWallEntity(params, '0', 'straight'));
  }

  function makeCurved(): WallEntity {
    const params: WallParams = {
      ...buildDefaultWallParams(start, end),
      curveControl: { x: 500, y: 400, z: 0 },
    };
    return unwrap(buildWallEntity(params, '0', 'curved'));
  }

  function makePolyline(): WallEntity {
    const params: WallParams = {
      ...buildDefaultWallParams(start, { x: 2000, y: 0 }),
      polylineVertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
        { x: 1500, y: 500, z: 0 },
        { x: 2000, y: 0, z: 0 },
      ],
    };
    return unwrap(buildWallEntity(params, '0', 'polyline'));
  }

  // ─── projectPointOnWallAxis (clamped) ────────────────────────────────────

  it('1. straight wall — cursor above axis → foot εντός segment', () => {
    const wall = makeStraight();
    const foot = projectPointOnWallAxis(wall, { x: 500, y: 100 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(500, 6);
    expect(foot!.y).toBeCloseTo(0, 6);
  });

  it('2. straight wall — cursor πριν start → clamped στο start', () => {
    const wall = makeStraight();
    const foot = projectPointOnWallAxis(wall, { x: -200, y: 50 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(0, 6);
    expect(foot!.y).toBeCloseTo(0, 6);
  });

  it('3. straight wall — cursor μετά end → clamped στο end', () => {
    const wall = makeStraight();
    const foot = projectPointOnWallAxis(wall, { x: 1500, y: 50 });
    expect(foot).not.toBeNull();
    expect(foot!.x).toBeCloseTo(1000, 6);
    expect(foot!.y).toBeCloseTo(0, 6);
  });

  it('4. polyline wall — cursor κοντά στο δεύτερο segment', () => {
    const wall = makePolyline();
    // Segment 2 = (1000,0) → (1500,500). Midpoint ≈ (1250, 250).
    const foot = projectPointOnWallAxis(wall, { x: 1250, y: 300 });
    expect(foot).not.toBeNull();
    // Foot ~mid του segment, ~επί ευθείας y=x-1000 → x≈1275, y≈275
    expect(foot!.x).toBeGreaterThan(1200);
    expect(foot!.x).toBeLessThan(1350);
    expect(foot!.y).toBeGreaterThan(200);
    expect(foot!.y).toBeLessThan(350);
  });

  it('5. curved wall — cursor πάνω από mid → foot σε tessellated segment', () => {
    const wall = makeCurved();
    // Bezier control (500, 400) → cursor (500, 250) είναι κοντά στο curve mid.
    const foot = projectPointOnWallAxis(wall, { x: 500, y: 250 });
    expect(foot).not.toBeNull();
    // Bezier mid t=0.5 για quadratic με control (500,400): y_mid = 0.25*0 + 0.5*400 + 0.25*0 = 200
    expect(foot!.x).toBeCloseTo(500, 0);
    expect(foot!.y).toBeCloseTo(200, 0);
  });

  it('6. wall χωρίς cached geometry → null', () => {
    const wall = makeStraight();
    // Override geometry σε undefined-like για να πιστοποιήσει defensive guard.
    const stripped = { ...wall, geometry: undefined as unknown as WallEntity['geometry'] };
    const foot = projectPointOnWallAxis(stripped as WallEntity, { x: 500, y: 100 });
    expect(foot).toBeNull();
  });

  // ─── getWallAxisPerpendicularFeet (unclamped) ────────────────────────────

  it('7. straight wall — foot εντός snap radius', () => {
    const wall = makeStraight();
    const feet = getWallAxisPerpendicularFeet(wall, { x: 500, y: 50 }, 100);
    expect(feet).toHaveLength(1);
    expect(feet[0].point.x).toBeCloseTo(500, 6);
    expect(feet[0].point.y).toBeCloseTo(0, 6);
    expect(feet[0].segmentIndex).toBe(0);
  });

  it('8. straight wall — cursor μετά end → unclamped foot σε προέκταση εντός radius', () => {
    const wall = makeStraight();
    // Cursor (1500, 50) → unclamped foot (1500, 0) — απόσταση 50 < radius 100.
    const feet = getWallAxisPerpendicularFeet(wall, { x: 1500, y: 50 }, 100);
    expect(feet).toHaveLength(1);
    expect(feet[0].point.x).toBeCloseTo(1500, 6);
    expect(feet[0].point.y).toBeCloseTo(0, 6);
  });

  it('9. straight wall — foot εκτός radius → κενή λίστα', () => {
    const wall = makeStraight();
    // Cursor 500 mm μακριά από axis, radius=100 → εκτός.
    const feet = getWallAxisPerpendicularFeet(wall, { x: 500, y: 500 }, 100);
    expect(feet).toHaveLength(0);
  });

  it('10. polyline wall — multiple feet (1 ανά segment εντός radius)', () => {
    const wall = makePolyline();
    // Cursor (1000, 50): segment 1 (0→1000,0) foot=(1000,0) d=50;
    // segment 2 (1000,0)→(1500,500) extension foot σε y=x-1000 line.
    const feet = getWallAxisPerpendicularFeet(wall, { x: 1000, y: 50 }, 200);
    expect(feet.length).toBeGreaterThanOrEqual(1);
    // Όλα entries έχουν unique segmentIndex.
    const indices = feet.map((f) => f.segmentIndex);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('11. curved wall — N feet (1 ανά tessellated segment εντός radius)', () => {
    const wall = makeCurved();
    const feet = getWallAxisPerpendicularFeet(wall, { x: 500, y: 250 }, 1000);
    // Bezier tessellated σε CURVED_SUBDIVISIONS=16 segments → up to 16 feet.
    expect(feet.length).toBeGreaterThan(0);
    expect(feet.length).toBeLessThanOrEqual(16);
  });

  it('12. wall χωρίς cached geometry → κενή λίστα', () => {
    const wall = makeStraight();
    const stripped = { ...wall, geometry: undefined as unknown as WallEntity['geometry'] };
    const feet = getWallAxisPerpendicularFeet(stripped as WallEntity, { x: 500, y: 50 }, 100);
    expect(feet).toHaveLength(0);
  });
});
