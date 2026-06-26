/**
 * ADR-539 — SetFaceAppearanceCommand unit tests: apply / undo / redo / clear / no-merge.
 * Patches the base `faceAppearance` field (mirror SetComponentVisibilityCommand).
 */

import type { SceneEntity } from '../../interfaces';
import type { FaceAppearanceMap } from '../../../../bim/types/face-appearance-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';
import { SetFaceAppearanceCommand } from '../SetFaceAppearanceCommand';

type FacedEntity = SceneEntity & { faceAppearance?: FaceAppearanceMap };

function seed(faceAppearance?: FaceAppearanceMap): FacedEntity {
  return { id: 'slab-1', faceAppearance } as unknown as FacedEntity;
}

function faceMapOf(sm: ReturnType<typeof createMockSceneManager>): FaceAppearanceMap | undefined {
  return (sm.store.get('slab-1') as FacedEntity | undefined)?.faceAppearance;
}

describe('SetFaceAppearanceCommand', () => {
  it('applies a face material on execute', () => {
    const sm = createMockSceneManager([seed()]);
    new SetFaceAppearanceCommand('slab-1', 'top', { materialId: 'paint-red' }, sm).execute();
    expect(faceMapOf(sm)).toEqual({ top: { materialId: 'paint-red' } });
  });

  it('restores the previous map on undo (here: removes the only face)', () => {
    const sm = createMockSceneManager([seed()]);
    const cmd = new SetFaceAppearanceCommand('slab-1', 'top', { colorHex: '#C0392B' }, sm);
    cmd.execute();
    cmd.undo();
    expect(faceMapOf(sm)).toBeUndefined();
  });

  it('redo re-applies after undo', () => {
    const sm = createMockSceneManager([seed()]);
    const cmd = new SetFaceAppearanceCommand('slab-1', 'side:2', { colorHex: '#27AE60' }, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(faceMapOf(sm)).toEqual({ 'side:2': { colorHex: '#27AE60' } });
  });

  it('preserves other faces when painting a new one', () => {
    const sm = createMockSceneManager([seed({ top: { materialId: 'paint-blue' } })]);
    new SetFaceAppearanceCommand('slab-1', 'bottom', { materialId: 'paint-red' }, sm).execute();
    expect(faceMapOf(sm)).toEqual({
      top: { materialId: 'paint-blue' },
      bottom: { materialId: 'paint-red' },
    });
  });

  it('clears a single face when value is null (others kept)', () => {
    const sm = createMockSceneManager([seed({
      top: { materialId: 'paint-blue' },
      bottom: { materialId: 'paint-red' },
    })]);
    new SetFaceAppearanceCommand('slab-1', 'top', null, sm).execute();
    expect(faceMapOf(sm)).toEqual({ bottom: { materialId: 'paint-red' } });
  });

  it('never merges (each paint is its own undo step)', () => {
    const sm = createMockSceneManager([seed()]);
    expect(new SetFaceAppearanceCommand('slab-1', 'top', null, sm).canMergeWith()).toBe(false);
  });

  it('validates required fields', () => {
    const sm = createMockSceneManager([seed()]);
    expect(new SetFaceAppearanceCommand('', 'top', null, sm).validate()).not.toBeNull();
    expect(new SetFaceAppearanceCommand('slab-1', '', null, sm).validate()).not.toBeNull();
    expect(new SetFaceAppearanceCommand('slab-1', 'top', null, sm).validate()).toBeNull();
  });
});
