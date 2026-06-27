/**
 * ADR-539 Φ4a — read-face-appearance SSoT (read counterpart of applyFaceAppearance).
 * Reads per-face / whole-map appearance from the live level scene via a fake LevelsHookReturn.
 */

import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import type { SceneModel } from '../../../types/scene';
import type { FaceAppearanceMap } from '../../../bim/types/face-appearance-types';
import { readFaceAppearance, readEntityFaceAppearanceMap } from '../read-face-appearance';

function fakeLevels(opts: {
  currentLevelId: string | null;
  entities?: ReadonlyArray<{ id: string; faceAppearance?: FaceAppearanceMap }>;
}): LevelsHookReturn {
  const scene = { entities: opts.entities ?? [] } as unknown as SceneModel;
  return {
    currentLevelId: opts.currentLevelId,
    getLevelScene: (id: string) => (id === opts.currentLevelId ? scene : null),
  } as unknown as LevelsHookReturn;
}

describe('readEntityFaceAppearanceMap', () => {
  it('returns the entity face-appearance map', () => {
    const map = { top: { materialId: 'paint-red' }, bottom: { colorHex: '#000' } };
    const levels = fakeLevels({ currentLevelId: 'lvl-1', entities: [{ id: 'col-1', faceAppearance: map }] });
    expect(readEntityFaceAppearanceMap(levels, 'col-1')).toEqual(map);
  });

  it('returns null for an unpainted entity (no faceAppearance)', () => {
    const levels = fakeLevels({ currentLevelId: 'lvl-1', entities: [{ id: 'col-1' }] });
    expect(readEntityFaceAppearanceMap(levels, 'col-1')).toBeNull();
  });

  it('returns null when there is no current level', () => {
    const levels = fakeLevels({ currentLevelId: null });
    expect(readEntityFaceAppearanceMap(levels, 'col-1')).toBeNull();
  });

  it('returns null when levels is null', () => {
    expect(readEntityFaceAppearanceMap(null, 'col-1')).toBeNull();
  });
});

describe('readFaceAppearance', () => {
  it('returns a single face appearance by key', () => {
    const levels = fakeLevels({
      currentLevelId: 'lvl-1',
      entities: [{ id: 'col-1', faceAppearance: { 'side:2': { colorHex: '#27AE60' } } }],
    });
    expect(readFaceAppearance(levels, 'col-1', 'side:2')).toEqual({ colorHex: '#27AE60' });
  });

  it('returns null for an unpainted face on a painted entity', () => {
    const levels = fakeLevels({
      currentLevelId: 'lvl-1',
      entities: [{ id: 'col-1', faceAppearance: { top: { materialId: 'paint-red' } } }],
    });
    expect(readFaceAppearance(levels, 'col-1', 'bottom')).toBeNull();
  });

  it('returns null when the entity is missing', () => {
    const levels = fakeLevels({ currentLevelId: 'lvl-1', entities: [] });
    expect(readFaceAppearance(levels, 'ghost', 'top')).toBeNull();
  });
});
