/**
 * ADR-686 Φ5 — apply-imported-mesh-material-map: το batch write του Material Mapping.
 *
 * Επιβεβαιώνει τη μοναδική συμπεριφορά που ΔΕΝ φαίνεται στον κώδικα: (α) no-op guards, (β) ότι κάθε
 * ανάθεση γίνεται `SetEntityFaceAppearanceMapCommand` με base `'*'` map (per-entity, όχι slot), και
 * (γ) ότι όλα εκτελούνται ως ΕΝΑ atomic batch (ένα undo βήμα).
 */

import { applyImportedMeshMaterialMap } from '../apply-imported-mesh-material-map';
import { executeAsAtomicBatch } from '../../../core/commands/execute-atomic-batch';
import { SetEntityFaceAppearanceMapCommand } from '../../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import type { LevelSceneWriter } from '../../../systems/levels/level-scene-accessor';

jest.mock('../../../core/commands/execute-atomic-batch', () => ({
  executeAsAtomicBatch: jest.fn(),
}));
jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: jest.fn(() => ({ adapter: true })),
}));
jest.mock('../../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand', () => ({
  SetEntityFaceAppearanceMapCommand: jest.fn(function (this: Record<string, unknown>, id, value, sm) {
    this.id = id;
    this.value = value;
    this.sm = sm;
  }),
}));

const execMock = executeAsAtomicBatch as jest.Mock;
const cmdMock = SetEntityFaceAppearanceMapCommand as unknown as jest.Mock;

function writer(currentLevelId: string | null): LevelSceneWriter {
  return {
    currentLevelId,
    getLevelScene: jest.fn(() => null),
    setLevelScene: jest.fn(),
  };
}

beforeEach(() => {
  execMock.mockClear();
  cmdMock.mockClear();
  (createLevelSceneManagerAdapter as jest.Mock).mockClear();
});

describe('applyImportedMeshMaterialMap', () => {
  it('no-op όταν λείπει το τρέχον level', () => {
    applyImportedMeshMaterialMap(writer(null), [{ entityId: 'a', value: { materialId: 'm1' } }]);
    expect(execMock).not.toHaveBeenCalled();
  });

  it('no-op όταν ο manager είναι null', () => {
    applyImportedMeshMaterialMap(null, [{ entityId: 'a', value: { materialId: 'm1' } }]);
    expect(execMock).not.toHaveBeenCalled();
  });

  it('no-op σε άδεια λίστα αναθέσεων', () => {
    applyImportedMeshMaterialMap(writer('L0'), []);
    expect(execMock).not.toHaveBeenCalled();
  });

  it('γράφει base «*» map ανά entity (per-entity, όχι slot) και εκτελεί ΕΝΑ batch', () => {
    applyImportedMeshMaterialMap(writer('L0'), [
      { entityId: 'chair-base', value: { materialId: 'metal' } },
      { entityId: 'chair-arm', value: { colorHex: '#2b2723' } },
    ]);

    expect(cmdMock).toHaveBeenCalledTimes(2);
    expect(cmdMock.mock.calls[0][0]).toBe('chair-base');
    expect(cmdMock.mock.calls[0][1]).toEqual({ '*': { materialId: 'metal' } });
    expect(cmdMock.mock.calls[1][1]).toEqual({ '*': { colorHex: '#2b2723' } });

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock.mock.calls[0][0]).toHaveLength(2);
  });

  it('value=null καθαρίζει το override (άδειο map)', () => {
    applyImportedMeshMaterialMap(writer('L0'), [{ entityId: 'x', value: null }]);
    expect(cmdMock.mock.calls[0][1]).toEqual({});
    expect(execMock).toHaveBeenCalledTimes(1);
  });
});
