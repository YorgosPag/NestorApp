/**
 * ADR-652 M6 — CreateBlockFromSelectionCommand tests (undoable «Δημιουργία Block»).
 * Mirrors CreateGroupCommand.test using the shared mock scene manager: N entities → 1 block
 * instance, members removed, undo restores, redo reuses the SAME container id (stable).
 */

import { CreateBlockFromSelectionCommand } from '../CreateBlockFromSelectionCommand';
import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const mkLine = (id: string, x = 0): SceneEntity =>
  ({
    id,
    type: 'line',
    layerId: 'lyr_test',
    visible: true,
    start: { x, y: 0 },
    end: { x: x + 1, y: 0 },
  }) as unknown as SceneEntity;

const mkScene = (initial: SceneEntity[]) => {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
};

describe('ADR-652 M6 — CreateBlockFromSelectionCommand', () => {
  it('execute: 2 lines → 1 block instance, members removed', () => {
    const { scene, sm } = mkScene([mkLine('l1', 10), mkLine('l2', 15)]);
    const cmd = new CreateBlockFromSelectionCommand(['l1', 'l2'], 'Sofa', sm);
    cmd.execute();

    expect(scene.has('l1')).toBe(false);
    expect(scene.has('l2')).toBe(false);
    expect(scene.size).toBe(1);

    const [block] = [...scene.values()];
    expect(block.type).toBe('block');
    expect((block as { name?: string }).name).toBe('Sofa');
    expect(cmd.getCreatedEntityId()).toBe(block.id);
  });

  it('exposes the created def (baked to origin) for registry + library save', () => {
    const { sm } = mkScene([mkLine('l1', 10), mkLine('l2', 15)]);
    const cmd = new CreateBlockFromSelectionCommand(['l1', 'l2'], 'Sofa', sm);
    cmd.execute();

    const def = cmd.getCreatedDef();
    expect(def).not.toBeNull();
    expect(def!.name).toBe('Sofa');
    // base = min corner {10,0} → baked members start at origin.
    expect(def!.boundsMm!.minX).toBeCloseTo(0);
    expect(def!.boundsMm!.minY).toBeCloseTo(0);
  });

  it('places the instance at the selection base point (min corner)', () => {
    const { scene, sm } = mkScene([mkLine('l1', 10), mkLine('l2', 15)]);
    new CreateBlockFromSelectionCommand(['l1', 'l2'], 'Sofa', sm).execute();
    const [block] = [...scene.values()];
    expect((block as { position?: { x: number; y: number } }).position).toEqual({ x: 10, y: 0 });
  });

  it('single entity is allowed (AutoCAD BLOCK of 1 object)', () => {
    const { scene, sm } = mkScene([mkLine('l1', 3)]);
    const cmd = new CreateBlockFromSelectionCommand(['l1'], 'Solo', sm);
    expect(cmd.validate()).toBeNull();
    cmd.execute();
    expect(scene.size).toBe(1);
    expect([...scene.values()][0].type).toBe('block');
  });

  it('undo restores the members and removes the instance', () => {
    const { scene, sm } = mkScene([mkLine('l1', 10), mkLine('l2', 15)]);
    const cmd = new CreateBlockFromSelectionCommand(['l1', 'l2'], 'Sofa', sm);
    cmd.execute();
    cmd.undo();

    expect(scene.has('l1')).toBe(true);
    expect(scene.has('l2')).toBe(true);
    expect(scene.size).toBe(2);
  });

  it('redo re-creates after undo, re-adding the SAME container id (stable)', () => {
    const { scene, sm } = mkScene([mkLine('l1', 10), mkLine('l2', 15)]);
    const cmd = new CreateBlockFromSelectionCommand(['l1', 'l2'], 'Sofa', sm);
    cmd.execute();
    const idAfterExecute = cmd.getCreatedEntityId();
    cmd.undo();
    cmd.redo();

    expect(scene.size).toBe(1);
    expect(cmd.getCreatedEntityId()).toBe(idAfterExecute);
    expect(scene.has(idAfterExecute as string)).toBe(true);
  });

  it('validate rejects an empty selection or a blank name', () => {
    const { sm } = mkScene([mkLine('l1')]);
    expect(new CreateBlockFromSelectionCommand([], 'X', sm).validate()).not.toBeNull();
    expect(new CreateBlockFromSelectionCommand(['l1'], '  ', sm).validate()).not.toBeNull();
  });
});
