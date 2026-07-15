/**
 * ADR-449 PART B Slice C — SetFinishFaceOverrideCommand: apply / undo / redo / clear /
 * no-op (χωρίς finish / οριζόντια όψη) / validate.
 *
 * Γράφει `params.finish.faceOverrides[ref]` όπου `ref = finishFaceRef` της ακμής `side:i`
 * του stored footprint (ίδιο key με το `pushFinishOverrideEdges` της σιλουέτας).
 */

import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';
import { SetFinishFaceOverrideCommand } from '../SetFinishFaceOverrideCommand';
import { finishFaceRef } from '../../../../bim/finishes/structural-finish-face-ref';
import type { StructuralFinishSpec } from '../../../../bim/finishes/structural-finish-types';

const SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

const VERTS = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];
const REF0 = finishFaceRef(VERTS[0], VERTS[1]); // ακμή side:0

/** Column-like entity με finish spec + footprint. */
function seed(finish?: StructuralFinishSpec): SceneEntity {
  return {
    id: 'col-1',
    params: { finish },
    geometry: { footprint: { vertices: VERTS } },
  } as unknown as SceneEntity;
}

function specOf(sm: ReturnType<typeof createMockSceneManager>): StructuralFinishSpec | undefined {
  return (sm.store.get('col-1') as unknown as { params?: { finish?: StructuralFinishSpec } } | undefined)?.params?.finish;
}

describe('SetFinishFaceOverrideCommand', () => {
  it('βάφει την όψη side:0 → faceOverrides[ref] (colorOverride)', () => {
    const sm = createMockSceneManager([seed(SPEC)]);
    new SetFinishFaceOverrideCommand('col-1', 'side:0', { colorOverride: '#c0d8b0' }, sm).execute();
    expect(specOf(sm)?.faceOverrides).toEqual({ [REF0]: { colorOverride: '#c0d8b0' } });
  });

  it('undo → επαναφορά (αφαιρεί το override)', () => {
    const sm = createMockSceneManager([seed(SPEC)]);
    const cmd = new SetFinishFaceOverrideCommand('col-1', 'side:0', { materialId: 'mat-gypsum-board' }, sm);
    cmd.execute();
    cmd.undo();
    expect(specOf(sm)?.faceOverrides).toBeUndefined(); // επαναφορά ΑΚΡΙΒΩΣ στο prev spec (χωρίς overrides)
  });

  it('redo → ξανα-εφαρμογή', () => {
    const sm = createMockSceneManager([seed(SPEC)]);
    const cmd = new SetFinishFaceOverrideCommand('col-1', 'side:0', { materialId: 'mat-gypsum-board' }, sm);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(specOf(sm)?.faceOverrides).toEqual({ [REF0]: { materialId: 'mat-gypsum-board' } });
  });

  it('null value → clear της όψης', () => {
    const sm = createMockSceneManager([seed({ ...SPEC, faceOverrides: { [REF0]: { materialId: 'x' } } })]);
    new SetFinishFaceOverrideCommand('col-1', 'side:0', null, sm).execute();
    expect(specOf(sm)?.faceOverrides).toEqual({});
  });

  it('no-op όταν το στοιχείο δεν έχει ενεργό σοβά (undefined finish)', () => {
    const sm = createMockSceneManager([seed(undefined)]);
    new SetFinishFaceOverrideCommand('col-1', 'side:0', { colorOverride: '#fff' }, sm).execute();
    expect(specOf(sm)).toBeUndefined(); // αμετάβλητο (κανένας σοβάς να βαφτεί)
  });

  it('no-op σε οριζόντια όψη (top) — όχι κάθετη όψη σοβά', () => {
    const sm = createMockSceneManager([seed(SPEC)]);
    new SetFinishFaceOverrideCommand('col-1', 'top', { colorOverride: '#fff' }, sm).execute();
    expect(specOf(sm)?.faceOverrides).toBeUndefined();
  });

  it('validate: entityId + faceKey required', () => {
    const sm = createMockSceneManager([seed(SPEC)]);
    expect(new SetFinishFaceOverrideCommand('', 'side:0', null, sm).validate()).not.toBeNull();
    expect(new SetFinishFaceOverrideCommand('col-1', '', null, sm).validate()).not.toBeNull();
    expect(new SetFinishFaceOverrideCommand('col-1', 'side:0', null, sm).validate()).toBeNull();
  });

  it('δεν κάνει merge (κάθε βαφή = δικό της undo step)', () => {
    const sm = createMockSceneManager([seed(SPEC)]);
    const cmd = new SetFinishFaceOverrideCommand('col-1', 'side:0', null, sm);
    expect(cmd.canMergeWith(cmd)).toBe(false);
  });
});
