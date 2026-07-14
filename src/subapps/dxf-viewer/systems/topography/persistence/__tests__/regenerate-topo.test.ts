/**
 * ADR-650 — silent contour regenerate: idempotent cleanup + no undo/autosave side effects.
 */

import { regenerateTopoContours } from '../regenerate-topo';
import { clearTopo, setTopoPoints } from '../../TopoPointStore';
import { createSceneLayer } from '../../../../types/scene-types';
import { TOPO_MINOR_LAYER_NAME } from '../../contour-config';
import type { SceneModel, AnySceneEntity } from '../../../../types/scene';

function makeScene(entities: AnySceneEntity[], layers: ReturnType<typeof createSceneLayer>[]): SceneModel {
  const layersById: Record<string, ReturnType<typeof createSceneLayer>> = {};
  for (const l of layers) layersById[l.id] = l;
  return {
    entities,
    layersById: layersById as unknown as SceneModel['layersById'],
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  } as SceneModel;
}

describe('regenerateTopoContours', () => {
  beforeEach(() => clearTopo());
  afterEach(() => clearTopo());

  it('removes stale entities on contour layers before rebuilding (idempotent cleanup)', () => {
    const minorLayer = createSceneLayer({ name: TOPO_MINOR_LAYER_NAME, color: '#B5651D', visible: true, locked: false });
    const staleContour = { id: 'stale_1', type: 'lwpolyline', layerId: minorLayer.id, vertices: [], closed: false } as unknown as AnySceneEntity;
    const keeper = { id: 'keep_1', type: 'line', layerId: 'lyr_other', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as AnySceneEntity;

    let scene = makeScene([staleContour, keeper], [minorLayer]);
    // No survey points → no fresh contours, but the stale one must still be dropped.
    const count = regenerateTopoContours({
      getScene: () => scene,
      commitScene: (s) => { scene = s; },
      levelId: '0',
    });

    expect(count).toBe(0);
    const ids = scene.entities.map((e) => e.id);
    expect(ids).toContain('keep_1');       // non-contour entity survives
    expect(ids).not.toContain('stale_1');  // stale contour purged
  });

  it('is idempotent across repeated runs (no duplication)', () => {
    // A minimal triangulable survey (three non-collinear points at different Z).
    setTopoPoints([
      { x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 1000 },
      { x: 0, y: 1000, z: 500 }, { x: 1000, y: 1000, z: 1500 },
    ]);
    let scene = makeScene([], []);
    const commit = (s: SceneModel) => { scene = s; };

    const first = regenerateTopoContours({ getScene: () => scene, commitScene: commit, levelId: '0' });
    const afterFirst = scene.entities.length;
    const second = regenerateTopoContours({ getScene: () => scene, commitScene: commit, levelId: '0' });

    expect(second).toBe(first);                 // same contour count both runs
    expect(scene.entities.length).toBe(afterFirst); // no accumulation
  });
});
