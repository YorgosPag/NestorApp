/**
 * TerrainContourLayer — the topographic CONTOUR lines in the 3D viewport (ADR-650 M10d).
 *
 * The line sibling of {@link TerrainSceneLayer}: that layer renders the surface as a solid mesh,
 * this one renders the SAME derived surface's contours as draped lines. Both read the ONE memoised
 * `getTopoSurface()` and seat by the SAME geo-reference projector + vertical datum, so the hill,
 * its contours in 3D, and its contours in 2D plan are three views of one triangulation — they can
 * never silently disagree.
 *
 * Why a dedicated layer and not the per-floor DXF overlay (the bug this fixes): the contours are
 * plain `lwpolyline` CAD entities of the survey drawing. The 3D DXF overlay stamps every floor's
 * plan flat at that floor's elevation, so the SAME contours were re-drawn at every storey and
 * stacked into a ladder. A contour is a survey product at a FIXED ground elevation, not a
 * floor-scoped annotation — so, exactly like Civil 3D / Revit, it belongs to the surface and
 * renders ONCE at its real (datum-shifted) elevation, regardless of the active floor scope.
 *
 * Owner pattern + reactivity: identical to `TerrainSceneLayer` — literally so, since both extend
 * {@link TopoSceneLayer}, which owns the seating, the subscriptions, the rebuild/clip-re-assertion
 * and the teardown. `ThreeJsSceneManager` constructs this once and calls `dispose()` on teardown;
 * it reacts imperatively to the survey, display, contour-config and geo-reference stores with zero
 * React state (ADR-040). This class owns only the contour derivation.
 *
 * @module bim-3d/scene/terrain/TerrainContourLayer
 */

import * as THREE from 'three';
import { getTopoSurface } from '../../../systems/topography/topo-surface';
import { getTerrain3DState } from '../../../systems/topography/terrain-3d-store';
import { getContourConfig, subscribeContourConfig } from '../../../systems/topography/contour-config-store';
import type { ContourConfig } from '../../../systems/topography/contour-config';
import { generateContoursFromSurface } from '../../../systems/topography/contour-generator';
import {
  getActiveWorldToDisplayProjector,
  getGeoReference,
} from '../../../systems/geo-referencing/geo-reference-store';
import { getActiveVerticalDatumMm } from '../../../systems/topography/vertical-datum';
import { TopoSceneLayer } from './topo-scene-layer-support';
import type { TinSurface } from '../../../systems/topography/topo-types';
import type { GeoReference } from '../../../systems/geo-referencing/geo-transform';
import { contourLinesToGeometries } from '../../converters/contour-to-three';
import { getTopoContourMaterial3D } from '../../materials/terrain-materials-3d';
import { disposeObjectTree } from '../dispose-object-tree';

/** ADR-650 M10d — geometry inputs that force a re-derivation (opacity is NOT one of them). */
interface ContourGeoInputs {
  readonly surface: TinSurface;
  readonly config: ContourConfig;
  readonly datumMm: number;
  readonly geoRef: GeoReference | null;
}

export class TerrainContourLayer extends TopoSceneLayer<ContourGeoInputs> {
  constructor(
    scene: THREE.Object3D,
    markDirty: () => void,
    onRebuilt: (root: THREE.Object3D) => void = () => {},
  ) {
    // Drops with the terrain mesh by the SAME margin (ADR-650 M10d) so the contours stay ON the
    // surface, and adds the contour interval/index config to the shared subscriptions: a different
    // interval derives different levels → rebuild.
    super(scene, 'topo-contours', markDirty, onRebuilt, [subscribeContourConfig]);
    this.start();
  }

  /**
   * Drop the old lines and rebuild from the current surface + display state. Rebuild-all (like
   * `TerrainSceneLayer`): the CDT re-triangulates globally when a point moves, so contours have no
   * stable per-line identity to diff. `getTopoSurface()` is memoised.
   */
  protected rebuildGeometry(): void {
    const opacity = getTerrain3DState().contourOpacity;
    const inputs: ContourGeoInputs = {
      surface: getTopoSurface(),
      config: getContourConfig(),
      datumMm: getActiveVerticalDatumMm(),
      geoRef: getGeoReference(),
    };

    // ADR-650 M10d — an opacity-only change leaves every geometry input untouched → mutate the two
    // (shared) contour materials the existing lines already reference; NO re-run of marching triangles.
    if (this.root.children.length > 0 && this.sameInputs(inputs)) {
      getTopoContourMaterial3D(true, opacity);
      getTopoContourMaterial3D(false, opacity);
      this.markDirty();
      return;
    }

    this.clearContent();
    // The SAME derivation the 2D plan uses (`useTopoContours`) over the SAME memoised TIN — no
    // second contour algorithm, no second triangulation.
    const { contours } = generateContoursFromSurface(inputs.surface, inputs.config);
    if (contours.length === 0) {
      this.lastInputs = null;
      this.markDirty();
      return;
    }

    // Seat under the building (projector, M10b) and drop onto it (datum, M10c) — resolved here in
    // the impure layer and passed into the pure converter, exactly as `TerrainSceneLayer` does.
    const projector = getActiveWorldToDisplayProjector();
    const { major, minor } = contourLinesToGeometries(contours, { projector, datumMm: inputs.datumMm });

    if (minor) this.addLines(minor, false, opacity); // draw minors first so the heavier majors read on top
    if (major) this.addLines(major, true, opacity);
    this.lastInputs = inputs;
    this.markDirty();
  }

  /** Add one LineSegments set with its shared (catalog singleton) major/minor material. */
  private addLines(geometry: THREE.BufferGeometry, isMajor: boolean, opacity: number): void {
    const lines = new THREE.LineSegments(geometry, getTopoContourMaterial3D(isMajor, opacity));
    lines.name = isMajor ? 'topo-contours-major' : 'topo-contours-minor';
    this.root.add(lines);
  }

  /** Remove + free the current line geometries. Geometry only — materials are catalog singletons. */
  protected clearContent(): void {
    disposeObjectTree(this.root); // geometry-only (materials shared) — walks every child LineSegments
    this.root.clear();
  }
}
