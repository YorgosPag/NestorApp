/**
 * ADR-467 — load-path graph traversal (pure).
 *
 * Καλύπτει: reverse-topological σειρά (beams→columns→footings), αποκλεισμό των
 * `top-attachment` ακμών, graceful cycle fallback, και τους edge resolvers.
 */

import {
  topologicalLoadOrder,
  beamSupportColumnIds,
  footingColumnId,
} from '../load-path-walk';
import type {
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
  StructuralConnectionKind,
  StructuralMemberKind,
} from '../../organism/structural-organism-types';

function node(id: string, memberKind: StructuralMemberKind): StructuralNode {
  const entityType = memberKind === 'footing' ? 'foundation' : memberKind;
  return { id, memberKind, entityType, baseZmm: 0, topZmm: 1000 };
}

function edge(supportId: string, supportedId: string, kind: StructuralConnectionKind): StructuralEdge {
  return { id: `${supportId}->${supportedId}:${kind}`, supportId, supportedId, kind };
}

/** Index ενός node id μέσα στη διατεταγμένη λίστα (για assertions σειράς). */
function orderIndex(ordered: readonly StructuralNode[], id: string): number {
  return ordered.findIndex((n) => n.id === id);
}

describe('topologicalLoadOrder', () => {
  it('καθαρός κάναβος (κολώνες+πέδιλα, χωρίς δοκάρια) → κολώνα ΠΡΙΝ το πέδιλό της', () => {
    const graph: StructuralGraph = {
      nodes: [node('f1', 'footing'), node('c1', 'column')],
      edges: [edge('f1', 'c1', 'footing-bearing')],
    };
    const ordered = topologicalLoadOrder(graph);
    expect(ordered).toHaveLength(2);
    expect(orderIndex(ordered, 'c1')).toBeLessThan(orderIndex(ordered, 'f1'));
  });

  it('πλαισιωμένος κάναβος → δοκάρι ΠΡΙΝ κολώνα ΠΡΙΝ πέδιλο', () => {
    const graph: StructuralGraph = {
      nodes: [node('f1', 'footing'), node('c1', 'column'), node('b1', 'beam')],
      edges: [
        edge('f1', 'c1', 'footing-bearing'),
        edge('c1', 'b1', 'column-bearing'),
      ],
    };
    const ordered = topologicalLoadOrder(graph);
    expect(orderIndex(ordered, 'b1')).toBeLessThan(orderIndex(ordered, 'c1'));
    expect(orderIndex(ordered, 'c1')).toBeLessThan(orderIndex(ordered, 'f1'));
  });

  it('αγνοεί τις `top-attachment` ακμές (γεωμετρικές, όχι load) — δεν επηρεάζουν τη σειρά', () => {
    const graph: StructuralGraph = {
      nodes: [node('c1', 'column'), node('b1', 'beam')],
      // top-attachment: κορυφή κολώνας c1 attached στο δοκάρι b1 από πάνω.
      edges: [edge('b1', 'c1', 'top-attachment')],
    };
    const ordered = topologicalLoadOrder(graph);
    // Καμία load εξάρτηση → και τα δύο in-degree 0, αμφότερα παρόντα.
    expect(ordered).toHaveLength(2);
    expect(orderIndex(ordered, 'c1')).toBeGreaterThanOrEqual(0);
    expect(orderIndex(ordered, 'b1')).toBeGreaterThanOrEqual(0);
  });

  it('graceful σε κύκλο — κανένα μέλος δεν χάνεται', () => {
    const graph: StructuralGraph = {
      nodes: [node('a', 'column'), node('b', 'column')],
      edges: [
        edge('a', 'b', 'column-bearing'),
        edge('b', 'a', 'column-bearing'),
      ],
    };
    const ordered = topologicalLoadOrder(graph);
    expect(ordered).toHaveLength(2);
  });

  it('πολλαπλά πέδιλα/κολώνες — όλα τα μέλη παρόντα, κάθε κολώνα πριν το πέδιλό της', () => {
    const graph: StructuralGraph = {
      nodes: [
        node('f1', 'footing'), node('f2', 'footing'),
        node('c1', 'column'), node('c2', 'column'),
      ],
      edges: [
        edge('f1', 'c1', 'footing-bearing'),
        edge('f2', 'c2', 'footing-bearing'),
      ],
    };
    const ordered = topologicalLoadOrder(graph);
    expect(ordered).toHaveLength(4);
    expect(orderIndex(ordered, 'c1')).toBeLessThan(orderIndex(ordered, 'f1'));
    expect(orderIndex(ordered, 'c2')).toBeLessThan(orderIndex(ordered, 'f2'));
  });
});

describe('edge resolvers', () => {
  const graph: StructuralGraph = {
    nodes: [node('f1', 'footing'), node('c1', 'column'), node('c2', 'column'), node('b1', 'beam')],
    edges: [
      edge('f1', 'c1', 'footing-bearing'),
      edge('c1', 'b1', 'column-bearing'),
      edge('c2', 'b1', 'column-bearing'),
    ],
  };

  it('beamSupportColumnIds → οι στηρίζουσες κολώνες του δοκαριού', () => {
    expect(beamSupportColumnIds(graph, 'b1').sort()).toEqual(['c1', 'c2']);
  });

  it('beamSupportColumnIds → [] όταν το δοκάρι δεν πλαισιώνεται', () => {
    expect(beamSupportColumnIds(graph, 'unknown')).toEqual([]);
  });

  it('footingColumnId → η εδραζόμενη κολώνα του πεδίλου', () => {
    expect(footingColumnId(graph, 'f1')).toBe('c1');
  });

  it('footingColumnId → null όταν δεν υπάρχει footing-bearing', () => {
    expect(footingColumnId(graph, 'unknown')).toBeNull();
  });
});
