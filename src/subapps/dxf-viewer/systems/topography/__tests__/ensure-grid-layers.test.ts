/**
 * ADR-656 M11 — ensure the TOPO-GRID layer exists (mint · reuse · idempotency · null scene).
 * Mirrors the M9/M10 layer contract.
 */

import { ensureGridLayer } from '../ensure-grid-layers';
import { TOPO_GRID_LAYER_NAME } from '../topo-grid-config';
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

describe('ensureGridLayer — ADR-656 M11', () => {
  it('mints the TOPO-GRID layer and returns its id', () => {
    const h = makeHarness();
    const id = ensureGridLayer(h.getScene, h.setScene, LEVEL);
    expect(id).not.toBeNull();
    expect(byName(h.scene(), TOPO_GRID_LAYER_NAME)?.id).toBe(id);
  });

  it('reuses an existing TOPO-GRID layer instead of re-minting it', () => {
    const existing = createSceneLayer({ name: TOPO_GRID_LAYER_NAME });
    const h = makeHarness([existing]);
    const id = ensureGridLayer(h.getScene, h.setScene, LEVEL);
    expect(id).toBe(existing.id);
    expect(h.writes()).toBe(0);
  });

  it('is idempotent — a second call writes nothing', () => {
    const h = makeHarness();
    ensureGridLayer(h.getScene, h.setScene, LEVEL);
    const afterFirst = h.writes();
    ensureGridLayer(h.getScene, h.setScene, LEVEL);
    expect(h.writes()).toBe(afterFirst);
  });

  it('returns null when the level has no scene', () => {
    expect(ensureGridLayer(() => null, () => {}, LEVEL)).toBeNull();
  });
});
