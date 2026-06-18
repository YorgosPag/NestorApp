/**
 * ADR-480 (T2) — analytical model builder (pure).
 *
 * Σενάριο: portal frame — 2 κολόνες (c1@0, c2@5m, ύψος 3m) + 1 δοκάρι (b1) στην
 * κορυφή + 2 πέδιλα (f1/f2). Καλύπτει: παραγωγή κόμβων/μελών, node-merging άκρου
 * δοκαριού με κορυφή κολόνας (connectivity), στηρίξεις από πέδιλα, διάφραγμα ανά
 * στάθμη, και σωστές μονάδες (μέτρα).
 */

import { buildAnalyticalModel } from '../analytical-model-builder';
import type { Entity } from '../../../../types/entities';
import type {
  StructuralEdge, StructuralGraph, StructuralNode, StructuralConnectionKind,
} from '../../organism/structural-organism-types';

/** Κολόνα: footprint 250×250 (canvas=mm), κεντραρισμένο στο (cxMm, 0). */
function columnEntity(id: string, cxMm: number): Entity {
  const half = 125;
  return {
    id, type: 'column',
    geometry: { footprint: { vertices: [
      { x: cxMm - half, y: -half }, { x: cxMm + half, y: -half },
      { x: cxMm + half, y: half }, { x: cxMm - half, y: half },
    ] } },
    params: { sceneUnits: 'mm', height: 3000 },
  } as unknown as Entity;
}

/** Δοκάρι: άξονας (sxMm,0)→(exMm,0), canvas=mm. */
function beamEntity(id: string, sxMm: number, exMm: number): Entity {
  return {
    id, type: 'beam',
    params: {
      sceneUnits: 'mm', width: 250,
      startPoint: { x: sxMm, y: 0 }, endPoint: { x: exMm, y: 0 },
    },
  } as unknown as Entity;
}

function gnode(
  id: string, memberKind: StructuralNode['memberKind'], baseZmm: number, topZmm: number,
): StructuralNode {
  const entityType = memberKind === 'footing' ? 'foundation' : memberKind;
  return { id, memberKind, entityType, baseZmm, topZmm };
}

function edge(s: string, t: string, kind: StructuralConnectionKind): StructuralEdge {
  return { id: `${s}->${t}:${kind}`, supportId: s, supportedId: t, kind };
}

function portalFrame(): { entities: Entity[]; graph: StructuralGraph } {
  const entities = [
    columnEntity('c1', 0), columnEntity('c2', 5000), beamEntity('b1', 0, 5000),
  ];
  const graph: StructuralGraph = {
    nodes: [
      gnode('f1', 'footing', 0, 0), gnode('f2', 'footing', 0, 0),
      gnode('c1', 'column', 0, 3000), gnode('c2', 'column', 0, 3000),
      gnode('b1', 'beam', 2700, 3000),
    ],
    edges: [
      edge('f1', 'c1', 'footing-bearing'), edge('f2', 'c2', 'footing-bearing'),
      edge('c1', 'b1', 'column-bearing'), edge('c2', 'b1', 'column-bearing'),
    ],
  };
  return { entities, graph };
}

describe('buildAnalyticalModel — portal frame', () => {
  const { entities, graph } = portalFrame();
  const model = buildAnalyticalModel({ entities, graph });

  it('μετά το merge: 4 κόμβοι (2 βάσεις + 2 κοινές κορυφές)', () => {
    expect(model.nodes).toHaveLength(4);
  });

  it('3 μέλη: 2 κολόνες + 1 δοκάρι', () => {
    expect(model.members).toHaveLength(3);
    expect(model.members.filter((m) => m.memberType === 'column')).toHaveLength(2);
    expect(model.members.filter((m) => m.memberType === 'beam')).toHaveLength(1);
  });

  it('το δοκάρι b1 έχει μήκος ≈ 5m (μονάδες σε μέτρα)', () => {
    const beam = model.members.find((m) => m.id === 'b1');
    expect(beam?.lengthM).toBeCloseTo(5, 3);
  });

  it('οι κολόνες έχουν μήκος ≈ 3m', () => {
    const col = model.members.find((m) => m.id === 'c1');
    expect(col?.lengthM).toBeCloseTo(3, 3);
  });

  it('2 στηρίξεις (πάκτωση) στις βάσεις των κολονών, με FK πεδίλου', () => {
    expect(model.supports).toHaveLength(2);
    expect(model.supports.every((s) => s.supportType === 'fixed')).toBe(true);
    expect(model.supports.map((s) => s.entityId).sort()).toEqual(['f1', 'f2']);
  });

  it('οι κόμβοι-στηρίξεις είναι δεσμευμένοι (dz), οι κορυφές ελεύθερες', () => {
    const supportedIds = new Set(model.supports.map((s) => s.nodeId));
    const baseNodes = model.nodes.filter((n) => supportedIds.has(n.id));
    expect(baseNodes).toHaveLength(2);
    expect(baseNodes.every((n) => n.restraint.dz)).toBe(true);
  });

  it('2 στάθμες (z=0 βάσεις, z=3 κορυφές)', () => {
    expect(model.levels).toHaveLength(2);
  });

  it('1 άκαμπτο διάφραγμα στη στάθμη του δοκαριού (2 κόμβοι)', () => {
    expect(model.diaphragms).toHaveLength(1);
    expect(model.diaphragms[0].nodeIds).toHaveLength(2);
  });
});

describe('buildAnalyticalModel — άδειο', () => {
  it('χωρίς φέροντα μέλη → κενό μοντέλο', () => {
    const model = buildAnalyticalModel({ entities: [], graph: { nodes: [], edges: [] } });
    expect(model.nodes).toHaveLength(0);
    expect(model.members).toHaveLength(0);
  });
});
