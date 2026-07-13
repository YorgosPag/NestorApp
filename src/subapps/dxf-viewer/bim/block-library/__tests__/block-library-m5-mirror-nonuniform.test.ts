/**
 * ADR-652 M5 — Mirror + μη-ομοιόμορφη κλίμακα (x≠y) στην τοποθέτηση block.
 *
 * Κλειδώνει το ΝΕΟ κομμάτι του M5 στο επίπεδο tool: το `buildParams` του
 * `useBlockLibraryTool` χαρτογραφεί τα `scaleX`/`scaleY` overrides (ΣΥΜΠΕΡΙΛΑΜΒΑΝΟΜΕΝΟΥ
 * αρνητικού = καθρέφτισμα) σε `BlockEntity.scale: Point2D`, και ο ίδιος δρόμος
 * τροφοδοτεί ΚΑΙ το commit ΚΑΙ το ghost footprint (WYSIWYG, ADR-040).
 *
 * Το passthrough «scale Point2D (incl. negative) → BlockEntity.scale» καλύπτεται ήδη από το
 * `buildBlockEntityFromDef` (foundation test)· εδώ κλειδώνουμε τη ΓΕΦΥΡΑ overrides→Point2D.
 */

import { renderHook, act } from '@testing-library/react';
import type { Entity, BlockEntity } from '../../../types/entities';
import { useBlockLibraryTool } from '../../../hooks/drawing/useBlockLibraryTool';
import {
  upsertSessionBlockDef,
  __resetSessionBlockLibraryForTests,
} from '../block-library-registry';
import {
  setSelectedBlockName,
  __resetBlockLibrarySelectionForTests,
} from '../block-library-selection-store';
import { blockLibraryToolBridgeStore } from '../../../ui/ribbon/hooks/bridge/block-library-tool-bridge-store';

/** Line member σε BLOCK-LOCAL space. */
function line(id: string, x2: number, y2: number): Entity {
  return {
    id,
    type: 'line',
    start: { x: 0, y: 0 },
    end: { x: x2, y: y2 },
    layerId: '0',
  } as unknown as Entity;
}

beforeEach(() => {
  __resetSessionBlockLibraryForTests();
  __resetBlockLibrarySelectionForTests();
  blockLibraryToolBridgeStore.set(null);
  upsertSessionBlockDef({ name: 'CHAIR', localMembers: [line('m', 10, 5)], boundsMm: null });
  setSelectedBlockName('CHAIR');
});

afterEach(() => blockLibraryToolBridgeStore.set(null));

/** Τοποθετεί ένα block με τα δοσμένα overrides και επιστρέφει το committed BlockEntity. */
function placeWith(overrides: Parameters<
  ReturnType<typeof useBlockLibraryTool>['setParamOverrides']
>[0]): BlockEntity {
  let created: BlockEntity | null = null;
  const { result } = renderHook(() =>
    useBlockLibraryTool({ onBlockCreated: (e) => { created = e; } }),
  );
  act(() => result.current.activate());
  act(() => result.current.setParamOverrides(overrides));
  act(() => { result.current.onCanvasClick({ x: 100, y: 50 }); });
  if (!created) throw new Error('block was not created');
  return created;
}

describe('useBlockLibraryTool — M5 overrides → placement scale', () => {
  it('μη-ομοιόμορφο x≠y περνά αυτούσιο στο BlockEntity.scale', () => {
    const entity = placeWith({ scaleX: 3, scaleY: 2 });
    expect(entity.scale).toEqual({ x: 3, y: 2 });
    expect(entity.position).toEqual({ x: 100, y: 50 });
  });

  it('αρνητικός άξονας = καθρέφτισμα (mirror) — διατηρεί το πρόσημο', () => {
    const entity = placeWith({ scaleX: -1, scaleY: 2 });
    expect(entity.scale).toEqual({ x: -1, y: 2 });
  });

  it('μόνο scaleX ορισμένο → ο άλλος άξονας πέφτει στο default 1', () => {
    const entity = placeWith({ scaleX: 2 });
    expect(entity.scale).toEqual({ x: 2, y: 1 });
  });

  it('κανένα scale override → default ομοιόμορφο {1,1}', () => {
    const entity = placeWith({ rotation: 45 });
    expect(entity.scale).toEqual({ x: 1, y: 1 });
    expect(entity.rotation).toBe(45);
  });

  it('το ghost footprint ακολουθεί τον ΙΔΙΟ δρόμο (mirror ορατό ΠΡΙΝ το κλικ)', () => {
    let footprint: readonly { x: number; y: number }[] | null = null;
    const { result } = renderHook(() => useBlockLibraryTool());
    act(() => result.current.activate());
    act(() => result.current.setParamOverrides({ scaleX: -1, scaleY: 2 }));
    act(() => { footprint = result.current.getGhostFootprint({ x: 100, y: 50 }); });
    // Ο ghost υπολογίζεται από το ίδιο buildParams → 4 γωνίες, non-null (WYSIWYG).
    expect(footprint).not.toBeNull();
    expect(footprint).toHaveLength(4);
  });
});
