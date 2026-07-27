/**
 * ADR-650 §M10e — the three pure primitives the matcher is built from.
 *
 * Tested apart from the orchestrator because each encodes a decision that is easy to break
 * silently: which drawing features count as surveyed points, where a coordinate frame ends,
 * and which segments make a usable basis.
 */

import {
  collectCandidatePoints, dominantLayerName, selectBasisSample, strideSample,
} from '../geo-ref-candidate-points';
import { splitByCoordinateFrame } from '../geo-point-clusters';
import {
  buildPairTable, forEachPairNear, selectLongestBases, toFlatCoords, MAX_PAIR_TABLE_POINTS,
} from '../geo-pair-table';
import {
  applyAcceptanceGates, matchableTotal, requiredInliers, suggestUnitScale, isUnitMismatch,
} from '../geo-match-gates';
import type { Entity } from '../../../types/entities';
import { LAYERS, LAYER_ID, LAYER_NAME } from './geo-match-fixtures';

describe('collectCandidatePoints', () => {
  const at = (x: number, y: number): { x: number; y: number } => ({ x, y });

  it('takes POINT positions, INSERT insertion points, circle CENTRES and raw polyline vertices', () => {
    const entities: Entity[] = [
      { id: 'p1', type: 'point', layerId: LAYER_ID, position: at(10, 20) },
      { id: 'b1', type: 'block', layerId: LAYER_ID, name: 'TREE', position: at(30, 40), scale: at(1, 1), rotation: 0, entities: [] },
      { id: 'c1', type: 'circle', layerId: LAYER_ID, center: at(50, 60), radius: 900 },
      { id: 'l1', type: 'lwpolyline', layerId: LAYER_ID, vertices: [at(0, 0), at(100, 0), at(100, 100)] },
    ];

    const points = collectCandidatePoints(entities);

    expect(points.map((p) => p.kind)).toEqual(['node', 'insert', 'centre', 'vertex', 'vertex', 'vertex']);
    // The circle contributed ONE point (its centre) — never a tessellated outline.
    expect(points.filter((p) => p.kind === 'centre')).toEqual([{ x: 50, y: 60, layerId: LAYER_ID, kind: 'centre' }]);
  });

  it('contributes nothing for entities with no surveyed-node meaning', () => {
    const entities: Entity[] = [
      { id: 't1', type: 'text', layerId: LAYER_ID, position: at(1, 1), text: 'ΟΙΚΟΠΕΔΟ' },
    ];
    expect(collectCandidatePoints(entities)).toEqual([]);
  });

  it('drops non-finite coordinates instead of poisoning every distance downstream', () => {
    const entities: Entity[] = [
      { id: 'p1', type: 'point', layerId: LAYER_ID, position: at(Number.NaN, 5) },
      { id: 'p2', type: 'point', layerId: LAYER_ID, position: at(5, 5) },
    ];
    expect(collectCandidatePoints(entities)).toHaveLength(1);
  });

  it('keeps every node when capping, and sheds vertices first', () => {
    const nodes: Entity[] = Array.from({ length: 30 }, (_, i) => (
      { id: `p${i}`, type: 'point', layerId: LAYER_ID, position: at(i, i) }
    ));
    const verts: Entity[] = [{
      id: 'poly', type: 'lwpolyline', layerId: LAYER_ID,
      vertices: Array.from({ length: 500 }, (_, i) => at(i, 0)),
    }];

    const capped = collectCandidatePoints([...verts, ...nodes], { maxPoints: 50 });

    expect(capped).toHaveLength(50);
    expect(capped.filter((p) => p.kind === 'node')).toHaveLength(30); // all of them survived
  });

  it('honours includeVertices: false', () => {
    const entities: Entity[] = [
      { id: 'l1', type: 'line', layerId: LAYER_ID, start: at(0, 0), end: at(9, 9) },
      { id: 'p1', type: 'point', layerId: LAYER_ID, position: at(1, 1) },
    ];
    expect(collectCandidatePoints(entities, { includeVertices: false })).toHaveLength(1);
  });
});

describe('strideSample', () => {
  it('spans the whole input rather than truncating its head', () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const kept = strideSample(input, 10);
    expect(kept).toHaveLength(10);
    expect(kept[0]).toBe(0);
    expect(kept[9]).toBeGreaterThan(80); // reaches the far end
  });

  it('returns a copy untouched when it already fits', () => {
    expect(strideSample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('is deterministic — the same input always yields the same sample', () => {
    const input = Array.from({ length: 77 }, (_, i) => i);
    expect(strideSample(input, 13)).toEqual(strideSample(input, 13));
  });
});

describe('splitByCoordinateFrame', () => {
  const pt = (x: number, y: number) => ({ x, y, layerId: LAYER_ID, kind: 'node' as const });

  it('separates an ΕΓΣΑ frame from a local inset 40 km away', () => {
    const egsa = Array.from({ length: 20 }, (_, i) => pt(400_000_000 + i * 5_000, 4_500_000_000 + i * 3_000));
    const inset = Array.from({ length: 8 }, (_, i) => pt(i * 4_000, i * 4_000));

    const frames = splitByCoordinateFrame([...egsa, ...inset]);

    expect(frames).toHaveLength(2);
    expect(frames[0]!.points).toHaveLength(20); // largest first
    expect(frames[1]!.points).toHaveLength(8);
  });

  it('does NOT cut a continuous survey, however irregular its spacing', () => {
    const spread = [0, 3_000, 9_000, 12_000, 40_000, 41_000, 90_000, 150_000].map((x) => pt(x, 0));
    expect(splitByCoordinateFrame(spread)).toHaveLength(1);
  });

  it('drops frames too small to evidence a rotation', () => {
    const main = Array.from({ length: 10 }, (_, i) => pt(i * 1_000, 0));
    const stray = [pt(99_000_000, 0), pt(99_000_100, 0)];
    const frames = splitByCoordinateFrame([...main, ...stray]);
    expect(frames).toHaveLength(1);
    expect(frames[0]!.points).toHaveLength(10);
  });

  it('returns nothing for an empty input', () => {
    expect(splitByCoordinateFrame([])).toEqual([]);
  });
});

describe('geo-pair-table', () => {
  const square = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }, { x: 0, y: 400 }];

  it('holds every pair exactly once, with the right distances', () => {
    const table = buildPairTable(square);
    expect(table.count).toBe(6);
    expect([...table.distance].sort((a, b) => a - b)).toEqual([300, 300, 400, 400, 500, 500]);
  });

  it('finds the pairs inside a tolerance band and nothing else', () => {
    const found: number[] = [];
    forEachPairNear(toFlatCoords(square), 500, 1, (_a, _b, d) => found.push(d));
    expect(found).toEqual([500, 500]); // the two diagonals
  });

  it('streams the SAME pairs a materialised table would have, in the same order', () => {
    // The drawing side stopped being materialised in v23. That is only safe if the stream is
    // order-for-order identical: the hypothesis sequence is what decides ties in the search.
    const lattice: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) lattice.push({ x: i * 400, y: j * 400 });

    const table = buildPairTable(lattice);
    const fromTable: Array<[number, number]> = [];
    for (let k = 0; k < table.count; k++) {
      const d = table.distance[k]!;
      if (d >= 399 && d <= 401) fromTable.push([table.indexA[k]!, table.indexB[k]!]);
    }

    const streamed: Array<[number, number]> = [];
    forEachPairNear(toFlatCoords(lattice), 400, 1, (a, b) => streamed.push([a, b]));

    // 2 × (4 steps × 5 rows) adjacent pairs on a 5×5 lattice.
    expect(fromTable).toHaveLength(40);
    expect(streamed).toEqual(fromTable);
  });

  it('admits short pairs when the band is wider than the target length', () => {
    // (L−τ)² with τ > L squares back into a POSITIVE floor — here 250 mm. Squaring an
    // unclamped lower bound would silently reject exactly the short pairs the wide band admits.
    const withShortPairs = [...square, { x: 100, y: 0 }];
    const found: number[] = [];
    forEachPairNear(toFlatCoords(withShortPairs), 100, 350, (_a, _b, d) => found.push(d));

    expect(found).toContain(100); // 0→4 — dropped by an unclamped floor
    expect(found).toContain(200); // 1→4 — likewise
    expect(found).not.toContain(500); // the diagonals are genuinely outside the band
  });

  it('picks the longest, endpoint-disjoint bases', () => {
    const bases = selectLongestBases(buildPairTable(square), 2);
    expect(bases).toHaveLength(2);
    expect(bases.every((b) => b.lengthMm === 500)).toBe(true);
    // Endpoint-disjoint: the two diagonals share no corner.
    expect(new Set(bases.flatMap((b) => [b.a, b.b])).size).toBe(4);
  });

  it('refuses to build a table that would exhaust memory, loudly', () => {
    const many = Array.from({ length: MAX_PAIR_TABLE_POINTS + 1 }, (_, i) => ({ x: i, y: 0 }));
    expect(() => buildPairTable(many)).toThrow(/exceeds/);
  });

  it('never offers a zero-length basis — it carries no direction', () => {
    const coincident = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    expect(selectLongestBases(buildPairTable(coincident), 3)).toEqual([]);
  });
});

describe('geo-match-gates', () => {
  it('judges the inlier count against the ACHIEVABLE maximum, not the drawing size', () => {
    // 1 500 drawing points, 93 survey points: the one-to-one rule caps inliers at 93.
    expect(matchableTotal(1_500, 93)).toBe(93);
    expect(requiredInliers(93)).toBe(28);
    // Against the drawing's own total the requirement would be 450 — unreachable by anything.
    expect(requiredInliers(93)).toBeLessThan(93);
  });

  it('refuses too few inliers, a loose fit, and an ambiguous winner — each by name', () => {
    const base = { matchable: 93, rmsMm: 5, secondBestInliers: 0 };
    expect(applyAcceptanceGates({ ...base, inliers: 90 }).accepted).toBe(true);
    expect(applyAcceptanceGates({ ...base, inliers: 20 }).reason).toBe('too-few-inliers');
    expect(applyAcceptanceGates({ ...base, inliers: 90, rmsMm: 51 }).reason).toBe('residual-too-large');
    expect(applyAcceptanceGates({ ...base, inliers: 90, secondBestInliers: 70 }).reason).toBe('ambiguous');
  });

  it('keeps the absolute floor of 8 inliers however small the survey', () => {
    expect(requiredInliers(4)).toBe(8);
    expect(applyAcceptanceGates({ inliers: 4, matchable: 4, rmsMm: 0, secondBestInliers: 0 }).accepted).toBe(false);
  });

  it('names the unit ratio behind a scale mismatch, and both directions of it', () => {
    expect(isUnitMismatch(1.0005)).toBe(false); // ordinary fit noise
    expect(isUnitMismatch(1000)).toBe(true);
    expect(suggestUnitScale(1000.4)).toBe(1000);
    expect(suggestUnitScale(0.001)).toBeCloseTo(0.001, 9);
    expect(suggestUnitScale(304.8)).toBe(304.8);
    expect(suggestUnitScale(7.77)).toBeNull(); // a mismatch, but not a known unit — say so
  });
});

describe('dominantLayerName + selectBasisSample', () => {
  const pt = (layerId: string) => ({ x: 0, y: 0, layerId, kind: 'node' as const });

  it('names the layer that contributed most of the frame', () => {
    const points = [pt(LAYER_ID), pt(LAYER_ID), pt('lyr_other')];
    expect(dominantLayerName(points, LAYERS)).toBe(LAYER_NAME);
  });

  it('returns null rather than guessing when there is nothing to name', () => {
    expect(dominantLayerName([], LAYERS)).toBeNull();
    expect(dominantLayerName([pt('lyr_missing')], LAYERS)).toBeNull();
  });

  it('returns the set unchanged when it is already under the cap', () => {
    const points = [pt(LAYER_ID), pt(LAYER_ID)];
    expect(selectBasisSample(points, 10)).toBe(points);
  });
});
