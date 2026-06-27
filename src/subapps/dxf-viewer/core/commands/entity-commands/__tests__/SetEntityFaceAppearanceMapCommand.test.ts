/**
 * ADR-539 Φ4a — SetEntityFaceAppearanceMapCommand unit tests:
 * whole-map replace / undo / redo / clear-all / clone-isolation / no-merge.
 */

import type { SceneEntity } from '../../interfaces';
import type { FaceAppearanceMap } from '../../../../bim/types/face-appearance-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';
import { SetEntityFaceAppearanceMapCommand } from '../SetEntityFaceAppearanceMapCommand';

type FacedEntity = SceneEntity & { faceAppearance?: FaceAppearanceMap };

function seed(faceAppearance?: FaceAppearanceMap): FacedEntity {
  return { id: 'slab-1', faceAppearance } as unknown as FacedEntity;
}

function faceMapOf(sm: ReturnType<typeof createMockSceneManager>): FaceAppearanceMap | undefined {
  return (sm.store.get('slab-1') as FacedEntity | undefined)?.faceAppearance;
}

describe('SetEntityFaceAppearanceMapCommand', () => {
  it('replaces the whole face-appearance map on execute (faces outside value are dropped)', () => {
    const sm = createMockSceneManager([seed({ top: { materialId: 'paint-old' }, bottom: { colorHex: '#111111' } })]);
    new SetEntityFaceAppearanceMapCommand('slab-1', { top: { materialId: 'paint-red' } }, sm).execute();
    expect(faceMapOf(sm)).toEqual({ top: { materialId: 'paint-red' } });
  });

  it('restores the previous map on undo', () => {
    const prevMap = { top: { materialId: 'paint-blue' } };
    const sm = createMockSceneManager([seed(prevMap)]);
    const cmd = new SetEntityFaceAppearanceMapCommand('slab-1', { 'side:0': { colorHex: '#27AE60' } }, sm);
    cmd.execute();
    cmd.undo();
    expect(faceMapOf(sm)).toEqual(prevMap);
  });

  it('redo re-applies the pasted map after undo', () => {
    const sm = createMockSceneManager([seed({ top: { materialId: 'paint-blue' } })]);
    const cmd = new SetEntityFaceAppearanceMapCommand('slab-1', { bottom: { colorHex: '#C0392B' } }, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(faceMapOf(sm)).toEqual({ bottom: { colorHex: '#C0392B' } });
  });

  it('clears all painted faces when value is {} (empty map = back to base look)', () => {
    const sm = createMockSceneManager([seed({ top: { materialId: 'paint-blue' }, bottom: { colorHex: '#000' } })]);
    new SetEntityFaceAppearanceMapCommand('slab-1', {}, sm).execute();
    expect(faceMapOf(sm)).toEqual({});
  });

  it('clones the value (later clipboard mutation does not leak into the entity)', () => {
    const sm = createMockSceneManager([seed()]);
    const clipboard: Record<string, { colorHex?: string }> = { top: { colorHex: '#AAAAAA' } };
    new SetEntityFaceAppearanceMapCommand('slab-1', clipboard as FaceAppearanceMap, sm).execute();
    clipboard.top.colorHex = '#FFFFFF'; // mutate the source after the paste
    expect(faceMapOf(sm)).toEqual({ top: { colorHex: '#AAAAAA' } });
  });

  it('never merges (each paste is its own undo step)', () => {
    const sm = createMockSceneManager([seed()]);
    expect(new SetEntityFaceAppearanceMapCommand('slab-1', {}, sm).canMergeWith()).toBe(false);
  });

  it('validates the entity id', () => {
    const sm = createMockSceneManager([seed()]);
    expect(new SetEntityFaceAppearanceMapCommand('', {}, sm).validate()).not.toBeNull();
    expect(new SetEntityFaceAppearanceMapCommand('slab-1', {}, sm).validate()).toBeNull();
  });
});
