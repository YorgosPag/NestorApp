/**
 * WallTypePreviewRenderer — the «Edit Wall Type» dialog's live preview (ADR-414).
 *
 * The scene, camera fit, highlight outline, picking and lifecycle all live in the
 * shared `BandStackPreviewRenderer` SSoT — this file owns ONLY what is genuinely
 * wall-specific: the stub dimensions, the view direction, and the fact that wall
 * layers stack along Z (through the thickness).
 *
 * @see band-stack-preview-renderer.ts — the shared mini viewport
 * @see ../converters/wall-type-preview-geometry.ts — pure band math
 * @see ../../ui/ribbon/wall-advanced-panel/sections/WallDnaEditor.tsx — the editor
 * @see docs/centralized-systems/reference/adrs/ADR-414-wall-type-live-preview.md
 */

import * as THREE from 'three';
import type { WallDna } from '../../bim/types/wall-dna-types';
import {
  BandStackPreviewRenderer,
  type BandStackPreviewSpec,
  type PreviewBandBox,
} from './band-stack-preview-renderer';
import {
  buildWallTypePreviewBands,
  type WallPreviewBand,
} from '../converters/wall-type-preview-geometry';

/** Synthetic stub dimensions (meters) — short wall, full height-ish slice. */
const STUB_LENGTH_M = 1.2;
const STUB_HEIGHT_M = 1.0;

/**
 * 3/4 view direction. Weighted toward +X (the wall END face) and +Y (the TOP
 * face) — both of which expose the layer cross-section across the thickness —
 * with a smaller frontal (+Z) component. Giorgio: «στρέψε πιο αριστερά + γείρε
 * προς εμένα» → more side + top, less front.
 */
const VIEW_DIR = new THREE.Vector3(1.5, 1.05, 0.85).normalize();

/** Exported for tests — this spec IS the wall-specific behaviour, so it is the contract. */
export const WALL_PREVIEW_SPEC: BandStackPreviewSpec<WallDna, WallPreviewBand> = {
  viewDir: VIEW_DIR,
  fallbackThicknessM: 0.25,
  buildBands: (dna) => buildWallTypePreviewBands(dna),
  // Wall layers stack along Z — each band spans the full slice, its own depth.
  boxOf: (band): PreviewBandBox => ({
    size: [STUB_LENGTH_M, STUB_HEIGHT_M, band.depthM],
    position: [0, 0, band.centerZM],
  }),
  halfExtents: (totalM) => [STUB_LENGTH_M / 2, STUB_HEIGHT_M / 2, totalM / 2],
};

export class WallTypePreviewRenderer extends BandStackPreviewRenderer<WallDna, WallPreviewBand> {
  constructor(container: HTMLElement) {
    super(container, WALL_PREVIEW_SPEC);
  }
}
