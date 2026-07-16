/**
 * topo-scene-layer-support — shared lifecycle scaffold for the topographic 3D scene layers
 * (ADR-650, N.18 anti-clone). `TerrainSceneLayer` (surface mesh) and `TerrainContourLayer`
 * (draped contour lines) are structural siblings: both are `ThreeJsSceneManager`-owned scene
 * layers that seat a root a hair below internal z=0 and react to the SAME survey / visibility /
 * geo-reference stores with zero React state (ADR-040). This module owns everything that was
 * identical between them — the seating, the shared subscription set, and the whole
 * construct/rebuild/dispose lifecycle ({@link TopoSceneLayer}) — so there is ONE place to change
 * the drop margin, the subscriptions, or the ADR-665 clip re-assertion.
 *
 * @module bim-3d/scene/terrain/topo-scene-layer-support
 * @enterprise ADR-650 — Topography · ADR-665 — Terrain clip at active level · ADR-584 — Anti-Duplication
 */

import * as THREE from 'three';
import { subscribeTopo } from '../../../systems/topography/TopoPointStore';
import { getTerrain3DState, subscribeTerrain3D } from '../../../systems/topography/terrain-3d-store';
import { subscribeGeoReference } from '../../../systems/geo-referencing/geo-reference-store';
import { TERRAIN_DISPLAY_DROP_MM } from '../../../systems/topography/vertical-datum';

/** A store subscription: register `cb`, get back an unsubscribe. */
type LayerSubscribe = (cb: () => void) => () => void;

/**
 * Name a topo scene-layer root, sit it a hair BELOW internal z=0 (so the ground-floor plan/images
 * at z=0 win from above — «κάτοψη πάνω, έδαφος κάτω») and attach it to the scene. Constant
 * world-space drop of the whole layer (ADR-650 M10d).
 *
 * ADR-665 — also stamps the `'topo'` CLIP SCOPE marker, which the clip applicator inherits down
 * the whole subtree: everything under this root gets the terrain's level cut instead of the
 * building's planes. The marker lives on the ROOT (never on the leaves) so a layer rebuild — which
 * discards and recreates every mesh/line under it — can never lose it.
 *
 * Marker, not name-matching: names are cosmetic and a rename would silently break the routing.
 *
 * NOTE the drop needs no clip compensation — `clippingPlanes` are WORLD-space and this offset is
 * already baked into the child world matrices. A plane at world-Y = FFL cuts at world-Y = FFL.
 */
function seatTopoLayerRoot(root: THREE.Group, scene: THREE.Object3D, name: string): void {
  root.name = name;
  root.position.y = -TERRAIN_DISPLAY_DROP_MM / 1000;
  root.userData['topoClipScope'] = true;
  scene.add(root);
}

/**
 * Wire the subscriptions every topo scene-layer shares — survey edit (re-triangulation), 3D
 * visibility, and the geo-reference «κούμπωμα» that seats the hill under the building (ADR-650
 * M10b) — plus any layer-specific `extra` subscribers (cut-fill reference level / contour config),
 * inserted in their original position between visibility and geo-reference. Every subscription
 * fires the same `rebuild`. Returns the unsubscribe handles in subscription order.
 */
function subscribeTopoLayer(
  rebuild: () => void,
  extra: readonly LayerSubscribe[],
): (() => void)[] {
  return [
    subscribeTopo(rebuild),
    subscribeTerrain3D(rebuild),
    ...extra.map((subscribe) => subscribe(rebuild)),
    subscribeGeoReference(rebuild),
  ];
}

/**
 * The lifecycle every topo scene layer has: seat a root, subscribe, gate on visibility, rebuild on
 * every change, re-assert the clip planes after each rebuild, and tear the whole thing down on
 * `dispose()`. Subclasses supply only what genuinely differs — how to derive their content
 * ({@link rebuildGeometry}) and how to free it ({@link clearContent}).
 *
 * `TInputs` is the layer's geometry-input record: the values that force a re-derivation (surface,
 * datum, geo-reference, plus whatever else the layer reads). Opacity is deliberately NOT one of
 * them anywhere — see {@link sameInputs}.
 *
 * ADR-665 — `rebuild()` wraps `rebuildGeometry()` and re-asserts the clip planes
 * UNCONDITIONALLY. Wrapping instead of calling `onRebuilt` at each of the subclass's rebuild exits
 * is deliberate: freshly built meshes/lines start with `clippingPlanes = null` and the clip owner
 * (`SectionSceneController`) does not watch the survey store, so a forgotten exit path means the
 * layer silently loses its level cut on the next edit. No future return path can forget it here,
 * and the no-change cost is a ~3-node subtree walk.
 */
export abstract class TopoSceneLayer<TInputs extends object> {
  protected readonly root = new THREE.Group();
  private readonly unsubscribes: readonly (() => void)[];
  protected disposed = false;
  /** ADR-650 M10d — inputs the current content was built from; lets an opacity-only change skip rebuild. */
  protected lastInputs: TInputs | null = null;

  /**
   * @param name Scene-graph name for this layer's root (`'topo-terrain'`, `'topo-contours'`).
   * @param onRebuilt ADR-665 — «I rebuilt; re-assert the clip planes on my subtree».
   * @param extra Layer-specific subscriptions (cut-fill reference / contour config), on top of the
   *   shared survey + visibility + geo-reference set.
   */
  protected constructor(
    scene: THREE.Object3D,
    name: string,
    protected readonly markDirty: () => void,
    private readonly onRebuilt: (root: THREE.Object3D) => void,
    extra: readonly LayerSubscribe[],
  ) {
    seatTopoLayerRoot(this.root, scene, name);
    this.unsubscribes = subscribeTopoLayer(() => this.rebuild(), extra);
  }

  /**
   * Kick off the first build. Subclasses MUST call this as the LAST statement of their constructor,
   * never the base: a base-constructor build would run before the subclass's field initializers,
   * which would then overwrite the state that build just produced.
   */
  protected start(): void {
    this.rebuild();
  }

  /**
   * Contours belong to the surface — shown with it, hidden with it (Revit Toposurface parity) — so
   * the visibility gate lives here, once, for every topo layer. Cheap when hidden: an invisible
   * layer costs nothing on every survey edit.
   */
  private rebuild(): void {
    if (this.disposed) return;
    if (getTerrain3DState().visible) {
      this.rebuildGeometry();
    } else {
      this.clearContent();
      this.lastInputs = null;
      this.markDirty();
    }
    this.onRebuilt(this.root);
  }

  /**
   * True when every geometry input is identity-equal to the last build. Compares every key of
   * `TInputs` rather than a hand-written list: adding an input to the record automatically makes it
   * invalidating, so a new input can never be silently left out of the comparison and serve stale
   * geometry. Opacity is not part of `TInputs` and so is never compared — an opacity-only change
   * mutates the shared material instead of re-deriving.
   */
  protected sameInputs(next: TInputs): boolean {
    const previous = this.lastInputs;
    if (!previous) return false;
    return (Object.keys(next) as (keyof TInputs)[]).every((key) => previous[key] === next[key]);
  }

  /**
   * Derive this layer's content from the current stores. Called on construct and on every change,
   * but ONLY when the terrain is visible — the base owns that gate.
   */
  protected abstract rebuildGeometry(): void;

  /** Remove + free the current content. Geometry only — materials are catalog singletons. */
  protected abstract clearContent(): void;

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.clearContent();
    this.root.removeFromParent();
  }
}
