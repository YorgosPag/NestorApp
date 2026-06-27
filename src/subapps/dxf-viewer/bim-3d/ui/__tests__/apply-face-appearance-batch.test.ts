/**
 * ADR-539 Φ4b — applyFaceAppearanceToFaces: paint N faces with ONE atomic undo.
 *
 * The CRITICAL guarantee of Φ4b: a single swatch click / paste paints every selected face,
 * and ONE Ctrl+Z reverts them all together — including CROSS-ENTITY (faces on different
 * solids) and SAME-ENTITY (two faces of one solid). Drives the real wiring through a
 * stateless level-scene adapter over a mutable scene (mirror the production read-after-write).
 */

import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import type { SceneModel } from '../../../types/scene';
import type { FaceAppearanceMap } from '../../../bim/types/face-appearance-types';
import { getGlobalCommandHistory, resetGlobalCommandHistory } from '../../../core/commands';
import { applyFaceAppearanceToFaces } from '../apply-face-appearance';

type FacedEntity = { id: string; faceAppearance?: FaceAppearanceMap };

/** A LevelsHookReturn over a mutable scene: setLevelScene synchronously replaces it. */
function makeLevels(entities: readonly FacedEntity[]) {
  let scene = { entities: entities.map((e) => ({ ...e })) } as unknown as SceneModel;
  const levels = {
    currentLevelId: 'lvl-1',
    getLevelScene: (id: string) => (id === 'lvl-1' ? scene : null),
    setLevelScene: (id: string, next: SceneModel) => { if (id === 'lvl-1') scene = next; },
  } as unknown as LevelsHookReturn;
  const faceMap = (id: string): FaceAppearanceMap | undefined =>
    (scene.entities.find((e) => e.id === id) as unknown as FacedEntity | undefined)?.faceAppearance;
  return { levels, faceMap };
}

beforeEach(() => resetGlobalCommandHistory());

describe('applyFaceAppearanceToFaces — batch = one undo', () => {
  it('paints a cross-entity face set and reverts all with ONE undo', () => {
    const { levels, faceMap } = makeLevels([{ id: 'col-1' }, { id: 'col-2' }]);
    applyFaceAppearanceToFaces(levels, [
      { bimId: 'col-1', faceKey: 'top' },
      { bimId: 'col-2', faceKey: 'top' },
    ], { materialId: 'paint-red' });

    expect(faceMap('col-1')).toEqual({ top: { materialId: 'paint-red' } });
    expect(faceMap('col-2')).toEqual({ top: { materialId: 'paint-red' } });
    expect(getGlobalCommandHistory().size()).toBe(1); // ONE undo step for the whole batch

    getGlobalCommandHistory().undo();
    expect(faceMap('col-1')).toBeUndefined();
    expect(faceMap('col-2')).toBeUndefined();
  });

  it('paints two faces of the SAME entity and reverts both with ONE undo', () => {
    const { levels, faceMap } = makeLevels([{ id: 'col-1' }]);
    applyFaceAppearanceToFaces(levels, [
      { bimId: 'col-1', faceKey: 'top' },
      { bimId: 'col-1', faceKey: 'bottom' },
    ], { colorHex: '#27AE60' });

    expect(faceMap('col-1')).toEqual({
      top: { colorHex: '#27AE60' },
      bottom: { colorHex: '#27AE60' },
    });
    expect(getGlobalCommandHistory().size()).toBe(1);

    getGlobalCommandHistory().undo();
    expect(faceMap('col-1')).toBeUndefined();
  });

  it('redo re-applies the whole batch after undo', () => {
    const { levels, faceMap } = makeLevels([{ id: 'col-1' }, { id: 'col-2' }]);
    applyFaceAppearanceToFaces(levels, [
      { bimId: 'col-1', faceKey: 'top' },
      { bimId: 'col-2', faceKey: 'side:1' },
    ], { materialId: 'paint-blue' });
    getGlobalCommandHistory().undo();
    getGlobalCommandHistory().redo();

    expect(faceMap('col-1')).toEqual({ top: { materialId: 'paint-blue' } });
    expect(faceMap('col-2')).toEqual({ 'side:1': { materialId: 'paint-blue' } });
  });

  it('clears (value=null) the selected faces, preserving siblings, in one undo', () => {
    const { levels, faceMap } = makeLevels([
      { id: 'col-1', faceAppearance: { top: { materialId: 'paint-red' }, bottom: { colorHex: '#000' } } },
    ]);
    applyFaceAppearanceToFaces(levels, [{ bimId: 'col-1', faceKey: 'top' }], null);
    expect(faceMap('col-1')).toEqual({ bottom: { colorHex: '#000' } });

    getGlobalCommandHistory().undo();
    expect(faceMap('col-1')).toEqual({
      top: { materialId: 'paint-red' }, bottom: { colorHex: '#000' },
    });
  });

  it('a single-face batch is one plain command (no composite overhead)', () => {
    const { levels, faceMap } = makeLevels([{ id: 'col-1' }]);
    applyFaceAppearanceToFaces(levels, [{ bimId: 'col-1', faceKey: 'top' }], { materialId: 'paint-red' });
    expect(faceMap('col-1')).toEqual({ top: { materialId: 'paint-red' } });
    expect(getGlobalCommandHistory().size()).toBe(1);
  });

  it('no-op on empty face set or missing level (no command pushed)', () => {
    const { levels } = makeLevels([{ id: 'col-1' }]);
    applyFaceAppearanceToFaces(levels, [], { materialId: 'paint-red' });
    applyFaceAppearanceToFaces(null, [{ bimId: 'col-1', faceKey: 'top' }], { materialId: 'paint-red' });
    expect(getGlobalCommandHistory().size()).toBe(0);
  });
});
