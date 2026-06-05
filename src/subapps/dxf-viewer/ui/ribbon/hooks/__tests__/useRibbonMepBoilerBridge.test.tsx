/**
 * ADR-408 Εύρος Β #2 — useRibbonMepBoilerBridge tests.
 *
 * Coverage:
 *   - getComboboxState: reads numeric params (width / connectorDiameter); returns
 *     null for an unspecified optional field (thermalOutputW absent) and with no
 *     selection.
 *   - onComboboxChange: dispatches an UpdateMepBoilerParamsCommand with the
 *     patched field; ignores NaN. (Connector re-seeding is the command's job — the
 *     bridge does NOT pre-build connectors, unlike the manifold bridge.)
 *   - onAction: delete emits the delete-requested event (confirm accepted); close
 *     clears the selection.
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonMepBoilerBridge } from '../useRibbonMepBoilerBridge';
import {
  MEP_BOILER_RIBBON_KEYS,
  MEP_BOILER_RIBBON_KEYS_ACTIONS,
} from '../bridge/mep-boiler-command-keys';
import { UpdateMepBoilerParamsCommand } from '../../../../core/commands/entity-commands/UpdateMepBoilerParamsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../../../core/commands';

// Απομόνωση του command — αποφυγή geometry/validation υπολογισμών.
jest.mock(
  '../../../../core/commands/entity-commands/UpdateMepBoilerParamsCommand',
  () => ({
    UpdateMepBoilerParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

// Fixture: επίτοιχος λέβητας (wall-boiler), width 450, connectorDiameterMm 22.
// thermalOutputW απουσιάζει ηθελημένα (optional field).
const boiler = {
  id: 'boiler-1',
  type: 'mep-boiler' as const,
  kind: 'wall-boiler' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcBoiler' as const,
  params: {
    kind: 'wall-boiler' as const,
    shape: 'rectangular' as const,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 450,
    length: 300,
    bodyHeightMm: 700,
    mountingElevationMm: 1200,
    connectorDiameterMm: 22,
    systemClassification: 'hydronic-supply' as const,
    sceneUnits: 'mm' as const,
    connectors: [],
  },
  geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, height: 700 },
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof boiler] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepBoilerBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
    clearAll: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepBoilerBridge>[0]['universalSelection'];
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateMepBoilerParamsCommand as jest.Mock).mockClear();
});

describe('useRibbonMepBoilerBridge — getComboboxState', () => {
  it('reads numeric params (width / connectorDiameter)', () => {
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_BOILER_RIBBON_KEYS.params.width)?.value).toBe('450');
    expect(result.current.getComboboxState(MEP_BOILER_RIBBON_KEYS.params.connectorDiameter)?.value).toBe('22');
  });

  it('returns null for an unspecified optional field (thermalOutputW absent)', () => {
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_BOILER_RIBBON_KEYS.params.thermalOutput)).toBe(null);
  });

  it('returns null with no selection', () => {
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(MEP_BOILER_RIBBON_KEYS.params.width)).toBe(null);
  });
});

describe('useRibbonMepBoilerBridge — onComboboxChange', () => {
  it('width change patches the field', () => {
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_BOILER_RIBBON_KEYS.params.width, '600'));
    const next = (UpdateMepBoilerParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.width).toBe(600);
  });

  it('thermalOutput change patches the optional field', () => {
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_BOILER_RIBBON_KEYS.params.thermalOutput, '24000'));
    const next = (UpdateMepBoilerParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.thermalOutputW).toBe(24000);
  });

  it('ignores NaN numeric input (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_BOILER_RIBBON_KEYS.params.width, 'abc'));
    expect((UpdateMepBoilerParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('ignores unowned command keys (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    act(() => result.current.onComboboxChange('mepRadiator.params.width', '600'));
    expect((UpdateMepBoilerParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

describe('useRibbonMepBoilerBridge — onAction', () => {
  it('emits bim:mep-boiler-delete-requested when confirmed', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    act(() => result.current.onAction(MEP_BOILER_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).toHaveBeenCalledWith('bim:mep-boiler-delete-requested', { boilerId: 'boiler-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('does NOT emit delete when the confirm is declined', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: makeSelection('boiler-1'),
      }),
    );
    act(() => result.current.onAction(MEP_BOILER_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).not.toHaveBeenCalledWith('bim:mep-boiler-delete-requested', { boilerId: 'boiler-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('close clears the selection', () => {
    const selection = makeSelection('boiler-1');
    const { result } = renderHook(() =>
      useRibbonMepBoilerBridge({
        levelManager: makeLevelManager(boiler),
        universalSelection: selection,
      }),
    );
    act(() => result.current.onAction(MEP_BOILER_RIBBON_KEYS_ACTIONS.close));
    expect(selection.clearAll).toHaveBeenCalled();
  });
});
