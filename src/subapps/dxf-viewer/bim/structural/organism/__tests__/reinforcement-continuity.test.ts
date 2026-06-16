/**
 * ADR-459 Phase 4c — organism reinforcement continuity.
 *
 * Hand-built graph + minimal entity fixtures (cast `as unknown as Entity`, ίδιο
 * pattern με το structural-graph.test) ώστε να εξεταστεί η αμφίδρομη συνέχεια ανά
 * edge ανεξάρτητα από τον graph builder. Επιπλέον: provider lap/anchorage SSoT +
 * compute integration (continuity vs flat fallback) + DERIVED invariant.
 */

import { computeOrganismReinforcementContinuity } from '../reinforcement-continuity';
import type { StructuralGraph, StructuralNode } from '../structural-organism-types';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import { GREEK_LEGACY_PROVIDER } from '../../codes/greek-legacy-provider';
import { computeColumnReinforcementQuantities } from '../../reinforcement/column-reinforcement-compute';
import { computeBeamReinforcementQuantities } from '../../reinforcement/beam-reinforcement-compute';
import type { ColumnReinforcement } from '../../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../../reinforcement/beam-reinforcement-types';
import type { ColumnSectionContext, BeamSectionContext } from '../../codes/structural-code-types';
import type { Entity } from '../../../../types/entities';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const node = (id: string, memberKind: StructuralNode['memberKind']): StructuralNode => ({
  id,
  memberKind,
  entityType: memberKind === 'beam' ? 'beam' : memberKind === 'column' ? 'column' : 'foundation',
  baseZmm: 0,
  topZmm: 1000,
});

const colReinf = (diameterMm: number, count: number): ColumnReinforcement => ({
  longitudinal: { diameterMm, count },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 30,
});

const beamReinf = (botD: number, botN: number, topD: number, topN: number): BeamReinforcement => ({
  bottom: { diameterMm: botD, count: botN },
  top: { diameterMm: topD, count: topN },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 30,
});

const colEntity = (id: string, reinforcement?: ColumnReinforcement): Entity =>
  ({ id, type: 'column', params: reinforcement ? { reinforcement } : {} } as unknown as Entity);

const beamEntity = (id: string, reinforcement?: BeamReinforcement): Entity =>
  ({ id, type: 'beam', params: reinforcement ? { reinforcement } : {} } as unknown as Entity);

const footingEntity = (id: string): Entity => ({ id, type: 'foundation', params: {} } as unknown as Entity);

const edge = (supportId: string, supportedId: string, kind: StructuralGraph['edges'][number]['kind']) => ({
  id: `${supportId}->${supportedId}:${kind}`,
  supportId,
  supportedId,
  kind,
});

// ─── Provider lap/anchorage SSoT ──────────────────────────────────────────────

describe('provider lap/anchorage SSoT (ADR-459 Φ4c)', () => {
  it('eurocode: lap ≈ 50·Ø, anchorage ≈ 40·Ø', () => {
    expect(EUROCODE_PROVIDER.lapLengthMm(16)).toBeCloseTo(800, 6);
    expect(EUROCODE_PROVIDER.anchorageLengthMm(16)).toBeCloseTo(640, 6);
  });

  it('legacy is more conservative than eurocode (lap & anchorage)', () => {
    expect(GREEK_LEGACY_PROVIDER.lapLengthMm(16)).toBeGreaterThan(EUROCODE_PROVIDER.lapLengthMm(16));
    expect(GREEK_LEGACY_PROVIDER.anchorageLengthMm(16)).toBeGreaterThan(EUROCODE_PROVIDER.anchorageLengthMm(16));
  });

  it('monotonic in Ø', () => {
    expect(EUROCODE_PROVIDER.lapLengthMm(20)).toBeGreaterThan(EUROCODE_PROVIDER.lapLengthMm(16));
    expect(EUROCODE_PROVIDER.anchorageLengthMm(20)).toBeGreaterThan(EUROCODE_PROVIDER.anchorageLengthMm(16));
  });

  it('poor bond ×1.4 — tension default, compression shorter', () => {
    expect(EUROCODE_PROVIDER.lapLengthMm(16, { bondCondition: 'poor' })).toBeCloseTo(1120, 6);
    expect(EUROCODE_PROVIDER.anchorageLengthMm(16, { inTension: false })).toBeCloseTo(448, 6);
  });
});

// ─── Per-edge continuity ──────────────────────────────────────────────────────

describe('computeOrganismReinforcementContinuity — footing-bearing (dowels)', () => {
  const graph: StructuralGraph = {
    nodes: [node('F1', 'footing'), node('C1', 'column')],
    edges: [edge('F1', 'C1', 'footing-bearing')],
  };
  const entities = [footingEntity('F1'), colEntity('C1', colReinf(16, 4))];
  const result = computeOrganismReinforcementContinuity(graph, entities, EUROCODE_PROVIDER);

  it('produces a dowel item: count = column count, Ø = column Ø, length = anchorage + lap', () => {
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      kind: 'dowel',
      count: 4,
      diameterMm: 16,
      lengthMm: 640 + 800, // anchorage(40·16) + lap(50·16)
      fromMemberId: 'C1',
      toMemberId: 'F1',
    });
  });

  it('the dowel item is bidirectional — present in BOTH column and footing byMember', () => {
    expect(result.byMember.get('C1')).toHaveLength(1);
    expect(result.byMember.get('F1')).toHaveLength(1);
    expect(result.byMember.get('C1')?.[0]).toBe(result.byMember.get('F1')?.[0]);
  });

  it('column development = base lap (replaces flat 50·Ø)', () => {
    expect(result.columnDevelopmentMm.get('C1')).toBeCloseTo(800, 6);
  });
});

describe('computeOrganismReinforcementContinuity — top-attachment (floor lap)', () => {
  const graph: StructuralGraph = {
    nodes: [node('C1', 'column'), node('C2', 'column')],
    edges: [edge('C2', 'C1', 'top-attachment')], // C1 (lower) top attaches to C2 (upper)
  };
  const entities = [colEntity('C1', colReinf(16, 4)), colEntity('C2', colReinf(16, 4))];
  const result = computeOrganismReinforcementContinuity(graph, entities, EUROCODE_PROVIDER);

  it('lap item: kind = lap, count = min(counts)', () => {
    expect(result.items[0]).toMatchObject({ kind: 'lap', count: 4, diameterMm: 16, lengthMm: 800 });
  });

  it('both columns receive a lap in their development (lower top + upper base)', () => {
    expect(result.columnDevelopmentMm.get('C1')).toBeCloseTo(800, 6);
    expect(result.columnDevelopmentMm.get('C2')).toBeCloseTo(800, 6);
  });
});

describe('computeOrganismReinforcementContinuity — top-attachment to non-column host (Φ4e/E1)', () => {
  const graph: StructuralGraph = {
    nodes: [node('C1', 'column'), node('B1', 'beam')],
    edges: [edge('B1', 'C1', 'top-attachment')], // host B1 (beam) ↔ column C1 top
  };
  const entities = [colEntity('C1', colReinf(16, 6)), beamEntity('B1', beamReinf(16, 3, 14, 2))];
  const result = computeOrganismReinforcementContinuity(graph, entities, EUROCODE_PROVIDER);

  it('anchorage item: kind = anchorage, count = column count, length = lbd (40·Ø)', () => {
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      kind: 'anchorage',
      count: 6,
      diameterMm: 16,
      lengthMm: 640, // anchorage 40·16
      fromMemberId: 'C1',
      toMemberId: 'B1',
    });
  });

  it('only the column receives the anchorage in its development (host gets none)', () => {
    expect(result.columnDevelopmentMm.get('C1')).toBeCloseTo(640, 6);
    expect(result.columnDevelopmentMm.get('B1')).toBeUndefined();
  });
});

describe('computeOrganismReinforcementContinuity — column-bearing (beam anchorage)', () => {
  const graph: StructuralGraph = {
    nodes: [node('C1', 'column'), node('B1', 'beam')],
    edges: [edge('C1', 'B1', 'column-bearing')],
  };
  const entities = [colEntity('C1', colReinf(16, 4)), beamEntity('B1', beamReinf(16, 3, 14, 2))];
  const result = computeOrganismReinforcementContinuity(graph, entities, EUROCODE_PROVIDER);

  it('anchorage item: kind = anchorage, count = bottom + top', () => {
    expect(result.items[0]).toMatchObject({ kind: 'anchorage', count: 5, fromMemberId: 'B1', toMemberId: 'C1' });
  });

  it('beam development = anchorage per layer (bottom Ø16, top Ø14)', () => {
    expect(result.beamDevelopmentMm.get('B1')).toEqual({ bottomMm: 640, topMm: 560 });
  });
});

describe('computeOrganismReinforcementContinuity — accumulation & skips', () => {
  it('a column on a footing AND under an upper column sums both laps', () => {
    const graph: StructuralGraph = {
      nodes: [node('F1', 'footing'), node('C1', 'column'), node('C2', 'column')],
      edges: [edge('F1', 'C1', 'footing-bearing'), edge('C2', 'C1', 'top-attachment')],
    };
    const entities = [footingEntity('F1'), colEntity('C1', colReinf(16, 4)), colEntity('C2', colReinf(16, 4))];
    const result = computeOrganismReinforcementContinuity(graph, entities, EUROCODE_PROVIDER);
    // base lap (800) + top lap (800) = 1600
    expect(result.columnDevelopmentMm.get('C1')).toBeCloseTo(1600, 6);
  });

  it('skips an edge whose member lacks reinforcement intent (→ flag in 4d)', () => {
    const graph: StructuralGraph = {
      nodes: [node('F1', 'footing'), node('C1', 'column')],
      edges: [edge('F1', 'C1', 'footing-bearing')],
    };
    const result = computeOrganismReinforcementContinuity(graph, [footingEntity('F1'), colEntity('C1')], EUROCODE_PROVIDER);
    expect(result.items).toHaveLength(0);
    expect(result.columnDevelopmentMm.size).toBe(0);
  });
});

// ─── Compute integration ──────────────────────────────────────────────────────

const colCtx: ColumnSectionContext = { widthMm: 400, depthMm: 400, heightMm: 3000, grossAreaMm2: 400 * 400 };
const beamCtx: BeamSectionContext = { widthMm: 250, depthMm: 500, spanMm: 5000, grossAreaMm2: 250 * 500, supportType: 'simple' };

describe('compute integration — continuity-aware vs flat fallback', () => {
  it('column: flat fallback (no continuity) keeps the legacy 50·Ø length', () => {
    const r = colReinf(16, 4);
    const flat = computeColumnReinforcementQuantities(colCtx, r);
    // ADR-460 f7: 400mm παρειά (>200) → code-driven 8 ράβδοι (όχι 4).
    // 8 × (3000 + 50·16) / 1000 = 8 × 3.8 = 30.4 m
    expect(flat.longitudinalLengthM).toBeCloseTo(30.4, 3);
  });

  it('column: continuity development override replaces the flat factor', () => {
    const r = colReinf(16, 4);
    const withCont = computeColumnReinforcementQuantities(colCtx, r, { developmentMm: 1600 });
    // 8 × (3000 + 1600) / 1000 = 36.8 m  (> flat 30.4)
    expect(withCont.longitudinalLengthM).toBeCloseTo(36.8, 3);
    expect(withCont.longitudinalLengthM).toBeGreaterThan(computeColumnReinforcementQuantities(colCtx, r).longitudinalLengthM);
  });

  it('beam: bottom/top development applied per layer', () => {
    const r = beamReinf(16, 3, 14, 2);
    const withCont = computeBeamReinforcementQuantities(beamCtx, r, { bottomDevelopmentMm: 640, topDevelopmentMm: 560 });
    // bottom 3 × (5000 + 640)/1000 = 16.92 ; top 2 × (5000 + 560)/1000 = 11.12
    expect(withCont.bottomLengthM).toBeCloseTo(16.92, 3);
    expect(withCont.topLengthM).toBeCloseTo(11.12, 3);
  });
});

// ─── DERIVED invariant ────────────────────────────────────────────────────────

describe('DERIVED invariant — entities are never mutated', () => {
  it('entity params deep-equal before and after compute', () => {
    const graph: StructuralGraph = {
      nodes: [node('F1', 'footing'), node('C1', 'column')],
      edges: [edge('F1', 'C1', 'footing-bearing')],
    };
    const entities = [footingEntity('F1'), colEntity('C1', colReinf(16, 4))];
    const snapshot = JSON.parse(JSON.stringify(entities));
    computeOrganismReinforcementContinuity(graph, entities, EUROCODE_PROVIDER);
    expect(JSON.parse(JSON.stringify(entities))).toEqual(snapshot);
  });
});
