/**
 * ADR-635 Φ C.17 — `commitImportedScene`: η ΜΙΑ πόρτα εισαγωγής σκηνής σε όροφο.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ (και τα δύο θα ήταν πρακτικά αόρατα σε code review):
 *   1. Το `emitImportedEntityCreateEvents` παίρνει τα **RECONCILED** entities. Με τα ωμά,
 *      τα per-entity docs θα first-save-άρουν με νέα layer ids ενώ το scene κρατά τα παλιά
 *      — το ίδιο ορφάνιασμα από την ανάποδη.
 *   2. Το reconcile διαβάζει τον όροφο-**ΣΤΟΧΟ**, όχι τον ενεργό (ADR-420 + Φ C.16).
 */

import { commitImportedScene } from '../commit-imported-scene';
import { createSceneLayer } from '../../../types/scene-types';
import type { Entity, SceneLayer, SceneModel } from '../../../types/entities';
import { EMPTY_BOUNDS } from '../../../config/geometry-constants';
import { emitImportedEntityCreateEvents } from '../emit-imported-entity-create-events';
import { captureSessionBlocksFromScene } from '../../../bim/block-library/capture-session-blocks';
import { markFreshImportFit } from '../../zoom/viewport-fit-intent';

jest.mock('../emit-imported-entity-create-events', () => ({
  emitImportedEntityCreateEvents: jest.fn(),
}));
jest.mock('../../../bim/block-library/capture-session-blocks', () => ({
  captureSessionBlocksFromScene: jest.fn(),
}));
jest.mock('../../zoom/viewport-fit-intent', () => ({
  markFreshImportFit: jest.fn(),
}));

const emitMock = emitImportedEntityCreateEvents as jest.MockedFunction<typeof emitImportedEntityCreateEvents>;
const captureMock = captureSessionBlocksFromScene as jest.MockedFunction<typeof captureSessionBlocksFromScene>;
const fitMock = markFreshImportFit as jest.MockedFunction<typeof markFreshImportFit>;

const TARGET = 'lvl_target';
const ACTIVE = 'lvl_active';
const SCOPE = { levelId: TARGET, floorId: 'flr_1', floorplanId: null };

function scene(layers: SceneLayer[], entities: Entity[] = []): SceneModel {
  const layersById: Record<string, SceneLayer> = {};
  for (const l of layers) layersById[l.id] = l;
  return { entities, layersById, bounds: { ...EMPTY_BOUNDS }, units: 'mm' };
}

function hatch(id: string, layerId: string): Entity {
  return { id, type: 'hatch', layerId, visible: true, boundaryPaths: [] } as unknown as Entity;
}

describe('commitImportedScene', () => {
  let written: { levelId: string; scene: SceneModel } | null;
  let linkCalls: number;
  let scenes: Record<string, SceneModel>;

  const deps = () => ({
    targetLevelId: TARGET,
    scope: SCOPE,
    getLevelScene: (id: string) => scenes[id] ?? null,
    setLevelScene: (levelId: string, s: SceneModel) => { written = { levelId, scene: s }; },
    linkSceneFileToLevel: () => { linkCalls += 1; },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    written = null;
    linkCalls = 0;
    scenes = {};
  });

  // ⭐ DISCRIMINATING — πιάνει το ordering bug (reconcile ΜΕΤΑ το emit).
  it('emits entity-created with the RECONCILED entities, not the raw import', () => {
    scenes[TARGET] = scene([createSceneLayer({ id: 'lyr_A', name: 'ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ' })]);
    const imported = scene(
      [createSceneLayer({ id: 'lyr_B', name: 'ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ' })],
      [hatch('h1', 'lyr_B')],
    );

    commitImportedScene(imported, deps());

    const emitted = emitMock.mock.calls[0][0] as ReadonlyArray<{ layerId: string }>;
    expect(emitted[0].layerId).toBe('lyr_A');
    // Το doc που θα γραφτεί στο Firestore ΚΑΙ η σκηνή συμφωνούν.
    expect((written?.scene.entities[0] as unknown as { layerId: string }).layerId).toBe('lyr_A');
  });

  it('reconciles against the TARGET level, not the active one (ADR-420 + Φ C.16)', () => {
    scenes[ACTIVE] = scene([createSceneLayer({ id: 'lyr_ACTIVE', name: 'ΤΟΙΧΟΙ' })]);
    scenes[TARGET] = scene([createSceneLayer({ id: 'lyr_TARGET', name: 'ΤΟΙΧΟΙ' })]);
    const imported = scene([createSceneLayer({ id: 'lyr_NEW', name: 'ΤΟΙΧΟΙ' })], [hatch('h1', 'lyr_NEW')]);

    commitImportedScene(imported, deps());

    expect(written?.levelId).toBe(TARGET);
    expect((written?.scene.entities[0] as unknown as { layerId: string }).layerId).toBe('lyr_TARGET');
  });

  it('forwards the explicit import scope to the first-save emitter (Φ C.16)', () => {
    scenes[TARGET] = scene([]);
    commitImportedScene(scene([], [hatch('h1', 'lyr_X')]), deps());

    expect(emitMock.mock.calls[0][1]).toBe(SCOPE);
  });

  it('runs the full pipeline once, in order, for a first import (empty target)', () => {
    const imported = scene([createSceneLayer({ id: 'lyr_B', name: '0' })], [hatch('h1', 'lyr_B')]);

    commitImportedScene(imported, deps());

    // Κενός στόχος ⇒ no-op reconcile ⇒ ίδιο reference, αλλά ΟΛΑ τα βήματα τρέχουν.
    expect(written?.scene).toBe(imported);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(linkCalls).toBe(1);
    expect(fitMock).toHaveBeenCalledTimes(1);
  });
});
