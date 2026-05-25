/**
 * ADR-363 Phase 8D — useRibbonColumnBridge tests.
 *
 * Coverage:
 *   - Selected entity: nested param routing (sides → polygon.sides, flange/web → ishape.X).
 *   - Selected entity: getPanelVisibility (polygonParams visible iff kind='polygon').
 *   - Drawing mode (no selection, tool active via store): kind dropdown reads
 *     from tool handle + writes call handle.setKind/setParamOverrides.
 */

import { renderHook, act } from '@testing-library/react';
import {
  useRibbonColumnBridge,
  isColumnPanelVisibilityKey,
} from '../useRibbonColumnBridge';
import {
  COLUMN_RIBBON_KEYS,
  COLUMN_RIBBON_VISIBILITY_KEYS,
} from '../bridge/column-command-keys';
import { columnToolBridgeStore } from '../bridge/column-tool-bridge-store';
import {
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
  DEFAULT_POLYGON_SIDES,
} from '../../../../bim/types/column-types';
import { resetGlobalCommandHistory } from '../../../../core/commands';

// ── Mock UpdateColumnParamsCommand to capture writes ──────────────────────────
jest.mock(
  '../../../../core/commands/entity-commands/UpdateColumnParamsCommand',
  () => ({
    UpdateColumnParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

// ── Test fixtures ────────────────────────────────────────────────────────────
const polygonColumn = {
  id: 'col-polygon-1',
  type: 'column' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcColumn' as const,
  params: {
    kind: 'polygon' as const,
    position: { x: 0, y: 0, z: 0 },
    anchor: 'center' as const,
    width: 400,
    depth: 400,
    height: 3000,
    rotation: 0,
    sceneUnits: 'mm' as const,
    polygon: { sides: 8 },
    baseBinding: 'storey-floor' as const,
    topBinding: 'storey-ceiling' as const,
    baseOffset: 0,
    topOffset: 0,
  },
  geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, volume: 0, height: 3000 },
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

const ishapeColumn = {
  ...polygonColumn,
  id: 'col-i-1',
  params: {
    ...polygonColumn.params,
    kind: 'I-shape' as const,
    polygon: undefined,
    ishape: { flangeThickness: 25, webThickness: 18 },
  },
};

const rectColumn = {
  ...polygonColumn,
  id: 'col-rect-1',
  params: { ...polygonColumn.params, kind: 'rectangular' as const, polygon: undefined },
};

function makeLevelManager(entity: typeof polygonColumn | null) {
  const scene = entity ? { entities: [entity] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonColumnBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
  } as unknown as Parameters<typeof useRibbonColumnBridge>[0]['universalSelection'];
}

beforeEach(() => {
  resetGlobalCommandHistory();
  columnToolBridgeStore.set(null);
});

afterEach(() => {
  columnToolBridgeStore.set(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// SELECTED ENTITY BRANCH
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonColumnBridge — selected entity, nested params', () => {
  it('reads polygon.sides from params when key=column.params.sides', () => {
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(polygonColumn),
        universalSelection: makeSelection('col-polygon-1'),
      }),
    );
    const state = result.current.getComboboxState(COLUMN_RIBBON_KEYS.params.sides);
    expect(state?.value).toBe('8');
  });

  it('falls back to DEFAULT_POLYGON_SIDES when polygon override absent', () => {
    const fallback = { ...polygonColumn, params: { ...polygonColumn.params, polygon: undefined } };
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(fallback),
        universalSelection: makeSelection('col-polygon-1'),
      }),
    );
    const state = result.current.getComboboxState(COLUMN_RIBBON_KEYS.params.sides);
    expect(state?.value).toBe(String(DEFAULT_POLYGON_SIDES));
  });

  it('reads ishape.flangeThickness / webThickness', () => {
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(ishapeColumn),
        universalSelection: makeSelection('col-i-1'),
      }),
    );
    expect(result.current.getComboboxState(COLUMN_RIBBON_KEYS.params.flangeThickness)?.value).toBe('25');
    expect(result.current.getComboboxState(COLUMN_RIBBON_KEYS.params.webThickness)?.value).toBe('18');
  });

  it('falls back to I-shape defaults when ishape override absent', () => {
    const fallback = { ...ishapeColumn, params: { ...ishapeColumn.params, ishape: undefined } };
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(fallback),
        universalSelection: makeSelection('col-i-1'),
      }),
    );
    expect(result.current.getComboboxState(COLUMN_RIBBON_KEYS.params.flangeThickness)?.value)
      .toBe(String(DEFAULT_I_FLANGE_THICKNESS_MM));
    expect(result.current.getComboboxState(COLUMN_RIBBON_KEYS.params.webThickness)?.value)
      .toBe(String(DEFAULT_I_WEB_THICKNESS_MM));
  });
});

describe('useRibbonColumnBridge — getPanelVisibility', () => {
  it('polygonParams visible when selected kind === polygon', () => {
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(polygonColumn),
        universalSelection: makeSelection('col-polygon-1'),
      }),
    );
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams)).toBe(true);
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams)).toBe(false);
  });

  it('ishapeParams visible when selected kind === I-shape', () => {
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(ishapeColumn),
        universalSelection: makeSelection('col-i-1'),
      }),
    );
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams)).toBe(true);
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams)).toBe(false);
  });

  it('both panels hidden when kind === rectangular', () => {
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(rectColumn),
        universalSelection: makeSelection('col-rect-1'),
      }),
    );
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams)).toBe(false);
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams)).toBe(false);
  });

  it('isColumnPanelVisibilityKey type guard recognizes own keys', () => {
    expect(isColumnPanelVisibilityKey(COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams)).toBe(true);
    expect(isColumnPanelVisibilityKey(COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams)).toBe(true);
    expect(isColumnPanelVisibilityKey('stair.visibility.multiFlight')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRAWING-MODE BRANCH (no selection, tool active via store)
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonColumnBridge — drawing-mode synthetic resolver', () => {
  function publishTool(overrides: { kind?: string; polygon?: { sides?: number }; ishape?: { flangeThickness?: number; webThickness?: number } } = {}) {
    const setKind = jest.fn();
    const setAnchor = jest.fn();
    const setParamOverrides = jest.fn();
    columnToolBridgeStore.set({
      isActive: true,
      kind: (overrides.kind ?? 'polygon') as never,
      anchor: 'center',
      overrides: {
        ...(overrides.polygon ? { polygon: overrides.polygon } : {}),
        ...(overrides.ishape ? { ishape: overrides.ishape } : {}),
      },
      setKind,
      setAnchor,
      setParamOverrides,
    });
    return { setKind, setAnchor, setParamOverrides };
  }

  it('reads kind from tool handle when no entity is selected', () => {
    publishTool({ kind: 'polygon' });
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(COLUMN_RIBBON_KEYS.stringParams.kind)?.value).toBe('polygon');
  });

  it('reads polygon.sides from tool overrides (defaults when absent)', () => {
    publishTool({ kind: 'polygon' });
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(COLUMN_RIBBON_KEYS.params.sides)?.value)
      .toBe(String(DEFAULT_POLYGON_SIDES));
  });

  it('setKind via ribbon writes to tool handle', () => {
    const handlers = publishTool({ kind: 'rectangular' });
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => {
      result.current.onComboboxChange(COLUMN_RIBBON_KEYS.stringParams.kind, 'I-shape');
    });
    expect(handlers.setKind).toHaveBeenCalledWith('I-shape');
  });

  it('setSides via ribbon writes polygon.sides override to tool handle', () => {
    const handlers = publishTool({ kind: 'polygon' });
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => {
      result.current.onComboboxChange(COLUMN_RIBBON_KEYS.params.sides, '8');
    });
    expect(handlers.setParamOverrides).toHaveBeenCalledWith({ polygon: { sides: 8 } });
  });

  it('setFlangeThickness via ribbon writes ishape.flangeThickness override', () => {
    const handlers = publishTool({ kind: 'I-shape' });
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => {
      result.current.onComboboxChange(COLUMN_RIBBON_KEYS.params.flangeThickness, '25');
    });
    expect(handlers.setParamOverrides).toHaveBeenCalledWith({ ishape: { flangeThickness: 25 } });
  });

  it('getPanelVisibility resolves kind from tool handle in drawing mode', () => {
    publishTool({ kind: 'polygon' });
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams)).toBe(true);
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.ishapeParams)).toBe(false);
  });

  it('returns null when no selection and tool inactive', () => {
    columnToolBridgeStore.set(null);
    const { result } = renderHook(() =>
      useRibbonColumnBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(COLUMN_RIBBON_KEYS.stringParams.kind)).toBe(null);
    expect(result.current.getPanelVisibility(COLUMN_RIBBON_VISIBILITY_KEYS.polygonParams)).toBe(false);
  });
});
