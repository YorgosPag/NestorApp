/**
 * ADR-459 Phase 2/3 — Create/Extend cross-level footing commands.
 *
 * Verifies the composition: cross-level writer (foundation level) + FK attach
 * (active column) as ONE undoable step.
 */

import { CreateColumnFootingCommand } from '../CreateColumnFootingCommand';
import { ExtendFootingToColumnCommand } from '../ExtendFootingToColumnCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { FoundationCrossLevelWriter } from '../../../../bim/foundations/foundation-cross-level-writer';
import { buildColumnEntity, buildDefaultColumnParams } from '../../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../../bim/types/column-types';
import type { FoundationEntity } from '../../../../bim/types/foundation-types';

function makeMockScene(initial: SceneEntity[] = []): { scene: Map<string, SceneEntity>; sm: ISceneManager } {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...(updates as SceneEntity) });
    },
    updateEntities: () => {},
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

function makeColumn(): ColumnEntity {
  const r = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!r.ok) throw new Error('column build failed');
  return r.entity;
}

function makeWriter(): jest.Mocked<FoundationCrossLevelWriter> {
  return { create: jest.fn(), update: jest.fn(), remove: jest.fn() };
}

const footing = (id: string) => ({ id, type: 'foundation', kind: 'pad' } as unknown as FoundationEntity);

describe('CreateColumnFootingCommand', () => {
  it('creates the footing cross-level and sets the column FK; undo reverts both', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const writer = makeWriter();
    const f = footing('F1');
    const cmd = new CreateColumnFootingCommand(f, col.id, writer, sm);

    cmd.execute();
    expect(writer.create).toHaveBeenCalledWith(f);
    expect((scene.get(col.id) as unknown as ColumnEntity).params.footingId).toBe('F1');

    cmd.undo();
    expect(writer.remove).toHaveBeenCalledWith('F1');
    expect((scene.get(col.id) as unknown as ColumnEntity).params.footingId).toBeUndefined();

    cmd.redo();
    expect(writer.create).toHaveBeenCalledTimes(2);
    expect((scene.get(col.id) as unknown as ColumnEntity).params.footingId).toBe('F1');
  });

  it('validates + serializes', () => {
    const col = makeColumn();
    const { sm } = makeMockScene([col as unknown as SceneEntity]);
    const cmd = new CreateColumnFootingCommand(footing('F1'), col.id, makeWriter(), sm);
    expect(cmd.validate()).toBeNull();
    expect(cmd.getAffectedEntityIds()).toEqual(['F1', col.id]);
    expect(cmd.serialize().type).toBe('create-column-footing');
  });
});

describe('ExtendFootingToColumnCommand', () => {
  it('updates the footing to the grown params and attaches the 2nd column; undo restores prev', () => {
    const col = makeColumn();
    const { scene, sm } = makeMockScene([col as unknown as SceneEntity]);
    const writer = makeWriter();
    const prev = footing('F1');
    const next = footing('F1');
    const cmd = new ExtendFootingToColumnCommand(prev, next, col.id, writer, sm);

    cmd.execute();
    expect(writer.update).toHaveBeenLastCalledWith(next);
    expect((scene.get(col.id) as unknown as ColumnEntity).params.footingId).toBe('F1');

    cmd.undo();
    expect(writer.update).toHaveBeenLastCalledWith(prev);
    expect((scene.get(col.id) as unknown as ColumnEntity).params.footingId).toBeUndefined();
  });
});
