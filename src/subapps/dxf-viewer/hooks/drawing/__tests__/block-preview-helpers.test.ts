/**
 * ADR-652 §M7 — Block Library WYSIWYG placement ghost tests.
 *
 * Mirror of `column-preview-helpers.test.ts` / `foundation-preview-helpers.test.ts`: verifies the
 * free single-click ghost follows the cursor, carries neighbor-clearance dims + footprint HUD, and
 * the place+rotate lock phase (κοινό `PlacementRotationStore` με κολόνα/πέδιλο).
 */

import { generateBlockLibraryPreview } from '../block-preview-helpers';
import {
  upsertSessionBlockDef,
  __resetSessionBlockLibraryForTests,
} from '../../../bim/block-library/block-library-registry';
import {
  setSelectedBlockName,
  __resetBlockLibrarySelectionForTests,
} from '../../../bim/block-library/block-library-selection-store';
import { blockLibraryToolBridgeStore } from '../../../ui/ribbon/hooks/bridge/block-library-tool-bridge-store';
import { sceneSnapTargetsStore } from '../../../bim/framing/scene-snap-targets';
import { updateImmediateTransform } from '../../../systems/cursor/ImmediateTransformStore';
import { setPlacementRotationLock, clearPlacementRotationLock } from '../../../systems/cursor/PlacementRotationStore';
import type { Entity } from '../../../types/entities';

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

describe('generateBlockLibraryPreview', () => {
  beforeEach(() => {
    __resetSessionBlockLibraryForTests();
    __resetBlockLibrarySelectionForTests();
    blockLibraryToolBridgeStore.set(null);
    sceneSnapTargetsStore.reset();
    updateImmediateTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  });
  afterEach(() => {
    blockLibraryToolBridgeStore.set(null);
    clearPlacementRotationLock();
  });

  it('επιστρέφει null όταν κανένα block δεν είναι επιλεγμένο', () => {
    expect(generateBlockLibraryPreview({ x: 100, y: 50 })).toBeNull();
  });

  it('επιστρέφει null όταν το επιλεγμένο όνομα δεν έχει ορισμό στο registry', () => {
    setSelectedBlockName('GHOST_NAME');
    expect(generateBlockLibraryPreview({ x: 100, y: 50 })).toBeNull();
  });

  it('WYSIWYG BlockEntity ghost στον κέρσορα (μηδέν επιλεγμένα overrides)', () => {
    upsertSessionBlockDef({ name: 'CHAIR', localMembers: [line('m', 10, 5)], boundsMm: null });
    setSelectedBlockName('CHAIR');
    const ghost = generateBlockLibraryPreview({ x: 100, y: 50 }) as {
      type: string; preview?: boolean; wysiwygPreview?: boolean;
      position: { x: number; y: number };
    };
    expect(ghost).not.toBeNull();
    expect(ghost.type).toBe('block');
    expect(ghost.preview).toBe(true);
    expect(ghost.wysiwygPreview).toBe(true);
    expect(ghost.position).toEqual({ x: 100, y: 50 });
  });

  it('ADR-652 §M7 footprint-hud — το ghost φέρει footprintHud (rectangular descriptor)', () => {
    upsertSessionBlockDef({ name: 'CHAIR', localMembers: [line('m', 10, 5)], boundsMm: null });
    setSelectedBlockName('CHAIR');
    const ghost = generateBlockLibraryPreview({ x: 100, y: 50 }) as {
      footprintHud?: {
        footprint: readonly { x: number; y: number }[];
        descriptor: { kind: string; rotationDeg: number };
        heightSpecLabel: string;
      };
    };
    expect(ghost.footprintHud).toBeDefined();
    expect(ghost.footprintHud!.footprint.length).toBeGreaterThan(0);
    expect(ghost.footprintHud!.descriptor.kind).toBe('rectangular');
    expect(Number.isFinite(ghost.footprintHud!.descriptor.rotationDeg)).toBe(true);
    expect(ghost.footprintHud!.heightSpecLabel).toBe('');
  });

  it('M5 — το ghost ακολουθεί τα ribbon overrides (mirror/non-uniform scale + rotation)', () => {
    upsertSessionBlockDef({ name: 'CHAIR', localMembers: [line('m', 10, 5)], boundsMm: null });
    setSelectedBlockName('CHAIR');
    blockLibraryToolBridgeStore.set({
      isActive: true,
      overrides: { scaleX: -1, scaleY: 2, rotation: 45 },
      setParamOverrides: () => {},
    });
    const ghost = generateBlockLibraryPreview({ x: 0, y: 0 }) as {
      scale: { x: number; y: number }; rotation: number;
    };
    expect(ghost.scale).toEqual({ x: -1, y: 2 });
    expect(ghost.rotation).toBe(45);
  });

  it('degenerate block (χωρίς μέλη) → footprint πέφτει στο σημείο εισαγωγής (pointBounds fallback)', () => {
    upsertSessionBlockDef({ name: 'EMPTY', localMembers: [], boundsMm: null });
    setSelectedBlockName('EMPTY');
    const ghost = generateBlockLibraryPreview({ x: 300, y: 400 }) as {
      footprintHud?: { footprint: readonly { x: number; y: number }[] };
    };
    expect(ghost).not.toBeNull();
    // getEntityBounds('block') fallback: κενά members → pointBounds(position) → degenerate 4×ίδια κορυφή.
    expect(ghost.footprintHud).toBeDefined();
    expect(ghost.footprintHud!.footprint.every((p) => p.x === 300 && p.y === 400)).toBe(true);
  });

  describe('place+rotate (κοινό PlacementRotationStore με κολόνα/πέδιλο)', () => {
    it('awaitingRotation → το block μένει στην ΚΛΕΙΔΩΜΕΝΗ θέση και περιστρέφεται live προς τον κέρσορα', () => {
      upsertSessionBlockDef({ name: 'CHAIR', localMembers: [line('m', 10, 5)], boundsMm: null });
      setSelectedBlockName('CHAIR');
      setPlacementRotationLock({ x: 0, y: 0 }, 'center');
      const ghost = generateBlockLibraryPreview({ x: 0, y: 5000 }) as {
        position: { x: number; y: number }; rotation: number;
      };
      expect(ghost.position).toEqual({ x: 0, y: 0 }); // κλειδωμένη θέση, ΟΧΙ ο κέρσορας
      expect(Number.isFinite(ghost.rotation)).toBe(true);
      expect(ghost.rotation).not.toBe(0); // περιστρέφεται προς τον κέρσορα (Β, 90°)
    });
  });
});
