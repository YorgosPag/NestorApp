/**
 * ADR-417 §10 #3 — Roof family-type command tests (mirror of the wall command
 * tests). Covers:
 *   - `AssignRoofTypeCommand` — per-instance type-link mutation + undo/redo,
 *   - `UpdateRoofFamilyTypeCommand` — optimistic catalog edit + undo + idempotent,
 *   - `createDeleteRoofFamilyTypeCommand` — compound detach-then-delete order.
 */

import {
  AssignRoofTypeCommand,
  type RoofTypeAssignment,
} from '../AssignRoofTypeCommand';
import {
  UpdateRoofFamilyTypeCommand,
  type RoofFamilyTypeMutationDeps,
} from '../UpdateRoofFamilyTypeCommand';
import {
  createDeleteRoofFamilyTypeCommand,
  type RoofFamilyTypeDeleteDeps,
} from '../DeleteRoofFamilyTypeCommand';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { BimFamilyType, RoofTypeParams } from '../../../../bim/types/bim-family-type';
import type { RoofEntity, RoofParams } from '../../../../bim/types/roof-types';
import { computeRoofGeometry, validateRoofParams } from '../../../../bim/geometry/roof-geometry';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRoofParams(overrides: Partial<RoofParams> = {}): RoofParams {
  return {
    outline: { vertices: [{ x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, { x: 4000, y: 3000, z: 0 }, { x: 0, y: 3000, z: 0 }] },
    edges: [
      { definesSlope: true, slope: 30, overhangMm: 0 },
      { definesSlope: false, slope: 0, overhangMm: 0 },
      { definesSlope: true, slope: 30, overhangMm: 0 },
      { definesSlope: false, slope: 0, overhangMm: 0 },
    ],
    slopeUnit: 'deg',
    basePivotZ: 3000,
    thickness: 200,
    ...overrides,
  };
}

function makeRoof(): RoofEntity {
  const params = makeRoofParams();
  return {
    id: 'roof-1',
    type: 'roof',
    kind: 'roof',
    layerId: '0',
    params,
    geometry: computeRoofGeometry(params),
    validation: validateRoofParams(params).bimValidation,
    visible: true,
    ifcType: 'IfcRoof',
  } as RoofEntity;
}

function assignment(params: RoofParams, typeId: string | undefined): RoofTypeAssignment {
  return { typeId, typeOverrides: undefined, params };
}

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const scene = new Map<string, SceneEntity>(initial.map((e) => [e.id, e]));
  const sm: ISceneManager = {
    getEntity: (id) => scene.get(id),
    addEntity: (e) => { scene.set(e.id, e); },
    removeEntity: (id) => { scene.delete(id); },
    updateEntity: (id, updates) => {
      const e = scene.get(id);
      if (e) scene.set(id, { ...e, ...(updates as SceneEntity) });
    },
    updateEntities: (updates) => {
      updates.forEach((partial, id) => {
        const e = scene.get(id);
        if (e) scene.set(id, { ...e, ...(partial as SceneEntity) });
      });
    },
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

// ─── AssignRoofTypeCommand ───────────────────────────────────────────────────

describe('AssignRoofTypeCommand', () => {
  it('execute sets typeId + folds resolved params, recomputes geometry', () => {
    const roof = makeRoof();
    const { scene, sm } = makeMockScene([roof as unknown as SceneEntity]);
    const nextParams = makeRoofParams({ thickness: 295 });

    const cmd = new AssignRoofTypeCommand(
      roof.id,
      assignment(nextParams, 'bimftype-roof-x'),
      assignment(roof.params, undefined),
      sm,
    );
    cmd.execute();

    const updated = scene.get(roof.id) as unknown as RoofEntity;
    expect(updated.typeId).toBe('bimftype-roof-x');
    expect(updated.params.thickness).toBe(295);
    expect(updated.geometry).toBeDefined();
    expect(updated.validation).toBeDefined();
  });

  it('undo restores the prior untyped state; redo re-applies', () => {
    const roof = makeRoof();
    const { scene, sm } = makeMockScene([roof as unknown as SceneEntity]);
    const cmd = new AssignRoofTypeCommand(
      roof.id,
      assignment(makeRoofParams({ thickness: 295 }), 'bimftype-roof-x'),
      assignment(roof.params, undefined),
      sm,
    );
    cmd.execute();
    cmd.undo();
    expect((scene.get(roof.id) as unknown as RoofEntity).typeId).toBeUndefined();
    cmd.redo();
    expect((scene.get(roof.id) as unknown as RoofEntity).typeId).toBe('bimftype-roof-x');
  });

  it('getDescription reflects assign vs clear; serialize round-trips', () => {
    const roof = makeRoof();
    const { sm } = makeMockScene([roof as unknown as SceneEntity]);
    const assign = new AssignRoofTypeCommand(
      roof.id, assignment(roof.params, 'x'), assignment(roof.params, undefined), sm);
    const clear = new AssignRoofTypeCommand(
      roof.id, assignment(roof.params, undefined), assignment(roof.params, 'x'), sm);
    expect(assign.getDescription()).toMatch(/Assign roof type/);
    expect(clear.getDescription()).toMatch(/Clear roof type/);
    const s = assign.serialize();
    expect(s.type).toBe('assign-roof-type');
    expect(s.data).toMatchObject({ roofId: roof.id });
    expect(assign.getAffectedEntityIds()).toEqual([roof.id]);
  });
});

// ─── UpdateRoofFamilyTypeCommand ─────────────────────────────────────────────

const TYPE_ID = 'bimftype-roof-1';

function makeType(thickness: number): BimFamilyType<'roof'> {
  return {
    id: TYPE_ID,
    category: 'roof',
    name: 'Tiled',
    scope: 'company',
    origin: 'user',
    typeParams: { thickness },
    companyId: 'co-1',
    ownerId: 'u-1',
  };
}

interface Harness {
  catalog: BimFamilyType[];
  deps: RoofFamilyTypeMutationDeps;
  persisted: RoofTypeParams[];
  audits: Array<{ from: RoofTypeParams; to: RoofTypeParams }>;
  notifyCount: number;
}

function makeHarness(initialThickness = 200): Harness {
  const h: Harness = {
    catalog: [makeType(initialThickness) as BimFamilyType],
    persisted: [],
    audits: [],
    notifyCount: 0,
    deps: {} as RoofFamilyTypeMutationDeps,
  };
  h.deps = {
    getTypes: () => h.catalog,
    setTypes: (types) => { h.catalog = [...types]; },
    persist: (typeParams) => { h.persisted.push(typeParams); },
    audit: (from, to) => { h.audits.push({ from, to }); },
    notifyChanged: () => { h.notifyCount += 1; },
  };
  return h;
}

const NEXT: RoofTypeParams = { thickness: 295 };
const PREV: RoofTypeParams = { thickness: 200 };

describe('UpdateRoofFamilyTypeCommand', () => {
  it('execute: optimistic store replace + persist + audit + notify', () => {
    const h = makeHarness();
    new UpdateRoofFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps).execute();
    expect((h.catalog.find((t) => t.id === TYPE_ID) as BimFamilyType<'roof'> | undefined)?.typeParams.thickness).toBe(295);
    expect(h.persisted).toEqual([NEXT]);
    expect(h.audits).toEqual([{ from: PREV, to: NEXT }]);
    expect(h.notifyCount).toBe(1);
  });

  it('undo: restores previous params + reversed audit + re-notify', () => {
    const h = makeHarness();
    const cmd = new UpdateRoofFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    cmd.execute();
    cmd.undo();
    expect((h.catalog.find((t) => t.id === TYPE_ID) as BimFamilyType<'roof'> | undefined)?.typeParams.thickness).toBe(200);
    expect(h.audits[1]).toEqual({ from: NEXT, to: PREV });
    expect(h.notifyCount).toBe(2);
  });

  it('idempotent + redo + leaves OTHER types untouched', () => {
    const h = makeHarness();
    const other: BimFamilyType = { ...(makeType(999) as BimFamilyType), id: 'bimftype-roof-2' };
    h.catalog = [...h.catalog, other];
    const cmd = new UpdateRoofFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    cmd.execute();
    cmd.execute();
    expect((h.catalog.find((t) => t.id === TYPE_ID) as BimFamilyType<'roof'> | undefined)?.typeParams.thickness).toBe(295);
    expect((h.catalog.find((t) => t.id === 'bimftype-roof-2') as BimFamilyType<'roof'> | undefined)?.typeParams.thickness).toBe(999);
  });

  it('validate rejects empty id + non-positive thickness; no scene entities affected', () => {
    const h = makeHarness();
    expect(new UpdateRoofFamilyTypeCommand('', NEXT, PREV, h.deps).validate()).toMatch(/ID/);
    expect(
      new UpdateRoofFamilyTypeCommand(TYPE_ID, { thickness: 0 }, PREV, h.deps).validate(),
    ).toMatch(/thickness/);
    const cmd = new UpdateRoofFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    expect(cmd.validate()).toBeNull();
    expect(cmd.serialize().type).toBe('update-roof-family-type');
    expect(cmd.getAffectedEntityIds()).toEqual([]);
  });
});

// ─── createDeleteRoofFamilyTypeCommand ───────────────────────────────────────

describe('createDeleteRoofFamilyTypeCommand', () => {
  function makeDeleteDeps(catalog: BimFamilyType[]): {
    deps: RoofFamilyTypeDeleteDeps;
    getCatalog: () => BimFamilyType[];
    removed: number[];
  } {
    let cat = [...catalog];
    const removed: number[] = [];
    const deps: RoofFamilyTypeDeleteDeps = {
      getTypes: () => cat,
      setTypes: (types) => { cat = [...types]; },
      removePersist: () => { removed.push(1); },
      restorePersist: () => {},
      auditDeleted: () => {},
      auditRestored: () => {},
    };
    return { deps, getCatalog: () => cat, removed };
  }

  it('removes the type from the catalog on execute and restores on undo', () => {
    const snapshot = makeType(200) as BimFamilyType;
    const { deps, getCatalog } = makeDeleteDeps([snapshot]);
    const roof = makeRoof();
    const { sm } = makeMockScene([roof as unknown as SceneEntity]);
    const detach = new AssignRoofTypeCommand(
      roof.id, assignment(roof.params, undefined), assignment(roof.params, TYPE_ID), sm);

    const cmd = createDeleteRoofFamilyTypeCommand(snapshot, [detach], deps);
    cmd.execute();
    expect(getCatalog().find((t) => t.id === TYPE_ID)).toBeUndefined();
    cmd.undo();
    expect(getCatalog().find((t) => t.id === TYPE_ID)).toBeDefined();
  });
});
