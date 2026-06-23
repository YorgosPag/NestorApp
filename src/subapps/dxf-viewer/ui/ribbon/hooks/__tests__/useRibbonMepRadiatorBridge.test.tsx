/**
 * ADR-408 Εύρος Β #1 — useRibbonMepRadiatorBridge tests.
 *
 * Coverage:
 *   - getComboboxState: reads numeric params (width / connectorDiameter); returns
 *     null for an unspecified optional field (thermalOutputW absent) and with no
 *     selection.
 *   - onComboboxChange: dispatches an UpdateMepRadiatorParamsCommand with the
 *     patched field; ignores NaN. (Connector re-seeding is the command's job — the
 *     bridge does NOT pre-build connectors, unlike the manifold bridge.)
 *   - onAction: delete emits the delete-requested event (confirm accepted); close
 *     is a no-op in the bridge (handled centrally by routeRibbonAction, ADR-363).
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonMepRadiatorBridge } from '../useRibbonMepRadiatorBridge';
import {
  MEP_RADIATOR_RIBBON_KEYS,
  MEP_RADIATOR_RIBBON_KEYS_ACTIONS,
} from '../bridge/mep-radiator-command-keys';
import { UpdateMepRadiatorParamsCommand } from '../../../../core/commands/entity-commands/UpdateMepRadiatorParamsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../../../core/commands';

// Break the Firebase transitive import chain from useRadiatorSizing → useSpaceHeatLoads
// → useHeatLoadInputs → useLevels → Firebase. Mirror of the boiler test pattern.
let mockHeatLoads: { results: Map<string, { totalW: number }>; totalW: number } | null = null;
jest.mock('../../../../hooks/data/useSpaceHeatLoads', () => ({
  useSpaceHeatLoads: () => mockHeatLoads,
}));
jest.mock('../../../../bim/mep-systems/mep-system-store', () => ({
  useMepSystemStore: { getState: () => ({ getSystems: () => [] }) },
}));

// Mock the command to capture the patched params (avoids geometry/validation calc).
jest.mock(
  '../../../../core/commands/entity-commands/UpdateMepRadiatorParamsCommand',
  () => ({
    UpdateMepRadiatorParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

const radiator = {
  id: 'rad-1',
  type: 'mep-radiator' as const,
  kind: 'panel-radiator' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcSpaceHeater' as const,
  params: {
    kind: 'panel-radiator' as const,
    shape: 'rectangular' as const,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 1000,
    length: 100,
    bodyHeightMm: 600,
    mountingElevationMm: 450,
    connectorDiameterMm: 15,
    sceneUnits: 'mm' as const,
    connectors: [],
  },
  geometry: { footprint: { vertices: [] }, bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, area: 0, height: 600 },
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof radiator] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepRadiatorBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
  } as unknown as Parameters<typeof useRibbonMepRadiatorBridge>[0]['universalSelection'];
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateMepRadiatorParamsCommand as jest.Mock).mockClear();
});

describe('useRibbonMepRadiatorBridge — getComboboxState', () => {
  it('reads numeric params (width / connectorDiameter)', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_RADIATOR_RIBBON_KEYS.params.width)?.value).toBe('1000');
    expect(result.current.getComboboxState(MEP_RADIATOR_RIBBON_KEYS.params.connectorDiameter)?.value).toBe('15');
  });

  it('returns null for an unspecified optional field (thermalOutputW absent)', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_RADIATOR_RIBBON_KEYS.params.thermalOutput)).toBe(null);
  });

  it('returns null with no selection', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(null),
        universalSelection: makeSelection(null),
      }),
    );
    expect(result.current.getComboboxState(MEP_RADIATOR_RIBBON_KEYS.params.width)).toBe(null);
  });
});

describe('useRibbonMepRadiatorBridge — onComboboxChange', () => {
  it('width change patches the field', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_RADIATOR_RIBBON_KEYS.params.width, '1200'));
    const next = (UpdateMepRadiatorParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.width).toBe(1200);
  });

  it('thermalOutput change patches the optional field', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_RADIATOR_RIBBON_KEYS.params.thermalOutput, '1500'));
    const next = (UpdateMepRadiatorParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.thermalOutputW).toBe(1500);
  });

  it('ignores NaN numeric input (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_RADIATOR_RIBBON_KEYS.params.width, 'abc'));
    expect((UpdateMepRadiatorParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('ignores unowned command keys (no dispatch)', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    act(() => result.current.onComboboxChange('mepManifold.params.width', '600'));
    expect((UpdateMepRadiatorParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

describe('useRibbonMepRadiatorBridge — onAction', () => {
  it('emits bim:mep-radiator-delete-requested when confirmed', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    act(() => result.current.onAction(MEP_RADIATOR_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).toHaveBeenCalledWith('bim:mep-radiator-delete-requested', { radiatorId: 'rad-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('does NOT emit delete when the confirm is declined', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    act(() => result.current.onAction(MEP_RADIATOR_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).not.toHaveBeenCalledWith('bim:mep-radiator-delete-requested', { radiatorId: 'rad-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });

  it('close is a no-op in the bridge — intercepted centrally by routeRibbonAction (ADR-363)', () => {
    const { result } = renderHook(() =>
      useRibbonMepRadiatorBridge({
        levelManager: makeLevelManager(radiator),
        universalSelection: makeSelection('rad-1'),
      }),
    );
    // «Κλείσιμο» never reaches the bridge — routeRibbonAction intercepts it first.
    expect(() => act(() => result.current.onAction(MEP_RADIATOR_RIBBON_KEYS_ACTIONS.close))).not.toThrow();
  });
});
