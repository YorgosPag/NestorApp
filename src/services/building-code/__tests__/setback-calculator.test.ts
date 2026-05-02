/**
 * @related ADR-186 Building Code Module — Modular ΝΟΚ
 *
 * Tests for per-edge setback engine — edge classification, polygon inset, setback result.
 */
import {
  computeCentroid,
  classifyEdges,
  computeEdgeSetbacks,
  insetPolygon,
  computeMinEdgeLength,
  computeSetbackResult,
} from '@/services/building-code/engines/setback-calculator';
import { shoelaceArea } from '@/services/building-code/utils/geometry';
import type { EdgeRole } from '@/services/building-code/types/setback.types';

// ─── Test fixtures ───────────────────────────────────────────────────────────

/** 20×30 rectangle: frontage on south (edge 0), CCW winding. */
const RECT_20x30: readonly [number, number][] = [
  [0, 0], [20, 0], [20, 30], [0, 30],
];

/** 15×15 square for corner plot tests. */
const SQUARE_15: readonly [number, number][] = [
  [0, 0], [15, 0], [15, 15], [0, 15],
];

const FRONTAGE_DEFAULT = { prassia_m: 0 };
const FRONTAGE_WITH_PRASSIA = { prassia_m: 4.0 };

// ─── computeCentroid ──────────────────────────────────────────────────────────

describe('computeCentroid', () => {
  it('returns center of rectangle', () => {
    const [cx, cz] = computeCentroid(RECT_20x30);
    expect(cx).toBeCloseTo(10, 5);
    expect(cz).toBeCloseTo(15, 5);
  });

  it('returns center of triangle', () => {
    const tri: [number, number][] = [[0, 0], [6, 0], [3, 6]];
    const [cx, cz] = computeCentroid(tri);
    expect(cx).toBeCloseTo(3, 5);
    expect(cz).toBeCloseTo(2, 5);
  });
});

// ─── classifyEdges ────────────────────────────────────────────────────────────

describe('classifyEdges', () => {
  it('mesaio rectangle: 1F, 1R, 2L', () => {
    const roles = classifyEdges(RECT_20x30, [0], 'mesaio');
    expect(roles[0]).toBe('frontage');
    expect(roles[2]).toBe('rear');
    expect(roles[1]).toBe('lateral');
    expect(roles[3]).toBe('lateral');
  });

  it('goniako rectangle: 2F, 0R or 1R, rest L', () => {
    const roles = classifyEdges(RECT_20x30, [0, 1], 'goniako');
    expect(roles[0]).toBe('frontage');
    expect(roles[1]).toBe('frontage');
    const nonFrontage = [roles[2], roles[3]] as EdgeRole[];
    expect(nonFrontage).toContain('rear');
  });

  it('diamperes rectangle: 2F, 0R, 2L', () => {
    const roles = classifyEdges(RECT_20x30, [0, 2], 'diamperes');
    expect(roles[0]).toBe('frontage');
    expect(roles[2]).toBe('frontage');
    expect(roles[1]).toBe('lateral');
    expect(roles[3]).toBe('lateral');
  });

  it('multi-edge frontage flattened correctly', () => {
    const roles = classifyEdges(RECT_20x30, [[0, 1]], 'mesaio');
    expect(roles[0]).toBe('frontage');
    expect(roles[1]).toBe('frontage');
  });
});

// ─── computeEdgeSetbacks ──────────────────────────────────────────────────────

describe('computeEdgeSetbacks', () => {
  it('assigns D_m to rear, delta_m to lateral, prassia to frontage', () => {
    const roles: EdgeRole[] = ['frontage', 'lateral', 'rear', 'lateral'];
    const result = computeEdgeSetbacks(RECT_20x30, roles, 3.0, 2.5, [FRONTAGE_DEFAULT]);
    expect(result[0]!.setback_m).toBe(0);
    expect(result[1]!.setback_m).toBe(2.5);
    expect(result[2]!.setback_m).toBe(3.0);
    expect(result[3]!.setback_m).toBe(2.5);
  });

  it('uses prassia_m from matching frontage', () => {
    const roles: EdgeRole[] = ['frontage', 'lateral', 'rear', 'lateral'];
    const result = computeEdgeSetbacks(RECT_20x30, roles, 3.0, 2.5, [FRONTAGE_WITH_PRASSIA]);
    expect(result[0]!.setback_m).toBe(4.0);
  });

  it('generates edge labels', () => {
    const roles: EdgeRole[] = ['frontage', 'lateral', 'rear', 'lateral'];
    const result = computeEdgeSetbacks(RECT_20x30, roles, 3.0, 2.5, [FRONTAGE_DEFAULT]);
    expect(result[0]!.label).toBe('Α→Β');
    expect(result[1]!.label).toBe('Β→Γ');
  });
});

// ─── insetPolygon ─────────────────────────────────────────────────────────────

describe('insetPolygon', () => {
  it('inset area < original area', () => {
    const roles: EdgeRole[] = ['frontage', 'lateral', 'rear', 'lateral'];
    const setbacks = computeEdgeSetbacks(RECT_20x30, roles, 3.0, 2.5, [FRONTAGE_DEFAULT]);
    const footprint = insetPolygon(RECT_20x30, setbacks);
    const insetArea = shoelaceArea(footprint);
    const originalArea = shoelaceArea(RECT_20x30);
    expect(insetArea).toBeLessThan(originalArea);
    expect(insetArea).toBeGreaterThan(0);
  });

  it('uniform setback = uniform shrink', () => {
    const setbacks = RECT_20x30.map((_, i) => ({
      edgeIdx: i, role: 'lateral' as EdgeRole, setback_m: 2.0, label: `e${i}`,
    }));
    const footprint = insetPolygon(RECT_20x30, setbacks);
    const area = shoelaceArea(footprint);
    expect(area).toBeCloseTo(16 * 26, 1);
  });

  it('zero setback → footprint ≈ original', () => {
    const setbacks = RECT_20x30.map((_, i) => ({
      edgeIdx: i, role: 'frontage' as EdgeRole, setback_m: 0, label: `e${i}`,
    }));
    const footprint = insetPolygon(RECT_20x30, setbacks);
    const area = shoelaceArea(footprint);
    expect(area).toBeCloseTo(shoelaceArea(RECT_20x30), 1);
  });

  it('all vertices inside original polygon (convex case)', () => {
    const roles: EdgeRole[] = ['frontage', 'lateral', 'rear', 'lateral'];
    const setbacks = computeEdgeSetbacks(RECT_20x30, roles, 3.0, 2.5, [FRONTAGE_DEFAULT]);
    const footprint = insetPolygon(RECT_20x30, setbacks);
    for (const [x, z] of footprint) {
      expect(x).toBeGreaterThanOrEqual(-0.01);
      expect(x).toBeLessThanOrEqual(20.01);
      expect(z).toBeGreaterThanOrEqual(-0.01);
      expect(z).toBeLessThanOrEqual(30.01);
    }
  });

  it('asymmetric setbacks: south=0, east=2.5, north=3, west=2.5', () => {
    const setbacks = [
      { edgeIdx: 0, role: 'frontage' as EdgeRole, setback_m: 0, label: 'Α→Β' },
      { edgeIdx: 1, role: 'lateral' as EdgeRole, setback_m: 2.5, label: 'Β→Γ' },
      { edgeIdx: 2, role: 'rear' as EdgeRole, setback_m: 3.0, label: 'Γ→Δ' },
      { edgeIdx: 3, role: 'lateral' as EdgeRole, setback_m: 2.5, label: 'Δ→Α' },
    ];
    const footprint = insetPolygon(RECT_20x30, setbacks);
    const area = shoelaceArea(footprint);
    expect(area).toBeCloseTo(15 * 27, 1);
  });
});

// ─── computeMinEdgeLength ─────────────────────────────────────────────────────

describe('computeMinEdgeLength', () => {
  it('rectangle min side', () => {
    expect(computeMinEdgeLength(RECT_20x30)).toBeCloseTo(20, 5);
  });

  it('square all sides equal', () => {
    expect(computeMinEdgeLength(SQUARE_15)).toBeCloseTo(15, 5);
  });
});

// ─── computeSetbackResult ─────────────────────────────────────────────────────

describe('computeSetbackResult', () => {
  it('returns null when no polyOutline', () => {
    const result = computeSetbackResult({
      polyOutline: undefined,
      polyFrontageEdges: [0],
      plotType: 'mesaio',
      D_m: 3.0,
      delta_m: 2.5,
      frontages: [FRONTAGE_DEFAULT],
    });
    expect(result).toBeNull();
  });

  it('returns null when no polyFrontageEdges', () => {
    const result = computeSetbackResult({
      polyOutline: RECT_20x30,
      polyFrontageEdges: undefined,
      plotType: 'mesaio',
      D_m: 3.0,
      delta_m: 2.5,
      frontages: [FRONTAGE_DEFAULT],
    });
    expect(result).toBeNull();
  });

  it('mesaio 20×30 with D=3, δ=2.5: area < 600', () => {
    const result = computeSetbackResult({
      polyOutline: RECT_20x30,
      polyFrontageEdges: [0],
      plotType: 'mesaio',
      D_m: 3.0,
      delta_m: 2.5,
      frontages: [FRONTAGE_DEFAULT],
    });
    expect(result).not.toBeNull();
    expect(result!.buildableArea_m2).toBeGreaterThan(0);
    expect(result!.buildableArea_m2).toBeLessThan(600);
    expect(result!.edges).toHaveLength(4);
    expect(result!.buildableFootprint).toHaveLength(4);
  });

  it('9m warning for narrow plot', () => {
    const narrow: readonly [number, number][] = [
      [0, 0], [10, 0], [10, 30], [0, 30],
    ];
    const result = computeSetbackResult({
      polyOutline: narrow,
      polyFrontageEdges: [0],
      plotType: 'mesaio',
      D_m: 3.0,
      delta_m: 2.5,
      frontages: [FRONTAGE_DEFAULT],
    });
    expect(result).not.toBeNull();
    expect(result!.minBuildableSide_m).toBeLessThan(9);
    expect(result!.warnings.length).toBeGreaterThan(0);
  });

  it('wide plot: no 9m warning', () => {
    const wide: readonly [number, number][] = [
      [0, 0], [30, 0], [30, 30], [0, 30],
    ];
    const result = computeSetbackResult({
      polyOutline: wide,
      polyFrontageEdges: [0],
      plotType: 'mesaio',
      D_m: 3.0,
      delta_m: 2.5,
      frontages: [FRONTAGE_DEFAULT],
    });
    expect(result).not.toBeNull();
    expect(result!.minBuildableSide_m).toBeGreaterThanOrEqual(9);
    expect(result!.warnings).toHaveLength(0);
  });

  it('diamperes plot: no rear edges', () => {
    const result = computeSetbackResult({
      polyOutline: RECT_20x30,
      polyFrontageEdges: [0, 2],
      plotType: 'diamperes',
      D_m: 3.0,
      delta_m: 2.5,
      frontages: [FRONTAGE_DEFAULT, FRONTAGE_DEFAULT],
    });
    expect(result).not.toBeNull();
    const rearEdges = result!.edges.filter((e) => e.role === 'rear');
    expect(rearEdges).toHaveLength(0);
  });

  it('prassia applied to frontage setback', () => {
    const result = computeSetbackResult({
      polyOutline: RECT_20x30,
      polyFrontageEdges: [0],
      plotType: 'mesaio',
      D_m: 3.0,
      delta_m: 2.5,
      frontages: [FRONTAGE_WITH_PRASSIA],
    });
    expect(result).not.toBeNull();
    const frontageEdge = result!.edges.find((e) => e.role === 'frontage');
    expect(frontageEdge!.setback_m).toBe(4.0);
  });
});
