/**
 * delete-entities-core — SSoT command-based delete shared by keyboard
 * (useSmartDelete PRIORITY 3) and ribbon «Διαγραφή».
 *
 * Verifies the orchestration (command selection, cascade, MEP bundle, events)
 * with the heavy command/cascade/event collaborators mocked, so the test stays
 * a focused unit on the delete logic itself.
 */

import { deleteEntitiesById } from '../delete-entities-core';
import {
  DeleteEntityCommand,
  DeleteMultipleEntitiesCommand,
  CompoundCommand,
} from '../../../core/commands';
import { collectBimDeleteIds, emitBimDeleteEvents } from '../smart-delete-bim-events';
import { findHostedOpenings, findHostedSlabOpenings } from '../../../bim/cascade/bim-cascade-resolver';
import { requestWallCascadeDelete } from '../../../bim/walls/wall-cascade-delete-store';
import { resolveMepCascadeOnDelete } from '../../../bim/mep-systems/mep-system-coordinator';

jest.mock('../../../core/commands', () => ({
  DeleteEntityCommand: jest.fn().mockImplementation((id: string) => ({ __kind: 'single', id })),
  DeleteMultipleEntitiesCommand: jest.fn().mockImplementation((ids: string[]) => ({ __kind: 'multiple', ids })),
  CompoundCommand: jest.fn().mockImplementation((name: string, cmds: unknown[]) => ({ __kind: 'compound', name, cmds })),
}));

jest.mock('../smart-delete-bim-events', () => ({
  collectBimDeleteIds: jest.fn(() => ({ panelIds: [], fixtureIds: [] })),
  emitBimDeleteEvents: jest.fn(),
}));

jest.mock('../../../bim/cascade/bim-cascade-resolver', () => ({
  findHostedOpenings: jest.fn(() => [] as string[]),
  findHostedSlabOpenings: jest.fn(() => [] as string[]),
  findHostedStairwellOpenings: jest.fn(() => [] as string[]),
  findHostedStairRailings: jest.fn(() => [] as string[]),
}));

jest.mock('../../../bim/walls/wall-cascade-delete-store', () => ({
  requestWallCascadeDelete: jest.fn(async () => 'delete'),
}));

jest.mock('../../../bim/mep-systems/mep-system-coordinator', () => ({
  resolveMepCascadeOnDelete: jest.fn(() => ({ dissolve: [], memberRemovals: [] })),
}));

jest.mock('../../../bim/mep-systems/mep-system-store', () => ({
  useMepSystemStore: { getState: () => ({ getSystems: () => [] }) },
}));

jest.mock('../../../core/commands/entity-commands/UpdateMepSystemParamsCommand', () => ({
  UpdateMepSystemParamsCommand: jest.fn().mockImplementation(() => ({ __kind: 'mep-update' })),
}));

jest.mock('../../../core/commands/entity-commands/DissolveMepSystemCommand', () => ({
  DissolveMepSystemCommand: jest.fn().mockImplementation(() => ({ __kind: 'mep-dissolve' })),
}));

type AdapterMock = Parameters<typeof deleteEntitiesById>[1]['adapter'];

function mkAdapter(typeById: Record<string, string>): AdapterMock {
  return {
    getEntity: (id: string) => (typeById[id] ? { id, type: typeById[id] } : undefined),
  } as unknown as AdapterMock;
}

const collectMock = collectBimDeleteIds as jest.Mock;
const findOpeningsMock = findHostedOpenings as jest.Mock;
const findSlabOpeningsMock = findHostedSlabOpenings as jest.Mock;
const promptMock = requestWallCascadeDelete as jest.Mock;
const mepCascadeMock = resolveMepCascadeOnDelete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  collectMock.mockReturnValue({ panelIds: [], fixtureIds: [] });
  findOpeningsMock.mockReturnValue([]);
  findSlabOpeningsMock.mockReturnValue([]);
  promptMock.mockResolvedValue('delete');
  mepCascadeMock.mockReturnValue({ dissolve: [], memberRemovals: [] });
});

describe('deleteEntitiesById', () => {
  it('returns false for empty ids (no command, no events)', async () => {
    const executeCommand = jest.fn();
    const res = await deleteEntitiesById([], { adapter: mkAdapter({}), sceneEntities: [], executeCommand });
    expect(res).toBe(false);
    expect(executeCommand).not.toHaveBeenCalled();
    expect(emitBimDeleteEvents).not.toHaveBeenCalled();
  });

  it('single id → DeleteEntityCommand + emit + true', async () => {
    const executeCommand = jest.fn();
    const res = await deleteEntitiesById(['c1'], {
      adapter: mkAdapter({ c1: 'column' }), sceneEntities: [], executeCommand,
    });
    expect(res).toBe(true);
    expect(DeleteEntityCommand).toHaveBeenCalledWith('c1', expect.anything());
    expect(DeleteMultipleEntitiesCommand).not.toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(emitBimDeleteEvents).toHaveBeenCalledTimes(1);
  });

  it('multiple ids → DeleteMultipleEntitiesCommand', async () => {
    const executeCommand = jest.fn();
    await deleteEntitiesById(['a', 'b'], {
      adapter: mkAdapter({ a: 'column', b: 'beam' }), sceneEntities: [], executeCommand,
    });
    expect(DeleteMultipleEntitiesCommand).toHaveBeenCalledWith(['a', 'b'], expect.anything());
    expect(DeleteEntityCommand).not.toHaveBeenCalled();
  });

  it('wall with hosted openings: prompt cancel → false, nothing executed', async () => {
    findOpeningsMock.mockReturnValue(['op1', 'op2']);
    promptMock.mockResolvedValue('cancel');
    const executeCommand = jest.fn();
    const res = await deleteEntitiesById(['w1'], {
      adapter: mkAdapter({ w1: 'wall' }), sceneEntities: [], executeCommand,
    });
    expect(res).toBe(false);
    expect(executeCommand).not.toHaveBeenCalled();
    expect(emitBimDeleteEvents).not.toHaveBeenCalled();
  });

  it('wall with hosted openings: prompt confirm → openings appended to delete set', async () => {
    findOpeningsMock.mockReturnValue(['op1']);
    promptMock.mockResolvedValue('delete');
    const executeCommand = jest.fn();
    await deleteEntitiesById(['w1'], {
      adapter: mkAdapter({ w1: 'wall' }), sceneEntities: [], executeCommand,
    });
    // wall + orphan opening = 2 ids → multiple-delete with both, collected from both.
    expect(DeleteMultipleEntitiesCommand).toHaveBeenCalledWith(['w1', 'op1'], expect.anything());
    expect(collectMock).toHaveBeenCalledWith(['w1', 'op1'], expect.anything());
  });

  it('slab openings cascade automatically (no prompt)', async () => {
    findSlabOpeningsMock.mockReturnValue(['so1']);
    const executeCommand = jest.fn();
    await deleteEntitiesById(['s1'], {
      adapter: mkAdapter({ s1: 'slab' }), sceneEntities: [], executeCommand,
    });
    expect(promptMock).not.toHaveBeenCalled();
    expect(DeleteMultipleEntitiesCommand).toHaveBeenCalledWith(['s1', 'so1'], expect.anything());
  });

  it('deleting an electrical panel bundles the MEP cascade in a CompoundCommand', async () => {
    collectMock.mockReturnValue({ panelIds: ['p1'], fixtureIds: [] });
    mepCascadeMock.mockReturnValue({ dissolve: [{ id: 'sys1' }], memberRemovals: [] });
    const executeCommand = jest.fn();
    await deleteEntitiesById(['p1'], {
      adapter: mkAdapter({ p1: 'electrical-panel' }), sceneEntities: [], executeCommand,
    });
    expect(CompoundCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({ __kind: 'compound' }));
  });

  it('no MEP entities → plain delete command, no CompoundCommand', async () => {
    const executeCommand = jest.fn();
    await deleteEntitiesById(['c1'], {
      adapter: mkAdapter({ c1: 'column' }), sceneEntities: [], executeCommand,
    });
    expect(CompoundCommand).not.toHaveBeenCalled();
    expect(executeCommand).toHaveBeenCalledWith(expect.objectContaining({ __kind: 'single' }));
  });
});
