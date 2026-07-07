/**
 * ADR-507 (Giorgio 2026-07-07) — buildHatchVertexOpCommand tests.
 *
 * Verifies the hatch grip context-menu op → command mapping: remove-vertex on a
 * `hatch-vertex-*` grip, add-vertex on a `hatch-edge-midpoint-*` grip, the min-triangle
 * guard, wrong op/kind pairings, and non-hatch / missing inputs (all → null, no command).
 */

import { buildHatchVertexOpCommand, buildArmedHatchVertexDeleteCommand } from '../hatch-grip-ops';
import { UpdateEntityCommand } from '../../../core/commands/entity-commands/UpdateEntityCommand';
import type { UnifiedGripInfo } from '../../../hooks/grips/unified-grip-types';
import type { ISceneManager } from '../../../core/commands/interfaces';
import type { GripRef } from '../../../rendering/grips/grip-temperature';

jest.mock('../../../core/commands/entity-commands/UpdateEntityCommand', () => ({
  UpdateEntityCommand: jest.fn().mockImplementation((id, patch) => ({
    validate: () => null, execute: jest.fn(), undo: jest.fn(), __id: id, __patch: patch,
  })),
}));

const SQUARE = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]];
const HATCH = { id: 'h1', type: 'hatch', boundaryPaths: SQUARE };

function sm(entity: unknown): ISceneManager {
  return {
    getEntity: (id: string) => (entity && (entity as { id: string }).id === id ? entity : undefined),
  } as unknown as ISceneManager;
}
function grip(kind: string): UnifiedGripInfo {
  return { entityId: 'h1', hatchGripKind: kind } as unknown as UnifiedGripInfo;
}
function lastPatch(): { boundaryPaths: { x: number; y: number }[][] } {
  return (UpdateEntityCommand as jest.Mock).mock.calls[0][1];
}

beforeEach(() => (UpdateEntityCommand as jest.Mock).mockClear());

describe('buildHatchVertexOpCommand', () => {
  it('remove-vertex on a vertex grip → command with that vertex dropped', () => {
    const cmd = buildHatchVertexOpCommand(grip('hatch-vertex-0-1'), 'remove-vertex', sm(HATCH));
    expect(cmd).not.toBeNull();
    expect(lastPatch().boundaryPaths[0]).toHaveLength(3);
    expect(lastPatch().boundaryPaths[0]).not.toContainEqual({ x: 100, y: 0 });
  });

  it('add-vertex on an edge-midpoint grip → inserts at the exact midpoint (delta 0)', () => {
    const cmd = buildHatchVertexOpCommand(grip('hatch-edge-midpoint-0-0'), 'add-vertex', sm(HATCH));
    expect(cmd).not.toBeNull();
    expect(lastPatch().boundaryPaths[0]).toHaveLength(5);
    expect(lastPatch().boundaryPaths[0][1]).toEqual({ x: 50, y: 0 });
  });

  it('remove-vertex at the minimum triangle → null (no command emitted)', () => {
    const tri = { id: 'h1', type: 'hatch', boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]] };
    expect(buildHatchVertexOpCommand(grip('hatch-vertex-0-0'), 'remove-vertex', sm(tri))).toBeNull();
    expect((UpdateEntityCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('wrong op/kind pairing → null', () => {
    expect(buildHatchVertexOpCommand(grip('hatch-vertex-0-0'), 'add-vertex', sm(HATCH))).toBeNull();
    expect(buildHatchVertexOpCommand(grip('hatch-edge-midpoint-0-0'), 'remove-vertex', sm(HATCH))).toBeNull();
  });

  it('non-hatch entity, missing kind, or missing entity → null', () => {
    expect(buildHatchVertexOpCommand(grip('hatch-vertex-0-0'), 'remove-vertex', sm({ id: 'h1', type: 'line' }))).toBeNull();
    expect(buildHatchVertexOpCommand({ entityId: 'h1' } as UnifiedGripInfo, 'remove-vertex', sm(HATCH))).toBeNull();
    expect(buildHatchVertexOpCommand(grip('hatch-vertex-0-0'), 'remove-vertex', sm(null))).toBeNull();
  });
});

describe('buildArmedHatchVertexDeleteCommand (bulk delete of armed vertices)', () => {
  // 5-vertex hatch → gripIndex 0..4 = vertices, 5..9 = edge-midpoints.
  const PENTA = {
    id: 'h1', type: 'hatch',
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 80 }, { x: 100, y: 160 }, { x: 0, y: 160 }]],
  };
  function ref(entityId: string, gripIndex: number): GripRef {
    return { entityId, gripIndex };
  }
  // A scene manager that resolves several entities by id.
  function multiSm(...entities: unknown[]): ISceneManager {
    return {
      getEntity: (id: string) => entities.find((e) => e && (e as { id: string }).id === id),
    } as unknown as ISceneManager;
  }

  it('removes all armed VERTEX grips of a hatch in one command (indices → ring vertices)', () => {
    const cmd = buildArmedHatchVertexDeleteCommand([ref('h1', 1), ref('h1', 3)], multiSm(PENTA));
    expect(cmd).not.toBeNull();
    expect(lastPatch().boundaryPaths[0]).toHaveLength(3);
    expect(lastPatch().boundaryPaths[0]).not.toContainEqual({ x: 100, y: 0 });
    expect(lastPatch().boundaryPaths[0]).not.toContainEqual({ x: 100, y: 160 });
  });

  it('ignores armed edge-midpoint grips (gripIndex ≥ vertex count) — not deletable', () => {
    // gripIndex 5,6 = edge-midpoints on a 5-vertex hatch → nothing removable → null.
    expect(buildArmedHatchVertexDeleteCommand([ref('h1', 5), ref('h1', 6)], multiSm(PENTA))).toBeNull();
    expect((UpdateEntityCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('groups armed grips across multiple hatches → one command each (CompoundCommand)', () => {
    const other = { id: 'h2', type: 'hatch', boundaryPaths: PENTA.boundaryPaths };
    const cmd = buildArmedHatchVertexDeleteCommand(
      [ref('h1', 0), ref('h2', 2)], multiSm(PENTA, other),
    );
    expect(cmd).not.toBeNull();
    expect((UpdateEntityCommand as jest.Mock).mock.calls.length).toBe(2);
  });

  it('non-hatch armed entity or empty refs → null', () => {
    expect(buildArmedHatchVertexDeleteCommand([ref('x', 0)], multiSm({ id: 'x', type: 'line' }))).toBeNull();
    expect(buildArmedHatchVertexDeleteCommand([], multiSm(PENTA))).toBeNull();
  });
});
