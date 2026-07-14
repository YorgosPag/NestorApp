/**
 * ADR-650 — silent contour regenerate: idempotent cleanup + no undo/autosave side effects.
 */

import { regenerateTopoContours } from '../regenerate-topo';
import { clearTopo, setTopoPoints } from '../../TopoPointStore';
import { createSceneLayer } from '../../../../types/scene-types';
import { TOPO_MINOR_LAYER_NAME } from '../../contour-config';
import { setGeoReference } from '../../../geo-referencing/geo-reference-store';
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

// Collect every {x,y} vertex from the produced contour lwpolylines.
function contourVertices(scene: SceneModel): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const e of scene.entities) {
    const verts = (e as unknown as { vertices?: { x: number; y: number }[] }).vertices;
    if (Array.isArray(verts)) out.push(...verts);
  }
  return out;
}

describe('regenerateTopoContours', () => {
  beforeEach(() => { clearTopo(); setGeoReference(null); });
  afterEach(() => { clearTopo(); setGeoReference(null); });

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

  it('ADR-650 M10 — projects ΕΓΣΑ world contours into the building LOCAL frame', () => {
    // A survey sitting at ΕΓΣΑ world coords (~384.5 km / 4201 km), far from the plan.
    const ox = 384_500_000;
    const oy = 4_201_200_000;
    setTopoPoints([
      { x: ox, y: oy, z: 0 }, { x: ox + 1000, y: oy, z: 1000 },
      { x: ox, y: oy + 1000, z: 500 }, { x: ox + 1000, y: oy + 1000, z: 1500 },
    ]);
    let scene = makeScene([], []);
    const commit = (s: SceneModel) => { scene = s; };

    // Without a geo-reference the contours stay in ΕΓΣΑ world (huge magnitudes).
    regenerateTopoContours({ getScene: () => scene, commitScene: commit, levelId: '0' });
    const worldVerts = contourVertices(scene);
    expect(worldVerts.length).toBeGreaterThan(0);
    expect(worldVerts.every((v) => v.x > 1e8)).toBe(true);

    // With the geo-reference (local origin at the survey corner) they land near 0 — on the plan.
    setGeoReference({ originWorld: { x: ox, y: oy }, rotationDeg: 0 });
    regenerateTopoContours({ getScene: () => scene, commitScene: commit, levelId: '0' });
    const localVerts = contourVertices(scene);
    expect(localVerts.length).toBeGreaterThan(0);
    expect(localVerts.every((v) => v.x >= -1 && v.x <= 1001)).toBe(true);
    expect(localVerts.every((v) => v.y >= -1 && v.y <= 1001)).toBe(true);
  });
});
