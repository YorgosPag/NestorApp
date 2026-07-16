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
 * the display store — zero React state (ADR-040). The seating, subscriptions, rebuild/clip-
 * re-assertion and teardown all live in {@link TopoSceneLayer}, shared with `TerrainContourLayer`;
 * this class owns only the TIN → mesh derivation.
 *
 * @module bim-3d/scene/terrain/TerrainSceneLayer
 */

import * as THREE from 'three';
import { getTopoSurface } from '../../../systems/topography/topo-surface';
import { getTerrain3DState } from '../../../systems/topography/terrain-3d-store';
import { resolveCutFillReference, subscribeCutFill } from '../../../systems/topography/cut-fill-store';
import {
  getActiveWorldToDisplayProjector,
  getGeoReference,
} from '../../../systems/geo-referencing/geo-reference-store';
import { getActiveVerticalDatumMm } from '../../../systems/topography/vertical-datum';
import { TopoSceneLayer } from './topo-scene-layer-support';
import type { TinSurface, TerrainSurfaceStyle } from '../../../systems/topography/topo-types';
import type { GeoReference } from '../../../systems/geo-referencing/geo-transform';
import type { ElevationReference } from '../../../systems/topography/cut-fill';
import { tinToBufferGeometry } from '../../converters/tin-to-three';
import { getTerrainMaterial3D } from '../../materials/terrain-materials-3d';
import { disposeObjectTree } from '../dispose-object-tree';

/** ADR-650 M10d — geometry inputs that force a re-triangulation (opacity is NOT one of them). */
interface TerrainGeoInputs {
  readonly surface: TinSurface;
  readonly style: TerrainSurfaceStyle;
  readonly datumMm: number;
  readonly reference: ElevationReference | null;
  readonly geoRef: GeoReference | null;
}

export class TerrainSceneLayer extends TopoSceneLayer<TerrainGeoInputs> {
  private mesh: THREE.Mesh | null = null;

  constructor(
    scene: THREE.Object3D,
    markDirty: () => void,
    onRebuilt: (root: THREE.Object3D) => void = () => {},
  ) {
    // Seats a hair below z=0 (ADR-650 M10d) + wires the shared subscriptions, plus the cut-fill
    // reference level: ADR-650 M6 — moving the design level must re-colour the hill (cutfill).
    super(scene, 'topo-terrain', markDirty, onRebuilt, [subscribeCutFill]);
    this.start();
  }

  /**
   * Drop the old mesh and rebuild from the current surface + display state.
   *
   * Rebuild-all (like `BimSceneLayer.sync`), not incremental: the CDT re-triangulates globally
   * when a single point moves, so there is no stable per-triangle identity to diff against.
   * `getTopoSurface()` is memoised, so re-styling never re-triangulates.
   */
  protected rebuildGeometry(): void {
    const state = getTerrain3DState();
    const { style } = state;
    const opacity = state.surfaceOpacity[style] ?? 1;
    // The reference is resolved ONCE, here, from the same SSoT the volume table reads — so the
    // colours on the hill and the numbers in the table always answer the same question.
    const inputs: TerrainGeoInputs = {
      surface: getTopoSurface(),
      style,
      datumMm: getActiveVerticalDatumMm(),
      reference: style === 'cutfill' ? resolveCutFillReference() : null,
      geoRef: getGeoReference(),
    };

    // ADR-650 M10d — an opacity-only change (the common slider drag) leaves every geometry input
    // untouched → re-apply the (mutated) material to the SAME mesh, no re-triangulation.
    if (this.mesh && this.sameInputs(inputs)) {
      this.mesh.material = getTerrainMaterial3D(style, opacity);
      this.markDirty();
      return;
    }

    this.clearContent();
    // Seat the ΕΓΣΑ world surface under the building via the active geo-reference (M10b), and drop it
    // vertically onto the building via the project datum (M10c). Both resolved here, in the impure
    // layer, and passed into the pure converter — same pattern as `reference`.
    const projector = getActiveWorldToDisplayProjector();
    const geometry = tinToBufferGeometry(inputs.surface, style, {
      reference: inputs.reference, projector, datumMm: inputs.datumMm,
    });
    if (!geometry) {
      this.lastInputs = null;
      this.markDirty(); // nothing to draw (no surface yet, or a degenerate one) — not an error
      return;
    }

    // ADR-650 M10c — `shaded` is a lit earth surface (casts + receives shadow for hillshade form);
    // the analysis styles are an UNLIT data overlay (getTerrainMaterial3D → MeshBasicMaterial), so
    // shadow participation is meaningless for them and would only re-introduce the darkening that
    // made the lit variant vanish. Display-only, like a Civil 3D / Revit analysis style.
    const lit = style === 'shaded';
    const mesh = new THREE.Mesh(geometry, getTerrainMaterial3D(style, opacity));
    mesh.name = 'topo-terrain-mesh';
    mesh.castShadow = lit;
    mesh.receiveShadow = lit; // the building must cast onto the earth ground, or it reads as floating
    this.root.add(mesh);
    this.mesh = mesh;
    this.lastInputs = inputs;
    this.markDirty();
  }

  /** Remove + free the current mesh. Geometry only — the material is a catalog singleton. */
  protected clearContent(): void {
    if (!this.mesh) return;
    this.root.remove(this.mesh);
    disposeObjectTree(this.mesh);
    this.mesh = null;
  }
}
