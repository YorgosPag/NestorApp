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
import { BimGizmoOverlay, activeHandlesFor, isPlanarMoveType } from '../bim-gizmo-overlay';

function findByName(scene: THREE.Scene, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  scene.traverse((obj) => {
    if (!found && obj.name === name) found = obj;
  });
  return found;
}

describe('BimGizmoOverlay — active-handle visibility', () => {
  // Shared-visual regression lock (`resize-x`/`resize-m-x` map to ONE octahedron):
  // exercised through STAIR, the only type that still exposes the plan resize handles
  // after the Revit-faithful ADR-408 Φ1 cleanup (structural section → Type, no drag).
  it('shows the resize-x / resize-z visuals for a stair selection', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(activeHandlesFor('stair'));

    expect(findByName(scene, 'gizmo-resize-x')?.visible).toBe(true);
    expect(findByName(scene, 'gizmo-resize-z')?.visible).toBe(true);
    // Base move handle stays visible too.
    expect(findByName(scene, 'gizmo-arrow-x')?.visible).toBe(true);

    overlay.dispose();
  });

  // ADR-408 Φ1 — a column shows ONLY the vertical (height) octahedra; its X/Z section
  // (width/depth) is a Type parameter, never a drag.
  it('shows resize-y but HIDES resize-x / resize-z for a column selection (Revit: section = Type)', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(activeHandlesFor('column'));

    expect(findByName(scene, 'gizmo-resize-y')?.visible).toBe(true);
    expect(findByName(scene, 'gizmo-resize-x')?.visible).toBe(false);
    expect(findByName(scene, 'gizmo-resize-z')?.visible).toBe(false);

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

  it('exposes the resize-x / resize-z hitboxes for a stair (hittable)', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(activeHandlesFor('stair'));
    const ids = new Set(
      overlay.hitTestView.hitboxes.map((hb) => overlay.hitTestView.hitboxToId.get(hb)),
    );

    expect(ids.has('resize-x')).toBe(true);
    expect(ids.has('resize-z')).toBe(true);

    overlay.dispose();
  });
});

describe('BimGizmoOverlay — relocatable base-point marker (ADR-408)', () => {
  it('shows the ⊙ marker at a world point and hides it on null', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    // Hidden by default (no override).
    expect(findByName(scene, 'gizmo-base-point-marker')?.visible).toBe(false);

    overlay.setBasePointMarker(new THREE.Vector3(1, 2, 3));
    const marker = findByName(scene, 'gizmo-base-point-marker');
    expect(marker?.visible).toBe(true);
    expect(marker?.position.toArray()).toEqual([1, 2, 3]);

    overlay.setBasePointMarker(null);
    expect(findByName(scene, 'gizmo-base-point-marker')?.visible).toBe(false);

    overlay.dispose();
  });

  it('keeps the marker camera-facing + screen-constant after updateScale (no NaN)', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld(true);

    overlay.setBasePointMarker(new THREE.Vector3(0, 0, 0));
    overlay.updateScale(camera);

    const marker = findByName(scene, 'gizmo-base-point-marker');
    expect(marker?.visible).toBe(true);
    expect(Number.isFinite(marker?.scale.x ?? NaN)).toBe(true);
    expect((marker?.scale.x ?? 0)).toBeGreaterThan(0);

    overlay.dispose();
  });
});

describe('activeHandlesFor — per-type resize handles (ADR-408 Φ1, Revit-faithful)', () => {
  // Revit: a section (thickness/width/depth) is NEVER a drag — only a Type parameter.
  // So wall/column keep only the vertical HEIGHT octahedra (top + base); the X/Z
  // plan-section handles were removed.
  it.each(['column', 'wall'])(
    'exposes ONLY the vertical height handles (resize-y + resize-m-y) for %s — section is Type',
    (bimType) => {
      const ids = activeHandlesFor(bimType);
      expect(ids.has('resize-y')).toBe(true);
      expect(ids.has('resize-m-y')).toBe(true);
      expect(ids.has('resize-x')).toBe(false);
      expect(ids.has('resize-z')).toBe(false);
    },
  );

  it('beam exposes NO resize handles — length is an endpoint handle, section + elevation are Type/move', () => {
    const ids = activeHandlesFor('beam');
    expect(ids.has('resize-x')).toBe(false);
    expect(ids.has('resize-z')).toBe(false);
    expect(ids.has('resize-y')).toBe(false);
    expect(ids.has('resize-m-y')).toBe(false);
  });

  it('slab exposes NO resize handles — thickness is Type, footprint is 2D per-vertex', () => {
    const ids = activeHandlesFor('slab');
    expect(ids.has('resize-y')).toBe(false);
    expect(ids.has('resize-x')).toBe(false);
    expect(ids.has('resize-z')).toBe(false);
    expect(ids.has('resize-m-y')).toBe(false);
  });

  it('stair KEEPS its plan + vertical resize handles (incline is parametric run, not a section)', () => {
    const ids = activeHandlesFor('stair');
    expect(ids.has('resize-x')).toBe(true);
    expect(ids.has('resize-z')).toBe(true);
    expect(ids.has('resize-y')).toBe(true);
    expect(ids.has('resize-m-y')).toBe(true);
  });

  it('a base-only / unknown selection exposes no resize handles', () => {
    const ids = activeHandlesFor(null);
    expect(ids.has('resize-x')).toBe(false);
    expect(ids.has('resize-z')).toBe(false);
    expect(ids.has('resize-y')).toBe(false);
  });
});

describe('activeHandlesFor — endpoint LENGTH shape handles (ADR-408 Φ-D/Φ1, Revit)', () => {
  // A linear element exposes a draggable handle at each axis end (Revit shape handle):
  // mep-segment (free-3D pipe) + wall/beam (horizontal length). Point/area elements do not.
  it.each(['mep-segment', 'wall', 'beam'])('linear element %s exposes both endpoint handles', (bimType) => {
    const ids = activeHandlesFor(bimType);
    expect(ids.has('endpoint-start')).toBe(true);
    expect(ids.has('endpoint-end')).toBe(true);
  });

  it.each(['column', 'slab', 'stair', 'mep-fixture'])(
    'non-linear element %s exposes NO endpoint handles',
    (bimType) => {
      const ids = activeHandlesFor(bimType);
      expect(ids.has('endpoint-start')).toBe(false);
      expect(ids.has('endpoint-end')).toBe(false);
    },
  );

  it('a multi-selection (editBimType null) exposes no endpoint handles — single-select only', () => {
    const ids = activeHandlesFor(null);
    expect(ids.has('endpoint-start')).toBe(false);
    expect(ids.has('endpoint-end')).toBe(false);
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

describe('BimGizmoOverlay — collapse to move handles during a drag (ADR-363 Φ1G.5 Slice 2h)', () => {
  it('hides the resize/shape handles while keeping the move arrows, then restores them', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);
    overlay.setActiveHandles(activeHandlesFor('wall')); // wall: resize-y + arrows + endpoint rings

    expect(findByName(scene, 'gizmo-resize-y')?.visible).toBe(true);

    overlay.collapseToMoveHandles();
    expect(findByName(scene, 'gizmo-resize-y')?.visible).toBe(false); // clutter hidden
    expect(findByName(scene, 'gizmo-arrow-x')?.visible).toBe(true); // move arrow stays

    overlay.restoreConfiguredHandles();
    expect(findByName(scene, 'gizmo-resize-y')?.visible).toBe(true); // back after release

    overlay.dispose();
  });

  // ADR-363 Φ1G.5 Slice 2i — the snap marker is no longer hidden during a collapsed move;
  // it is shown SMALL (Revit face-snap square) so the user SEES where the face landed.
  it('shows the snap-marker SMALL while collapsed (Slice 2i), full-size on restore', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.updateMatrixWorld(true);
    overlay.setActiveHandles(activeHandlesFor('wall'));
    const at = new THREE.Vector3(9, 0, 9);
    const snapCube = scene.children.find((o): o is THREE.LineSegments => o instanceof THREE.LineSegments)!;

    overlay.collapseToMoveHandles();
    overlay.showSnapMarker(at, camera); // a snap during the drag
    expect(snapCube.visible).toBe(true); // visible (small) — Slice 2i feedback
    const movedScale = snapCube.scale.x;

    overlay.restoreConfiguredHandles();
    overlay.showSnapMarker(at, camera);
    expect(snapCube.visible).toBe(true); // normal OSNAP marker once the drag ends
    const restoredScale = snapCube.scale.x;

    // The collapsed-move glyph is meaningfully smaller than the full-size OSNAP marker.
    expect(movedScale).toBeLessThan(restoredScale);

    overlay.dispose();
  });
});

describe('isPlanarMoveType — planar (collapsible) vs free-3D selection (ADR-363 Φ1G.5 Slice 2h)', () => {
  it.each(['wall', 'column', 'beam', 'slab', 'stair', 'furniture'])('%s is planar (collapsible)', (t) => {
    expect(isPlanarMoveType(t)).toBe(true);
  });
  it.each(['mep-segment', 'mep-fixture', 'mep-radiator', 'mep-boiler'])('%s is free-3D (NOT collapsible)', (t) => {
    expect(isPlanarMoveType(t)).toBe(false);
  });
  it('a multi-selection (null) is not collapsible', () => {
    expect(isPlanarMoveType(null)).toBe(false);
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
