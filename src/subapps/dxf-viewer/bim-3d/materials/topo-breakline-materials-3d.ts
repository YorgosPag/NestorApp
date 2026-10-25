/**
 * topo-breakline-materials-3d — the 3D stroke of a COMMITTED breakline (ADR-920 Β4.8 Β2.2).
 *
 * Every value comes from `topo-breakline-style`, the vocabulary the 2D overlay already draws with, so
 * the plan and the model say the same sentence: a yellow line on a dark casing, its PATTERN telling where
 * the z came from (solid = elevation/unknown · dashed = proximity · dotted = surface), a disc at each
 * vertex. The 3D-specific parts are only the renderer's: flat-ended dashes in SCREEN px
 * (`breaklineFlatCapDash` → `scene-fat-line` `screenDash`), so the legend reads the same at every zoom.
 *
 * ### Depth
 * The lines test depth and carry {@link COPLANAR_LINE_POLYGON_OFFSET}: a committed breakline is survey
 * geometry lying ON its TIN edge, so it must win against the triangles it bounds and still hide behind a
 * hill, exactly like the contours. The vertex DISCS do not test depth: a point sprite has no polygon to
 * offset, so on a slope half of every disc would sink into the ground beside it. They read through the
 * hill like the candidate corners do — the line, not the marker, carries occlusion.
 *
 * @module bim-3d/materials/topo-breakline-materials-3d
 * @enterprise ADR-920 — Topography breaklines · ADR-650 — Topography · ADR-584 — Anti-Duplication
 */

import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { UI_COLORS } from '../../config/color-config';
import {
  breaklineFlatCapDash,
  breaklinePatternKey,
  TOPO_BREAKLINE_STROKE_PX,
  TOPO_BREAKLINE_VERTEX_DOT_PX,
  TOPO_BREAKLINE_VERTEX_OUTLINE_PX,
  type BreaklineDashPattern,
} from '../../systems/topography/topo-breakline-style';
import { COPLANAR_LINE_POLYGON_OFFSET } from '../lines/scene-fat-line';
import { createFatLineMaterialCatalog } from './fat-line-material-catalog';
import { createScreenDotMaterial, type ScreenDotMaterial } from './screen-dot-material';

const lineCatalog = createFatLineMaterialCatalog();

/** The two vertex discs: the dark ring (drawn first) and the yellow fill on top of it. */
type VertexDiscRole = 'outline' | 'fill';
const discs = new Map<VertexDiscRole, ScreenDotMaterial>();

/** The dark CASING under every committed breakline — solid, one step heavier than the core. */
export function getTopoBreaklineCasingMaterial3D(): LineMaterial {
  return lineCatalog.get('casing', {
    widthPx: TOPO_BREAKLINE_STROKE_PX.casing,
    color: new THREE.Color(UI_COLORS.TOPO_BREAKLINE_CASING).getHex(),
    polygonOffset: COPLANAR_LINE_POLYGON_OFFSET,
  });
}

/** The yellow CORE in the breakline's provenance pattern (`null` = solid). */
export function getTopoBreaklineCoreMaterial3D(pattern: BreaklineDashPattern | null): LineMaterial {
  const dash = breaklineFlatCapDash(pattern, TOPO_BREAKLINE_STROKE_PX.stroke);
  return lineCatalog.get(`core:${breaklinePatternKey(pattern)}`, {
    widthPx: TOPO_BREAKLINE_STROKE_PX.stroke,
    color: new THREE.Color(UI_COLORS.TOPO_BREAKLINE).getHex(),
    polygonOffset: COPLANAR_LINE_POLYGON_OFFSET,
    ...(dash ? { screenDash: dash } : null),
  });
}

/**
 * A vertex disc. The outline is the fill's diameter plus the 2D ring on both sides, so the two passes
 * compose the same ringed disc the plan draws with one `<circle stroke>`.
 */
export function getTopoBreaklineVertexMaterial3D(role: VertexDiscRole): THREE.PointsMaterial {
  let disc = discs.get(role);
  if (!disc) {
    disc = createScreenDotMaterial(role === 'fill'
      ? { color: UI_COLORS.TOPO_BREAKLINE, diameterPx: TOPO_BREAKLINE_VERTEX_DOT_PX, depthTest: false }
      : {
          color: UI_COLORS.TOPO_BREAKLINE_CASING,
          diameterPx: TOPO_BREAKLINE_VERTEX_DOT_PX + 2 * TOPO_BREAKLINE_VERTEX_OUTLINE_PX,
          depthTest: false,
        });
    discs.set(role, disc);
  }
  return disc.material;
}

/** Free every committed-breakline material + its viewport subscription. Full app teardown only. */
export function disposeTopoBreaklineMaterials3D(): void {
  lineCatalog.dispose();
  for (const disc of discs.values()) {
    disc.unsubscribe();
    disc.material.dispose();
  }
  discs.clear();
}
