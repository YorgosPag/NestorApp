/**
 * ADR-408 Φ8 — useRibbonMepSegmentBridge tests (ΕΝΑ tab για duct + pipe).
 *
 * Coverage:
 *   - getComboboxState: sectionKind (effective) + width/height (rect) / diameter
 *     (round, resolved via resolveSegmentSection defaults).
 *   - onComboboxChange: dispatches UpdateMepSegmentParamsCommand + emits
 *     params-updated; a pipe ignores a rectangular section change.
 *   - getPanelVisibility: domainAllowsSectionChoice (duct only) + rectangular /
 *     round section gates (a pipe is always round).
 *   - onAction: delete emits the delete-requested event.
 */

import { renderHook, act } from '@testing-library/react';
import {
  useRibbonMepSegmentBridge,
  isMepSegmentPanelVisibilityKey,
} from '../useRibbonMepSegmentBridge';
import {
  MEP_SEGMENT_RIBBON_KEYS,
  MEP_SEGMENT_RIBBON_KEYS_ACTIONS,
  MEP_SEGMENT_RIBBON_VISIBILITY_KEYS,
} from '../bridge/mep-segment-command-keys';
import { UpdateMepSegmentParamsCommand } from '../../../../core/commands/entity-commands/UpdateMepSegmentParamsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import { resetGlobalCommandHistory } from '../../../../core/commands';

jest.mock(
  '../../../../core/commands/entity-commands/UpdateMepSegmentParamsCommand',
  () => ({
    UpdateMepSegmentParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

const rectDuct = {
  id: 'seg-duct-1',
  type: 'mep-segment' as const,
  kind: 'duct' as const,
  layerId: 'lvl-1',
  visible: true,
  ifcType: 'IfcDuctSegment' as const,
  params: {
    domain: 'duct' as const,
    sectionKind: 'rectangular' as const,
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    width: 400,
    height: 200,
    centerlineElevationMm: 2800,
    sceneUnits: 'mm' as const,
  },
  geometry: {} as never,
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

const roundPipe = {
  ...rectDuct,
  id: 'seg-pipe-1',
  kind: 'pipe' as const,
  ifcType: 'IfcPipeSegment' as const,
  params: {
    domain: 'pipe' as const,
    sectionKind: 'round' as const,
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: 1000, y: 0, z: 0 },
    diameter: 50,
    centerlineElevationMm: 0,
    sceneUnits: 'mm' as const,
  },
};

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof rectDuct] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepSegmentBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
    clearAll: jest.fn(),
  } as unknown as Parameters<typeof useRibbonMepSegmentBridge>[0]['universalSelection'];
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateMepSegmentParamsCommand as jest.Mock).mockClear();
});

describe('useRibbonMepSegmentBridge — getComboboxState', () => {
  it('reads sectionKind + rect dims for a duct', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(rectDuct),
        universalSelection: makeSelection('seg-duct-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind)?.value).toBe('rectangular');
    expect(result.current.getComboboxState(MEP_SEGMENT_RIBBON_KEYS.params.width)?.value).toBe('400');
    expect(result.current.getComboboxState(MEP_SEGMENT_RIBBON_KEYS.params.height)?.value).toBe('200');
  });

  it('reads diameter (round) + effective round section for a pipe', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(roundPipe),
        universalSelection: makeSelection('seg-pipe-1'),
      }),
    );
    expect(result.current.getComboboxState(MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind)?.value).toBe('round');
    expect(result.current.getComboboxState(MEP_SEGMENT_RIBBON_KEYS.params.diameter)?.value).toBe('50');
  });
});

describe('useRibbonMepSegmentBridge — onComboboxChange', () => {
  it('dispatches a sectionKind patch + emits params-updated (duct)', () => {
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(rectDuct),
        universalSelection: makeSelection('seg-duct-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind, 'round'));
    const next = (UpdateMepSegmentParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.sectionKind).toBe('round');
    expect(emitSpy).toHaveBeenCalledWith('bim:mep-segment-params-updated', { segmentId: 'seg-duct-1' });
    emitSpy.mockRestore();
  });

  it('a pipe ignores a rectangular section change (always round)', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(roundPipe),
        universalSelection: makeSelection('seg-pipe-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind, 'rectangular'));
    expect((UpdateMepSegmentParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('dispatches a diameter patch', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(roundPipe),
        universalSelection: makeSelection('seg-pipe-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_SEGMENT_RIBBON_KEYS.params.diameter, '63'));
    const next = (UpdateMepSegmentParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.diameter).toBe(63);
  });

  it('ignores NaN numeric input', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(rectDuct),
        universalSelection: makeSelection('seg-duct-1'),
      }),
    );
    act(() => result.current.onComboboxChange(MEP_SEGMENT_RIBBON_KEYS.params.width, 'abc'));
    expect((UpdateMepSegmentParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });
});

describe('useRibbonMepSegmentBridge — getPanelVisibility', () => {
  it('duct: section choice allowed + rectangular dims visible', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(rectDuct),
        universalSelection: makeSelection('seg-duct-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.domainAllowsSectionChoice)).toBe(true);
    expect(result.current.getPanelVisibility(MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.rectangularSection)).toBe(true);
    expect(result.current.getPanelVisibility(MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.roundSection)).toBe(false);
  });

  it('pipe: no section choice, round dims only', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(roundPipe),
        universalSelection: makeSelection('seg-pipe-1'),
      }),
    );
    expect(result.current.getPanelVisibility(MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.domainAllowsSectionChoice)).toBe(false);
    expect(result.current.getPanelVisibility(MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.rectangularSection)).toBe(false);
    expect(result.current.getPanelVisibility(MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.roundSection)).toBe(true);
  });

  it('unowned key returns true; type guard recognizes own keys', () => {
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(rectDuct),
        universalSelection: makeSelection('seg-duct-1'),
      }),
    );
    expect(result.current.getPanelVisibility('column.visibility.polygonParams')).toBe(true);
    expect(isMepSegmentPanelVisibilityKey(MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.roundSection)).toBe(true);
    expect(isMepSegmentPanelVisibilityKey('column.visibility.polygonParams')).toBe(false);
  });
});

describe('useRibbonMepSegmentBridge — onAction', () => {
  it('emits bim:mep-segment-delete-requested when confirmed', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const emitSpy = jest.spyOn(EventBus, 'emit');
    const { result } = renderHook(() =>
      useRibbonMepSegmentBridge({
        levelManager: makeLevelManager(rectDuct),
        universalSelection: makeSelection('seg-duct-1'),
      }),
    );
    act(() => result.current.onAction(MEP_SEGMENT_RIBBON_KEYS_ACTIONS.delete));
    expect(emitSpy).toHaveBeenCalledWith('bim:mep-segment-delete-requested', { segmentId: 'seg-duct-1' });
    confirmSpy.mockRestore();
    emitSpy.mockRestore();
  });
});
