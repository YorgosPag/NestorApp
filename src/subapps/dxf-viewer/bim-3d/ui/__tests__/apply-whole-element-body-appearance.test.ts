/**
 * ADR-539 Φ7 — `applyWholeElementBodyAppearance` (mode ΣΩΜΑ) routing:
 *   - ΣΚΑΛΑ → `applyStairWholeAppearance` → `UpdateStairParamsCommand` (materials.appearance).
 *   - solid → `applyEntityFaceAppearanceMap` → `SetEntityFaceAppearanceMapCommand` (base `'*'`).
 * Οι deps mocked ώστε το test να ελέγχει ΜΟΝΟ το branching-by-type.
 */

import type { LevelsHookReturn } from '../../../systems/levels/useLevels';

const mockExecuted: string[] = [];
const mockState: { entity: { type: string; params?: unknown } | undefined } = { entity: undefined };

jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: (cmd: { kind: string }) => mockExecuted.push(cmd.kind) }),
}));
jest.mock('../../../core/commands/entity-commands/UpdateStairParamsCommand', () => ({
  UpdateStairParamsCommand: class { readonly kind = 'stair'; },
}));
jest.mock('../../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand', () => ({
  SetEntityFaceAppearanceMapCommand: class { readonly kind = 'entity'; },
}));
jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: () => ({ getEntity: () => mockState.entity }),
}));

import { applyWholeElementBodyAppearance } from '../apply-entity-face-appearance-map';

const levels = { currentLevelId: 'lvl1', getLevelScene: () => null, setLevelScene: () => {} } as unknown as LevelsHookReturn;

beforeEach(() => { mockExecuted.length = 0; mockState.entity = undefined; });

describe('applyWholeElementBodyAppearance', () => {
  it('σκάλα → UpdateStairParamsCommand (materials.appearance)', () => {
    mockState.entity = { type: 'stair', params: {} };
    applyWholeElementBodyAppearance(levels, 'stair_1', { colorHex: '#123' });
    expect(mockExecuted).toEqual(['stair']);
  });

  it('solid (wall) → SetEntityFaceAppearanceMapCommand (base map)', () => {
    mockState.entity = { type: 'wall' };
    applyWholeElementBodyAppearance(levels, 'wall_1', { colorHex: '#123' });
    expect(mockExecuted).toEqual(['entity']);
  });

  it('column → entity path', () => {
    mockState.entity = { type: 'column' };
    applyWholeElementBodyAppearance(levels, 'col_1', { materialId: 'wc-brick' });
    expect(mockExecuted).toEqual(['entity']);
  });

  it('no-op όταν το entity δεν βρέθηκε → πέφτει στο entity path χωρίς crash', () => {
    mockState.entity = undefined;
    applyWholeElementBodyAppearance(levels, 'x', { colorHex: '#123' });
    // entity undefined → όχι stair → entity path (SetEntityFaceAppearanceMapCommand).
    expect(mockExecuted).toEqual(['entity']);
  });
});
