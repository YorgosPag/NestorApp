/**
 * auto-breakline-materials-3d — ADR-650 M8β/Γ — the 3D review palette of a proposed breakline.
 *
 * Split out of `terrain-materials-3d` in M8β/Γ v2 (N.7.1): the focused candidate stopped being «a
 * line and some dots» and became a three-pass selection — casing, core, corner markers — with a
 * viewport subscription of its own. Colours still come from the SAME `UI_COLORS` SSoT the 2D
 * preview reads and widths from the SAME `auto-breakline-review-style`, because «πράσινη στο
 * σχέδιο», which the panel says in words, is a promise both views must keep.
 *
 * ### Why the focused candidate is drawn twice
 * v1 gave the focus a `LineBasicMaterial` and leaned the whole emphasis on vertex dots, on the
 * grounds that WebGL ignores `linewidth`. The first half is true; the conclusion was not. Every CAD
 * viewer on the web draws thick lines with `LineSegments2`, and this scene has published the
 * `resolution` those need since ADR-375. The result on screen was a 1 px line that vanished next to
 * 7 px dots — so the selection read as «a row of dots», not «this line», and beside the 2D preview
 * (which has had a proper halo all along) the 3D view was visibly the poorer of the two.
 *
 * So the focus now says the same sentence in both views: a translucent CASING in the selection
 * colour, a solid CORE in the candidate's approval colour, corner markers on top. Casing-under-core
 * is the cartographic answer to «make a line legible over a background you do not control» (ESRI's
 * halo/casing guidance for exactly this problem), and it keeps the two questions the review asks
 * separable — the casing answers «is this the one I clicked», the core still answers «will it be
 * written». v1 painted the focused line entirely in the selection colour and silently lost the
 * second answer, which the 2D preview never did.
 *
 * ### Two things deliberately NOT done
 * - **No animation** (pulse / dash-flow). It would read well, but every frame of it must go through
 *   the `UnifiedFrameScheduler` (ADR-040 forbids a private RAF loop), turning a review layer that
 *   currently costs *nothing* between clicks into a permanent per-frame consumer. A static casing
 *   already solves the legibility problem; motion would be paying a running cost for polish.
 * - **No dark outer casing** (the ESRI double-casing that survives a light background too). The
 *   app's selection colour IS white, and a second, darker ring would be a 3D-only invention — the
 *   two views would stop describing the review identically, which is the whole point of this file.
 *
 * `depthTest: false` on all three passes: the focused candidate stays visible THROUGH the hill.
 * Hunting for a line hidden behind a ridge is the exact failure a selection highlight exists to
 * prevent. ⚠️ Note the side effect — `LineMaterial` is excluded from three.js clipping
 * (`section-clip-applicator`, ADR-452/ADR-665), so unlike the thin approval lines the focused
 * candidate is NOT cut by the active level plane. That is consistent with it ignoring depth: it is
 * a selection indicator, not survey geometry.
 *
 * @module bim-3d/materials/auto-breakline-materials-3d
 * @enterprise ADR-650 — Topography · ADR-040 — canvas performance · ADR-584 — Anti-Duplication
 */

import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { UI_COLORS } from '../../config/color-config';
import {
  AUTO_BREAKLINE_CORNER_DOT_PX,
  AUTO_BREAKLINE_HALO_OPACITY,
  AUTO_BREAKLINE_STROKE_PX,
} from '../../systems/topography/auto-breaklines/auto-breakline-review-style';
import { createFatLineMaterialCatalog } from './fat-line-material-catalog';
import { createScreenDotMaterial, type ScreenDotMaterial } from './screen-dot-material';

/** Which approval state a candidate line is drawn in. Focus is a SECOND, independent signal. */
export type AutoBreaklineLineKind = 'approved' | 'rejected';

/** Thin (1 px) approval lines — the un-focused majority. Cached per state for the app lifetime. */
const APPROVAL_CACHE = new Map<AutoBreaklineLineKind, THREE.LineBasicMaterial>();

/** Fat focus passes: the selection casing (one) and the core (one per approval state). */
const focusCatalog = createFatLineMaterialCatalog();

/** The corner markers of the focused candidate. One material, one focused candidate. */
let dots: ScreenDotMaterial | null = null;

/** The review palette, resolved in one place so casing, core and markers can never disagree. */
function autoBreaklineColor(kind: AutoBreaklineLineKind): string {
  return kind === 'approved' ? UI_COLORS.TOPO_BREAKLINE_APPROVED : UI_COLORS.TOPO_BREAKLINE_REJECTED;
}

/**
 * The thin approval line (green ticked / grey unticked).
 *
 * Stays `LineBasicMaterial`, i.e. 1 px, on purpose: `LineBasicMaterial` DOES ship three.js' clipping
 * chunks, so these lines are cut by the terrain's active level plane under the `'topo'` clip scope
 * (ADR-665) — a fat line would silently opt out of that cut. Widening them is a real improvement
 * and a separate decision, because it has to answer the clipping question first.
 */
export function getAutoBreaklineMaterial3D(kind: AutoBreaklineLineKind): THREE.LineBasicMaterial {
  let mat = APPROVAL_CACHE.get(kind);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({ color: new THREE.Color(autoBreaklineColor(kind)).getHex() });
    APPROVAL_CACHE.set(kind, mat);
  }
  return mat;
}

/** A fat focus pass — stays visible through the hill (see the module docblock). */
function focusMaterial(key: string, color: string, widthPx: number, opacity?: number): LineMaterial {
  return focusCatalog.get(key, {
    widthPx,
    color: new THREE.Color(color).getHex(),
    depthTest: false,
    ...(opacity === undefined ? null : { opacity }),
  });
}

/** The selection CASING — drawn first, under the core, in the app's selection colour. */
export function getAutoBreaklineFocusHaloMaterial3D(): LineMaterial {
  return focusMaterial(
    'halo',
    UI_COLORS.SELECTION_HIGHLIGHT,
    AUTO_BREAKLINE_STROKE_PX.halo,
    AUTO_BREAKLINE_HALO_OPACITY,
  );
}

/**
 * The focused candidate's CORE — in its APPROVAL colour, not the selection colour, so a click to
 * look at a candidate never hides what will happen to it (mirror of the 2D preview).
 */
export function getAutoBreaklineFocusCoreMaterial3D(kind: AutoBreaklineLineKind): LineMaterial {
  return focusMaterial(`core:${kind}`, autoBreaklineColor(kind), AUTO_BREAKLINE_STROKE_PX.focused);
}

/** Corner markers along the focused candidate — constant on-screen size, through the hill. */
export function getAutoBreaklinePointsMaterial3D(): THREE.PointsMaterial {
  dots ??= createScreenDotMaterial({
    color: UI_COLORS.SELECTION_HIGHLIGHT,
    diameterPx: AUTO_BREAKLINE_CORNER_DOT_PX,
    depthTest: false,
  });
  return dots.material;
}

/** Free every cached review material + its viewport subscription. Full app teardown only. */
export function disposeAutoBreaklineMaterials3D(): void {
  for (const mat of APPROVAL_CACHE.values()) mat.dispose();
  APPROVAL_CACHE.clear();
  focusCatalog.dispose();
  dots?.unsubscribe();
  dots?.material.dispose();
  dots = null;
}
