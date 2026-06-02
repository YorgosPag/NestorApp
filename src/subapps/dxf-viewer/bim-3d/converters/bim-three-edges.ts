/**
 * bim-three-edges — shared 3D edge-projection overlay helper.
 *
 * Extracted from BimToThreeConverter.ts (Google file-size SSoT, N.7.1) so the
 * point-based converters (bim-three-point-converters.ts) and the structural
 * converters share ONE edge-attach routine (ADR-375 Phase C.7).
 */
import * as THREE from 'three';
import { resolve3DEdgeStyle } from '../edges/bim-3d-edge-resolver';
import { buildEdgeOverlay, attachEdgeOverlay } from '../edges/bim-3d-edge-overlay-builder';
import type { BimCategory } from '../../config/bim-object-styles';

// ADR-375 Phase C.7 — default 3D edge resolution context.
// scaleDenominator 100 = 1:100 architectural plan, the most common BIM scale.
// dpi 96 = standard CSS pixel density.
const EDGE_DEFAULT_SCALE = 100;
const EDGE_DEFAULT_DPI = 96;

export function attachEdgesProjection(mesh: THREE.Mesh, category: BimCategory): void {
  const style = resolve3DEdgeStyle({
    category,
    cutState: 'projection',
    scaleDenominator: EDGE_DEFAULT_SCALE,
    dpi: EDGE_DEFAULT_DPI,
  });
  attachEdgeOverlay(mesh, buildEdgeOverlay(mesh, style));
}
