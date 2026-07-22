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
import type { GizmoHandleId } from '../gizmo-types';
// ADR-537 — the base-point ⊙ & snap markers keep `root.visible = false` (main render skips them);
// their real shown-state lives in the post-FX overlay roots, so assert via `collectPostFxOverlayRoots`.
import { collectPostFxOverlayRoots } from '../../scene/post-fx-overlay-pass';

function findByName(scene: THREE.Scene, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  scene.traverse((obj) => {
    if (!found && obj.name === name) found = obj;
  });
  return found;
}

describe('BimGizmoOverlay — active-handle visibility', () => {
  // Shared-visual regression lock (`resize-x`/`resize-m-x` map to ONE octahedron): the visual
  // must stay visible when only `resize-x` is active. ADR-402 §gizmo-cleanup (2026-07-22)
  // removed resize handles from EVERY type (incl. stair) so this drives the overlay's
  // visibility mechanism DIRECTLY with an explicit id set — decoupled from the per-type table.
  it('keeps a shared resize octahedron visible when only one of its ids is active', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(new Set<GizmoHandleId>(['resize-x', 'axis-x']));

    expect(findByName(scene, 'gizmo-resize-x')?.visible).toBe(true); // shared visual stays on
    expect(findByName(scene, 'gizmo-resize-z')?.visible).toBe(false); // unrelated stays hidden
    // Base move handle stays visible too.
    expect(findByName(scene, 'gizmo-arrow-x')?.visible).toBe(true);

    overlay.dispose();
  });

  // ADR-402 §gizmo-cleanup (Giorgio 2026-06-29) — a column shows NO resize octahedra at all: the
  // vertical height «διαμαντάκια» were removed (height → tab, section → Type).
  it('HIDES every resize octahedron for a column selection (ADR-402 §gizmo-cleanup)', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    overlay.setActiveHandles(activeHandlesFor('column'));

    expect(findByName(scene, 'gizmo-resize-y')?.visible).toBe(false);
    expect(findByName(scene, 'gizmo-resize-m-y')?.visible).toBe(false);
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

  it('exposes a resize hitbox only when its id is explicitly active (hittable)', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    // Drive the mechanism directly: after ADR-402 §gizmo-cleanup no BIM type activates resize,
    // so `activeHandlesFor('stair')` would expose none — assert the hitbox gate itself instead.
    overlay.setActiveHandles(new Set<GizmoHandleId>(['resize-x', 'axis-x']));
    const ids = new Set(
      overlay.hitTestView.hitboxes.map((hb) => overlay.hitTestView.hitboxToId.get(hb)),
    );

    expect(ids.has('resize-x')).toBe(true);
    expect(ids.has('resize-z')).toBe(false);

    overlay.dispose();
  });
});

describe('BimGizmoOverlay — relocatable base-point marker (ADR-408)', () => {
  it('shows the ⊙ marker at a world point and hides it on null', () => {
    const scene = new THREE.Scene();
    const overlay = new BimGizmoOverlay(scene);

    // Hidden by default (no override). ADR-537 — `root.visible` stays false; the shown-state
    // lives in the post-FX overlay roots.
    expect(collectPostFxOverlayRoots(scene)).not.toContain(findByName(scene, 'gizmo-base-point-marker'));

    overlay.setBasePointMarker(new THREE.Vector3(1, 2, 3));
    const marker = findByName(scene, 'gizmo-base-point-marker');
    expect(collectPostFxOverlayRoots(scene)).toContain(marker);
    expect(marker?.position.toArray()).toEqual([1, 2, 3]);

    overlay.setBasePointMarker(null);
    expect(collectPostFxOverlayRoots(scene)).not.toContain(findByName(scene, 'gizmo-base-point-marker'));

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
    expect(collectPostFxOverlayRoots(scene)).toContain(marker); // ADR-537 — shown via post-FX pass
    expect(Number.isFinite(marker?.scale.x ?? NaN)).toBe(true);
    expect((marker?.scale.x ?? 0)).toBeGreaterThan(0);

    overlay.dispose();
  });
});

describe('activeHandlesFor — per-type resize handles (ADR-408 Φ1 / ADR-402 §gizmo-cleanup, Revit-faithful)', () => {
  // ADR-402 §gizmo-cleanup (Giorgio 2026-06-29): column + wall expose NO resize handles. The vertical
  // height octahedra («κίτρινα διαμαντάκια» στη θέση του κάθετου άξονα) were removed —
  // height/base → contextual tab, section (X/Z) → Type. Only stair keeps resize handles.
  it.each(['column', 'wall'])(
    'exposes NO resize handles for %s — height is tab, section is Type (ADR-402 §gizmo-cleanup)',
    (bimType) => {
      const ids = activeHandlesFor(bimType);
      expect(ids.has('resize-y')).toBe(false);
      expect(ids.has('resize-m-y')).toBe(false);
      expect(ids.has('resize-x')).toBe(false);
      expect(ids.has('resize-z')).toBe(false);
    },
  );

  it('beam exposes NO resize handles — length + width are 2D reshape grips (ADR-535 Φ9), section + elevation are Type/move', () => {
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

  it('stair exposes NO resize handles — all sizes edit via the «Ιδιότητες Κλίμακας» panel (ADR-402 §gizmo-cleanup 2026-07-22)', () => {
    const ids = activeHandlesFor('stair');
    expect(ids.has('resize-x')).toBe(false);
    expect(ids.has('resize-z')).toBe(false);
    expect(ids.has('resize-y')).toBe(false);
    expect(ids.has('resize-m-y')).toBe(false);
  });

  it('a base-only / unknown selection exposes no resize handles', () => {
    const ids = activeHandlesFor(null);
    expect(ids.has('resize-x')).toBe(false);
    expect(ids.has('resize-z')).toBe(false);
    expect(ids.has('resize-y')).toBe(false);
  });
});

describe('activeHandlesFor — endpoint LENGTH shape handles (ADR-408 Φ-D/Φ1, Revit)', () => {
  // Only the free-3D pipe (`mep-segment`) still exposes draggable endpoint shape handles.
  // ADR-535 Φ9 REMOVED `beam` + Φ8 follow-up REMOVED `wall`: their length/ends are now the
  // 2D Canvas2D reshape grips (mirror slab), so the cyan endpoint rings would be a
  // duplicate/conflicting length handle. Point/area elements never had them.
  it.each(['mep-segment'])('linear element %s exposes both endpoint handles', (bimType) => {
    const ids = activeHandlesFor(bimType);
    expect(ids.has('endpoint-start')).toBe(true);
    expect(ids.has('endpoint-end')).toBe(true);
  });

  it.each(['column', 'slab', 'stair', 'mep-fixture', 'beam', 'wall'])(
    '%s exposes NO endpoint handles (beam/wall → 2D reshape grips, ADR-535 Φ9/Φ8)',
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
    // ADR-402 §gizmo-cleanup (2026-07-22) — NO BIM type exposes resize handles now, so drive
    // the collapse mechanism with an explicit id set that includes a resize handle + the move
    // arrows (exercises the clutter-hide path independent of the per-type table).
    overlay.setActiveHandles(new Set<GizmoHandleId>(['resize-y', 'axis-x', 'axis-z', 'plane-xz', 'rotate-y']));

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
    expect(collectPostFxOverlayRoots(scene)).toContain(snapCube); // ADR-537 — shown via post-FX (root.visible stays false)
    const movedScale = snapCube.scale.x;

    overlay.restoreConfiguredHandles();
    overlay.showSnapMarker(at, camera);
    expect(collectPostFxOverlayRoots(scene)).toContain(snapCube); // ADR-537 — normal OSNAP marker once the drag ends (shown via post-FX)
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
