/**
 * ADR-650 M8α — RAW cloud → display-only preview for the three.js `Points` layer.
 *
 * Stride-samples the classified cloud down to `PREVIEW_MAX_POINTS` and colours every surviving
 * point GROUND vs NON-GROUND (earth-brown vs grey — `ASPRS_CLASS_COLOR`/`PREVIEW_COLOR_FALLBACK`,
 * SSoT in `asprs-las-spec.ts`, never a second inline RGB triple). This is the human-certifier
 * surface (ReCap/CloudCompare parity, ADR-650 §6): the engineer must SEE what the ground filter
 * kept and discarded before approving the thin survey-grade set that `voxel-decimate.ts` produces
 * — this function never touches that set, `TopoPointStore`, or the TIN.
 *
 * Frame: `positions` interleaves `(localX, localY, worldZ)` per point — the SAME per-axis split
 * `PointCloudData` already carries (x/y LOCAL mm, z WORLD mm, never offset — mirrors
 * `TinSurface.elevations`). No LOCAL→WORLD or plan→three-world transform happens here; that is
 * the 3D layer's job (`tin-to-three.ts` does the equivalent step for the TIN).
 */

import { ASPRS_CLASS, ASPRS_CLASS_COLOR, PREVIEW_COLOR_FALLBACK } from './asprs-las-spec';
import { PREVIEW_MAX_POINTS } from './pointcloud-defaults';
import type { GroundClassifyResult, PointCloudData, PointCloudPreview } from './pointcloud-types';

/** Ground points render in this colour — reused, never re-picked (SSoT: `asprs-las-spec.ts`). */
const GROUND_COLOR = ASPRS_CLASS_COLOR[ASPRS_CLASS.GROUND]!;

/**
 * Build the display-only preview cloud for `data`, coloured by `ground`.
 *
 * @param data   the RAW (or stride-sampled-at-read) cloud, LOCAL x/y + WORLD z.
 * @param ground which of `data`'s points are bare earth (source classification or CSF).
 */
export function buildCloudPreview(data: PointCloudData, ground: GroundClassifyResult): PointCloudPreview {
  if (data.count === 0) {
    return { count: 0, positions: new Float32Array(0), colors: null, origin: data.origin };
  }

  const stride = Math.max(1, Math.ceil(data.count / PREVIEW_MAX_POINTS));
  const isGround = buildGroundFlags(data.count, ground.groundIndices);
  const sampled = Math.ceil(data.count / stride);

  const positions = new Float32Array(sampled * 3);
  const colors = new Float32Array(sampled * 3);
  fillPreviewBuffers(data, isGround, stride, positions, colors);

  return { count: sampled, positions, colors, origin: data.origin };
}

/** Uint8 ground-membership flags, one pass over the (sorted) `groundIndices`. */
function buildGroundFlags(count: number, groundIndices: Uint32Array): Uint8Array {
  const flags = new Uint8Array(count);
  for (let k = 0; k < groundIndices.length; k++) {
    flags[groundIndices[k]!] = 1;
  }
  return flags;
}

/** Stride-sample `data` into the pre-sized `positions`/`colors` buffers. */
function fillPreviewBuffers(
  data: PointCloudData,
  isGround: Uint8Array,
  stride: number,
  positions: Float32Array,
  colors: Float32Array,
): void {
  let out = 0;
  for (let i = 0; i < data.count; i += stride) {
    const base = out * 3;
    positions[base] = data.x[i]!;
    positions[base + 1] = data.y[i]!;
    positions[base + 2] = data.z[i]!;

    const color = isGround[i] ? GROUND_COLOR : PREVIEW_COLOR_FALLBACK;
    colors[base] = color[0];
    colors[base + 1] = color[1];
    colors[base + 2] = color[2];
    out += 1;
  }
}
