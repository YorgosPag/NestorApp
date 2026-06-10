/**
 * ADR-408 Φ3/Φ6 — useRibbonElectricalPanelBridge tests.
 *
 * Coverage:
 *   - getComboboxState: reads numeric params (width / length / rotation / body
 *     height / mounting elevation).
 *   - onComboboxChange: dispatches an UpdateElectricalPanelParamsCommand with the
 *     patched field; ignores NaN.
 *   - getPanelVisibility: hasCircuits visible iff the panel sources ≥1 circuit.
 *   - onAction: delete emits the delete-requested event (confirm accepted); close
 *     clears the selection.
 */

import { renderHook, act } from '@testing-library/react';
import {
  useRibbonElectricalPanelBridge,
  isElectricalPanelPanelVisibilityKey,
} from '../useRibbonElectricalPanelBridge';
import {
  ELECTRICAL_PANEL_RIBBON_KEYS,
  ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS,
  ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS,
} from '../bridge/electrical-panel-command-keys';
import { UpdateElectricalPanelParamsCommand } from '../../../../core/commands/entity-commands/UpdateElectricalPanelParamsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../../../core/commands';
import { useMepSystemStore } from '../../../../bim/mep-systems/mep-system-store';
import type { MepSystemEntity } from '../../../../bim/types/mep-system-types';

// Mock the command to capture the patched params (avoids geometry/validation calc).
jest.mock(
  '../../../../core/commands/entity-commands/UpdateElectricalPanelParamsCommand',
  () => ({
    UpdateElectricalPanelParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

const panel = {
  id: 'pnl-1',
  type: 'electrical-panel' as const,
  kind: 'distribution-board' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcElectricDistributionBoard' as const,
  params: {
    kind: 'distribution-board' as const,
    shape: 'rectangular' as const,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 600,
    length: 150,
    bodyHeightMm: 700,
    mountingElevationMm: 1500,
    sceneUnits: 'mm' as const,
    connectors: [],
  },
  geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, height: 700 },
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof panel] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonElectricalPanelBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
    clearAll: jest.fn(),
  } as unknown as Parameters<typeof useRibbonElectricalPanelBridge>[0]['universalSelection'];
}

/** A circuit sourced by the panel. */
function circuitSourcedBy(sourceId: string): MepSystemEntity {
  return {
    id: 'circ-1',
    params: {
      name: 'Κύκλωμα 1',
      systemClassification: 'power',
      sourceEntityId: sourceId,
      sourceConnectorId: 'pnl-out-0',
      members: [],
    },
  } as unknown as MepSystemEntity;
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateElectricalPanelParamsCommand as jest.Mock).mockClear();
  useMepSystemStore.setState({ systems: [] });
});

describe('useRibbonElectricalPanelBridge — getComboboxState', () => {
  it('reads numeric params (width / length / rotation / bodyHeight / mountingElevation)', () => {
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    expect(result.current.getComboboxState(ELECTRICAL_PANEL_RIBBON_KEYS.params.width)?.value).toBe('600');
    expect(result.current.getComboboxState(ELECTRICAL_PANEL_RIBBON_KEYS.params.length)?.value).toBe('150');
    expect(result.current.getComboboxState(ELECTRICAL_PANEL_RIBBON_KEYS.params.rotation)?.value).toBe('0');
    expect(result.current.getComboboxState(ELECTRICAL_PANEL_RIBBON_KEYS.params.bodyHeight)?.value).toBe('700');
    expect(result.current.getComboboxState(ELECTRICAL_PANEL_RIBBON_KEYS.params.mountingElevation)?.value).toBe('1500');
  });

  it('returns null with no selection', () => {
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(ELECTRICAL_PANEL_RIBBON_KEYS.params.width)).toBe(null);
  });
});

describe('useRibbonElectricalPanelBridge — onComboboxChange', () => {
  it('width change patches the field via UpdateElectricalPanelParamsCommand', () => {
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    act(() => result.current.onComboboxChange(ELECTRICAL_PANEL_RIBBON_KEYS.params.width, '800'));
    const next = (UpdateElectricalPanelParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.width).toBe(800);
  });

  it('mountingElevation change patches the field', () => {
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    act(() => result.current.onComboboxChange(ELECTRICAL_PANEL_RIBBON_KEYS.params.mountingElevation, '1800'));
    const next = (UpdateElectricalPanelParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.mountingElevationMm).toBe(1800);
  });

  it('ignores NaN numeric input (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    act(() => result.current.onComboboxChange(ELECTRICAL_PANEL_RIBBON_KEYS.params.width, 'abc'));
    expect((UpdateElectricalPanelParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

describe('useRibbonElectricalPanelBridge — getPanelVisibility hasCircuits', () => {
  it('hidden when the panel sources no circuit', () => {
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    expect(result.current.getPanelVisibility(ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS.hasCircuits)).toBe(false);
  });

  it('visible when the panel sources a circuit', () => {
    act(() => useMepSystemStore.setState({ systems: [circuitSourcedBy('pnl-1')] }));
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    expect(result.current.getPanelVisibility(ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS.hasCircuits)).toBe(true);
  });

  it('unowned visibility key returns true (no-op); type guard recognizes own keys', () => {
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    expect(result.current.getPanelVisibility('column.visibility.polygonParams')).toBe(true);
    expect(isElectricalPanelPanelVisibilityKey(ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS.hasCircuits)).toBe(true);
    expect(isElectricalPanelPanelVisibilityKey('column.visibility.polygonParams')).toBe(false);
  });
});

describe('useRibbonElectricalPanelBridge — onAction', () => {
  it('emits bim:electrical-panel-delete-requested when confirmed', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    act(() => result.current.onAction(ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).toHaveBeenCalledWith('bim:electrical-panel-delete-requested', { panelId: 'pnl-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('does NOT emit delete when the confirm is rejected', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: makeSelection('pnl-1'),
      }),
    );
    act(() => result.current.onAction(ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).not.toHaveBeenCalledWith('bim:electrical-panel-delete-requested', { panelId: 'pnl-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('close clears the selection', () => {
    const selection = makeSelection('pnl-1');
    const { result } = renderHook(() =>
      useRibbonElectricalPanelBridge({
        levelManager: makeLevelManager(panel),
        universalSelection: selection,
      }),
    );
    act(() => result.current.onAction(ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS.close));
    expect(selection.clearAll).toHaveBeenCalled();
  });
});
