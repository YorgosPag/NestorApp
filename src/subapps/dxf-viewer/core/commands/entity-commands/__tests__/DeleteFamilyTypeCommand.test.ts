/**
 * ADR-412 Φ5 / ADR-604 — `createDeleteFamilyTypeCommand` (generic) tests.
 *
 * The generic replaces the former per-entity `DeleteWallFamilyTypeCommand` (and
 * its slab/roof twins). Exercised here with a wall instance detach:
 * forward = detach instances (typeId → undefined, params kept) THEN remove the
 * type from the catalog; undo (reverse) = restore the type FIRST then re-attach
 * the instances. Audit + persist side effects fire on both directions. The label
 * arg (`'DeleteWallFamilyType'`) names the compound for the history.
 * `CatalogDeleteOp` is exercised through the compound so child ordering is covered.
 */

import {
  createDeleteFamilyTypeCommand,
  CatalogDeleteOp,
  type FamilyTypeDeleteDeps,
} from '../DeleteFamilyTypeCommand';
import { AssignWallTypeCommand, type WallTypeAssignment } from '../AssignWallTypeCommand';
import type { SceneEntity } from '../../interfaces';
import { completeWallFromTwoClicks } from '../../../../hooks/drawing/wall-completion';
import type { WallEntity, WallParams } from '../../../../bim/types/wall-types';
import type { BimFamilyType } from '../../../../bim/types/bim-family-type';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

const TYPE_ID = 'bimftype-wall-1';
const LABEL = 'DeleteWallFamilyType';

function makeType(): BimFamilyType<'wall'> {
  return {
    id: TYPE_ID,
    category: 'wall',
    name: 'Interior 100',
    scope: 'company',
    origin: 'user',
    typeParams: { category: 'interior', thickness: 100 },
    companyId: 'co-1',
    ownerId: 'u-1',
  };
}

function makeMockScene(initial: SceneEntity[]): { scene: Map<string, SceneEntity>; sm: ReturnType<typeof createMockSceneManager> } {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

function makeTypedWall(): WallEntity {
  const r = completeWallFromTwoClicks({ x: 0, y: 0 }, { x: 4000, y: 0 }, '0');
  if (!r.ok) throw new Error('wall build failed');
  return { ...r.entity, typeId: TYPE_ID } as WallEntity;
}

function detachAssignment(params: WallParams): { next: WallTypeAssignment; previous: WallTypeAssignment } {
  return {
    next: { typeId: undefined, typeOverrides: undefined, params },
    previous: { typeId: TYPE_ID, typeOverrides: undefined, params },
  };
}

interface Harness {
  catalog: BimFamilyType[];
  deps: FamilyTypeDeleteDeps;
  removeCount: number;
  restoreCount: number;
  auditDeleted: number;
  auditRestored: number;
}

function makeDeps(initial: BimFamilyType[]): Harness {
  const h = {
    catalog: [...initial],
    removeCount: 0, restoreCount: 0, auditDeleted: 0, auditRestored: 0,
    deps: {} as FamilyTypeDeleteDeps,
  } as Harness;
  h.deps = {
    getTypes: () => h.catalog,
    setTypes: (types) => { h.catalog = [...types]; },
    removePersist: () => { h.removeCount += 1; },
    restorePersist: () => { h.restoreCount += 1; },
    auditDeleted: () => { h.auditDeleted += 1; },
    auditRestored: () => { h.auditRestored += 1; },
  };
  return h;
}

describe('createDeleteFamilyTypeCommand (ADR-604 generic, wall payload)', () => {
  it('1. execute: detaches the instance AND removes the type from the catalog', () => {
    const type = makeType() as BimFamilyType;
    const wall = makeTypedWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const { next, previous } = detachAssignment(wall.params);
    const h = makeDeps([type]);

    const cmd = createDeleteFamilyTypeCommand(
      LABEL,
      type,
      [new AssignWallTypeCommand(wall.id, next, previous, sm, wall.kind)],
      h.deps,
    );
    cmd.execute();

    expect((scene.get(wall.id) as unknown as WallEntity).typeId).toBeUndefined();
    expect(h.catalog.find((t) => t.id === TYPE_ID)).toBeUndefined();
    expect(h.removeCount).toBe(1);
    expect(h.auditDeleted).toBe(1);
  });

  it('2. undo: restores the type and re-attaches the instance', () => {
    const type = makeType() as BimFamilyType;
    const wall = makeTypedWall();
    const { scene, sm } = makeMockScene([wall as unknown as SceneEntity]);
    const { next, previous } = detachAssignment(wall.params);
    const h = makeDeps([type]);

    const cmd = createDeleteFamilyTypeCommand(
      LABEL,
      type,
      [new AssignWallTypeCommand(wall.id, next, previous, sm, wall.kind)],
      h.deps,
    );
    cmd.execute();
    cmd.undo();

    expect((scene.get(wall.id) as unknown as WallEntity).typeId).toBe(TYPE_ID);
    expect(h.catalog.find((t) => t.id === TYPE_ID)).toBeDefined();
    expect(h.restoreCount).toBe(1);
    expect(h.auditRestored).toBe(1);
  });

  it('3. delete of an UNUSED type (no instances) still removes it', () => {
    const type = makeType() as BimFamilyType;
    const h = makeDeps([type]);
    const cmd = createDeleteFamilyTypeCommand(LABEL, type, [], h.deps);
    cmd.execute();
    expect(h.catalog).toHaveLength(0);
    expect(h.removeCount).toBe(1);
  });

  it('4. CatalogDeleteOp.undo does not duplicate an already-present snapshot', () => {
    const type = makeType() as BimFamilyType;
    const h = makeDeps([type]); // type still present
    const op = new CatalogDeleteOp(type, h.deps);
    op.undo();
    expect(h.catalog.filter((t) => t.id === TYPE_ID)).toHaveLength(1);
  });

  it('5. compound serialize round-trips type + affects no entities at catalog level', () => {
    const type = makeType() as BimFamilyType;
    const h = makeDeps([type]);
    const op = new CatalogDeleteOp(type, h.deps);
    const s = op.serialize();
    expect(s.type).toBe('catalog-delete-family-type');
    expect(op.getAffectedEntityIds()).toEqual([]);
  });
});
