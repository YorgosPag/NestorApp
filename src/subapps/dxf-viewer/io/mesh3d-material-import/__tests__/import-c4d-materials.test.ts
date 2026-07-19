/**
 * ADR-678 Φ1 — orchestrator wiring test. Τεστάρει enumerate → match → resolve → group-by-level,
 * με mocked command layer (κανένα EventBus/persistence). Ο pure core τεστάρεται χωριστά.
 */

import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import { importC4dMaterials } from '../import-c4d-materials';

const mockCapture = { executed: null as unknown };

jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: (c: unknown) => { mockCapture.executed = c; } }),
}));
jest.mock('../../../core/commands/CompositeCommand', () => ({
  CompositeCommand: class { constructor(public readonly children: unknown[]) {} },
}));
jest.mock('../../../core/commands/entity-commands/SetFaceAppearanceCommand', () => ({
  SetFaceAppearanceCommand: class {
    constructor(
      public readonly entityId: string,
      public readonly faceKey: string,
      public readonly value: unknown,
      public readonly adapter: unknown,
    ) {}
  },
}));
jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: (_g: unknown, _s: unknown, levelId: string) => ({ levelId }),
}));
jest.mock('../../../bim-3d/scene/extract-bim3d-entities', () => ({
  extractBim3DEntities: () => ({
    walls: [{ id: 'w-42', type: 'wall' }],
    columns: [{ id: 'col-7', type: 'column' }],
  }),
}));

const MTL = `newmtl paint-red
Kd 0.752941 0.223529 0.168627
newmtl mat_myblue
Kd 0.100000 0.200000 0.300000
`;
const OBJ = `o Wall_w-42
usemtl paint-red
f 1 2 3
o Column_col-7
usemtl mat_myblue
f 4 5 6
o Cube_extra
usemtl mat_myblue
f 7 8 9
`;

function fakeLevels(): LevelsHookReturn {
  return {
    levels: [{ id: 'lvl-1', name: '' }],
    getLevelScene: () => ({ entities: [] }),
    setLevelScene: () => undefined,
  } as unknown as LevelsHookReturn;
}

describe('importC4dMaterials (orchestrator)', () => {
  beforeEach(() => { mockCapture.executed = null; });

  it('matches, resolves and applies per entity as a base override', () => {
    const result = importC4dMaterials(fakeLevels(), { objText: OBJ, mtlText: MTL });

    expect(result.objectCount).toBe(3);
    expect(result.matchedCount).toBe(2);
    expect(result.appliedCount).toBe(2);
    expect(result.unmatched).toEqual(['Cube_extra']);

    const children = (mockCapture.executed as { children: Array<Record<string, unknown>> }).children;
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({
      entityId: 'w-42', faceKey: '*', value: { materialId: 'paint-red' }, adapter: { levelId: 'lvl-1' },
    });
    expect(children[1]).toMatchObject({
      entityId: 'col-7', faceKey: '*', value: { colorHex: '#1a334d' }, adapter: { levelId: 'lvl-1' },
    });
  });

  it('does nothing when no object matches', () => {
    const result = importC4dMaterials(fakeLevels(), {
      objText: 'o Nope_x\nusemtl paint-red\nf 1 2 3\n', mtlText: MTL,
    });
    expect(result.appliedCount).toBe(0);
    expect(mockCapture.executed).toBeNull();
  });
});
