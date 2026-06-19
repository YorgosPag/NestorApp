/**
 * ADR-502 §Slice2 — column-support-moment (`buildColumnSupportMomentMap`): η στατική
 * ροπή `w·L²/2` ενός δοκαριού-προβόλου που παραλαμβάνει η μοναδική στηρίζουσα κολώνα.
 * Fixtures: canvas = mm· graph synthetic (column-bearing ακμές).
 */

import { buildColumnSupportMomentMap } from '../column-support-moment';
import { buildBeamSectionContext } from '../../section-context';
import { beamDesignMomentNmm } from '../../codes/suggest-reinforcement';
import type { Entity } from '../../../../types/entities';
import type { AppliedMemberLoad } from '../structural-loads-types';
import type {
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
  StructuralConnectionKind,
  StructuralMemberKind,
} from '../../organism/structural-organism-types';

function beam(id: string, lengthM: number, applied?: AppliedMemberLoad): Entity {
  return {
    id, type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', width: 250, depth: 400, sceneUnits: 'mm',
      startPoint: { x: 0, y: 0 }, endPoint: { x: lengthM * 1000, y: 0 },
      ...(applied ? { appliedLoad: applied } : {}),
    },
    geometry: { length: lengthM, volume: 0.5 },
  } as unknown as Entity;
}

function gNode(id: string, memberKind: StructuralMemberKind): StructuralNode {
  const entityType = memberKind === 'footing' ? 'foundation' : memberKind;
  return { id, memberKind, entityType, baseZmm: 0, topZmm: 3000 };
}
function gEdge(supportId: string, supportedId: string, kind: StructuralConnectionKind): StructuralEdge {
  return { id: `${supportId}->${supportedId}:${kind}`, supportId, supportedId, kind };
}

const LOAD: AppliedMemberLoad = { deadAxialKn: 120, liveAxialKn: 40, source: 'takedown' };

/** Oracle: η ίδια ροπή προβόλου που υπολογίζει ο οπλισμός+sizing του δοκαριού (kNm). */
function oracleMomentKnm(b: Entity): number {
  return beamDesignMomentNmm(buildBeamSectionContext(b as never, 'cantilever')) / 1e6;
}

describe('buildColumnSupportMomentMap (ADR-502 §Slice2)', () => {
  it('δοκάρι-πρόβολος (1 στήριξη) → η μοναδική κολώνα παίρνει M = w·L²/2', () => {
    const b = beam('b1', 3, LOAD);
    const graph: StructuralGraph = {
      nodes: [gNode('c1', 'column'), gNode('b1', 'beam')],
      edges: [gEdge('c1', 'b1', 'column-bearing')],
    };
    const map = buildColumnSupportMomentMap([b, beam('_unused', 1)], graph);
    const m = map.get('c1') ?? 0;
    expect(m).toBeGreaterThan(0);
    expect(m).toBeCloseTo(oracleMomentKnm(b), 6); // ίδιο SSoT με τον οπλισμό του δοκαριού
  });

  it('αμφιέρειστο δοκάρι (2 στηρίξεις) → καμία στατική ροπή κολώνας', () => {
    const graph: StructuralGraph = {
      nodes: [gNode('c1', 'column'), gNode('c2', 'column'), gNode('b1', 'beam')],
      edges: [gEdge('c1', 'b1', 'column-bearing'), gEdge('c2', 'b1', 'column-bearing')],
    };
    expect(buildColumnSupportMomentMap([beam('b1', 3, LOAD)], graph).size).toBe(0);
  });

  it('δοκάρι-πρόβολος χωρίς φορτίο → καμία ροπή (M=0 skip)', () => {
    const graph: StructuralGraph = {
      nodes: [gNode('c1', 'column'), gNode('b1', 'beam')],
      edges: [gEdge('c1', 'b1', 'column-bearing')],
    };
    expect(buildColumnSupportMomentMap([beam('b1', 3)], graph).size).toBe(0);
  });

  it('μεγαλύτερο άνοιγμα προβόλου → μεγαλύτερη ροπή κολώνας (~L²)', () => {
    const graph: StructuralGraph = {
      nodes: [gNode('c1', 'column'), gNode('b1', 'beam')],
      edges: [gEdge('c1', 'b1', 'column-bearing')],
    };
    const short = buildColumnSupportMomentMap([beam('b1', 2, LOAD)], graph).get('c1') ?? 0;
    const long = buildColumnSupportMomentMap([beam('b1', 5, LOAD)], graph).get('c1') ?? 0;
    expect(long).toBeGreaterThan(short);
  });

  it('δύο πρόβολοι στην ίδια κολώνα → αθροιστική ροπή (additive)', () => {
    const graph: StructuralGraph = {
      nodes: [gNode('c1', 'column'), gNode('b1', 'beam'), gNode('b2', 'beam')],
      edges: [gEdge('c1', 'b1', 'column-bearing'), gEdge('c1', 'b2', 'column-bearing')],
    };
    const b1 = beam('b1', 3, LOAD);
    const b2 = { ...(beam('b2', 3, LOAD) as object) } as Entity;
    const m = buildColumnSupportMomentMap([b1, b2], graph).get('c1') ?? 0;
    expect(m).toBeCloseTo(oracleMomentKnm(b1) * 2, 6);
  });

  it('καμία δοκός → κενό', () => {
    expect(buildColumnSupportMomentMap([], { nodes: [], edges: [] }).size).toBe(0);
  });
});
