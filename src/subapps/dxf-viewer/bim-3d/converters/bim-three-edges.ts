/**
 * bim-three-edges — shared 3D edge-projection overlay helper (the SOLE 3D
 * edge-attach SSoT).
 *
 * Extracted from BimToThreeConverter.ts (Google file-size SSoT, N.7.1) so the
 * point-based converters (bim-three-point-converters.ts), the structural
 * converters AND the stair converter share ONE edge-attach routine
 * (ADR-375 Phase C.7, unified ADR-377 Phase E).
 *
 * ADR-377 Phase E — 3D ⟷ 2D subcategory parity:
 *   - Reads the SAME `objectStyles` SSoT the 2D renderers read at draw time
 *     (`useBimRenderSettingsStore.getState().objectStyles`), so user V/G
 *     category + subcategory pen/colour/pattern overrides reach the 3D edges.
 *     A rebuild on every `objectStyles` mutation is already wired by
 *     `useBim3DVgResync`, so the build-time read is always fresh.
 *   - Threads the per-geometry `subcategoryKey` (e.g. wall `common-edges`,
 *     stair `treads`) exactly like the 2D renderer sub-passes.
 *   - Propagates `linePattern` so dashed/dotted subcategories render dashed in 3D.
 */
import * as THREE from 'three';
import { resolve3DEdgeStyle } from '../edges/bim-3d-edge-resolver';
import { buildEdgeOverlay, attachEdgeOverlay } from '../edges/bim-3d-edge-overlay-builder';
import type { BimCategory } from '../../config/bim-object-styles';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';

// ADR-375 Phase C.7 — default 3D edge resolution context.
// scaleDenominator 100 = 1:100 architectural plan, the most common BIM scale.
// dpi 96 = standard CSS pixel density.
const EDGE_DEFAULT_SCALE = 100;
const EDGE_DEFAULT_DPI = 96;

/**
 * ADR-375 Phase C.7 (v2.22) — uniform "Shaded with Edges" silhouette colour.
 *
 * Revit's shaded 3D view draws model edges in ONE uniform dark line colour, not
 * the per-category 2D projection colours (those drive plan/wireframe line work,
 * e.g. v2.19 gave columns a blue-grey `#5b6478`). For the 3D solid view Giorgio
 * wants consistent discreet BLACK edges, so we override the resolver colour here
 * with a single near-black. The resolver still drives width / pattern / visibility
 * (pen table, V/G eye toggle, per-element/layer overrides all keep working in 3D).
 */
const BIM_3D_EDGE_COLOR = '#1a1a1a';

/**
 * Build + attach the projection edge overlay for a BIM solid mesh.
 *
 * @param subcategoryKey ADR-377 — the geometry sub-pass this mesh represents
 *   (wall/slab `common-edges`, stair `treads`/`risers`/`outlines`, …). Omit for
 *   categories whose 3D silhouette maps to the parent style (column, beam,
 *   point-based fixtures/panels) — preserving the pre-ADR-377 default look.
 */
export function attachEdgesProjection(
  mesh: THREE.Mesh,
  category: BimCategory,
  subcategoryKey?: string,
): void {
  // ADR-446 — Visual Style EDGES axis. `none` → no overlay at all (Shaded /
  // Realistic without edges). `visible` → occluded (depthTest on). `all` → x-ray
  // (depthTest off — Wireframe shows every edge through the absent faces).
  const edgeMode = useBimRenderSettingsStore.getState().edgeMode;
  if (edgeMode === 'none') return;

  const style = resolve3DEdgeStyle({
    category,
    cutState: 'projection',
    scaleDenominator: EDGE_DEFAULT_SCALE,
    dpi: EDGE_DEFAULT_DPI,
    subcategoryKey,
    objectStyles: useBimRenderSettingsStore.getState().objectStyles,
  });
  // v2.22 — uniform near-black silhouette colour for the 3D shaded view (Revit
  // "Shaded with Edges"); width/pattern/visibility stay resolver-driven.
  attachEdgeOverlay(
    mesh,
    buildEdgeOverlay(mesh, { ...style, color: BIM_3D_EDGE_COLOR, occlude: edgeMode !== 'all' }),
  );
}
