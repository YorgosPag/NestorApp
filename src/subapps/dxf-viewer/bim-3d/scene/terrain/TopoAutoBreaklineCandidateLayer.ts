/**
 * TopoAutoBreaklineCandidateLayer — the PROPOSED breaklines in the 3D viewport (ADR-650 M8β/Γ).
 *
 * The third {@link TopoSceneLayer}, after the surface mesh and the draped contours, and the one
 * that makes «Αυτόματες ασυνέχειες» a review the engineer can actually perform. M8β/Γ shipped the
 * proposals as a 2D SVG preview only; but the question a candidate asks — «is this fold a real
 * ridge, or triangulation noise?» — is a question about RELIEF, and relief is what plan view is
 * worst at. Orbiting the site made the proposals disappear, so the panel's list went back to being
 * numbers exactly when the engineer was best placed to judge them (§9, human-certifier).
 *
 * ### What it draws
 * Two thin line sets from {@link autoBreaklineCandidatesToGeometries} — approved (green), rejected
 * (grey) — and then the FOCUSED one, the row last clicked in the panel, as a three-pass selection:
 * a translucent CASING in the selection colour, a solid CORE in the candidate's own approval
 * colour, and CORNER MARKERS on top, all drawn last and through the hill. Same vocabulary as the 2D
 * preview, from the same `UI_COLORS` + `auto-breakline-review-style` SSoTs, so the two views
 * describe the review identically — including its thickness (ADR-650 M8β/Γ v2; before that the 3D
 * focus was a 1 px line that WebGL cannot widen, so the emphasis fell entirely on its dots and read
 * as «a row of dots» rather than «this line»).
 *
 * ### Why it hides with the terrain
 * The base gates every topo layer on `getTerrain3DState().visible`, and that is right here rather
 * than merely inherited: a candidate line hanging in empty space cannot be judged at all. It is the
 * ground underneath that makes it a ridge or noise — the same reason the contours belong to the
 * surface (Revit Toposurface parity).
 *
 * Owner pattern + reactivity: identical to its two siblings — `ThreeJsSceneManager` constructs it
 * once and calls `dispose()` on teardown; it reacts imperatively to the survey, display,
 * geo-reference and auto-breakline REVIEW stores with zero React state (ADR-040). The review store
 * is written only on discrete clicks (run · tick · click a row · clear), never per frame.
 *
 * @module bim-3d/scene/terrain/TopoAutoBreaklineCandidateLayer
 */

import * as THREE from 'three';
import {
  autoBreaklineStore,
  subscribeAutoBreakline,
} from '../../../systems/topography/auto-breaklines/auto-breakline-store';
import type { AutoBreaklineReport } from '../../../systems/topography/auto-breaklines/auto-breakline-types';
import {
  getActiveWorldToDisplayProjector,
  getGeoReference,
} from '../../../systems/geo-referencing/geo-reference-store';
import { getActiveVerticalDatumMm } from '../../../systems/topography/vertical-datum';
import type { GeoReference } from '../../../systems/geo-referencing/geo-transform';
import { TopoSceneLayer } from './topo-scene-layer-support';
import {
  autoBreaklineCandidatesToGeometries,
  type AutoBreaklineCandidateGeometries,
} from '../../converters/auto-breakline-to-three';
import {
  getAutoBreaklineFocusCoreMaterial3D,
  getAutoBreaklineFocusHaloMaterial3D,
  getAutoBreaklineMaterial3D,
  getAutoBreaklinePointsMaterial3D,
  type AutoBreaklineLineKind,
} from '../../materials/auto-breakline-materials-3d';
import { createFatLineMesh } from '../../lines/scene-fat-line';
import { disposeObjectTree } from '../dispose-object-tree';

/** Everything that changes what this layer draws. Compared by identity — see `sameInputs`. */
interface CandidateGeoInputs {
  readonly report: AutoBreaklineReport | null;
  readonly selected: ReadonlySet<string>;
  readonly focusedId: string | null;
  readonly datumMm: number;
  readonly geoRef: GeoReference | null;
}

/**
 * Draw order for the depth-test-free focused set. Without it the focused line would be composited
 * against whatever happened to render after it; with it, the one thing the engineer asked to see
 * is unconditionally last.
 *
 * The three values are the selection sentence in order: the casing lies under the core (a casing
 * drawn on top would erase the very line it exists to make legible), and the corner markers sit
 * over both. Same painter's order as the 2D preview's `<g>`, for the same reason.
 */
const FOCUS_RENDER_ORDER = { halo: 1, core: 2, corners: 3 } as const;

export class TopoAutoBreaklineCandidateLayer extends TopoSceneLayer<CandidateGeoInputs> {
  constructor(
    scene: THREE.Object3D,
    markDirty: () => void,
    onRebuilt: (root: THREE.Object3D) => void = () => {},
  ) {
    // Drops with the terrain mesh + contours by the SAME margin (the base seats the root), and adds
    // the review store to the shared subscriptions: ticking a row or clicking one must repaint.
    super(scene, 'topo-auto-breaklines', markDirty, onRebuilt, [subscribeAutoBreakline]);
    this.start();
  }

  /**
   * Rebuild every line set from the current review + display state.
   *
   * Rebuild-all, like both siblings: the CDT re-triangulates globally when a point moves, so a
   * candidate has no stable identity to diff against between passes. `sameInputs` still earns its
   * keep — the shared subscription set fires on EVERY survey edit, and an edit that leaves the
   * review untouched must not re-project every candidate.
   */
  protected rebuildGeometry(): void {
    const { report, selected, focusedId } = autoBreaklineStore.get();
    const inputs: CandidateGeoInputs = {
      report,
      selected,
      focusedId,
      datumMm: getActiveVerticalDatumMm(),
      geoRef: getGeoReference(),
    };
    if (this.root.children.length > 0 && this.sameInputs(inputs)) return;

    this.clearContent();
    if (!report || report.candidates.length === 0) {
      this.lastInputs = null; // nothing under review — not an error, just an empty layer
      this.markDirty();
      return;
    }

    // Seat under the building (projector, M10b) and drop onto it (datum, M10c) — resolved here in
    // the impure layer and passed into the pure converter, exactly as the two siblings do.
    const geometries = autoBreaklineCandidatesToGeometries(
      report.candidates, selected, focusedId,
      { projector: getActiveWorldToDisplayProjector(), datumMm: inputs.datumMm },
    );

    // Rejected first, approved over it, focused last: painter's order backs up the depth-test-free
    // focused material, so «which one did my click take me to» is never ambiguous.
    this.addLines(geometries.rejected, 'rejected');
    this.addLines(geometries.approved, 'approved');
    this.addFocus(geometries, focusedId !== null && selected.has(focusedId));

    this.lastInputs = inputs;
    this.markDirty();
  }

  /** Add one thin LineSegments set with its shared (catalog singleton) approval material. */
  private addLines(geometry: THREE.BufferGeometry | null, kind: AutoBreaklineLineKind): void {
    if (!geometry) return;
    const lines = new THREE.LineSegments(geometry, getAutoBreaklineMaterial3D(kind));
    lines.name = `topo-auto-breaklines-${kind}`;
    this.root.add(lines);
  }

  /**
   * Add the focused candidate: selection casing, approval-coloured core, corner markers.
   *
   * `approved` is read from the review store rather than baked into the geometry because focus and
   * approval are INDEPENDENT signals — the same focused chain is drawn green or grey depending on
   * its checkbox, exactly as in the 2D preview, and a click to look at a candidate must never
   * disguise what will be written.
   */
  private addFocus(geometries: AutoBreaklineCandidateGeometries, approved: boolean): void {
    const { focused, focusedVertices } = geometries;
    if (focused) {
      this.addFatPass(focused, getAutoBreaklineFocusHaloMaterial3D(), FOCUS_RENDER_ORDER.halo, 'halo');
      this.addFatPass(
        focused,
        getAutoBreaklineFocusCoreMaterial3D(approved ? 'approved' : 'rejected'),
        FOCUS_RENDER_ORDER.core,
        'core',
      );
    }
    if (focusedVertices) this.addCornerMarkers(focusedVertices);
  }

  /**
   * One fat-line pass over the focused positions. Each pass gets its OWN `LineSegmentsGeometry`
   * (two uploads of one candidate's segments): sharing it between casing and core would leave two
   * meshes owning one buffer, and `clearContent`'s geometry walk would free it twice.
   */
  private addFatPass(
    positions: Float32Array,
    material: Parameters<typeof createFatLineMesh>[1],
    renderOrder: number,
    name: string,
  ): void {
    const mesh = createFatLineMesh(positions, material);
    mesh.name = `topo-auto-breaklines-focus-${name}`;
    mesh.renderOrder = renderOrder;
    this.root.add(mesh);
  }

  /** Add the focused candidate's corner markers (ends + real turns — see `polyline-corner-vertices`). */
  private addCornerMarkers(positions: Float32Array): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    const points = new THREE.Points(geometry, getAutoBreaklinePointsMaterial3D());
    points.name = 'topo-auto-breaklines-focus-corners';
    points.renderOrder = FOCUS_RENDER_ORDER.corners;
    this.root.add(points);
  }

  /** Remove + free the current line geometries. Geometry only — materials are catalog singletons. */
  protected clearContent(): void {
    disposeObjectTree(this.root); // geometry-only (materials shared) — walks every child set
    this.root.clear();
  }
}
