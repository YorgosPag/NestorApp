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
 * Three line sets, from {@link autoBreaklineCandidatesToGeometries}: approved (green), rejected
 * (grey), and the FOCUSED one — the row last clicked in the panel — in the app's selection colour,
 * drawn last, through the hill, with vertex dots. Same vocabulary as the 2D preview, from the same
 * `UI_COLORS` SSoT, so the two views describe the review identically.
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
import { autoBreaklineCandidatesToGeometries } from '../../converters/auto-breakline-to-three';
import {
  getAutoBreaklineMaterial3D,
  getAutoBreaklinePointsMaterial3D,
  type AutoBreaklineLineKind,
} from '../../materials/terrain-materials-3d';
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
 */
const FOCUS_RENDER_ORDER = { line: 1, points: 2 } as const;

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
    this.addLines(geometries.focused, 'focused');
    this.addFocusVertices(geometries.focusedVertices);

    this.lastInputs = inputs;
    this.markDirty();
  }

  /** Add one LineSegments set with its shared (catalog singleton) review material. */
  private addLines(geometry: THREE.BufferGeometry | null, kind: AutoBreaklineLineKind): void {
    if (!geometry) return;
    const lines = new THREE.LineSegments(geometry, getAutoBreaklineMaterial3D(kind));
    lines.name = `topo-auto-breaklines-${kind}`;
    if (kind === 'focused') lines.renderOrder = FOCUS_RENDER_ORDER.line;
    this.root.add(lines);
  }

  /** Add the focused candidate's vertex dots — the 3D «bigger» (see the converter's docblock). */
  private addFocusVertices(geometry: THREE.BufferGeometry | null): void {
    if (!geometry) return;
    const points = new THREE.Points(geometry, getAutoBreaklinePointsMaterial3D());
    points.name = 'topo-auto-breaklines-focus-vertices';
    points.renderOrder = FOCUS_RENDER_ORDER.points;
    this.root.add(points);
  }

  /** Remove + free the current line geometries. Geometry only — materials are catalog singletons. */
  protected clearContent(): void {
    disposeObjectTree(this.root); // geometry-only (materials shared) — walks every child set
    this.root.clear();
  }
}
