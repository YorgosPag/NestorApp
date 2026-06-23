/**
 * ADR-408 DHW — useRibbonMepWaterHeaterBridge tests.
 *
 * Coverage:
 *   - getComboboxState: reads numeric params (width / connectorDiameter); returns
 *     null for an unspecified optional field (thermalOutputW absent), for absent
 *     tankCapacityL, and with no selection.
 *   - onComboboxChange: dispatches an UpdateMepWaterHeaterParamsCommand with the
 *     patched field; ignores NaN. (Connector re-seeding is the command's job — the
 *     bridge does NOT pre-build connectors, unlike the manifold bridge.)
 *   - onAction: delete emits the delete-requested event (confirm accepted); close
 *     is a no-op in the bridge (handled centrally by routeRibbonAction, ADR-363).
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonMepWaterHeaterBridge } from '../useRibbonMepWaterHeaterBridge';
import {
  MEP_WATER_HEATER_RIBBON_KEYS,
  MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS,
} from '../bridge/mep-water-heater-command-keys';
import { UpdateMepWaterHeaterParamsCommand } from '../../../../core/commands/entity-commands/UpdateMepWaterHeaterParamsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../../../core/commands';

// Απομόνωση του command — αποφυγή geometry/validation υπολογισμών.
jest.mock(
  '../../../../core/commands/entity-commands/UpdateMepWaterHeaterParamsCommand',
  () => ({
    UpdateMepWaterHeaterParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

// Fixture: electric water heater, width 500, connectorDiameterMm 22.
// thermalOutputW and tankCapacityL are absent intentionally (optional fields).
const waterHeater = {
  id: 'wh-1',
  type: 'mep-water-heater' as const,
  kind: 'electric-water-heater' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcUnitaryEquipment' as const,
  params: {
    kind: 'electric-water-heater' as const,
    shape: 'rectangular' as const,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 500,
    length: 500,
    bodyHeightMm: 900,
    mountingElevationMm: 1500,
    connectorDiameterMm: 22,
    systemClassification: 'domestic-hot-water' as const,
    sceneUnits: 'mm' as const,
    connectors: [],
  },
  geometry: {
    footprint: { vertices: [] },
    bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    area: 0,
    height: 900,
  },
  validation: {
    isValid: true,
    hardErrors: [],
    softWarnings: [],
    hasCodeViolations: false,
  },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof waterHeater] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepWaterHeaterBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
  } as unknown as Parameters<typeof useRibbonMepWaterHeaterBridge>[0]['universalSelection'];
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateMepWaterHeaterParamsCommand as jest.Mock).mockClear();
});

describe('useRibbonMepWaterHeaterBridge — getComboboxState', () => {
  it('reads numeric params (width / connectorDiameter)', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    expect(
      result.current.getComboboxState(MEP_WATER_HEATER_RIBBON_KEYS.params.width)?.value,
    ).toBe('500');
    expect(
      result.current.getComboboxState(MEP_WATER_HEATER_RIBBON_KEYS.params.connectorDiameter)?.value,
    ).toBe('22');
  });

  it('returns null for an unspecified optional field (thermalOutputW absent)', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    expect(
      result.current.getComboboxState(MEP_WATER_HEATER_RIBBON_KEYS.params.thermalOutput),
    ).toBe(null);
  });

  it('returns null for an unspecified optional field (tankCapacityL absent)', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    expect(
      result.current.getComboboxState(MEP_WATER_HEATER_RIBBON_KEYS.params.tankCapacityL),
    ).toBe(null);
  });

  it('returns null with no selection', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(
      result.current.getComboboxState(MEP_WATER_HEATER_RIBBON_KEYS.params.width),
    ).toBe(null);
  });
});

describe('useRibbonMepWaterHeaterBridge — onComboboxChange', () => {
  it('width change patches the field', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    act(() =>
      result.current.onComboboxChange(MEP_WATER_HEATER_RIBBON_KEYS.params.width, '600'),
    );
    const next = (UpdateMepWaterHeaterParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.width).toBe(600);
  });

  it('thermalOutput change patches the optional field', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    act(() =>
      result.current.onComboboxChange(
        MEP_WATER_HEATER_RIBBON_KEYS.params.thermalOutput,
        '2000',
      ),
    );
    const next = (UpdateMepWaterHeaterParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.thermalOutputW).toBe(2000);
  });

  it('tankCapacityL change patches the optional field', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    act(() =>
      result.current.onComboboxChange(
        MEP_WATER_HEATER_RIBBON_KEYS.params.tankCapacityL,
        '100',
      ),
    );
    const next = (UpdateMepWaterHeaterParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.tankCapacityL).toBe(100);
  });

  it('ignores NaN numeric input (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    act(() =>
      result.current.onComboboxChange(MEP_WATER_HEATER_RIBBON_KEYS.params.width, 'abc'),
    );
    expect((UpdateMepWaterHeaterParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('ignores unowned command keys (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    act(() =>
      result.current.onComboboxChange('mepBoiler.params.width', '600'),
    );
    expect((UpdateMepWaterHeaterParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

describe('useRibbonMepWaterHeaterBridge — onAction', () => {
  it('emits bim:mep-water-heater-delete-requested when confirmed', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    act(() => result.current.onAction(MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).toHaveBeenCalledWith('bim:mep-water-heater-delete-requested', {
      waterHeaterId: 'wh-1',
    });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('does NOT emit delete when the confirm is declined', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    act(() => result.current.onAction(MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).not.toHaveBeenCalledWith(
      'bim:mep-water-heater-delete-requested',
      { waterHeaterId: 'wh-1' },
    );
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('close is a no-op in the bridge — intercepted centrally by routeRibbonAction (ADR-363)', () => {
    const { result } = renderHook(() =>
      useRibbonMepWaterHeaterBridge({
        levelManager: makeLevelManager(waterHeater),
        universalSelection: makeSelection('wh-1'),
      }),
    );
    // «Κλείσιμο» never reaches the bridge — routeRibbonAction intercepts it first.
    // Verify onAction does not throw.
    expect(() => act(() => result.current.onAction(MEP_WATER_HEATER_RIBBON_KEYS_ACTIONS.close))).not.toThrow();
  });
});
