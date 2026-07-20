/**
 * ADR-363 Phase 7.1 Step 6.3 — `useMultiSelectionRibbonBridge` tests.
 */

import { renderHook, act } from '@testing-library/react';
import { useMultiSelectionRibbonBridge } from '../useMultiSelectionRibbonBridge';
import { resetGlobalCommandHistory } from '../../../../core/commands';
import { SceneStore } from '../../../../systems/scene/SceneStore';
import { SelectedEntitiesStore } from '../../../../systems/selection/SelectedEntitiesStore';
import type { SceneModel } from '../../../../types/scene';
import type { SelectionEntry } from '../../../../systems/selection/types';

// 2026-07-20 — ΑΝΑΓΝΩΣΗ από τα stores, ΟΧΙ από props. Το bridge διάβαζε σκηνή +
// επιλογή μέσα σε `useMemo([levelManager, universalSelection])`, δηλαδή από δύο
// ΣΤΑΘΕΡΑ context refs → πάγωνε στο mount. Πλέον διαβάζει ζωντανά από
// `SceneStore` (ADR-547) + `SelectedEntitiesStore` (ADR-532), οπότε το setup
// γεμίζει τα stores· τα props κρατούν μόνο τα WRITE paths (setLevelScene,
// selectMultiple), που παραμένουν mockαρισμένα.

// ─── Test fixtures ───────────────────────────────────────────────────────────

const wall1Params = {
  category: 'interior',
  start: { x: 0, y: 0, z: 0 },
  end: { x: 1000, y: 0, z: 0 },
  height: 2700,
  thickness: 150,
  flip: false,
};
const wall2Params = { ...wall1Params, height: 3000 }; // different height → 'mixed'
const slabParams = { kind: 'flat', outline: { vertices: [] }, elevation: 0, thickness: 200 };

const sceneEntities = [
  { id: 'w1', type: 'wall', visible: true, params: wall1Params },
  { id: 'w2', type: 'wall', visible: true, params: wall2Params },
  { id: 's1', type: 'slab', visible: true, params: slabParams },
  { id: 'line1', type: 'line', visible: true, start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
];

function makeScene(): SceneModel {
  return { entities: sceneEntities } as unknown as SceneModel;
}

function makeLevelManager(scene: SceneModel | null) {
  return {
    currentLevelId: scene ? 'lvl-1' : null,
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  };
}

function makeUniversalSelection(entries: { id: string; type: SelectionEntry['type'] }[]) {
  const fullEntries: SelectionEntry[] = entries.map((e, i) => ({
    id: e.id,
    type: e.type,
    timestamp: i,
  }));
  return {
    getAll: jest.fn(() => fullEntries),
    selectMultiple: jest.fn(),
  };
}

function setup(opts: {
  scene?: SceneModel | null;
  entries?: { id: string; type: SelectionEntry['type'] }[];
}) {
  const scene = opts.scene === undefined ? makeScene() : opts.scene;
  const levelManager = makeLevelManager(scene);
  const universalSelection = makeUniversalSelection(opts.entries ?? []);

  // Γέμισμα των ΖΩΝΤΑΝΩΝ stores (η ανάγνωση δεν περνά πια από τα props).
  SceneStore._resetForTests();
  SelectedEntitiesStore._resetForTests();
  if (scene) SceneStore.setLevelScene('lvl-1', scene);
  for (const entry of opts.entries ?? []) {
    SelectedEntitiesStore.addEntity({ id: entry.id, type: entry.type });
  }

  const { result } = renderHook(() =>
    useMultiSelectionRibbonBridge({ levelManager, universalSelection }),
  );
  return { result, levelManager, universalSelection };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useMultiSelectionRibbonBridge', () => {
  beforeEach(() => {
    resetGlobalCommandHistory();
  });

  describe('mode resolution', () => {
    it('mode=none when no selection', () => {
      const { result } = setup({ entries: [] });
      expect(result.current.mode).toBe('none');
      expect(result.current.bimEntries).toEqual([]);
    });

    it('mode=none when only non-BIM entities selected (line)', () => {
      const { result } = setup({ entries: [{ id: 'line1', type: 'dxf-entity' }] });
      expect(result.current.mode).toBe('none');
      expect(result.current.bimEntries).toEqual([]);
    });

    it('mode=single when 1 BIM entity', () => {
      const { result } = setup({ entries: [{ id: 'w1', type: 'dxf-entity' }] });
      expect(result.current.mode).toBe('single');
      expect(result.current.bimEntries.length).toBe(1);
    });

    it('mode=multi when 2+ BIM entities', () => {
      const { result } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 'w2', type: 'dxf-entity' },
        ],
      });
      expect(result.current.mode).toBe('multi');
      expect(result.current.bimEntries.length).toBe(2);
    });

    it('mode=none when no active level', () => {
      const { result } = setup({ scene: null, entries: [{ id: 'w1', type: 'dxf-entity' }] });
      expect(result.current.mode).toBe('none');
    });
  });

  describe('bimEntries filtering', () => {
    it('drops missing entities', () => {
      const { result } = setup({
        entries: [{ id: 'missing', type: 'dxf-entity' }, { id: 'w1', type: 'dxf-entity' }],
      });
      expect(result.current.bimEntries.length).toBe(1);
      expect(result.current.bimEntries[0].id).toBe('w1');
    });

    it('drops non-BIM kinds (line)', () => {
      const { result } = setup({
        entries: [{ id: 'line1', type: 'dxf-entity' }, { id: 'w1', type: 'dxf-entity' }],
      });
      expect(result.current.bimEntries.map((e) => e.id)).toEqual(['w1']);
    });

    it('preserves selectableType per entry', () => {
      const { result } = setup({ entries: [{ id: 'w1', type: 'dxf-entity' }] });
      expect(result.current.bimEntries[0].selectableType).toBe('dxf-entity');
    });
  });

  describe('kindsCount + homogeneity', () => {
    it('homogeneous wall+wall', () => {
      const { result } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 'w2', type: 'dxf-entity' },
        ],
      });
      expect(result.current.kindsCount.get('wall')).toBe(2);
      expect(result.current.kindsCount.size).toBe(1);
      expect(result.current.isHomogeneous).toBe(true);
    });

    it('heterogeneous wall+slab', () => {
      const { result } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 's1', type: 'dxf-entity' },
        ],
      });
      expect(result.current.kindsCount.size).toBe(2);
      expect(result.current.isHomogeneous).toBe(false);
    });
  });

  describe('commonProperties', () => {
    it('homogeneous wall+wall → full wall set', () => {
      const { result } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 'w2', type: 'dxf-entity' },
        ],
      });
      const keys = result.current.commonProperties.map((p) => p.key);
      expect(keys).toEqual(['height', 'thickness']);
    });

    it('wall+slab → thickness only', () => {
      const { result } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 's1', type: 'dxf-entity' },
        ],
      });
      const keys = result.current.commonProperties.map((p) => p.key);
      expect(keys).toEqual(['thickness']);
    });
  });

  describe('currentValues', () => {
    it('all same → numeric value', () => {
      // w1 + w1 (re-use same params) → height=2700 για όλους
      const { result } = setup({
        entries: [{ id: 'w1', type: 'dxf-entity' }],
      });
      expect(result.current.currentValues.get('height')).toBe(2700);
      expect(result.current.currentValues.get('thickness')).toBe(150);
    });

    it('different values → mixed', () => {
      // w1 height=2700, w2 height=3000 → 'mixed' για height, ίδιο για thickness
      const { result } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 'w2', type: 'dxf-entity' },
        ],
      });
      expect(result.current.currentValues.get('height')).toBe('mixed');
      expect(result.current.currentValues.get('thickness')).toBe(150);
    });

    it('wall+slab thickness: wall=150, slab=200 → mixed', () => {
      const { result } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 's1', type: 'dxf-entity' },
        ],
      });
      expect(result.current.currentValues.get('thickness')).toBe('mixed');
    });
  });

  describe('narrowToKind', () => {
    it('replaces selection με entries του kind', () => {
      const { result, universalSelection } = setup({
        entries: [
          { id: 'w1', type: 'dxf-entity' },
          { id: 'w2', type: 'dxf-entity' },
          { id: 's1', type: 'dxf-entity' },
        ],
      });
      act(() => result.current.narrowToKind('wall'));
      expect(universalSelection.selectMultiple).toHaveBeenCalledWith([
        { id: 'w1', type: 'dxf-entity' },
        { id: 'w2', type: 'dxf-entity' },
      ]);
    });

    it('no-op όταν kind δεν υπάρχει', () => {
      const { result, universalSelection } = setup({
        entries: [{ id: 'w1', type: 'dxf-entity' }],
      });
      act(() => result.current.narrowToKind('column'));
      expect(universalSelection.selectMultiple).not.toHaveBeenCalled();
    });
  });

  describe('executeBulkPatch', () => {
    it('no-op όταν bimEntries άδειο', () => {
      const { result, levelManager } = setup({ entries: [] });
      act(() => result.current.executeBulkPatch({ height: 3000 }));
      expect(levelManager.setLevelScene).not.toHaveBeenCalled();
    });

    it('no-op όταν patch δεν παράγει commands (όλα filtered out)', () => {
      const { result, levelManager } = setup({
        entries: [{ id: 'w1', type: 'dxf-entity' }],
      });
      // 'width' δεν υπάρχει για wall → 0 commands → δεν εκτελείται
      act(() => result.current.executeBulkPatch({ width: 999 }));
      expect(levelManager.setLevelScene).not.toHaveBeenCalled();
    });
  });
});
