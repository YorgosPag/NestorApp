/**
 * ADR-459 Phase 4d — reinforcement diagnostics (`runReinforcementChecks`).
 *
 * Realistic entity fixtures (πραγματικά params ώστε ο shape-aware
 * `buildColumnSectionContext` + οι compute να τρέχουν αυθεντικά) + hand-built
 * graph. Καλύπτει: memberMissingReinforcement (3 kinds), ratioOutOfRange (κάτω
 * από min → finding· code-suggested → κανένα), barMismatchAtJoint (μάτισμα με
 * διαφορετικό πλήθος ράβδων), DERIVED invariant (entities ποτέ δεν μεταλλάσσονται).
 */

import { runReinforcementChecks } from '../reinforcement-checks';
import { buildColumnSectionContext } from '../../section-context';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import type { StructuralGraph, StructuralNode } from '../structural-organism-types';
import type { ColumnReinforcement } from '../../reinforcement/column-reinforcement-types';
import type { BeamReinforcement } from '../../reinforcement/beam-reinforcement-types';
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

const beamReinf = (botD: number, botN: number): BeamReinforcement => ({
  bottom: { diameterMm: botD, count: botN },
  top: { diameterMm: 14, count: 2 },
  stirrups: { diameterMm: 8, spacingMm: 200 },
  coverMm: 30,
});

const colEntity = (id: string, reinforcement?: ColumnReinforcement): Entity =>
  ({
    id,
    type: 'column',
    kind: 'rectangular',
    params: {
      kind: 'rectangular',
      position: { x: 0, y: 0, z: 0 },
      anchor: 'center',
      width: 600,
      depth: 600,
      height: 3000,
      rotation: 0,
      sceneUnits: 'mm',
      ...(reinforcement ? { reinforcement } : {}),
    },
    geometry: { area: 0.36 },
  } as unknown as Entity);

const beamEntity = (id: string, reinforcement?: BeamReinforcement): Entity =>
  ({
    id,
    type: 'beam',
    kind: 'straight',
    params: {
      kind: 'straight',
      startPoint: { x: 0, y: 0, z: 0 },
      endPoint: { x: 5000, y: 0, z: 0 },
      width: 250,
      depth: 500,
      topElevation: 3000,
      supportType: 'simple',
      sceneUnits: 'mm',
      ...(reinforcement ? { reinforcement } : {}),
    },
    geometry: { length: 5 },
  } as unknown as Entity);

const padEntity = (id: string, reinforcement?: unknown): Entity =>
  ({
    id,
    type: 'foundation',
    kind: 'pad',
    predefinedType: 'PAD_FOOTING',
    params: {
      kind: 'pad',
      topElevationMm: -1000,
      thicknessMm: 500,
      position: { x: 0, y: 0, z: 0 },
      width: 1500,
      length: 1500,
      rotation: 0,
      anchor: 'center',
      profile: 'flat',
      sceneUnits: 'mm',
      ...(reinforcement ? { reinforcement } : {}),
    },
  } as unknown as Entity);

const edge = (supportId: string, supportedId: string, kind: StructuralGraph['edges'][number]['kind']) => ({
  id: `${supportId}->${supportedId}:${kind}`,
  supportId,
  supportedId,
  kind,
});

const codesOf = (ds: { code: string }[]): string[] => ds.map((d) => d.code);

// ─── Check 1: memberMissingReinforcement (info) ───────────────────────────────

describe('runReinforcementChecks — memberMissingReinforcement', () => {
  it('flags column/beam/footing without reinforcement as info', () => {
    const graph: StructuralGraph = {
      nodes: [node('C1', 'column'), node('B1', 'beam'), node('F1', 'footing')],
      edges: [],
    };
    const findings = runReinforcementChecks(graph, [colEntity('C1'), beamEntity('B1'), padEntity('F1')], EUROCODE_PROVIDER);
    const missing = findings.filter((d) => d.code === 'memberMissingReinforcement');
    expect(missing).toHaveLength(3);
    expect(missing.every((d) => d.severity === 'info')).toBe(true);
  });

  it('does NOT flag a member that already has reinforcement', () => {
    const graph: StructuralGraph = { nodes: [node('C1', 'column')], edges: [] };
    const findings = runReinforcementChecks(graph, [colEntity('C1', colReinf(20, 8))], EUROCODE_PROVIDER);
    expect(codesOf(findings)).not.toContain('memberMissingReinforcement');
  });

  it('ignores entities not in the organism graph', () => {
    const graph: StructuralGraph = { nodes: [], edges: [] };
    expect(runReinforcementChecks(graph, [colEntity('C1')], EUROCODE_PROVIDER)).toHaveLength(0);
  });
});

// ─── Check 2: ratioOutOfRange (warning) ───────────────────────────────────────

describe('runReinforcementChecks — ratioOutOfRange', () => {
  it('column: sparse reinforcement → ρ below min → warning (ratioBelowMin)', () => {
    const graph: StructuralGraph = { nodes: [node('C1', 'column')], edges: [] };
    const findings = runReinforcementChecks(graph, [colEntity('C1', colReinf(12, 4))], EUROCODE_PROVIDER);
    const ratio = findings.find((d) => d.code === 'ratioOutOfRange');
    expect(ratio).toBeDefined();
    expect(ratio?.severity).toBe('warning');
    expect(ratio?.messageKey).toContain('ratioBelowMin');
    expect(ratio?.messageParams).toHaveProperty('ratio');
  });

  it('column: code-suggested reinforcement → ρ within range → no ratio finding', () => {
    const suggestion = EUROCODE_PROVIDER.suggestColumnReinforcement(buildColumnSectionContext(colEntity('C1') as never));
    const graph: StructuralGraph = { nodes: [node('C1', 'column')], edges: [] };
    const findings = runReinforcementChecks(graph, [colEntity('C1', suggestion)], EUROCODE_PROVIDER);
    expect(codesOf(findings)).not.toContain('ratioOutOfRange');
    expect(codesOf(findings)).not.toContain('memberMissingReinforcement');
  });

  it('beam: a single thin bottom bar → ρ below min → warning', () => {
    const graph: StructuralGraph = { nodes: [node('B1', 'beam')], edges: [] };
    const findings = runReinforcementChecks(graph, [beamEntity('B1', beamReinf(8, 1))], EUROCODE_PROVIDER);
    expect(codesOf(findings)).toContain('ratioOutOfRange');
  });

  it('footing: sparse mesh → ρ below min → warning', () => {
    const sparse = { kind: 'pad', bottomMeshX: { diameterMm: 8, spacingMm: 300 }, bottomMeshY: { diameterMm: 8, spacingMm: 300 }, coverMm: 50 };
    const graph: StructuralGraph = { nodes: [node('F1', 'footing')], edges: [] };
    const findings = runReinforcementChecks(graph, [padEntity('F1', sparse)], EUROCODE_PROVIDER);
    expect(codesOf(findings)).toContain('ratioOutOfRange');
  });
});

// ─── Check 3: barMismatchAtJoint (warning) ────────────────────────────────────

describe('runReinforcementChecks — barMismatchAtJoint', () => {
  it('flags a column splice (lap) with differing longitudinal bar counts', () => {
    const graph: StructuralGraph = {
      nodes: [node('C1', 'column'), node('C2', 'column')],
      edges: [edge('C2', 'C1', 'top-attachment')], // C1 lower top ↔ C2 upper base
    };
    const entities = [colEntity('C1', colReinf(16, 4)), colEntity('C2', colReinf(16, 6))];
    const findings = runReinforcementChecks(graph, entities, EUROCODE_PROVIDER);
    const mismatch = findings.filter((d) => d.code === 'barMismatchAtJoint');
    expect(mismatch).toHaveLength(1);
    expect(mismatch[0].entityIds).toEqual(expect.arrayContaining(['C1', 'C2']));
  });

  it('does NOT flag a splice with identical bars', () => {
    const graph: StructuralGraph = {
      nodes: [node('C1', 'column'), node('C2', 'column')],
      edges: [edge('C2', 'C1', 'top-attachment')],
    };
    const entities = [colEntity('C1', colReinf(16, 6)), colEntity('C2', colReinf(16, 6))];
    const findings = runReinforcementChecks(graph, entities, EUROCODE_PROVIDER);
    expect(codesOf(findings)).not.toContain('barMismatchAtJoint');
  });
});

// ─── DERIVED invariant ────────────────────────────────────────────────────────

describe('runReinforcementChecks — DERIVED invariant', () => {
  it('never mutates the input entities', () => {
    const graph: StructuralGraph = {
      nodes: [node('C1', 'column'), node('B1', 'beam')],
      edges: [],
    };
    const entities = [colEntity('C1', colReinf(12, 4)), beamEntity('B1', beamReinf(8, 1))];
    const snapshot = JSON.parse(JSON.stringify(entities));
    runReinforcementChecks(graph, entities, EUROCODE_PROVIDER);
    expect(JSON.parse(JSON.stringify(entities))).toEqual(snapshot);
  });
});
