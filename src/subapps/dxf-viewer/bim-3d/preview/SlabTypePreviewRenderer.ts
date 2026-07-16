/**
 * SlabTypePreviewRenderer — the «Edit Slab Type» dialog's live preview
 * (ADR-412/ADR-414). Slab analogue of `WallTypePreviewRenderer`.
 *
 * The scene, camera fit, highlight outline, picking and lifecycle all live in the
 * shared `BandStackPreviewRenderer` SSoT — this file owns ONLY what is genuinely
 * slab-specific: the stub footprint, the view direction, and the fact that slab
 * layers stack VERTICALLY (along Y) across the thickness.
 *
 * @see band-stack-preview-renderer.ts — the shared mini viewport
 * @see ../converters/slab-type-preview-geometry.ts — pure band math
 * @see WallTypePreviewRenderer.ts — the wall sibling
 */

import * as THREE from 'three';
import type { SlabDna } from '../../bim/types/slab-dna-types';
import {
  BandStackPreviewRenderer,
  type BandStackPreviewSpec,
  type PreviewBandBox,
} from './band-stack-preview-renderer';
import {
  buildSlabTypePreviewBands,
  type SlabPreviewBand,
} from '../converters/slab-type-preview-geometry';

/** Synthetic stub footprint (meters) — a short, wide slab patch. */
const STUB_WIDTH_M = 1.4; // X (along the section the layers read across)
const STUB_DEPTH_M = 0.9; // Z

/**
 * 3/4 view direction. Weighted toward +Z (the FRONT face, where the vertical
 * layer stack is visible) + +Y (TOP) + a smaller +X so the slab reads as a solid
 * with its layered edge facing the viewer.
 */
const VIEW_DIR = new THREE.Vector3(0.85, 1.05, 1.5).normalize();

const SLAB_PREVIEW_SPEC: BandStackPreviewSpec<SlabDna, SlabPreviewBand> = {
  viewDir: VIEW_DIR,
  fallbackThicknessM: 0.2,
  buildBands: (dna) => buildSlabTypePreviewBands(dna),
  // Slab layers stack along Y — each band spans the full footprint, its own height.
  boxOf: (band): PreviewBandBox => ({
    size: [STUB_WIDTH_M, band.heightM, STUB_DEPTH_M],
    position: [0, band.centerYM, 0],
  }),
  halfExtents: (totalM) => [STUB_WIDTH_M / 2, totalM / 2, STUB_DEPTH_M / 2],
};

export class SlabTypePreviewRenderer extends BandStackPreviewRenderer<SlabDna, SlabPreviewBand> {
  constructor(container: HTMLElement) {
    super(container, SLAB_PREVIEW_SPEC);
  }
}
