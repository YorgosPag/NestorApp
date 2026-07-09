/**
 * ADR-609 — createRibbonMepAutoBridge factory tests.
 *
 * Verifies the shared Generate → review → accept / reject pipeline the 6 pipe/duct
 * discipline bridges (water/drainage/heating/hvac/fire/gas) now delegate to:
 *   - generate (non-empty): runs the engine, publishes the proposal, emits `generated`.
 *   - generate (empty):     resets the store, emits `empty` with the warnings flag.
 *   - accept (non-empty):   builds the commit, dispatches ONE CompoundCommand, emits
 *                           `committed`, resets the store.
 *   - accept (empty plan):  resets the store, dispatches nothing.
 *   - reject:               resets the store only.
 *   - foreign action key:   no-op (composes with the other ribbon bridges).
 *
 * Heavy collaborators (command history, entity commands, scene adapter, recognition)
 * are mocked so the test asserts orchestration, not Firestore/geometry side effects.
 */

import { renderHook, act } from '@testing-library/react';
import {
  createRibbonMepAutoBridge,
  type RibbonMepAutoBridgeProps,
} from '../create-ribbon-mep-auto-bridge';
import type { LevelSceneWriter } from '../../../../systems/levels/level-scene-accessor';

const executeSpy = jest.fn();
const compoundCtor = jest.fn();

jest.mock('../../../../core/commands', () => ({
  useCommandHistory: () => ({ execute: executeSpy }),
  CompoundCommand: jest.fn().mockImplementation((label: string, commands: unknown[]) => {
    compoundCtor(label, commands);
    return { __label: label, __commands: commands };
  }),
}));

jest.mock('../../../../core/commands/entity-commands/CreateMepSegmentsCommand', () => ({
  CreateMepSegmentsCommand: jest.fn().mockImplementation((segments: unknown) => ({ segments })),
}));

jest.mock('../../../../core/commands/entity-commands/CreateMepSystemCommand', () => ({
  CreateMepSystemCommand: jest.fn().mockImplementation((entity: unknown) => ({ entity })),
}));

jest.mock('../../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ adapter: true })),
}));

jest.mock('../../../../systems/recognition', () => ({
  recognizeSceneFromRegistry: jest.fn(() => ({ recognized: true })),
  registerMepRecognition: jest.fn(),
}));

jest.mock('../../../../stores/LayerStore', () => ({ getCurrentLayerId: () => 'layer-1' }));
jest.mock('../../../../utils/scene-units', () => ({ resolveSceneUnits: () => 'mm' }));

// --- Fakes -----------------------------------------------------------------

interface FakeNetwork {
  readonly service: string;
}
interface FakeProposal {
  readonly networks: readonly FakeNetwork[];
  readonly warnings: readonly string[];
}

const ACTIONS = {
  generate: 'test.actions.generate',
  accept: 'test.actions.accept',
  reject: 'test.actions.reject',
} as const;

function makeStore() {
  let value: { proposal: FakeProposal; sceneUnits: 'mm' } | null = null;
  return {
    get: jest.fn(() => value),
    set: jest.fn((review: { proposal: FakeProposal; sceneUnits: 'mm' }) => {
      value = review;
    }),
    reset: jest.fn(() => {
      value = null;
    }),
  };
}

const levelManager = {
  currentLevelId: 'lvl-1',
  getLevelScene: () => ({ entities: [] }),
  setLevelScene: jest.fn(),
} as unknown as LevelSceneWriter;

function buildBridge(overrides: {
  proposal: FakeProposal;
  plan?: { segmentEntities: unknown[]; systemEntities: unknown[] };
}) {
  const store = makeStore();
  const design = jest.fn(() => overrides.proposal);
  const buildCommit = jest.fn(() => ({
    segmentEntities: overrides.plan?.segmentEntities ?? [{}],
    systemEntities: overrides.plan?.systemEntities ?? [{}, {}],
    skippedSegments: 0,
  }));
  const emitEmpty = jest.fn();
  const emitGenerated = jest.fn();
  const emitCommitted = jest.fn();

  const useBridge = createRibbonMepAutoBridge<FakeNetwork, FakeProposal>({
    actions: ACTIONS,
    store: store as never,
    design: design as never,
    buildCommit: buildCommit as never,
    resolveNetworkName: (_t, network) => network.service,
    commandLabel: 'Generate test',
    emitEmpty,
    emitGenerated,
    emitCommitted,
  });

  const rendered = renderHook((props: RibbonMepAutoBridgeProps) => useBridge(props), {
    initialProps: { levelManager },
  });
  return { rendered, store, design, buildCommit, emitEmpty, emitGenerated, emitCommitted };
}

beforeEach(() => {
  executeSpy.mockClear();
  compoundCtor.mockClear();
});

describe('createRibbonMepAutoBridge', () => {
  it('generate (non-empty): runs the engine, publishes the proposal, emits generated', () => {
    const b = buildBridge({ proposal: { networks: [{ service: 'a' }], warnings: [] } });
    act(() => b.rendered.result.current.onAction(ACTIONS.generate));
    expect(b.design).toHaveBeenCalledTimes(1);
    expect(b.store.set).toHaveBeenCalledWith({
      proposal: { networks: [{ service: 'a' }], warnings: [] },
      sceneUnits: 'mm',
    });
    expect(b.emitGenerated).toHaveBeenCalledWith(1, 0);
    expect(b.emitEmpty).not.toHaveBeenCalled();
  });

  it('generate (empty): resets the store, emits empty with the warnings flag', () => {
    const b = buildBridge({ proposal: { networks: [], warnings: ['w'] } });
    act(() => b.rendered.result.current.onAction(ACTIONS.generate));
    expect(b.store.set).not.toHaveBeenCalled();
    expect(b.store.reset).toHaveBeenCalledTimes(1);
    expect(b.emitEmpty).toHaveBeenCalledWith(true);
    expect(b.emitGenerated).not.toHaveBeenCalled();
  });

  it('accept (non-empty plan): builds the commit, dispatches ONE CompoundCommand, emits committed', () => {
    const b = buildBridge({ proposal: { networks: [{ service: 'a' }], warnings: [] } });
    act(() => b.rendered.result.current.onAction(ACTIONS.generate));
    act(() => b.rendered.result.current.onAction(ACTIONS.accept));
    expect(b.buildCommit).toHaveBeenCalledTimes(1);
    expect(compoundCtor).toHaveBeenCalledTimes(1);
    // 1 segments command + 2 system commands (one per systemEntity).
    const [label, commands] = compoundCtor.mock.calls[0];
    expect(label).toBe('Generate test');
    expect(commands).toHaveLength(3);
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(b.emitCommitted).toHaveBeenCalledWith(2, 1);
  });

  it('accept (empty plan): resets the store, dispatches nothing', () => {
    const b = buildBridge({
      proposal: { networks: [{ service: 'a' }], warnings: [] },
      plan: { segmentEntities: [], systemEntities: [] },
    });
    act(() => b.rendered.result.current.onAction(ACTIONS.generate));
    b.store.reset.mockClear();
    act(() => b.rendered.result.current.onAction(ACTIONS.accept));
    expect(b.store.reset).toHaveBeenCalledTimes(1);
    expect(executeSpy).not.toHaveBeenCalled();
    expect(b.emitCommitted).not.toHaveBeenCalled();
  });

  it('reject: resets the store only', () => {
    const b = buildBridge({ proposal: { networks: [{ service: 'a' }], warnings: [] } });
    act(() => b.rendered.result.current.onAction(ACTIONS.reject));
    expect(b.store.reset).toHaveBeenCalledTimes(1);
    expect(b.design).not.toHaveBeenCalled();
    expect(b.buildCommit).not.toHaveBeenCalled();
  });

  it('foreign action key: no-op', () => {
    const b = buildBridge({ proposal: { networks: [{ service: 'a' }], warnings: [] } });
    act(() => b.rendered.result.current.onAction('some.other.action'));
    expect(b.design).not.toHaveBeenCalled();
    expect(b.store.reset).not.toHaveBeenCalled();
    expect(b.store.set).not.toHaveBeenCalled();
  });
});
