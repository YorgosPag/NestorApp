/**
 * ADR-504 Φ2 S6 — `buildAddIntermediateColumnsCommand`: atomic opt-in action.
 *
 * Επαληθεύει: happy-path (2 στηρίζουσες κολώνες → CompoundCommand με K κολώνες που
 * κλωνοποιούν τη διατομή)· null guards (κενή σκηνή / count≤0 / καμία στηρίζουσα). Ο
 * γράφος χτίζεται one-shot από τον SSoT `buildStructuralGraph` (όχι reactive).
 */

import { buildAddIntermediateColumnsCommand } from '../add-intermediate-columns-command';
import { completeColumnFromClick } from '../../../hooks/drawing/column-completion';
import { buildStructuralGraph } from '../../structural/organism/structural-graph';
import { beamSupportColumnIds } from '../../structural/loads/load-path-walk';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity } from '../../types/column-types';
import type { SceneModel } from '../../../types/scene';

const LAYER = 'level-1';

function columnAt(xMm: number): ColumnEntity {
  const r = completeColumnFromClick({ x: xMm, y: 0 }, LAYER, 'rectangular', {
    width: 400, depth: 400, height: 3000,
  }, 'mm');
  if (!r.ok) throw new Error(r.hardErrors.join(', '));
  return r.entity;
}

function beamEntity(lengthMm: number): BeamEntity {
  return {
    id: 'b1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', width: 250, depth: 1450, sceneUnits: 'mm',
      startPoint: { x: 0, y: 0 }, endPoint: { x: lengthMm, y: 0 },
      supportType: 'simple',
    },
    geometry: { length: lengthMm / 1000, volume: 1 },
  } as unknown as BeamEntity;
}

function sceneOf(entities: Entity[]): SceneModel {
  return { entities } as unknown as SceneModel;
}

function depsFor(scene: SceneModel): Parameters<typeof buildAddIntermediateColumnsCommand>[2] {
  return {
    getLevelScene: () => scene,
    setLevelScene: () => {},
    levelId: LAYER,
    sceneUnits: 'mm',
  };
}

describe('buildAddIntermediateColumnsCommand — happy path', () => {
  const beam = beamEntity(16000);
  const entities: Entity[] = [columnAt(0) as Entity, columnAt(16000) as Entity, beam as unknown as Entity];

  it('precondition: ο graph αναγνωρίζει τις 2 κολώνες ως στηρίξεις', () => {
    const ids = beamSupportColumnIds(buildStructuralGraph(entities), 'b1');
    expect(ids.length).toBeGreaterThanOrEqual(2);
  });

  it('K=3 → CompoundCommand με 3 κολώνες (clone διατομής 400×400)', () => {
    const result = buildAddIntermediateColumnsCommand(beam, 3, depsFor(sceneOf(entities)));
    expect(result).not.toBeNull();
    expect(result!.columns).toHaveLength(3);
    expect(result!.command.size()).toBe(1); // ΕΝΑ CreateColumnsCommand → ΕΝΑ undo
    for (const c of result!.columns) {
      expect(c.params.width).toBe(400);
      expect(c.params.depth).toBe(400);
    }
    expect(result!.columns.map((c) => c.params.position.x)).toEqual([4000, 8000, 12000]);
  });

  it('fresh μοναδικά IDs, μηδέν collision με τις στηρίζουσες', () => {
    const result = buildAddIntermediateColumnsCommand(beam, 2, depsFor(sceneOf(entities)));
    const ids = result!.columns.map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).not.toContain(entities[0].id);
  });
});

describe('buildAddIntermediateColumnsCommand — null guards', () => {
  it('count ≤ 0 → null', () => {
    const beam = beamEntity(16000);
    const scene = sceneOf([columnAt(0) as Entity, columnAt(16000) as Entity, beam as unknown as Entity]);
    expect(buildAddIntermediateColumnsCommand(beam, 0, depsFor(scene))).toBeNull();
  });

  it('καμία στηρίζουσα κολώνα → null (μηδέν no-op command)', () => {
    const beam = beamEntity(16000);
    expect(buildAddIntermediateColumnsCommand(beam, 2, depsFor(sceneOf([beam as unknown as Entity])))).toBeNull();
  });
});
