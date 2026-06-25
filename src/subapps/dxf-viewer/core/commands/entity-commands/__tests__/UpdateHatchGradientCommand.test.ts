/**
 * ADR-507 Φ5 A4 — `UpdateHatchGradientCommand` tests.
 *
 * Patches το nested `gradient` (π.χ. `angleDeg` από το gradient-angle grip)· merge/
 * undo/redo skeleton inherited από `MergeableUpdateCommand`. Εδώ: execute/undo/redo
 * round-trip του gradient + validate + drag-merge.
 */

import { UpdateHatchGradientCommand } from '../UpdateHatchGradientCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { HatchGradient } from '../../../../bim/hatch/hatch-gradient';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

const PREV: HatchGradient = { type: 'linear', color1: '#2980b9', color2: '#ffffff' };
const NEXT: HatchGradient = { type: 'linear', color1: '#2980b9', color2: '#ffffff', angleDeg: 45 };

function makeGradientHatch(): SceneEntity {
  return {
    id: 'h1',
    type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }]],
    fillType: 'gradient',
    gradient: PREV,
  } as unknown as SceneEntity;
}

function readGradient(scene: Map<string, SceneEntity>): HatchGradient {
  return (scene.get('h1') as unknown as { gradient: HatchGradient }).gradient;
}

describe('UpdateHatchGradientCommand', () => {
  it('execute patches the gradient (new angleDeg)', () => {
    const { scene, sm } = makeMockScene([makeGradientHatch()]);
    new UpdateHatchGradientCommand('h1', NEXT, PREV, sm).execute();
    expect(readGradient(scene).angleDeg).toBe(45);
  });

  it('undo restores the previous gradient, redo re-applies', () => {
    const { scene, sm } = makeMockScene([makeGradientHatch()]);
    const cmd = new UpdateHatchGradientCommand('h1', NEXT, PREV, sm);
    cmd.execute();
    cmd.undo();
    expect(readGradient(scene).angleDeg).toBeUndefined();
    cmd.redo();
    expect(readGradient(scene).angleDeg).toBe(45);
  });

  it('validate rejects empty id + non-finite angle', () => {
    const { sm } = makeMockScene([makeGradientHatch()]);
    expect(new UpdateHatchGradientCommand('', NEXT, PREV, sm).validate()).not.toBeNull();
    expect(new UpdateHatchGradientCommand(
      'h1', { ...NEXT, angleDeg: Number.NaN }, PREV, sm,
    ).validate()).not.toBeNull();
    expect(new UpdateHatchGradientCommand('h1', NEXT, PREV, sm).validate()).toBeNull();
  });

  it('drag samples on the same hatch merge (one undo entry)', () => {
    const { sm } = makeMockScene([makeGradientHatch()]);
    const a = new UpdateHatchGradientCommand('h1', NEXT, PREV, sm, true);
    const b = new UpdateHatchGradientCommand('h1', { ...NEXT, angleDeg: 90 }, NEXT, sm, true);
    expect(a.canMergeWith(b)).toBe(true);
  });
});
