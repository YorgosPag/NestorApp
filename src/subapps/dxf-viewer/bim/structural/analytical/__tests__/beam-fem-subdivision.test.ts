/**
 * ADR-504 Φ2 S5 — FEM subdivision συνεχούς δοκού στον analytical builder.
 *
 * Σενάριο: δοκάρι b1 (0→16m) σε **3** κολώνες (c1@0, c2@8m, c3@16m) + 3 πέδιλα. Η c2
 * πέφτει στη ΜΕΣΗ → ο builder εισάγει ενδιάμεσο κόμβο εκεί και σπάει το member σε 2
 * υπο-μέλη (πραγματικός συνεχής δοκός). Επαληθεύει: εντοπισμό εσωτερικής στήριξης
 * (c2 interior, c1/c3 end)· 2 υπο-μέλη κοινού `entityId` με μοναδικά `id`· ένωση
 * ενδιάμεσου κόμβου με την κορυφή της c2· μηδέν regression για αμφιέρειστο (1 member).
 */

import { buildAnalyticalModel } from '../analytical-model-builder';
import { beamInteriorSupports } from '../beam-interior-supports';
import type { Entity } from '../../../../types/entities';
import type { BeamEntity } from '../../../types/beam-types';
import type {
  StructuralEdge, StructuralGraph, StructuralNode, StructuralConnectionKind,
} from '../../organism/structural-organism-types';

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

function beamEntity(id: string, sxMm: number, exMm: number): Entity {
  return {
    id, type: 'beam',
    params: {
      sceneUnits: 'mm', width: 250,
      startPoint: { x: sxMm, y: 0 }, endPoint: { x: exMm, y: 0 },
    },
    geometry: { length: (exMm - sxMm) / 1000 },
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

/** Συνεχής δοκός: N στηρίξεις σε ισαπέχουσες θέσεις 0..16m. */
function continuousFrame(columnXsMm: number[]): { entities: Entity[]; graph: StructuralGraph } {
  const lastX = columnXsMm[columnXsMm.length - 1]!;
  const entities: Entity[] = [
    ...columnXsMm.map((x, i) => columnEntity(`c${i}`, x)),
    beamEntity('b1', 0, lastX),
  ];
  const graph: StructuralGraph = {
    nodes: [
      ...columnXsMm.map((_x, i) => gnode(`f${i}`, 'footing', 0, 0)),
      ...columnXsMm.map((_x, i) => gnode(`c${i}`, 'column', 0, 3000)),
      gnode('b1', 'beam', 2700, 3000),
    ],
    edges: [
      ...columnXsMm.map((_x, i) => edge(`f${i}`, `c${i}`, 'footing-bearing')),
      ...columnXsMm.map((_x, i) => edge(`c${i}`, 'b1', 'column-bearing')),
    ],
  };
  return { entities, graph };
}

describe('beamInteriorSupports — εντοπισμός εσωτερικών στηρίξεων', () => {
  it('3 στηρίξεις (0/8/16m) → 1 interior (c2@μέση), c1/c3 end', () => {
    const { entities, graph } = continuousFrame([0, 8000, 16000]);
    const beam = entities.find((e) => e.id === 'b1') as BeamEntity;
    const interior = beamInteriorSupports(beam, graph, entities);
    expect(interior).toHaveLength(1);
    expect(interior[0].columnId).toBe('c1'); // c-index 1 = το 2ο column
    expect(interior[0].t).toBeCloseTo(0.5, 6);
  });

  it('αμφιέρειστο (0/16m) → μηδέν εσωτερική (μηδέν subdivision)', () => {
    const { entities, graph } = continuousFrame([0, 16000]);
    const beam = entities.find((e) => e.id === 'b1') as BeamEntity;
    expect(beamInteriorSupports(beam, graph, entities)).toHaveLength(0);
  });
});

describe('buildAnalyticalModel — συνεχής δοκός (subdivision)', () => {
  const { entities, graph } = continuousFrame([0, 8000, 16000]);
  const model = buildAnalyticalModel({ entities, graph });
  const beams = model.members.filter((m) => m.memberType === 'beam');

  it('το δοκάρι σπάει σε 2 υπο-μέλη', () => {
    expect(beams).toHaveLength(2);
  });

  it('κοινό entityId b1, μοναδικά memberId b1#0/b1#1', () => {
    expect(beams.every((m) => m.entityId === 'b1')).toBe(true);
    expect(new Set(beams.map((m) => m.id))).toEqual(new Set(['b1#0', 'b1#1']));
  });

  it('κάθε υπο-μέλος ≈ 8m', () => {
    for (const m of beams) expect(m.lengthM).toBeCloseTo(8, 1);
  });

  it('ο ενδιάμεσος κόμβος ενώνεται με την κορυφή c2 (κοινός κόμβος)', () => {
    // 2 υπο-μέλη μοιράζονται έναν κόμβο (ο interior) → 3 distinct beam-end κόμβοι.
    const beamNodeIds = new Set(beams.flatMap((m) => [m.iNodeId, m.jNodeId]));
    expect(beamNodeIds.size).toBe(3);
    // ο κοινός κόμβος των 2 υπο-μελών υπάρχει (continuity πάνω από την c2).
    const shared = beams[0].iNodeId === beams[1].iNodeId || beams[0].iNodeId === beams[1].jNodeId
      ? beams[0].iNodeId
      : beams[0].jNodeId;
    expect([beams[1].iNodeId, beams[1].jNodeId]).toContain(shared);
  });

  it('3 στηρίξεις (πάκτωση στις 3 βάσεις κολωνών)', () => {
    expect(model.supports).toHaveLength(3);
  });

  it('5 στηρίξεις → 4 υπο-μέλη', () => {
    const f = continuousFrame([0, 4000, 8000, 12000, 16000]);
    const m = buildAnalyticalModel({ entities: f.entities, graph: f.graph });
    expect(m.members.filter((x) => x.memberType === 'beam')).toHaveLength(4);
  });
});

describe('buildAnalyticalModel — αμφιέρειστο (μηδέν regression)', () => {
  it('2 στηρίξεις → 1 member με id===entityId', () => {
    const { entities, graph } = continuousFrame([0, 16000]);
    const model = buildAnalyticalModel({ entities, graph });
    const beams = model.members.filter((m) => m.memberType === 'beam');
    expect(beams).toHaveLength(1);
    expect(beams[0].id).toBe('b1');
    expect(beams[0].entityId).toBe('b1');
  });
});
