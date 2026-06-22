/**
 * ADR-507 Φ5 A3 — `UpdateHatchOriginCommand` tests.
 *
 * Patches `patternOrigin` (gradient seed) on a hatch· merge/undo/redo skeleton
 * inherited από `MergeableUpdateCommand` (γενικά tested στο MergeableUpdateCommand.test).
 * Εδώ: execute/undo/redo round-trip του patternOrigin + validate + drag-merge.
 */

import { UpdateHatchOriginCommand } from '../UpdateHatchOriginCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { Point2D } from '../../../../rendering/types/Types';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...(updates as SceneEntity) });
    },
    updateEntities: (updates) => {
      updates.forEach((partial, id) => {
        const e = scene.get(id);
        if (e) scene.set(id, { ...e, ...(partial as SceneEntity) });
      });
    },
    getVertices: () => undefined,
    insertVertex: () => {},
    removeVertex: () => {},
    updateVertex: () => {},
    getEntityIndex: () => -1,
    reorderEntity: () => {},
    moveEntityToIndex: () => {},
  };
  return { scene, sm };
}

function makeGradientHatch(origin?: Point2D): SceneEntity {
  return {
    id: 'h1',
    type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]],
    fillType: 'gradient',
    gradient: { type: 'linear', color1: '#2980b9', color2: '#ffffff' },
    ...(origin && { patternOrigin: origin }),
  } as unknown as SceneEntity;
}

const PREV: Point2D = { x: 500, y: 500 };
const NEXT: Point2D = { x: 750, y: 300 };

describe('UpdateHatchOriginCommand', () => {
  it('execute patches patternOrigin', () => {
    const { scene, sm } = makeMockScene([makeGradientHatch(PREV)]);
    const cmd = new UpdateHatchOriginCommand('h1', NEXT, PREV, sm);
    cmd.execute();
    expect((scene.get('h1') as unknown as { patternOrigin: Point2D }).patternOrigin).toEqual(NEXT);
  });

  it('undo restores the previous origin, redo re-applies', () => {
    const { scene, sm } = makeMockScene([makeGradientHatch(PREV)]);
    const cmd = new UpdateHatchOriginCommand('h1', NEXT, PREV, sm);
    cmd.execute();
    cmd.undo();
    expect((scene.get('h1') as unknown as { patternOrigin: Point2D }).patternOrigin).toEqual(PREV);
    cmd.redo();
    expect((scene.get('h1') as unknown as { patternOrigin: Point2D }).patternOrigin).toEqual(NEXT);
  });

  it('validate rejects empty id + non-finite point', () => {
    const { sm } = makeMockScene([makeGradientHatch(PREV)]);
    expect(new UpdateHatchOriginCommand('', NEXT, PREV, sm).validate()).not.toBeNull();
    expect(new UpdateHatchOriginCommand('h1', { x: NaN, y: 0 }, PREV, sm).validate()).not.toBeNull();
    expect(new UpdateHatchOriginCommand('h1', NEXT, PREV, sm).validate()).toBeNull();
  });

  it('drag samples on the same hatch merge (one undo entry)', () => {
    const { sm } = makeMockScene([makeGradientHatch(PREV)]);
    const a = new UpdateHatchOriginCommand('h1', NEXT, PREV, sm, true);
    const b = new UpdateHatchOriginCommand('h1', { x: 800, y: 200 }, NEXT, sm, true);
    expect(a.canMergeWith(b)).toBe(true);
  });
});
