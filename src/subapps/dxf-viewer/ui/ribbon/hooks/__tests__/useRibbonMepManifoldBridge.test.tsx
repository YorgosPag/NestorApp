/**
 * ADR-408 Φ12 — useRibbonMepManifoldBridge tests.
 *
 * Coverage:
 *   - getComboboxState: reads numeric params (width / outletCount / diameters).
 *   - onComboboxChange: dispatches an UpdateMepManifoldParamsCommand with the
 *     patched field; **re-seeds connectors** (1 inlet + N outlets) on outletCount
 *     change; clamps outletCount to [MIN, MAX]; ignores NaN.
 *   - getPanelVisibility: hasNetwork visible iff the manifold sources a network.
 *   - onAction: delete emits the delete-requested event (confirm accepted).
 */

import { renderHook, act } from '@testing-library/react';
import {
  useRibbonMepManifoldBridge,
  isMepManifoldPanelVisibilityKey,
} from '../useRibbonMepManifoldBridge';
import {
  MEP_MANIFOLD_RIBBON_KEYS,
  MEP_MANIFOLD_RIBBON_KEYS_ACTIONS,
  MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS,
} from '../bridge/mep-manifold-command-keys';
import { UpdateMepManifoldParamsCommand } from '../../../../core/commands/entity-commands/UpdateMepManifoldParamsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../../../core/commands';
import { useMepSystemStore } from '../../../../bim/mep-systems/mep-system-store';
import type { MepSystemEntity } from '../../../../bim/types/mep-system-types';

// Mock the command to capture the patched params (avoids geometry/validation calc).
jest.mock(
  '../../../../core/commands/entity-commands/UpdateMepManifoldParamsCommand',
  () => ({
    UpdateMepManifoldParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

const manifold = {
  id: 'mfld-1',
  type: 'mep-manifold' as const,
  kind: 'floor-manifold' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcPipeFitting' as const,
  params: {
    kind: 'floor-manifold' as const,
    shape: 'rectangular' as const,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 400,
    length: 80,
    bodyHeightMm: 60,
    mountingElevationMm: 400,
    outletCount: 4,
    inletDiameterMm: 25,
    outletDiameterMm: 16,
    sceneUnits: 'mm' as const,
    connectors: [],
  },
  geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, height: 60 },
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof manifold] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepManifoldBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
  } as unknown as Parameters<typeof useRibbonMepManifoldBridge>[0]['universalSelection'];
}

/** A plumbing network sourced by the manifold. */
function networkSourcedBy(sourceId: string): MepSystemEntity {
  return {
    id: 'net-1',
    params: {
      name: 'Δίκτυο 1',
      systemClassification: 'domestic-cold-water',
      sourceEntityId: sourceId,
      sourceConnectorId: 'mfld-out-0',
      members: [],
    },
  } as unknown as MepSystemEntity;
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateMepManifoldParamsCommand as jest.Mock).mockClear();
  useMepSystemStore.setState({ systems: [] });
});

describe('useRibbonMepManifoldBridge — getComboboxState', () => {
  it('reads numeric params (width / outletCount / diameters)', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_MANIFOLD_RIBBON_KEYS.params.width)?.value).toBe('400');
    expect(result.current.getComboboxState(MEP_MANIFOLD_RIBBON_KEYS.params.outletCount)?.value).toBe('4');
    expect(result.current.getComboboxState(MEP_MANIFOLD_RIBBON_KEYS.params.inletDiameter)?.value).toBe('25');
    expect(result.current.getComboboxState(MEP_MANIFOLD_RIBBON_KEYS.params.outletDiameter)?.value).toBe('16');
  });

  it('returns null with no selection', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(MEP_MANIFOLD_RIBBON_KEYS.params.width)).toBe(null);
  });
});

describe('useRibbonMepManifoldBridge — onComboboxChange (re-seed connectors)', () => {
  it('outletCount change patches the field AND re-seeds connectors (1 inlet + N outlets)', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_MANIFOLD_RIBBON_KEYS.params.outletCount, '6'));
    const next = (UpdateMepManifoldParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.outletCount).toBe(6);
    expect(next.connectors).toHaveLength(7); // 1 inlet + 6 outlets
  });

  it('clamps outletCount above MAX (12)', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_MANIFOLD_RIBBON_KEYS.params.outletCount, '99'));
    const next = (UpdateMepManifoldParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.outletCount).toBe(12);
    expect(next.connectors).toHaveLength(13);
  });

  it('width change patches the field and rebuilds connectors', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_MANIFOLD_RIBBON_KEYS.params.width, '600'));
    const next = (UpdateMepManifoldParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.width).toBe(600);
    expect(next.connectors).toHaveLength(5); // unchanged outletCount=4 → 1 inlet + 4
  });

  it('ignores NaN numeric input (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_MANIFOLD_RIBBON_KEYS.params.width, 'abc'));
    expect((UpdateMepManifoldParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

describe('useRibbonMepManifoldBridge — getPanelVisibility hasNetwork', () => {
  it('hidden when the manifold sources no network', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork)).toBe(false);
  });

  it('visible when the manifold sources a network', () => {
    act(() => useMepSystemStore.setState({ systems: [networkSourcedBy('mfld-1')] }));
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork)).toBe(true);
  });

  it('unowned visibility key returns true (no-op); type guard recognizes own keys', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    expect(result.current.getPanelVisibility('column.visibility.polygonParams')).toBe(true);
    expect(isMepManifoldPanelVisibilityKey(MEP_MANIFOLD_RIBBON_VISIBILITY_KEYS.hasNetwork)).toBe(true);
    expect(isMepManifoldPanelVisibilityKey('column.visibility.polygonParams')).toBe(false);
  });
});

describe('useRibbonMepManifoldBridge — onAction', () => {
  it('emits bim:mep-manifold-delete-requested when confirmed', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    act(() => result.current.onAction(MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).toHaveBeenCalledWith('bim:mep-manifold-delete-requested', { manifoldId: 'mfld-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('close is a no-op in the bridge — intercepted centrally by routeRibbonAction (ADR-363)', () => {
    const { result } = renderHook(() =>
      useRibbonMepManifoldBridge({
        levelManager: makeLevelManager(manifold),
        universalSelection: makeSelection('mfld-1'),
      }),
    );
    // «Κλείσιμο» never reaches the bridge — routeRibbonAction intercepts it first.
    expect(() => act(() => result.current.onAction(MEP_MANIFOLD_RIBBON_KEYS_ACTIONS.close))).not.toThrow();
  });
});
