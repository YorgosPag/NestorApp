/**
 * ADR-656 M9 — index/intermediate contour lineweights via the layer cascade.
 *
 * The presentation rule (Civil 3D / USGS / ΤΕΕ): MAJOR contours ~2.5–3× heavier
 * than MINOR ones. We apply this ByLayer (contour entities stay lineweight-free),
 * so these tests pin the layer-mint + idempotent reconcile contract:
 *   1. freshly-minted layers carry the spec lineweight;
 *   2. an EXISTING layer with a sentinel weight is upgraded on the next generate;
 *   3. a user's manual (concrete) override is NEVER clobbered;
 *   4. the whole call is idempotent — no scene write when nothing changes.
 */

import { ensureContourLayers } from '../ensure-contour-layers';
import {
  TOPO_MAJOR_LAYER_NAME, TOPO_MINOR_LAYER_NAME, TOPO_LABEL_LAYER_NAME,
  TOPO_MAJOR_LINEWEIGHT_MM, TOPO_MINOR_LINEWEIGHT_MM,
} from '../contour-config';
import { createSceneLayer } from '../../../types/scene-types';
import type { SceneLayer } from '../../../types/scene-types';
import type { SceneModel } from '../../../types/scene';

const LEVEL = '0';

/** Minimal scene harness with closure-backed get/set, tracking write count. */
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

/** Resolve a layer by its canonical name in a scene. */
function byName(scene: SceneModel, name: string): SceneLayer | undefined {
  return Object.values(scene.layersById).find((l) => l.name === name);
}

describe('ensureContourLayers — ADR-656 M9 lineweights', () => {
  it('mints major/minor layers with the spec lineweights (label stays default)', () => {
    const h = makeHarness();

    const ids = ensureContourLayers(h.getScene, h.setScene, LEVEL);

    expect(ids).not.toBeNull();
    const scene = h.scene();
    expect(byName(scene, TOPO_MAJOR_LAYER_NAME)?.lineweight).toBe(TOPO_MAJOR_LINEWEIGHT_MM);
    expect(byName(scene, TOPO_MINOR_LAYER_NAME)?.lineweight).toBe(TOPO_MINOR_LINEWEIGHT_MM);
    // Label layer is not a spec target → factory default sentinel (-3).
    expect(byName(scene, TOPO_LABEL_LAYER_NAME)?.lineweight).toBe(-3);
    // Major is meaningfully heavier than minor (the whole point of the feature).
    expect(TOPO_MAJOR_LINEWEIGHT_MM).toBeGreaterThan(TOPO_MINOR_LINEWEIGHT_MM * 2);
  });

  it('upgrades an existing layer that still has a sentinel lineweight', () => {
    // Legacy scene: contour layers exist from a pre-M9 generate (default weight).
    const legacyMajor = createSceneLayer({ name: TOPO_MAJOR_LAYER_NAME }); // lineweight -3
    const h = makeHarness([legacyMajor]);

    ensureContourLayers(h.getScene, h.setScene, LEVEL);

    const scene = h.scene();
    // Same id preserved (not re-minted) but weight brought up to spec.
    const major = byName(scene, TOPO_MAJOR_LAYER_NAME);
    expect(major?.id).toBe(legacyMajor.id);
    expect(major?.lineweight).toBe(TOPO_MAJOR_LINEWEIGHT_MM);
  });

  it('never clobbers a user-set (concrete) lineweight override', () => {
    const userMajor = createSceneLayer({ name: TOPO_MAJOR_LAYER_NAME, lineweight: 0.7 });
    const h = makeHarness([userMajor]);

    ensureContourLayers(h.getScene, h.setScene, LEVEL);

    expect(byName(h.scene(), TOPO_MAJOR_LAYER_NAME)?.lineweight).toBe(0.7);
  });

  it('is idempotent — a second call on a fully-provisioned scene writes nothing', () => {
    const h = makeHarness();

    ensureContourLayers(h.getScene, h.setScene, LEVEL);
    const writesAfterFirst = h.writes();
    ensureContourLayers(h.getScene, h.setScene, LEVEL);

    expect(h.writes()).toBe(writesAfterFirst);
  });
});
