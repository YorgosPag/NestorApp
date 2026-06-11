/**
 * ADR-441 Slice 5a-control — useRibbonFoundationBridge justification (Location Line) tests.
 *
 * Coverage:
 *   - Drawing mode (tool active via store): justification combobox reads override
 *     (default 'center') + write calls handle.setParamOverrides({ justification }).
 *   - Selected strip: write routes through UpdateFoundationParamsCommand με
 *     params.justification set.
 *   - Selected pad: justification combobox = null (δεν ισχύει — pad → anchor).
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonFoundationBridge } from '../useRibbonFoundationBridge';
import { FOUNDATION_RIBBON_KEYS } from '../bridge/foundation-command-keys';
import { UpdateFoundationParamsCommand } from '../../../../core/commands/entity-commands/UpdateFoundationParamsCommand';
import { foundationToolBridgeStore } from '../bridge/foundation-tool-bridge-store';
import { DEFAULT_STRIP_JUSTIFICATION } from '../../../../bim/types/foundation-types';
import { resetGlobalCommandHistory } from '../../../../core/commands';
import { EventBus } from '../../../../systems/events/EventBus';
import { commitFoundationGridFromGuides } from '../../../../bim/foundations/foundation-grid-commit';
import { buildStripGridFromGuides, type AxisGuideReader } from '../../../../bim/foundations/foundation-from-grid';
import type { Guide } from '../../../../systems/guides/guide-types';
import type { FoundationEntity, StripFootingParams } from '../../../../bim/types/foundation-types';

// ── Mock the grid commit (SSoT reconcile) to capture auto-trigger invocations ──
jest.mock('../../../../bim/foundations/foundation-grid-commit', () => ({
  commitFoundationGridFromGuides: jest.fn(() => ({
    ok: true, created: 0, deleted: 0, unchanged: 0, rehosted: 0, reJustified: 0,
  })),
}));

// ── Mock react-i18next (bridge calls useTranslation for delete confirm) ───────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ── Mock UpdateFoundationParamsCommand to capture writes ──────────────────────
jest.mock(
  '../../../../core/commands/entity-commands/UpdateFoundationParamsCommand',
  () => ({
    UpdateFoundationParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

// ── Test fixtures ────────────────────────────────────────────────────────────
const stripFoundation = {
  id: 'found-strip-1',
  type: 'foundation' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcFooting' as const,
  predefinedType: 'STRIP_FOOTING' as const,
  params: {
    kind: 'strip' as const,
    topElevationMm: -1000,
    thicknessMm: 400,
    start: { x: 0, y: 0, z: 0 },
    end: { x: 1000, y: 0, z: 0 },
    width: 600,
    sceneUnits: 'mm' as const,
  },
  geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, volume: 0, thickness: 400 },
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

const padFoundation = {
  ...stripFoundation,
  id: 'found-pad-1',
  predefinedType: 'PAD_FOOTING' as const,
  params: {
    kind: 'pad' as const,
    topElevationMm: -1000,
    thicknessMm: 500,
    position: { x: 0, y: 0, z: 0 },
    width: 1500,
    length: 1500,
    rotation: 0,
    anchor: 'center' as const,
    profile: 'flat' as const,
    sceneUnits: 'mm' as const,
  },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof stripFoundation] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonFoundationBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
    getSelectedEntityIds: jest.fn(() => (id ? [id] : [])),
  } as unknown as Parameters<typeof useRibbonFoundationBridge>[0]['universalSelection'];
}

const JUST_KEY = FOUNDATION_RIBBON_KEYS.stringParams.justification;

beforeEach(() => {
  resetGlobalCommandHistory();
  foundationToolBridgeStore.set(null);
  (UpdateFoundationParamsCommand as jest.Mock).mockClear();
});

afterEach(() => {
  foundationToolBridgeStore.set(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// SELECTED ENTITY BRANCH
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonFoundationBridge — justification (selected entity)', () => {
  it('reads default center when strip params.justification is absent', () => {
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(stripFoundation),
        universalSelection: makeSelection('found-strip-1'),
      }),
    );
    expect(result.current.getComboboxState(JUST_KEY)?.value).toBe(DEFAULT_STRIP_JUSTIFICATION);
  });

  it('write sets justification on the dispatched strip params', () => {
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(stripFoundation),
        universalSelection: makeSelection('found-strip-1'),
      }),
    );
    act(() => result.current.onComboboxChange(JUST_KEY, 'right'));
    const next = (UpdateFoundationParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.justification).toBe('right');
  });

  it('justification combobox is null for a selected pad (pad → anchor)', () => {
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(padFoundation),
        universalSelection: makeSelection('found-pad-1'),
      }),
    );
    expect(result.current.getComboboxState(JUST_KEY)).toBe(null);
  });

  it('justification write on a selected pad is a no-op (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(padFoundation),
        universalSelection: makeSelection('found-pad-1'),
      }),
    );
    act(() => result.current.onComboboxChange(JUST_KEY, 'left'));
    expect((UpdateFoundationParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRAWING-MODE BRANCH (no selection, tool active via store)
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonFoundationBridge — justification (drawing mode)', () => {
  function publishTool(kind: string, overrides: Record<string, unknown> = {}) {
    const setKind = jest.fn();
    const setAnchor = jest.fn();
    const setParamOverrides = jest.fn();
    foundationToolBridgeStore.set({
      isActive: true,
      kind: kind as never,
      anchor: 'center',
      overrides,
      setKind,
      setAnchor,
      setParamOverrides,
      getSceneUnits: () => 'mm',
    });
    return { setKind, setAnchor, setParamOverrides };
  }

  it('reads default center from tool overrides when absent (strip)', () => {
    publishTool('strip');
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(JUST_KEY)?.value).toBe(DEFAULT_STRIP_JUSTIFICATION);
  });

  it('write calls handle.setParamOverrides with justification', () => {
    const handlers = publishTool('tie-beam');
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    act(() => result.current.onComboboxChange(JUST_KEY, 'left'));
    expect(handlers.setParamOverrides).toHaveBeenCalledWith({ justification: 'left' });
  });

  it('justification combobox is null while a pad tool is active', () => {
    publishTool('pad');
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(JUST_KEY)).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADR-441 Slice 7 — AUTO RECONCILE on grid-guide settle
// ─────────────────────────────────────────────────────────────────────────────

const gridStrip = {
  ...stripFoundation,
  id: 'grid-strip-1',
  guideBindings: [
    { guideId: 'x0', slot: 'start-x' as const },
    { guideId: 'x0', slot: 'end-x' as const },
    { guideId: 'y0', slot: 'start-y' as const },
    { guideId: 'y1', slot: 'end-y' as const },
  ],
};

describe('useRibbonFoundationBridge — auto reconcile on grid-guides-settled', () => {
  const commitMock = commitFoundationGridFromGuides as jest.Mock;

  function mount(entity: unknown | null) {
    return renderHook(() =>
      useRibbonFoundationBridge({
        levelManager: makeLevelManager(entity),
        universalSelection: makeSelection(null),
      }),
    );
  }

  beforeEach(() => commitMock.mockClear());

  it('grid εσχάρα υπάρχει + delta>0 → τρέχει commit ΚΑΙ δείχνει toast', () => {
    commitMock.mockReturnValueOnce({ ok: true, created: 2, deleted: 1, unchanged: 5, rehosted: 0, reJustified: 1 });
    const toast = jest.fn();
    const offToast = EventBus.on('bim:foundations-from-grid', toast);
    mount(gridStrip);
    act(() => EventBus.emit('bim:grid-guides-settled', { levelId: 'lvl-1' }));
    expect(commitMock).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({ created: 2, deleted: 1, rehosted: 0, reJustified: 1 });
    offToast();
  });

  it('καμία grid εσχάρα (strip χωρίς bindings) → ΔΕΝ τρέχει commit (μην auto-create)', () => {
    mount(stripFoundation);
    act(() => EventBus.emit('bim:grid-guides-settled', { levelId: 'lvl-1' }));
    expect(commitMock).not.toHaveBeenCalled();
  });

  it('delta=0 (up-to-date) → τρέχει commit αλλά ΧΩΡΙΣ toast (μηδέν spam)', () => {
    commitMock.mockReturnValueOnce({ ok: false, reason: 'up-to-date', created: 0, deleted: 0, unchanged: 6, rehosted: 0, reJustified: 0 });
    const toast = jest.fn();
    const offToast = EventBus.on('bim:foundations-from-grid', toast);
    mount(gridStrip);
    act(() => EventBus.emit('bim:grid-guides-settled', { levelId: 'lvl-1' }));
    expect(commitMock).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    offToast();
  });

  it('διαφορετικό levelId → αγνοείται (gate)', () => {
    mount(gridStrip);
    act(() => EventBus.emit('bim:grid-guides-settled', { levelId: 'other-level' }));
    expect(commitMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADR-441 Slice 8 — live junction recompute σε αλλαγή έδρασης (το σενάριο Giorgio)
// ─────────────────────────────────────────────────────────────────────────────

const gridReader = (guides: readonly Guide[]): AxisGuideReader => ({
  getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis),
});
const mkGuide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({ id, axis, offset, visible: true, label: null, style: null, locked: false, createdAt: '', parentId: null, groupId: null } as Guide);

function build2x2Grid(): FoundationEntity[] {
  const r = buildStripGridFromGuides(
    gridReader([mkGuide('x0', 'X', 0), mkGuide('x1', 'X', 4000), mkGuide('y0', 'Y', 0), mkGuide('y1', 'Y', 8000)]),
    {}, 'lvl-1', 'mm',
  );
  return [...r.strips];
}

function makeStatefulLevelManager(entities: FoundationEntity[]) {
  let scene: { entities: FoundationEntity[] } = { entities };
  return {
    levelManager: {
      currentLevelId: 'lvl-1',
      getLevelScene: jest.fn(() => scene),
      setLevelScene: jest.fn((_id: string, next: { entities: FoundationEntity[] }) => { scene = next; }),
    } as unknown as Parameters<typeof useRibbonFoundationBridge>[0]['levelManager'],
    getScene: () => scene,
  };
}

const isVertical = (s: FoundationEntity) => 'start' in s.params && s.params.start.x === s.params.end.x;

describe('useRibbonFoundationBridge — Slice 8 live junction recompute (justification edit)', () => {
  it('outward έδραση σε περιμετρική → οι κάθετοι γείτονες αποκτούν miter extend (γωνία κλείνει live)', () => {
    const grid = build2x2Grid();
    const topH = grid.find((s) => 'start' in s.params && s.params.start.y === s.params.end.y && (s.params as StripFootingParams).start.y === 8000)!;
    const lm = makeStatefulLevelManager(grid);
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({ levelManager: lm.levelManager, universalSelection: makeSelection(topH.id) }),
    );
    act(() => result.current.onComboboxChange(JUST_KEY, 'left'));

    // ο edit έγινε (justification='left' στο dispatched params)
    const next = (UpdateFoundationParamsCommand as jest.Mock).mock.calls.at(-1)?.[1];
    expect(next.justification).toBe('left');
    // οι κάθετοι γείτονες ενημερώθηκαν με extend (RehostFoundationsCommand μέσα στο CompoundCommand)
    const extendedV = lm.getScene().entities.filter(
      (s) => isVertical(s) && (s.guideBindings ?? []).some((b) => b.extend !== undefined && Math.abs(b.extend) > 0),
    );
    expect(extendedV.length).toBeGreaterThan(0);
  });

  it('μη grid-managed λωρίδα (χωρίς bindings) → μόνο UpdateFoundationParamsCommand, μηδέν junction', () => {
    const lm = makeStatefulLevelManager([{ ...stripFoundation } as unknown as FoundationEntity]);
    const { result } = renderHook(() =>
      useRibbonFoundationBridge({ levelManager: lm.levelManager, universalSelection: makeSelection('found-strip-1') }),
    );
    act(() => result.current.onComboboxChange(JUST_KEY, 'left'));
    expect((UpdateFoundationParamsCommand as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    const extended = lm.getScene().entities.filter((s) => (s.guideBindings ?? []).some((b) => b.extend !== undefined));
    expect(extended).toHaveLength(0);
  });
});
