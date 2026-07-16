/**
 * array-tool-core — SSoT primitives shared by the rect/polar/path array tools (ADR-353).
 *
 * Added with the extraction that removed the sibling clones CHECK 3.28 flagged across the
 * three `useArray*Tool` hooks (ADR-584 / N.18). The guards asserted here — nested-array
 * rejection, empty/stale-source rejection, and the no-scene-manager no-op — previously
 * lived (untested) in triplicate; now that one copy serves all three tools, a regression
 * here breaks every array pattern at once. Hence characterization tests on the pure core.
 */
import { renderHook } from '@testing-library/react';
import {
  ARRAY_HINT_NEEDS_SELECTION,
  ARRAY_HINT_NESTED_FORBIDDEN,
  collectArraySources,
  collectSourceTypes,
  commitArrayCommand,
  findArrayEntity,
  resolveArrayScene,
  resolvePendingSourcesInScene,
  useArraySourcePick,
  type ArraySourcePick,
  type ArrayToolProps,
} from '../array-tool-core';
import { toolHintOverrideStore } from '../../toolHintOverrideStore';
import { CreateArrayCommand } from '../../../core/commands/entity-commands/CreateArrayCommand';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';
import type { ISceneManager } from '../../../core/commands/interfaces';

// i18next `t` is identity-on-key here — the store then holds `tool-hints:<key>`, so the
// assertions below read the hint the user would see without pulling in a locale bundle.
jest.mock('i18next', () => ({ __esModule: true, default: { t: (key: string) => key } }));

jest.mock('../../../core/commands/entity-commands/CreateArrayCommand', () => ({
  CreateArrayCommand: jest.fn(),
}));

const MockedCreateArrayCommand = CreateArrayCommand as unknown as jest.Mock;

function entity(id: string, type = 'line'): Entity {
  return { id, type } as unknown as Entity;
}

function scene(...entities: Entity[]): SceneModel {
  return { entities } as unknown as SceneModel;
}

/** The hint currently in the status bar, with the namespace prefix stripped. */
function currentHint(): string | null {
  const value = toolHintOverrideStore.getSnapshot();
  return value ? value.replace('tool-hints:', '') : null;
}

beforeEach(() => {
  jest.clearAllMocks();
  toolHintOverrideStore.setOverride(null);
});

describe('resolveArrayScene', () => {
  it('returns null when no level is active', () => {
    const levelManager = { currentLevelId: null, getLevelScene: jest.fn() };
    expect(resolveArrayScene(levelManager as never)).toBeNull();
    expect(levelManager.getLevelScene).not.toHaveBeenCalled();
  });

  it('returns null when the active level has no scene', () => {
    const levelManager = { currentLevelId: 'l1', getLevelScene: jest.fn(() => null) };
    expect(resolveArrayScene(levelManager as never)).toBeNull();
  });

  it('returns the current level scene', () => {
    const s = scene(entity('a'));
    const levelManager = { currentLevelId: 'l1', getLevelScene: jest.fn(() => s) };
    expect(resolveArrayScene(levelManager as never)).toBe(s);
    expect(levelManager.getLevelScene).toHaveBeenCalledWith('l1');
  });
});

describe('findArrayEntity', () => {
  it('finds by id and returns undefined for a miss', () => {
    const s = scene(entity('a'), entity('b'));
    expect(findArrayEntity(s, 'b')?.id).toBe('b');
    expect(findArrayEntity(s, 'zz')).toBeUndefined();
  });
});

describe('collectSourceTypes', () => {
  it('collects types in id order, skipping ids no longer in the scene', () => {
    const s = scene(entity('a', 'line'), entity('c', 'circle'));
    expect(collectSourceTypes(s, ['a', 'gone', 'c'])).toEqual(['line', 'circle']);
  });

  it('returns an empty array when nothing resolves', () => {
    expect(collectSourceTypes(scene(), ['a'])).toEqual([]);
  });
});

describe('collectArraySources — the shared activation guard', () => {
  it('rejects an empty selection', () => {
    const result = collectArraySources(scene(entity('a')), []);
    expect(result).toEqual({ ok: false, hintKey: ARRAY_HINT_NEEDS_SELECTION });
  });

  it('rejects a nested array source (Q19 guard) even when other sources are valid', () => {
    const s = scene(entity('a', 'line'), entity('nested', 'array'));
    const result = collectArraySources(s, ['a', 'nested']);
    expect(result).toEqual({ ok: false, hintKey: ARRAY_HINT_NESTED_FORBIDDEN });
  });

  it('rejects a selection whose ids all vanished from the scene', () => {
    const result = collectArraySources(scene(entity('a')), ['gone']);
    expect(result).toEqual({ ok: false, hintKey: ARRAY_HINT_NEEDS_SELECTION });
  });

  it('accepts resolvable non-array sources, skipping stale ids', () => {
    const s = scene(entity('a', 'line'), entity('b', 'circle'));
    const result = collectArraySources(s, ['a', 'gone', 'b']);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.sources.map((e) => e.id)).toEqual(['a', 'b']);
    expect(result.sourceTypes).toEqual(['line', 'circle']);
  });
});

describe('commitArrayCommand', () => {
  const params = { kind: 'rect' } as never;

  function setupCommand(affectedIds: string[]): void {
    MockedCreateArrayCommand.mockImplementation(() => ({
      getAffectedEntityIds: () => affectedIds,
    }));
  }

  it('does nothing and reports false when there is no scene manager', () => {
    const executeCommand = jest.fn();
    const setSelectedEntityIds = jest.fn();

    const committed = commitArrayCommand(
      () => null, ['a'], 'rect', params, executeCommand, setSelectedEntityIds,
    );

    expect(committed).toBe(false);
    expect(MockedCreateArrayCommand).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
    expect(setSelectedEntityIds).not.toHaveBeenCalled();
  });

  it('executes the command and reselects the new array entity', () => {
    setupCommand(['array-1']);
    const sm = {} as ISceneManager;
    const executeCommand = jest.fn();
    const setSelectedEntityIds = jest.fn();

    const committed = commitArrayCommand(
      () => sm, ['a', 'b'], 'rect', params, executeCommand, setSelectedEntityIds,
    );

    expect(committed).toBe(true);
    expect(MockedCreateArrayCommand).toHaveBeenCalledWith(['a', 'b'], 'rect', params, sm, undefined);
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(setSelectedEntityIds).toHaveBeenCalledWith(['array-1']);
  });

  it('forwards the path entity id (path arrays are hosted on a curve)', () => {
    setupCommand(['array-1']);
    const sm = {} as ISceneManager;

    commitArrayCommand(
      () => sm, ['a'], 'path', params, jest.fn(), jest.fn(), 'curve-9',
    );

    expect(MockedCreateArrayCommand).toHaveBeenCalledWith(['a'], 'path', params, sm, 'curve-9');
  });

  it('still reports success when the command affected no entity, leaving selection alone', () => {
    setupCommand([]);
    const setSelectedEntityIds = jest.fn();

    const committed = commitArrayCommand(
      () => ({} as ISceneManager), ['a'], 'rect', params, jest.fn(), setSelectedEntityIds,
    );

    expect(committed).toBe(true);
    expect(setSelectedEntityIds).not.toHaveBeenCalled();
  });
});

describe('resolvePendingSourcesInScene', () => {
  function makePick(pendingIds: string[]): ArraySourcePick & { exitToSelect: jest.Mock } {
    return {
      pendingSourceIds: { current: pendingIds },
      isAwaiting: () => true,
      exitToSelect: jest.fn(),
    };
  }

  it('hints and exits when every pending source vanished while the tool was armed', () => {
    const pick = makePick(['gone']);

    expect(resolvePendingSourcesInScene(scene(entity('a')), pick)).toBeNull();
    expect(pick.exitToSelect).toHaveBeenCalledTimes(1);
    expect(currentHint()).toBe(ARRAY_HINT_NEEDS_SELECTION);
  });

  it('returns the still-live sources without touching the tool state', () => {
    const s = scene(entity('a', 'line'), entity('b', 'arc'));
    const pick = makePick(['a', 'b']);

    const ctx = resolvePendingSourcesInScene(s, pick);

    expect(ctx).toEqual({ scene: s, sourceIds: ['a', 'b'], sourceTypes: ['line', 'arc'] });
    expect(pick.exitToSelect).not.toHaveBeenCalled();
    expect(currentHint()).toBeNull();
  });
});

describe('useArraySourcePick — arming FSM shared by the polar + path tools', () => {
  function props(overrides: Partial<ArrayToolProps> = {}): ArrayToolProps {
    return {
      activeTool: 'select',
      selectedEntityIds: ['a'],
      levelManager: {
        currentLevelId: 'l1',
        getLevelScene: () => scene(entity('a', 'line')),
        setLevelScene: jest.fn(),
      },
      executeCommand: jest.fn(),
      setSelectedEntityIds: jest.fn(),
      onToolChange: jest.fn(),
      ...overrides,
    } as unknown as ArrayToolProps;
  }

  function renderPick(p: ArrayToolProps, isActive: boolean) {
    return renderHook(
      ({ active }: { active: boolean }) => useArraySourcePick(p, active, 'arrayTool.pickCenter'),
      { initialProps: { active: isActive } },
    );
  }

  it('is not awaiting before activation', () => {
    const { result } = renderPick(props(), false);
    expect(result.current.isAwaiting()).toBe(false);
    expect(currentHint()).toBeNull();
  });

  it('arms on the activation edge — captures sources and prompts for the pick', () => {
    const p = props();
    const { result, rerender } = renderPick(p, false);

    rerender({ active: true });

    expect(result.current.isAwaiting()).toBe(true);
    expect(result.current.pendingSourceIds.current).toEqual(['a']);
    expect(currentHint()).toBe('arrayTool.pickCenter');
    expect(p.onToolChange).not.toHaveBeenCalled();
  });

  it('captures a copy of the selection, not the caller array', () => {
    const selectedEntityIds = ['a'];
    const { result, rerender } = renderPick(props({ selectedEntityIds }), false);

    rerender({ active: true });
    selectedEntityIds.push('b');

    expect(result.current.pendingSourceIds.current).toEqual(['a']);
  });

  it('hints and reverts to select instead of arming when the selection is invalid', () => {
    const p = props({ selectedEntityIds: [] });
    const { result, rerender } = renderPick(p, false);

    rerender({ active: true });

    expect(result.current.isAwaiting()).toBe(false);
    expect(currentHint()).toBe(ARRAY_HINT_NEEDS_SELECTION);
    expect(p.onToolChange).toHaveBeenCalledWith('select');
  });

  it('reverts to select without a hint when no scene is active', () => {
    const p = props({
      levelManager: { currentLevelId: null, getLevelScene: () => null, setLevelScene: jest.fn() } as never,
    });
    const { result, rerender } = renderPick(p, false);

    rerender({ active: true });

    expect(result.current.isAwaiting()).toBe(false);
    expect(currentHint()).toBeNull();
    expect(p.onToolChange).toHaveBeenCalledWith('select');
  });

  it('clears state and hint on the deactivation edge, without re-issuing a tool change', () => {
    const p = props();
    const { result, rerender } = renderPick(p, false);

    rerender({ active: true });
    rerender({ active: false });

    expect(result.current.isAwaiting()).toBe(false);
    expect(result.current.pendingSourceIds.current).toEqual([]);
    expect(currentHint()).toBeNull();
    expect(p.onToolChange).not.toHaveBeenCalled();
  });

  it('exitToSelect clears the armed state and hands the tool back to select', () => {
    const p = props();
    const { result, rerender } = renderPick(p, false);

    rerender({ active: true });
    result.current.exitToSelect();

    expect(result.current.isAwaiting()).toBe(false);
    expect(result.current.pendingSourceIds.current).toEqual([]);
    expect(currentHint()).toBeNull();
    expect(p.onToolChange).toHaveBeenCalledWith('select');
  });
});
