/**
 * ADR-484 — Revit-canonical foundation level routing: τα πέδιλα δρομολογούνται
 * ΠΑΝΤΑ στον foundation level (cross-level writer) όταν ο ενεργός όροφος διαφέρει·
 * αλλιώς κανονικό active-scene append.
 */

import { addFoundationToScene } from '../add-foundation-to-scene';
import { appendEntityToScene } from '../../scene/append-entity-to-scene';
import { createFoundationCrossLevelWriter } from '../foundation-cross-level-writer';
import { useFoundationLevelStore } from '../../../state/foundation-level-store';
import type { FoundationEntity } from '../types/foundation-types';
import type { SceneAppendAccessor } from '../../scene/append-entity-to-scene';
import type { FoundationWriteScope } from '../foundation-cross-level-writer';

jest.mock('../../scene/append-entity-to-scene', () => ({
  appendEntityToScene: jest.fn(),
}));
jest.mock('../foundation-cross-level-writer', () => ({
  createFoundationCrossLevelWriter: jest.fn(),
}));

const entity = { id: 'f1', type: 'foundation', kind: 'pad' } as unknown as FoundationEntity;
const accessor = {} as SceneAppendAccessor;
const scope: FoundationWriteScope = { companyId: 'c', projectId: 'p', userId: 'u' };

const setTarget = (target: unknown): void => {
  useFoundationLevelStore.setState({ target } as never);
};

describe('addFoundationToScene — ADR-484 level routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTarget(null);
  });

  it('ενεργός = foundation level (target null) → active-scene append', () => {
    addFoundationToScene(entity, accessor, scope);
    expect(appendEntityToScene).toHaveBeenCalledWith(accessor, entity, 'foundation');
    expect(createFoundationCrossLevelWriter).not.toHaveBeenCalled();
  });

  it('ενεργός ≠ foundation level (target set) → redirect cross-level writer.create', () => {
    const create = jest.fn();
    (createFoundationCrossLevelWriter as jest.Mock).mockReturnValue({ create });
    setTarget({ levelId: 'lvl-foundation', floorId: 'fl', sceneFileId: null, floorElevationMm: 0 });

    addFoundationToScene(entity, accessor, scope);

    expect(create).toHaveBeenCalledWith(entity);
    expect(appendEntityToScene).not.toHaveBeenCalled();
  });

  it('target set αλλά writer null (degenerate scope) → fallback active append', () => {
    (createFoundationCrossLevelWriter as jest.Mock).mockReturnValue(null);
    setTarget({ levelId: 'lvl-foundation', floorId: 'fl', sceneFileId: null, floorElevationMm: 0 });

    addFoundationToScene(entity, accessor, scope);

    expect(appendEntityToScene).toHaveBeenCalledWith(accessor, entity, 'foundation');
  });
});
