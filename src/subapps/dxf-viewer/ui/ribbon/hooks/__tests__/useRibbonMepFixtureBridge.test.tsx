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
import { useMepSystemStore } from '../../../../bim/mep-systems/mep-system-store';
import { useMepCircuitEditorStore } from '../../../../bim/mep-systems/mep-circuit-editor-store';
import type { MepSystemEntity } from '../../../../bim/types/mep-system-types';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';

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

/** A sanitary shower fixture — eligible for the `shower_realistic_01` mesh preset. */
const showerFixture = {
  ...rectFixture,
  id: 'fix-shower-1',
  kind: 'shower' as const,
  ifcType: 'IfcSanitaryTerminal' as const,
  params: {
    ...rectFixture.params,
    kind: 'shower' as const,
    width: 900,
    length: 900,
  },
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
    select: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepFixtureBridge>[0]['universalSelection'];
}

/** A circuit (`MepSystemEntity`) sourced by `panel-1`, with `fix-rect-1` as a member. */
function circuitWithMember(memberId: string): MepSystemEntity {
  return {
    id: 'sys-1',
    params: {
      name: 'L1',
      systemClassification: 'lighting',
      sourceEntityId: 'panel-1',
      sourceConnectorId: 'panel-out',
      members: [{ entityId: memberId, connectorId: 'fixture-power' }],
    },
  } as unknown as MepSystemEntity;
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateMepFixtureParamsCommand as jest.Mock).mockClear();
  useMepSystemStore.setState({ systems: [] });
  useMepCircuitEditorStore.setState({ activeSystemId: null });
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
// ADR-411 2D polish (issue #1) — assetId pick adopts the mesh's authored footprint
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonMepFixtureBridge — assetId (mesh footprint sizing)', () => {
  it('adopts the preset width/length + rectangular shape when picking a matching mesh', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(showerFixture),
        universalSelection: makeSelection('fix-shower-1'),
      }),
    );
    act(() => result.current.onComboboxChange(
      MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId, 'shower_realistic_01',
    ));
    const next = (UpdateMepFixtureParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.assetId).toBe('shower_realistic_01');
    expect(next.shape).toBe('rectangular');
    // Catalog preset (measured glTF bbox): 1304 (width) × 1049 (depth → length).
    expect(next.width).toBe(1304);
    expect(next.length).toBe(1049);
  });

  it('is a no-op when the mesh kind does not match the fixture (shower mesh on a light)', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    act(() => result.current.onComboboxChange(
      MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId, 'shower_realistic_01',
    ));
    expect((UpdateMepFixtureParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('clearing the mesh resets assetId but keeps the footprint (no revert)', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager({ ...showerFixture, params: { ...showerFixture.params, assetId: 'shower_realistic_01', width: 1300, length: 1050 } }),
        universalSelection: makeSelection('fix-shower-1'),
      }),
    );
    act(() => result.current.onComboboxChange(
      MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId, SELECT_CLEAR_VALUE,
    ));
    const next = (UpdateMepFixtureParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.assetId).toBeUndefined();
    expect(next.width).toBe(1300);
    expect(next.length).toBe(1050);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADR-411 — assetId dropdown lists ONLY this fixture's sanitary-kind meshes
// (Revit family filtering): a shower offers shower models, never WC models.
// ─────────────────────────────────────────────────────────────────────────────

const wcFixture = {
  ...rectFixture,
  id: 'fix-wc-1',
  kind: 'wc' as const,
  ifcType: 'IfcSanitaryTerminal' as const,
  params: { ...rectFixture.params, kind: 'wc' as const, width: 380, length: 680 },
};

describe('useRibbonMepFixtureBridge — assetId per-kind picker options', () => {
  it('a shower fixture lists shower meshes + parametric, and NO non-shower mesh', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(showerFixture),
        universalSelection: makeSelection('fix-shower-1'),
      }),
    );
    const state = result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId);
    const values = (state?.options ?? []).map((o) => o.value);
    expect(values).toContain(SELECT_CLEAR_VALUE);
    expect(values).toContain('shower_realistic_01');
    // No WC mesh leaks into a shower fixture's picker.
    expect(values).not.toContain('wc_realistic_01');
  });

  it('a WC fixture lists WC meshes + parametric, and NO shower mesh', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(wcFixture),
        universalSelection: makeSelection('fix-wc-1'),
      }),
    );
    const state = result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId);
    const values = (state?.options ?? []).map((o) => o.value);
    expect(values).toContain(SELECT_CLEAR_VALUE);
    expect(values).toContain('wc_realistic_01');
    expect(values).not.toContain('shower_realistic_01');
  });

  it('a non-sanitary fixture (light) lists parametric only (no mesh leakage)', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    const state = result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId);
    expect((state?.options ?? []).map((o) => o.value)).toEqual([SELECT_CLEAR_VALUE]);
  });

  it('option labels are non-literal (resolved via t(), N.11 — no hardcoded strings)', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(showerFixture),
        universalSelection: makeSelection('fix-shower-1'),
      }),
    );
    const state = result.current.getComboboxState(MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId);
    expect((state?.options ?? []).every((o) => o.isLiteralLabel === false)).toBe(true);
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

// ─────────────────────────────────────────────────────────────────────────────
// ADR-408 Φ7 — circuit awareness on the fixture tab (hasCircuit + editCircuit)
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonMepFixtureBridge — hasCircuit visibility', () => {
  it('hidden when the fixture belongs to no circuit', () => {
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.hasCircuit)).toBe(false);
  });

  it('visible when the selected fixture is a circuit member', () => {
    act(() => useMepSystemStore.setState({ systems: [circuitWithMember('fix-rect-1')] }));
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: makeSelection('fix-rect-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.hasCircuit)).toBe(true);
  });
});

describe('useRibbonMepFixtureBridge — onAction editCircuit (Select Panel → jump)', () => {
  it('selects the circuit source panel and activates the circuit', () => {
    act(() => useMepSystemStore.setState({ systems: [circuitWithMember('fix-rect-1')] }));
    const selection = makeSelection('fix-rect-1');
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: selection,
      }),
    );
    act(() => result.current.onAction(MEP_FIXTURE_RIBBON_KEYS_ACTIONS.editCircuit));
    expect(selection.select).toHaveBeenCalledWith('panel-1', 'dxf-entity');
    expect(useMepCircuitEditorStore.getState().activeSystemId).toBe('sys-1');
  });

  it('is a no-op when the fixture belongs to no circuit', () => {
    const selection = makeSelection('fix-rect-1');
    const { result } = renderHook(() =>
      useRibbonMepFixtureBridge({
        levelManager: makeLevelManager(rectFixture),
        universalSelection: selection,
      }),
    );
    act(() => result.current.onAction(MEP_FIXTURE_RIBBON_KEYS_ACTIONS.editCircuit));
    expect(selection.select).not.toHaveBeenCalled();
  });
});
