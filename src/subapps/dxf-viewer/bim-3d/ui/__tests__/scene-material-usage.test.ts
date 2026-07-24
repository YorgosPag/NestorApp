/**
 * scene-material-usage — ADR-687 Φ8 unit tests. Pure collector (no React/three). Καλύπτει: solids
 * faceAppearance (base + per-face), σκάλα (whole + perTread/Riser/Landing/Waist), κάγκελο (whole +
 * componentAppearance), dedup, null level, empty.
 */
import type { SceneModel } from '../../../types/scene';
import { collectSceneAppearanceRefs } from '../scene-material-usage';

// Minimal scene builder — ο collector διαβάζει μόνο type/faceAppearance/params.
function scene(entities: unknown[]): SceneModel {
  return { entities } as unknown as SceneModel;
}
function record(map: Record<string, SceneModel | null>): Record<string, SceneModel | null> {
  return map;
}

describe('collectSceneAppearanceRefs', () => {
  it('returns empty sets for an empty record', () => {
    const refs = collectSceneAppearanceRefs({});
    expect(refs.materialIds.size).toBe(0);
    expect(refs.colorHexes.size).toBe(0);
  });

  it('collects a solid entity faceAppearance (base + per-face)', () => {
    const refs = collectSceneAppearanceRefs(
      record({
        L1: scene([
          { id: 'w1', type: 'wall', faceAppearance: { '*': { materialId: 'mat-brick' }, 'side:0': { colorHex: '#123456' } } },
          { id: 'l1', type: 'line' },
        ]),
      }),
    );
    expect([...refs.materialIds]).toEqual(['mat-brick']);
    expect([...refs.colorHexes]).toEqual(['#123456']);
  });

  it('collects stair whole + per-sub-element overrides', () => {
    const refs = collectSceneAppearanceRefs(
      record({
        L1: scene([
          {
            id: 's1',
            type: 'stair',
            params: {
              materials: { appearance: { materialId: 'bmat_x' } },
              perTreadOverrides: { 0: { appearance: { materialId: 'mat-wood' } } },
              perRiserOverrides: {},
              perLandingOverrides: { 2: { appearance: { colorHex: '#abcdef' } } },
              perWaistOverrides: {},
            },
          },
        ]),
      }),
    );
    expect(refs.materialIds).toEqual(new Set(['bmat_x', 'mat-wood']));
    expect(refs.colorHexes).toEqual(new Set(['#abcdef']));
  });

  it('collects railing whole + component appearances', () => {
    const refs = collectSceneAppearanceRefs(
      record({
        L1: scene([
          {
            id: 'r1',
            type: 'railing',
            params: {
              appearance: { materialId: 'mat-metal' },
              componentAppearance: { post: { materialId: 'bmat_y' }, rail: { colorHex: '#0f0f0f' } },
            },
          },
        ]),
      }),
    );
    expect(refs.materialIds).toEqual(new Set(['mat-metal', 'bmat_y']));
    expect(refs.colorHexes).toEqual(new Set(['#0f0f0f']));
  });

  it('dedups across levels and skips null level scenes', () => {
    const refs = collectSceneAppearanceRefs(
      record({
        L1: scene([{ id: 'w1', type: 'wall', faceAppearance: { '*': { materialId: 'mat-brick' } } }]),
        L2: scene([{ id: 'w2', type: 'wall', faceAppearance: { '*': { materialId: 'mat-brick' } } }]),
        L3: null,
      }),
    );
    expect([...refs.materialIds]).toEqual(['mat-brick']);
  });
});
