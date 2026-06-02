/**
 * ADR-406 — useRibbonMepFixtureBridge tests.
 *
 * Coverage:
 *   - getComboboxState: reads shape (string) + numeric params (width/length/
 *     rotation/bodyHeightMm/mountingElevationMm) from the selected fixture.
 *   - onComboboxChange: dispatches an UpdateMepFixtureParamsCommand with the
 *     patched field; ignores NaN numeric input (no-op).
 *   - getPanelVisibility: rectangularParams visible iff shape === 'rectangular'.
 *   - onAction: delete emits the delete-requested event (confirm accepted).
 *   - No selection → getComboboxState null, rectangularParams hidden.
 */

import { renderHook, act } from '@testing-library/react';
import {
  useRibbonMepFixtureBridge,
  isMepFixturePanelVisibilityKey,
} from '../useRibbonMepFixtureBridge';
import {
  MEP_FIXTURE_RIBBON_KEYS,
  MEP_FIXTURE_RIBBON_KEYS_ACTIONS,
  MEP_FIXTURE_RIBBON_VISIBILITY_KEYS,
} from '../bridge/mep-fixture-command-keys';
import { UpdateMepFixtureParamsCommand } from '../../../../core/commands/entity-commands/UpdateMepFixtureParamsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../../../core/commands';

// ── Mock UpdateMepFixtureParamsCommand to capture writes (avoids geometry calc) ──
jest.mock(
  '../../../../core/commands/entity-commands/UpdateMepFixtureParamsCommand',
  () => ({
    UpdateMepFixtureParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

// ── Test fixtures ────────────────────────────────────────────────────────────
const rectFixture = {
  id: 'fix-rect-1',
  type: 'mep-fixture' as const,
  kind: 'light-fixture' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcLightFixture' as const,
  params: {
    kind: 'light-fixture' as const,
    shape: 'rectangular' as const,
    position: { x: 0, y: 0, z: 0 },
    rotation: 30,
    width: 600,
    length: 600,
    bodyHeightMm: 80,
    mountingElevationMm: 2700,
    sceneUnits: 'mm' as const,
  },
  geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, height: 80 },
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

const circularFixture = {
  ...rectFixture,
  id: 'fix-circ-1',
  params: { ...rectFixture.params, shape: 'circular' as const, width: 200 },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof rectFixture] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepFixtureBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
    getSelectedEntityIds: jest.fn(() => (id ? [id] : [])),
  } as unknown as Parameters<typeof useRibbonMepFixtureBridge>[0]['universalSelection'];
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateMepFixtureParamsCommand as jest.Mock).mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// getComboboxState
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonMepFixtureBridge — getComboboxState', () => {
  it('reads shape (string) from the selected fixture', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.stringParams.shape)?.value).toBe('rectangular');
  });

  it('reads numeric params (width / length / rotation / body / mounting)', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.params.width)?.value).toBe('600');
    expect(result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.params.length)?.value).toBe('600');
    expect(result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.params.rotation)?.value).toBe('30');
    expect(result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.params.bodyHeight)?.value).toBe('80');
    expect(result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.params.mountingElevation)?.value).toBe('2700');
  });

  it('returns null with no selection', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.params.width)).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// onComboboxChange
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonMepFixtureBridge — onComboboxChange', () => {
  it('dispatches a width patch via UpdateMepFixtureParamsCommand', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_FIXTURE_RIBBON_KEYS.params.width, '1200'));
    const next = (UpdateMepFixtureParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.width).toBe(1200);
  });

  it('dispatches a shape patch', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_FIXTURE_RIBBON_KEYS.stringParams.shape, 'circular'));
    const next = (UpdateMepFixtureParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.shape).toBe('circular');
  });

  it('ignores NaN numeric input (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_FIXTURE_RIBBON_KEYS.params.width, 'abc'));
    expect((UpdateMepFixtureParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPanelVisibility
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonMepFixtureBridge — getPanelVisibility', () => {
  it('rectangularParams visible when shape === rectangular', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams)).toBe(true);
  });

  it('rectangularParams hidden when shape === circular', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(circularFixture),
        universalSelection: makeSelection('fix-circ-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams)).toBe(false);
  });

  it('rectangularParams hidden with no selection', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams)).toBe(false);
  });

  it('unowned visibility key returns true (no-op)', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    expect(result.current.getPanelVisibility('column.visibility.polygonParams')).toBe(true);
  });

  it('isMepFixturePanelVisibilityKey type guard recognizes own keys', () => {
    expect(isMepFixturePanelVisibilityKey(MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams)).toBe(true);
    expect(isMepFixturePanelVisibilityKey('column.visibility.polygonParams')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// onAction — delete
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonMepFixtureBridge — onAction delete', () => {
  it('emits bim:mep-fixture-delete-requested when confirmed', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    act(() => result.current.onAction(MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).toHaveBeenCalledWith('bim:mep-fixture-delete-requested', { fixtureId: 'fix-rect-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('does not emit when confirm is rejected', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    act(() => result.current.onAction(MEP_FIXTURE_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).not.toHaveBeenCalledWith('bim:mep-fixture-delete-requested', expect.anything());
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });
});
