/**
 * TerrainSceneLayer — the topographic surface in the 3D viewport (ADR-650 M4).
 *
 * A standalone scene layer, NOT a BIM entity — the same citizenship the DXF wireframe underlay
 * and the C4D ground grid have. It renders the ONE derived surface (`getTopoSurface()`), so the
 * hill you orbit in 3D and the contours drawn in plan are two views of the same triangulation;
 * there is no second TIN anywhere in the app.
 *
 * Why a layer and not an element (Revit Toposolid / Civil 3D Surface object): in those products
 * the surface IS an element because its DEFINITION (the points, the breaklines) lives on the
 * element. Here the definition lives in `TopoPointStore` and the entity would carry no data of
 * its own — an entity wrapping a store is a second source of truth, not a BIM citizen. Promoting
 * it properly means re-homing the survey definition onto the element (ADR-650 §12.2 M4b); the
 * converter (`tinToBufferGeometry`) is already pure, so that promotion needs no geometry rewrite.
 *
 * Owner pattern: `ThreeJsSceneManager` constructs it once and calls `dispose()` on teardown
 * (same as `BimSceneLayer` / `Cinema4DGridFloor`). Reacts imperatively to the survey store and
 * the display store — zero React state (ADR-040).
 *
 * @module bim-3d/scene/terrain/TerrainSceneLayer
 */

import * as THREE from 'three';
import { subscribeTopo } from '../../../systems/topography/TopoPointStore';
import { getTopoSurface } from '../../../systems/topography/topo-surface';
import { getTerrain3DState, subscribeTerrain3D } from '../../../systems/topography/terrain-3d-store';
import { resolveCutFillReference, subscribeCutFill } from '../../../systems/topography/cut-fill-store';
import {
  getActiveWorldToDisplayProjector,
  subscribeGeoReference,
} from '../../../systems/geo-referencing/geo-reference-store';
import { tinToBufferGeometry } from '../../converters/tin-to-three';
import { getTerrainMaterial3D } from '../../materials/MaterialCatalog3D';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store'; // 🔎 TEMP DIAG (M10b) — REMOVE after live fix
import { disposeObjectTree } from '../dispose-object-tree';

export class TerrainSceneLayer {
  private readonly root = new THREE.Group();
  private readonly unsubscribes: readonly (() => void)[];
  private mesh: THREE.Mesh | null = null;
  private disposed = false;

  constructor(
    scene: THREE.Object3D,
    private readonly markDirty: () => void,
  ) {
    this.root.name = 'topo-terrain';
    scene.add(this.root);
    this.unsubscribes = [
      subscribeTopo(() => this.rebuild()), // survey edited → surface rebuilt (Civil 3D «Rebuild Surface»)
      subscribeTerrain3D(() => this.rebuild()), // shown/hidden or re-styled
      // ADR-650 M6: the design level / reference IS what the `cutfill` style paints. Move it and
      // the hill must re-colour, or the user reads last question's answer on this question's ground.
      subscribeCutFill(() => this.rebuild()),
      // ADR-650 M10b: the geo-reference is what seats the hill UNDER the building. When the user
      // «κουμπώνει» (aligns) live, the terrain must re-project with the plan — otherwise 3D lags
      // the 2D contours until the next survey edit. Mirror of `useTopoPersistence`'s 2D subscription.
      subscribeGeoReference(() => this.rebuild()),
    ];
    this.rebuild();
  }

  /**
   * Drop the old mesh and rebuild from the current surface + display state.
   *
   * Rebuild-all (like `BimSceneLayer.sync`), not incremental: the CDT re-triangulates globally
   * when a single point moves, so there is no stable per-triangle identity to diff against.
   * Cheap when hidden — the early return means an invisible terrain costs nothing on every
   * survey edit, and `getTopoSurface()` is memoised so re-styling never re-triangulates.
   */
  private rebuild(): void {
    if (this.disposed) return;
    this.clearMesh();

    const { visible, style } = getTerrain3DState();
    const surface = getTopoSurface();
    const projector = getActiveWorldToDisplayProjector();
    // 🔎 TEMP DIAG (2026-07-15 M10b). REMOVE after live fix. Decides: hidden? no triangles? geo-ref
    // applied? WHERE the mesh lands? AND — faceMode 'none'/'hidden-line' → withFaceMode() swaps the
    // terrain material for an INVISIBLE one (the DXF underlay does not, so it stays visible → the
    // mesh silently vanishes while the plan still shows).
    // eslint-disable-next-line no-console
    console.info('[TERRAIN-3D-DIAG]', {
      visible, style, tris: surface.triangles.length,
      geoRefIdentity: projector.isIdentity,
      faceMode: useBimRenderSettingsStore.getState().faceMode,
    });
    if (!visible) {
      this.markDirty();
      return;
    }

    // The reference is resolved ONCE, here, from the same SSoT the volume table reads — so the
    // colours on the hill and the numbers in the table always answer the same question.
    const reference = style === 'cutfill' ? resolveCutFillReference() : null;
    // Seat the ΕΓΣΑ world surface under the building via the active geo-reference (M10b). Resolved
    // here, in the impure layer, and passed into the pure converter — same pattern as `reference`.
    const geometry = tinToBufferGeometry(surface, style, { reference, projector });
    if (!geometry) {
      // 🔎 TEMP DIAG (2026-07-15 M10b). REMOVE after live fix.
      // eslint-disable-next-line no-console
      console.info('[TERRAIN-3D-DIAG] NO-GEOMETRY (empty/degenerate surface)');
      this.markDirty(); // nothing to draw (no surface yet, or a degenerate one) — not an error
      return;
    }

    const mesh = new THREE.Mesh(geometry, getTerrainMaterial3D(style));
    mesh.name = 'topo-terrain-mesh';
    mesh.castShadow = true;
    mesh.receiveShadow = true; // the building must cast onto the ground, or it reads as floating
    this.root.add(mesh);
    this.mesh = mesh;

    // 🔎 TEMP DIAG (2026-07-15 M10b). REMOVE after live fix. The mesh's three-world placement.
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (box) {
      const cx = (box.min.x + box.max.x) / 2;
      const cy = (box.min.y + box.max.y) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      // eslint-disable-next-line no-console
      console.info('[TERRAIN-3D-DIAG] mesh three-world', {
        centerM: { x: cx, y: cy, z: cz },
        sizeM: { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z },
      });
    }
    this.markDirty();
  }

  /** Remove + free the current mesh. Geometry only — the material is a catalog singleton. */
  private clearMesh(): void {
    if (!this.mesh) return;
    this.root.remove(this.mesh);
    disposeObjectTree(this.mesh);
    this.mesh = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.clearMesh();
    this.root.removeFromParent();
  }
}
