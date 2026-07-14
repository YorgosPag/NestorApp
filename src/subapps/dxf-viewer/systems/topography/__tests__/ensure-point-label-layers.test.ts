/**
 * ADR-656 M10 — ensure the four survey-point-label layers exist (mint + idempotency).
 *
 * Mirrors the M9 contour-layer contract: a fresh scene gets all four layers minted; a second
 * call on a fully-provisioned scene writes nothing (idempotent). No lineweight is asserted —
 * text/point labels stay default weight, unlike the index/intermediate contours.
 */

import { ensurePointLabelLayers } from '../ensure-point-label-layers';
import {
  TOPO_POINT_ELEV_LAYER_NAME, TOPO_POINT_CODE_LAYER_NAME,
  TOPO_POINT_NUM_LAYER_NAME, TOPO_BOUNDARY_XY_LAYER_NAME,
} from '../topo-point-label-config';
import { createSceneLayer } from '../../../types/scene-types';
import type { SceneLayer } from '../../../types/scene-types';
import type { SceneModel } from '../../../types/scene';

const LEVEL = '0';

function makeHarness(seedLayers: SceneLayer[] = []): {
  getScene: (levelId: string) => SceneModel | null;
  setScene: (levelId: string, scene: SceneModel) => void;
  scene: () => SceneModel;
  writes: () => number;
} {
  const layersById: Record<string, SceneLayer> = {};
  for (const l of seedLayers) layersById[l.id] = l;
  let current: SceneModel = {
    entities: [],
    layersById,
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  };
  let writes = 0;
  return {
    getScene: () => current,
    setScene: (_levelId, scene) => { current = scene; writes += 1; },
    scene: () => current,
    writes: () => writes,
  };
}

function byName(scene: SceneModel, name: string): SceneLayer | undefined {
  return Object.values(scene.layersById).find((l) => l.name === name);
}

describe('ensurePointLabelLayers — ADR-656 M10', () => {
  it('mints all four label layers with their ids returned', () => {
    const h = makeHarness();

    const ids = ensurePointLabelLayers(h.getScene, h.setScene, LEVEL);

    expect(ids).not.toBeNull();
    const scene = h.scene();
    expect(byName(scene, TOPO_POINT_ELEV_LAYER_NAME)?.id).toBe(ids?.elevation);
    expect(byName(scene, TOPO_POINT_CODE_LAYER_NAME)?.id).toBe(ids?.code);
    expect(byName(scene, TOPO_POINT_NUM_LAYER_NAME)?.id).toBe(ids?.number);
    expect(byName(scene, TOPO_BOUNDARY_XY_LAYER_NAME)?.id).toBe(ids?.boundary);
  });

  it('reuses an existing layer instead of re-minting it', () => {
    const existingElev = createSceneLayer({ name: TOPO_POINT_ELEV_LAYER_NAME });
    const h = makeHarness([existingElev]);

    const ids = ensurePointLabelLayers(h.getScene, h.setScene, LEVEL);

    expect(ids?.elevation).toBe(existingElev.id);
  });

  it('is idempotent — a second call on a fully-provisioned scene writes nothing', () => {
    const h = makeHarness();

    ensurePointLabelLayers(h.getScene, h.setScene, LEVEL);
    const writesAfterFirst = h.writes();
    ensurePointLabelLayers(h.getScene, h.setScene, LEVEL);

    expect(h.writes()).toBe(writesAfterFirst);
  });

  it('returns null when the level has no scene', () => {
    const ids = ensurePointLabelLayers(() => null, () => {}, LEVEL);
    expect(ids).toBeNull();
  });
});
