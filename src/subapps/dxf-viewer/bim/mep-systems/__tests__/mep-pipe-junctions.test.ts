/**
 * ADR-408 Φ11 — derivePipeJunctions tests (endpoint coincidence → fitting nodes).
 *
 * Covers: junction extraction (1/2/3/4 incidents), tolerance grouping, the
 * directionUnit pointing away from the node, and junctionKey stability (quantized,
 * jitter-invariant, deterministic across input order).
 */

import type { Entity } from '../../../types/entities';
import { derivePipeJunctions } from '../mep-pipe-junctions';
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
    expect(shared!.incidents.map((i) => i.segmentId)).toEqual(['p1', 'p2']);
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
    expect(tee!.incidents.map((i) => i.segmentId)).toEqual(['p1', 'p2', 'p3']);
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
      expect(forward.map((j) => j.incidents.map((i) => i.segmentId))).toEqual(
        reversed.map((j) => j.incidents.map((i) => i.segmentId)),
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
});
