/**
 * ADR-402 Phase B — BimGizmoOverlay handle visibility.
 *
 * Regression lock: a resize visual is shared by two handle ids (`resize-x` and its
 * mirror `resize-m-x` map to the SAME octahedron). `setActiveHandles` must keep it
 * visible when only `resize-x` is active — a per-id assignment let the inactive
 * mirror id overwrite it to false (Map insertion order), hiding every resize handle
 * for columns. Verified through the scene graph (black-box).
 */

import * as THREE from 'three';
import { BimGizmoOverlay, activeHandlesFor } from '../bim-gizmo-overlay';

function findByName(scene: THREE.Scene, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  scene.traverse((obj) => {
    if (!found && obj.name === name) found = obj;
  });
  return found;
}

describe('BimGizmoOverlay — active-handle visibility', () => {
  it('shows the resize-x / resize-z visuals for a column selection', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(activeHandlesFor('column'));

    expect(findByName(scene, 'gizmo-resize-x')?.visible).toBe(true);
    expect(findByName(scene, 'gizmo-resize-z')?.visible).toBe(true);
    // Base move handle stays visible too.
    expect(findByName(scene, 'gizmo-arrow-x')?.visible).toBe(true);

    overlay.dispose();
  });

  it('hides the resize visuals for a base-only (non-column) selection', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(activeHandlesFor(null));

    expect(findByName(scene, 'gizmo-resize-x')?.visible).toBe(false);
    expect(findByName(scene, 'gizmo-resize-z')?.visible).toBe(false);
    // Base move handle remains visible.
    expect(findByName(scene, 'gizmo-arrow-x')?.visible).toBe(true);

    overlay.dispose();
  });

  it('builds all gizmo geometry with finite vertex positions (no NaN)', () => {
    // Regression: the center pyramid basis divided by zero for the [1,1,1] diagonal
    // → NaN vertices → THREE "computeBoundingSphere(): radius is NaN" every frame the
    // gizmo rendered (triggered on selecting any entity, e.g. a wall).
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);
    overlay.setActiveHandles(activeHandlesFor('wall')); // base handles incl. center pyramid

    const offenders: string[] = [];
    scene.traverse((obj) => {
      const geo = (obj as THREE.Mesh | THREE.LineSegments).geometry as THREE.BufferGeometry | undefined;
      const pos = geo?.getAttribute?.('position');
      if (!pos) return;
      for (let i = 0; i < pos.array.length; i++) {
        if (!Number.isFinite(pos.array[i])) {
          offenders.push(obj.name || obj.type);
          break;
        }
      }
    });

    expect(offenders).toEqual([]);
    overlay.dispose();
  });

  it('exposes the resize-x / resize-z hitboxes for a column (hittable)', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(activeHandlesFor('column'));
    const ids = new Set(
      overlay.hitTestView.hitboxes.map((hb) => overlay.hitTestView.hitboxToId.get(hb)),
    );

    expect(ids.has('resize-x')).toBe(true);
    expect(ids.has('resize-z')).toBe(true);

    overlay.dispose();
  });
});

describe('activeHandlesFor — per-type resize handles (ADR-402 Phase B, Revit)', () => {
  it.each(['column', 'wall', 'beam'])(
    'exposes plan + vertical resize handles for %s',
    (bimType) => {
      const ids = activeHandlesFor(bimType);
      expect(ids.has('resize-x')).toBe(true);
      expect(ids.has('resize-z')).toBe(true);
      expect(ids.has('resize-y')).toBe(true);
    },
  );

  it('slab exposes only the vertical (thickness) resize handle — footprint is 2D per-vertex', () => {
    const ids = activeHandlesFor('slab');
    expect(ids.has('resize-y')).toBe(true);
    expect(ids.has('resize-x')).toBe(false);
    expect(ids.has('resize-z')).toBe(false);
  });

  it('wall + column expose a SECOND (base) vertical grip resize-m-y (ADR-401 E.3/F.3 top/base faces)', () => {
    expect(activeHandlesFor('wall').has('resize-m-y')).toBe(true);
    expect(activeHandlesFor('column').has('resize-m-y')).toBe(true);
  });

  it('beam/slab have a single vertical handle (no base grip)', () => {
    expect(activeHandlesFor('beam').has('resize-m-y')).toBe(false);
    expect(activeHandlesFor('slab').has('resize-m-y')).toBe(false);
  });

  it('a base-only / unknown selection exposes no resize handles', () => {
    const ids = activeHandlesFor(null);
    expect(ids.has('resize-x')).toBe(false);
    expect(ids.has('resize-z')).toBe(false);
    expect(ids.has('resize-y')).toBe(false);
  });
});

describe('activeHandlesFor — Revit DOF: 2-axis (planar) vs 3-axis (free) move (ADR-408 Φ-E)', () => {
  it.each(['wall', 'column', 'beam', 'slab', 'stair', 'furniture'])(
    'planar entity %s moves in PLAN only — horizontal arrows + horizontal plane, NO vertical move arrow / planes',
    (bimType) => {
      const ids = activeHandlesFor(bimType);
      expect(ids.has('axis-x')).toBe(true);
      expect(ids.has('axis-z')).toBe(true);
      expect(ids.has('plane-xz')).toBe(true);
      // 2-axis: no free vertical move (elevation is a constraint/offset via the tab).
      expect(ids.has('axis-y')).toBe(false);
      expect(ids.has('plane-xy')).toBe(false);
      expect(ids.has('plane-yz')).toBe(false);
    },
  );

  it.each([
    'mep-segment', 'mep-fixture', 'mep-manifold', 'mep-radiator', 'mep-boiler', 'mep-water-heater',
  ])('free-3D entity %s moves in ALL three axes — vertical arrow + all three plane handles', (bimType) => {
    const ids = activeHandlesFor(bimType);
    expect(ids.has('axis-x')).toBe(true);
    expect(ids.has('axis-y')).toBe(true);
    expect(ids.has('axis-z')).toBe(true);
    expect(ids.has('plane-xz')).toBe(true);
    expect(ids.has('plane-xy')).toBe(true);
    expect(ids.has('plane-yz')).toBe(true);
  });

  it('a multi-selection (editBimType null) is planar — no vertical move arrow / planes', () => {
    const ids = activeHandlesFor(null);
    expect(ids.has('axis-y')).toBe(false);
    expect(ids.has('plane-xy')).toBe(false);
    expect(ids.has('plane-yz')).toBe(false);
    // horizontal plan move stays.
    expect(ids.has('axis-x')).toBe(true);
    expect(ids.has('plane-xz')).toBe(true);
  });
});

describe('activeHandlesFor — tilt X/Z rings (ADR-404 Phase 2)', () => {
  it.each(['column', 'wall', 'beam', 'slab'])('exposes both X/Z tilt rings for %s', (bimType) => {
    const ids = activeHandlesFor(bimType);
    expect(ids.has('rotate-x')).toBe(true);
    expect(ids.has('rotate-z')).toBe(true);
    // the Y plan-rotation ring stays (it is a BASE handle).
    expect(ids.has('rotate-y')).toBe(true);
  });

  it('stair has NO tilt rings — its incline is parametric (run/stepCount)', () => {
    const ids = activeHandlesFor('stair');
    expect(ids.has('rotate-x')).toBe(false);
    expect(ids.has('rotate-z')).toBe(false);
  });

  it('a multi-selection (editBimType null) shows no tilt rings — single-select only', () => {
    const ids = activeHandlesFor(null);
    expect(ids.has('rotate-x')).toBe(false);
    expect(ids.has('rotate-z')).toBe(false);
  });
});
