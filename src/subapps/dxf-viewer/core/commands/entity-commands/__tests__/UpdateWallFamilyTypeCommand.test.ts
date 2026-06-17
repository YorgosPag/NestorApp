/**
 * ADR-412 Φ5 — `UpdateWallFamilyTypeCommand` tests.
 *
 * Verifies the synchronous optimistic catalog edit: execute replaces the type's
 * params in the (injected) store + runs persist/audit/notify; undo restores the
 * previous params + re-runs side effects with reversed diff; idempotent re-apply;
 * the command NEVER mutates scene entities directly (instances re-resolve via the
 * store-version mechanism, not this command); validate guards id + thickness.
 */

import {
  UpdateWallFamilyTypeCommand,
  type FamilyTypeMutationDeps,
} from '../UpdateWallFamilyTypeCommand';
import type { BimFamilyType, WallTypeParams } from '../../../../bim/types/bim-family-type';

const TYPE_ID = 'bimftype-wall-1';

function makeType(thickness: number): BimFamilyType<'wall'> {
  return {
    id: TYPE_ID,
    category: 'wall',
    name: 'Interior 100',
    scope: 'company',
    origin: 'user',
    typeParams: { category: 'interior', thickness },
    companyId: 'co-1',
    ownerId: 'u-1',
  };
}

interface Harness {
  catalog: BimFamilyType[];
  deps: FamilyTypeMutationDeps;
  persisted: WallTypeParams[];
  audits: Array<{ from: WallTypeParams; to: WallTypeParams }>;
  notifyCount: number;
}

function makeHarness(initialThickness = 100): Harness {
  const h: Harness = {
    catalog: [makeType(initialThickness) as BimFamilyType],
    persisted: [],
    audits: [],
    notifyCount: 0,
    deps: {} as FamilyTypeMutationDeps,
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

const NEXT: WallTypeParams = { category: 'interior', thickness: 250 };
const PREV: WallTypeParams = { category: 'interior', thickness: 100 };

describe('UpdateWallFamilyTypeCommand (ADR-412 Φ5)', () => {
  it('1. execute: optimistic store replace + persist + audit + notify', () => {
    const h = makeHarness();
    const cmd = new UpdateWallFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    cmd.execute();

    expect((h.catalog.find((t) => t.id === TYPE_ID) as BimFamilyType<'wall'> | undefined)?.typeParams.thickness).toBe(250);
    expect(h.persisted).toEqual([NEXT]);
    expect(h.audits).toEqual([{ from: PREV, to: NEXT }]);
    expect(h.notifyCount).toBe(1);
  });

  it('2. undo: restores previous params + reversed audit + re-notify', () => {
    const h = makeHarness();
    const cmd = new UpdateWallFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    cmd.execute();
    cmd.undo();

    expect((h.catalog.find((t) => t.id === TYPE_ID) as BimFamilyType<'wall'> | undefined)?.typeParams.thickness).toBe(100);
    expect(h.persisted).toEqual([NEXT, PREV]);
    expect(h.audits[1]).toEqual({ from: NEXT, to: PREV });
    expect(h.notifyCount).toBe(2);
  });

  it('3. idempotent: execute twice yields same catalog state', () => {
    const h = makeHarness();
    const cmd = new UpdateWallFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    cmd.execute();
    cmd.execute();
    expect((h.catalog.find((t) => t.id === TYPE_ID) as BimFamilyType<'wall'> | undefined)?.typeParams.thickness).toBe(250);
  });

  it('4. redo re-applies the next params after undo', () => {
    const h = makeHarness();
    const cmd = new UpdateWallFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect((h.catalog.find((t) => t.id === TYPE_ID) as BimFamilyType<'wall'> | undefined)?.typeParams.thickness).toBe(250);
  });

  it('5. leaves OTHER types untouched (replaces only the target id)', () => {
    const h = makeHarness();
    const other: BimFamilyType = { ...(makeType(300) as BimFamilyType), id: 'bimftype-wall-2' };
    h.catalog = [...h.catalog, other];
    new UpdateWallFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps).execute();
    expect((h.catalog.find((t) => t.id === 'bimftype-wall-2') as BimFamilyType<'wall'> | undefined)?.typeParams.thickness).toBe(300);
  });

  it('6. validate rejects empty id + non-positive thickness', () => {
    const h = makeHarness();
    expect(new UpdateWallFamilyTypeCommand('', NEXT, PREV, h.deps).validate()).toMatch(/ID/);
    expect(
      new UpdateWallFamilyTypeCommand(TYPE_ID, { category: 'interior', thickness: 0 }, PREV, h.deps).validate(),
    ).toMatch(/thickness/);
    expect(new UpdateWallFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps).validate()).toBeNull();
  });

  it('7. serialize round-trips + no scene entities affected', () => {
    const h = makeHarness();
    const cmd = new UpdateWallFamilyTypeCommand(TYPE_ID, NEXT, PREV, h.deps);
    const s = cmd.serialize();
    expect(s.type).toBe('update-wall-family-type');
    expect(s.data).toMatchObject({ typeId: TYPE_ID });
    // Instances re-resolve via the store-version mechanism — the command itself
    // touches no scene entity (handoff trap #1: no double propagation).
    expect(cmd.getAffectedEntityIds()).toEqual([]);
  });
});
