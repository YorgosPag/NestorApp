/**
 * ADR-408 Φ11 — derivePipeJunctions tests (endpoint coincidence → fitting nodes).
 *
 * Covers: junction extraction (1/2/3/4 incidents), tolerance grouping, the
 * directionUnit pointing away from the node, and junctionKey stability (quantized,
 * jitter-invariant, deterministic across input order).
 */

import type { Entity } from '../../../types/entities';
import { derivePipeJunctions } from '../mep-pipe-junctions';
import { classifyJunction } from '../../mep-fittings/mep-fitting-classify';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../../types/mep-connector-types';

/** Build a minimal pipe MepSegmentEntity fixture (round, default Ø). */
const seg = (
  id: string,
  start: [number, number],
  end: [number, number],
  opts: { domain?: 'duct' | 'pipe'; diameter?: number; elevation?: number } = {},
): Entity =>
  ({
    id,
    type: 'mep-segment',
    params: {
      domain: opts.domain ?? 'pipe',
      sectionKind: 'round',
      startPoint: { x: start[0], y: start[1], z: 0 },
      endPoint: { x: end[0], y: end[1], z: 0 },
      diameter: opts.diameter ?? 50,
      centerlineElevationMm: opts.elevation ?? 0,
    },
  } as unknown as Entity);

describe('derivePipeJunctions', () => {
  it('returns [] when there are no pipe segments', () => {
    expect(derivePipeJunctions([])).toEqual([]);
    expect(derivePipeJunctions([seg('d1', [0, 0], [10, 0], { domain: 'duct' })])).toEqual([]);
  });

  it('emits a lone segment as TWO 1-incident junctions (its two free ends)', () => {
    const junctions = derivePipeJunctions([seg('p1', [0, 0], [100, 0])]);
    expect(junctions).toHaveLength(2);
    expect(junctions.every((j) => j.incidents.length === 1)).toBe(true);
  });

  it('merges two end-to-end segments into a single 2-incident junction at the shared node', () => {
    const junctions = derivePipeJunctions([
      seg('p1', [0, 0], [100, 0]),
      seg('p2', [100, 0], [200, 0]),
    ]);
    // 4 endpoints → 2 free ends + 1 shared node = 3 junctions.
    expect(junctions).toHaveLength(3);
    const shared = junctions.find((j) => j.incidents.length === 2);
    expect(shared).toBeDefined();
    expect(shared!.position).toEqual({ x: 100, y: 0, z: 0 });
    // The two incidents are sorted (p1 end, then p2 start).
    expect(shared!.incidents.map((i) => i.entityId)).toEqual(['p1', 'p2']);
    expect(shared!.incidents[0]!.connectorId).toBe(SEGMENT_END_CONNECTOR_ID);
    expect(shared!.incidents[1]!.connectorId).toBe(SEGMENT_START_CONNECTOR_ID);
  });

  it('extracts a 3-incident node from a T-junction', () => {
    const junctions = derivePipeJunctions([
      seg('p1', [0, 0], [100, 0]),
      seg('p2', [100, 0], [200, 0]),
      seg('p3', [100, 0], [100, 100]),
    ]);
    const tee = junctions.find((j) => j.incidents.length === 3);
    expect(tee).toBeDefined();
    expect(tee!.incidents.map((i) => i.entityId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('extracts a 4-incident node from a cross junction', () => {
    const junctions = derivePipeJunctions([
      seg('p1', [0, 0], [100, 0]),
      seg('p2', [100, 0], [200, 0]),
      seg('p3', [100, -100], [100, 0]),
      seg('p4', [100, 0], [100, 100]),
    ]);
    const cross = junctions.find((j) => j.incidents.length === 4);
    expect(cross).toBeDefined();
    expect(cross!.incidents).toHaveLength(4);
  });

  describe('tolerance grouping', () => {
    it('merges endpoints within the tolerance', () => {
      const junctions = derivePipeJunctions(
        [seg('p1', [0, 0], [100, 0]), seg('p2', [100.5, 0], [200, 0])],
        1,
      );
      expect(junctions.some((j) => j.incidents.length === 2)).toBe(true);
    });

    it('keeps endpoints farther apart than the tolerance separate', () => {
      const junctions = derivePipeJunctions(
        [seg('p1', [0, 0], [100, 0]), seg('p2', [105, 0], [200, 0])],
        1,
      );
      expect(junctions.every((j) => j.incidents.length === 1)).toBe(true);
    });

    it('averages the coincident endpoint positions for the node centre', () => {
      const junctions = derivePipeJunctions(
        [seg('p1', [0, 0], [100, 0]), seg('p2', [100.4, 0], [200, 0])],
        1,
      );
      const shared = junctions.find((j) => j.incidents.length === 2);
      expect(shared!.position.x).toBeCloseTo(100.2, 5);
    });
  });

  describe('directionUnit', () => {
    it('points AWAY from the node toward the segment far end', () => {
      const junctions = derivePipeJunctions([seg('p1', [0, 0], [100, 0])]);
      const startNode = junctions.find(
        (j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID,
      )!;
      const endNode = junctions.find(
        (j) => j.incidents[0]!.connectorId === SEGMENT_END_CONNECTOR_ID,
      )!;
      // From the start node, the rest of the pipe is in +x; from the end node, in -x.
      expect(startNode.incidents[0]!.directionUnit).toEqual({ x: 1, y: 0, z: 0 });
      expect(endNode.incidents[0]!.directionUnit).toEqual({ x: -1, y: 0, z: 0 });
    });

    it('is a unit vector for a diagonal run', () => {
      const junctions = derivePipeJunctions([seg('p1', [0, 0], [30, 40])]);
      const startNode = junctions.find(
        (j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID,
      )!;
      const d = startNode.incidents[0]!.directionUnit;
      expect(d.x).toBeCloseTo(0.6, 5);
      expect(d.y).toBeCloseTo(0.8, 5);
      expect(Math.hypot(d.x, d.y)).toBeCloseTo(1, 5);
    });

    it('keeps z = 0 for a horizontal run (back-compat)', () => {
      const junctions = derivePipeJunctions([seg('p1', [0, 0], [100, 0])]);
      const startNode = junctions.find(
        (j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID,
      )!;
      expect(startNode.incidents[0]!.directionUnit.z).toBeCloseTo(0, 5);
    });

    it('carries the vertical slope (Φ-B2b) for a riser, as a 3D unit vector', () => {
      // Riser: start at floor (z=0) → end at ceiling (z=2800), 100mm plan run.
      const riser = {
        id: 'r1',
        type: 'mep-segment',
        params: {
          domain: 'pipe',
          sectionKind: 'round',
          startPoint: { x: 0, y: 0, z: 0 },
          endPoint: { x: 100, y: 0, z: 2800 },
          diameter: 50,
          centerlineElevationMm: 1400,
        },
      } as unknown as Entity;
      const startNode = derivePipeJunctions([riser]).find(
        (j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID,
      )!;
      const d = startNode.incidents[0]!.directionUnit;
      expect(d.z).toBeGreaterThan(0.9); // mostly vertical (2800 rise vs 100 plan)
      expect(Math.hypot(d.x, d.y, d.z ?? 0)).toBeCloseTo(1, 5); // still a unit vector
    });
  });

  describe('junctionKey stability', () => {
    it('quantizes the node position to the tolerance grid', () => {
      const junctions = derivePipeJunctions([seg('p1', [37, 0], [137, 0])], 1);
      const startNode = junctions.find(
        (j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID,
      )!;
      expect(startNode.key).toBe('37:0');
    });

    it('is invariant to sub-tolerance jitter (same key for jittered node)', () => {
      const a = derivePipeJunctions([seg('p1', [100, 0], [200, 0])], 1);
      const b = derivePipeJunctions([seg('p1', [100.3, -0.2], [200, 0])], 1);
      const keyA = a.find((j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID)!.key;
      const keyB = b.find((j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID)!.key;
      expect(keyA).toBe(keyB);
    });

    it('is deterministic regardless of input segment order', () => {
      const forward = derivePipeJunctions([
        seg('pA', [0, 0], [100, 0]),
        seg('pB', [100, 0], [200, 0]),
      ]);
      const reversed = derivePipeJunctions([
        seg('pB', [100, 0], [200, 0]),
        seg('pA', [0, 0], [100, 0]),
      ]);
      expect(forward.map((j) => j.key)).toEqual(reversed.map((j) => j.key));
      expect(forward.map((j) => j.incidents.map((i) => i.entityId))).toEqual(
        reversed.map((j) => j.incidents.map((i) => i.entityId)),
      );
    });

    it('returns junctions sorted by key', () => {
      const junctions = derivePipeJunctions([
        seg('p1', [0, 0], [100, 0]),
        seg('p2', [100, 0], [200, 0]),
      ]);
      const keys = junctions.map((j) => j.key);
      expect([...keys].sort((x, y) => x.localeCompare(y))).toEqual(keys);
    });
  });

  // ── ADR-408 Φ-A: junction elevation from per-endpoint z (sloped runs) ──────
  describe('per-endpoint elevation', () => {
    /** A riser: start at floor (z=0), end at ceiling (z=2800). */
    const riser = (id: string, start: [number, number], end: [number, number]): Entity =>
      ({
        id,
        type: 'mep-segment',
        params: {
          domain: 'pipe',
          sectionKind: 'round',
          startPoint: { x: start[0], y: start[1], z: 0 },
          endPoint: { x: end[0], y: end[1], z: 2800 },
          diameter: 50,
          centerlineElevationMm: 1400,
        },
      } as unknown as Entity);

    it('a junction carries the incident endpoint own elevation, not the centreline', () => {
      // riser end (z=2800) meets a horizontal pipe end at the same plan node.
      const junctions = derivePipeJunctions([
        riser('r1', [0, 0], [100, 0]),
        seg('p2', [100, 0], [200, 0], { elevation: 2800 }),
      ]);
      const shared = junctions.find((j) => j.incidents.length === 2)!;
      // r1 end z=2800, p2 start (horizontal, centreline 2800 ⇒ both ends 2800).
      expect(shared.centerlineElevationMm).toBeCloseTo(2800, 5);
    });
  });

  // ── ADR-408 Φ11 hotfix: unit-aware join tolerance ─────────────────────────
  // A raw 1-unit tolerance is 1 METRE in a metre scene — it merged a short pipe's
  // own two ends into one (cross) junction and collapsed distinct nodes onto a
  // single 1m-cell junctionKey. The unit-aware default (25mm) scales per scene.
  describe('unit-aware join tolerance (metre scene)', () => {
    /** A short pipe in a `sceneUnits: 'm'` scene (≤1m — under the old 1m tol). */
    const mSeg = (id: string, start: [number, number], end: [number, number]): Entity =>
      ({
        id,
        type: 'mep-segment',
        params: {
          domain: 'pipe',
          sectionKind: 'round',
          startPoint: { x: start[0], y: start[1], z: 0 },
          endPoint: { x: end[0], y: end[1], z: 0 },
          diameter: 50,
          centerlineElevationMm: 0,
          sceneUnits: 'm',
        },
      } as unknown as Entity);

    it("does NOT merge a short metre-scene pipe's own two ends", () => {
      // 0.5m run: a raw 1m tol would collapse both ends into one self-junction.
      const junctions = derivePipeJunctions([mSeg('p1', [0, 0], [0.5, 0])]);
      expect(junctions).toHaveLength(2);
      expect(junctions.every((j) => j.incidents.length === 1)).toBe(true);
    });

    it('two short angled pipes → a 2-incident node (elbow), NOT a 4-incident cross', () => {
      const junctions = derivePipeJunctions([
        mSeg('p1', [0, 0], [0.5, 0]),
        mSeg('p2', [0.5, 0], [0.5, 0.5]),
      ]);
      expect(junctions.some((j) => j.incidents.length === 2)).toBe(true);
      expect(junctions.some((j) => j.incidents.length >= 4)).toBe(false);
    });

    it('gives nodes 0.5m apart distinct keys (no 1m-cell collision)', () => {
      const junctions = derivePipeJunctions([
        mSeg('p1', [0, 0], [0.5, 0]),
        mSeg('p2', [0.5, 0], [1.0, 0]),
      ]);
      const keys = junctions.map((j) => j.key);
      expect(new Set(keys).size).toBe(keys.length); // all unique
    });
  });

  // ── ADR-408 Φ-B2b EXT: 3D (xyz) endpoint matching + z-aware junctionKey ──────
  // Endpoints coincide only when they meet in xyz, not just in plan. Two pipes that
  // cross in plan at DIFFERENT heights (one passes over the other, NOT connected)
  // must stay separate nodes — no false elbow/cross + no spurious fitting.
  describe('xyz-matching (3D junction)', () => {
    it('does NOT merge two pipe ends at the same (x,y) but different elevation', () => {
      // Both ends land on plan node (100,0): p1 at elevation 0, p2 at 1000mm.
      // Δz = 1000mm ≫ 25mm tolerance → distinct nodes (a fly-over, not a join).
      const junctions = derivePipeJunctions([
        seg('p1', [0, 0], [100, 0], { elevation: 0 }),
        seg('p2', [100, 0], [200, 0], { elevation: 1000 }),
      ]);
      // 4 endpoints, NONE coincident in 3D → 4 separate 1-incident junctions.
      expect(junctions).toHaveLength(4);
      expect(junctions.every((j) => j.incidents.length === 1)).toBe(true);
    });

    it('MERGES two pipe ends that coincide in BOTH plan and elevation', () => {
      const junctions = derivePipeJunctions([
        seg('p1', [0, 0], [100, 0], { elevation: 1000 }),
        seg('p2', [100, 0], [200, 0], { elevation: 1000 }),
      ]);
      const shared = junctions.find((j) => j.incidents.length === 2);
      expect(shared).toBeDefined();
      expect(shared!.incidents.map((i) => i.entityId)).toEqual(['p1', 'p2']);
    });

    it('gives the two crossing-at-different-z nodes DISTINCT junctionKeys', () => {
      const junctions = derivePipeJunctions([
        seg('p1', [0, 0], [100, 0], { elevation: 0 }),
        seg('p2', [100, 0], [200, 0], { elevation: 1000 }),
      ]);
      // The two ends that share plan node (100,0) but differ in z.
      const atNode = junctions.filter(
        (j) => Math.abs(j.position.x - 100) < 1 && Math.abs(j.position.y) < 1,
      );
      expect(atNode).toHaveLength(2);
      expect(new Set(atNode.map((j) => j.key)).size).toBe(2); // distinct keys
    });

    it('back-compat: a horizontal node at z=0 keeps the legacy key (no z-suffix)', () => {
      const junctions = derivePipeJunctions([seg('p1', [37, 0], [137, 0])], 1);
      const startNode = junctions.find(
        (j) => j.incidents[0]!.connectorId === SEGMENT_START_CONNECTOR_ID,
      )!;
      expect(startNode.key).toBe('37:0'); // unchanged — no `:qz` appended at z=0
    });

    it('appends a z-cell to the key for an elevated node', () => {
      const junctions = derivePipeJunctions(
        [seg('p1', [0, 0], [100, 0], { elevation: 1000 })],
        1,
      );
      // z=1000mm, grid=1 unit (mm scene) → qz=1000 → key carries the z cell.
      expect(junctions.every((j) => j.key.split(':').length === 3)).toBe(true);
    });
  });

  // ── ADR-408 Φ-B2b EXT #2: point-host connectors → no spurious cap ────────────
  // A pipe end landing on a manifold outlet joins the outlet's connector as a HOST
  // incident, so the node classifies to null (the equipment is the fitting) instead
  // of a dead-end cap.
  describe('point-host connector incidents (no spurious cap)', () => {
    /** A plumbing manifold with one pipe outlet connector at its origin. */
    const manifold = (
      id: string,
      at: [number, number],
      opts: { mountingElevationMm?: number; diameterMm?: number } = {},
    ): Entity =>
      ({
        id,
        type: 'mep-manifold',
        params: {
          position: { x: at[0], y: at[1], z: 0 },
          rotation: 0,
          mountingElevationMm: opts.mountingElevationMm ?? 0,
          connectors: [
            {
              connectorId: 'm-out-0',
              domain: 'pipe',
              flow: 'out',
              localPosition: { x: 0, y: 0, z: 0 },
              pipe: { systemClassification: 'domestic-cold-water', diameterMm: opts.diameterMm ?? 50 },
            },
          ],
        },
      } as unknown as Entity);

    it('a pipe end on a manifold outlet forms a 2-incident node carrying the host', () => {
      const junctions = derivePipeJunctions([
        seg('p1', [0, 0], [100, 0]),
        manifold('mfld-1', [100, 0]),
      ]);
      const node = junctions.find((j) => j.incidents.some((i) => i.host));
      expect(node).toBeDefined();
      expect(node!.incidents).toHaveLength(2);
      expect(node!.incidents.some((i) => i.entityId === 'p1' && !i.host)).toBe(true);
      expect(node!.incidents.some((i) => i.entityId === 'mfld-1' && i.host)).toBe(true);
    });

    it('classifies the manifold node as null (no cap) but the free pipe end as a cap', () => {
      const junctions = derivePipeJunctions([
        seg('p1', [0, 0], [100, 0]),
        manifold('mfld-1', [100, 0]),
      ]);
      const hostNode = junctions.find((j) => j.incidents.some((i) => i.host))!;
      const freeEnd = junctions.find(
        (j) => j.incidents.length === 1 && !j.incidents[0]!.host,
      )!;
      expect(classifyJunction(hostNode).kind).toBeNull();
      expect(classifyJunction(freeEnd).kind).toBe('cap');
    });

    it('does NOT merge a manifold outlet sitting at a different elevation than the pipe end', () => {
      // Outlet 1000mm above the (z=0) pipe end → Δz ≫ 25mm → separate nodes, so the
      // pipe end stays a real cap (it does not actually meet the manifold in 3D).
      const junctions = derivePipeJunctions([
        seg('p1', [0, 0], [100, 0], { elevation: 0 }),
        manifold('mfld-1', [100, 0], { mountingElevationMm: 1000 }),
      ]);
      const node = junctions.find(
        (j) => Math.abs(j.position.x - 100) < 1 && Math.abs(j.position.y) < 1 && !j.incidents.some((i) => i.host),
      )!;
      expect(node.incidents).toHaveLength(1);
      expect(classifyJunction(node).kind).toBe('cap');
    });

    it('ignores a manifold when there are no pipe segments at all', () => {
      expect(derivePipeJunctions([manifold('mfld-1', [100, 0])])).toEqual([]);
    });
  });
});
