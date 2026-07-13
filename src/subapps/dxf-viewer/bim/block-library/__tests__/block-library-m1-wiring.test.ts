/**
 * Block Library — Milestone 1 wiring specs.
 * registry (upsert/list/version) · selection store · local bounds · capture integration · footprint.
 */

import type { Entity } from '../../../types/entities';
import {
  upsertSessionBlockDef,
  getSessionBlockDef,
  listSessionBlockDefs,
  getSessionBlockDefsVersion,
  clearSessionBlockDefs,
  __resetSessionBlockLibraryForTests,
} from '../block-library-registry';
import {
  setSelectedBlockName,
  getSelectedBlockName,
  __resetBlockLibrarySelectionForTests,
} from '../block-library-selection-store';
import { computeBlockLocalBoundsMm } from '../block-local-bounds';
import { captureSessionBlocksFromScene } from '../capture-session-blocks';
import { computeBlockFootprint } from '../block-library-footprint';
import type { InSessionBlockDef } from '../block-library-types';

/** Line member σε BLOCK-LOCAL space (custom endpoints). */
function line(id: string, x1: number, y1: number, x2: number, y2: number): Entity {
  return {
    id,
    type: 'line',
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    layerId: '0',
  } as unknown as Entity;
}

/** BlockEntity σκηνής (τα `entities` = BLOCK-LOCAL members). */
function block(name: string, members: Entity[]): Entity {
  return {
    id: `blk_${name}`,
    type: 'block',
    name,
    layerId: '0',
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    entities: members,
    visible: true,
  } as unknown as Entity;
}

beforeEach(() => {
  __resetSessionBlockLibraryForTests();
  __resetBlockLibrarySelectionForTests();
});

describe('block-library-registry', () => {
  it('upsert συσσωρεύει, κρατά σειρά εισαγωγής, last-wins ανά name', () => {
    const a: InSessionBlockDef = { name: 'A', localMembers: [line('a', 0, 0, 10, 0)], boundsMm: null };
    const b: InSessionBlockDef = { name: 'B', localMembers: [line('b', 0, 0, 20, 0)], boundsMm: null };
    upsertSessionBlockDef(a);
    upsertSessionBlockDef(b);
    expect(listSessionBlockDefs().map((d) => d.name)).toEqual(['A', 'B']);

    // ίδιο name → override (τελευταίο κερδίζει), όχι διπλή εγγραφή
    const a2: InSessionBlockDef = { name: 'A', localMembers: [line('a2', 0, 0, 99, 0)], boundsMm: null };
    upsertSessionBlockDef(a2);
    expect(listSessionBlockDefs()).toHaveLength(2);
    expect(getSessionBlockDef('A')?.localMembers[0].id).toBe('a2');
  });

  it('bump-άρει το version σε κάθε αλλαγή· clear αδειάζει', () => {
    const v0 = getSessionBlockDefsVersion();
    upsertSessionBlockDef({ name: 'A', localMembers: [line('a', 0, 0, 10, 0)], boundsMm: null });
    expect(getSessionBlockDefsVersion()).toBeGreaterThan(v0);
    clearSessionBlockDefs();
    expect(listSessionBlockDefs()).toHaveLength(0);
    expect(getSessionBlockDef('A')).toBeNull();
  });
});

describe('block-library-selection-store', () => {
  it('set/get/reset της επιλογής', () => {
    expect(getSelectedBlockName()).toBeNull();
    setSelectedBlockName('CHAIR');
    expect(getSelectedBlockName()).toBe('CHAIR');
    __resetBlockLibrarySelectionForTests();
    expect(getSelectedBlockName()).toBeNull();
  });
});

describe('computeBlockLocalBoundsMm', () => {
  it('union AABB των members', () => {
    const bounds = computeBlockLocalBoundsMm([line('a', 0, 0, 10, 0), line('b', 0, 0, 0, 20)]);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 20 });
  });

  it('null για κενά members', () => {
    expect(computeBlockLocalBoundsMm([])).toBeNull();
  });
});

describe('captureSessionBlocksFromScene', () => {
  it('περνά τα named blocks στο registry με προϋπολογισμένα boundsMm', () => {
    captureSessionBlocksFromScene([
      block('CHAIR', [line('c', 0, 0, 10, 5)]),
      block('*D0', [line('d', 0, 0, 10, 0)]), // anonymous → skip
    ]);
    const defs = listSessionBlockDefs();
    expect(defs.map((d) => d.name)).toEqual(['CHAIR']);
    expect(defs[0].boundsMm).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 5 });
  });
});

describe('computeBlockFootprint', () => {
  const def: InSessionBlockDef = {
    name: 'CHAIR',
    localMembers: [line('m', 0, 0, 10, 5)],
    boundsMm: { minX: 0, minY: 0, maxX: 10, maxY: 5 },
  };

  it('4 γωνίες του translated AABB (scale 1, rotation 0)', () => {
    const fp = computeBlockFootprint(def, { position: { x: 100, y: 50 } });
    expect(fp).toEqual([
      { x: 100, y: 50, z: 0 },
      { x: 110, y: 50, z: 0 },
      { x: 110, y: 55, z: 0 },
      { x: 100, y: 55, z: 0 },
    ]);
  });

  it('εφαρμόζει scale γύρω από το origin πριν το translate', () => {
    const fp = computeBlockFootprint(def, { position: { x: 100, y: 50 }, scale: { x: 2, y: 2 } });
    // member ×2 about origin → (0,0)-(20,10)· + placement (100,50) → AABB {100,50 .. 120,60}
    expect(fp[0]).toEqual({ x: 100, y: 50, z: 0 });
    expect(fp[2]).toEqual({ x: 120, y: 60, z: 0 });
  });
});
