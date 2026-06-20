/**
 * ADR-506 — `buildBeamMaxWidthMap`: DERIVED άνω όριο πλάτους δοκαριού = κάθετη στον άξονα
 * προβολή της στηρίζουσας κολώνας (min επί όλων των στηρίξεων).
 *
 * Επαληθεύει: μία κολώνα → cap = κάθετη έκταση footprint· πολλές → min (στενότερη στήριξη)·
 * κολώνα-σημείο χωρίς footprint → χωρίς cap (depth-only)· μόνο δοκάρια του graph χαρτογραφούνται.
 * Fixtures: canvas = mm (sceneUnits 'mm', geometry.length = mm/1000 → sceneToMm = 1).
 */

import { buildBeamMaxWidthMap } from '../derive-beam-max-width';
import type { Entity } from '../../../../types/entities';
import type { BeamEntity } from '../../../types/beam-types';
import type { StructuralEdge, StructuralGraph, StructuralNode } from '../structural-organism-types';

/** Δοκάρι κατά τον άξονα X (μήκος σε mm)· το πλάτος του είναι κάθετο = κατά Y. */
function beam(id: string, lengthMm: number): BeamEntity {
  return {
    id, type: 'beam',
    params: {
      kind: 'straight', width: 250, depth: 500, sceneUnits: 'mm',
      startPoint: { x: 0, y: 0 }, endPoint: { x: lengthMm, y: 0 }, supportType: 'simple',
    },
    geometry: { length: lengthMm / 1000, volume: 1 },
  } as unknown as BeamEntity;
}

/** Ορθογώνια κολώνα με footprint κάθετης (Y) έκτασης `perpMm` στο `x` (X-έκταση σταθερή 400). */
function column(id: string, x: number, perpMm: number): Entity {
  const hy = perpMm / 2;
  return {
    id, type: 'column',
    params: { position: { x, y: 0 }, sceneUnits: 'mm', width: 400, depth: perpMm },
    geometry: {
      footprint: {
        vertices: [
          { x: x - 200, y: -hy }, { x: x + 200, y: -hy },
          { x: x + 200, y: hy }, { x: x - 200, y: hy },
        ],
      },
    },
  } as unknown as Entity;
}

/** Κολώνα-σημείο (footprint απών → καμία cap συνεισφορά). */
function pointColumn(id: string, x: number): Entity {
  return { id, type: 'column', params: { position: { x, y: 0 }, sceneUnits: 'mm', width: 400, depth: 400 }, geometry: {} } as unknown as Entity;
}

const edge = (columnId: string, beamId: string): StructuralEdge => ({
  id: `${columnId}->${beamId}:column-bearing`,
  supportId: columnId, supportedId: beamId, kind: 'column-bearing',
});

const beamNode = (id: string, lengthMm: number): StructuralNode => ({
  id, memberKind: 'beam', entityType: 'beam',
  axis: { start: { x: 0, y: 0 }, end: { x: lengthMm, y: 0 }, halfWidth: 125 },
  supportType: 'simple', baseZmm: 0, topZmm: 500,
} as unknown as StructuralNode);

const graphOf = (edges: StructuralEdge[], nodes: StructuralNode[]): StructuralGraph => ({ nodes, edges });

describe('buildBeamMaxWidthMap (ADR-506)', () => {
  it('cap = κάθετη έκταση footprint της στηρίζουσας κολώνας (400)', () => {
    const b = beam('b1', 6000);
    const g = graphOf([edge('c1', 'b1'), edge('c2', 'b1')], [beamNode('b1', 6000)]);
    const map = buildBeamMaxWidthMap(g, [b, column('c1', 0, 400), column('c2', 6000, 400)]);
    expect(map.get('b1')).toBeCloseTo(400, 0);
  });

  it('min επί όλων των στηρίξεων (στενότερη κολώνα 300)', () => {
    const b = beam('b1', 6000);
    const g = graphOf([edge('c1', 'b1'), edge('c2', 'b1')], [beamNode('b1', 6000)]);
    const map = buildBeamMaxWidthMap(g, [b, column('c1', 0, 400), column('c2', 6000, 300)]);
    expect(map.get('b1')).toBeCloseTo(300, 0);
  });

  it('κολώνες-σημεία χωρίς footprint → καμία cap (depth-only)', () => {
    const b = beam('b1', 6000);
    const g = graphOf([edge('c1', 'b1'), edge('c2', 'b1')], [beamNode('b1', 6000)]);
    const map = buildBeamMaxWidthMap(g, [b, pointColumn('c1', 0), pointColumn('c2', 6000)]);
    expect(map.has('b1')).toBe(false);
  });

  it('χαρτογραφεί μόνο δοκάρια του graph (όχι τις κολώνες)', () => {
    const b = beam('b1', 6000);
    const g = graphOf([edge('c1', 'b1')], [beamNode('b1', 6000)]);
    const map = buildBeamMaxWidthMap(g, [b, column('c1', 0, 400)]);
    expect(map.has('c1')).toBe(false);
    expect(map.has('b1')).toBe(true);
  });
});
