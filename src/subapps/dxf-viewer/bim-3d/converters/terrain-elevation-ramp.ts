/**
 * ADR-650 M4 — hypsometric elevation ramp (Civil 3D «Elevation Banding» analysis style) · ADR-650 M6 — cut/fill ramp.
 *
 * ADR-920 Β6.1: the elevation ramp's stops **and** the one ramp evaluator now live in `@/lib/terrain/elevation-ramp`,
 * because the public listing (plan SVG + 3D) must show the SAME colours as this viewer. This file keeps its two
 * signatures so `tin-to-three.ts` is unchanged; it no longer owns a second copy of the maths.
 *
 * Colours are interpolated in the renderer's LINEAR working space (the stops are authored in sRGB and converted
 * exactly like `THREE.Color.setHex` does with ColorManagement on), so a hypsometric hill matches its swatch and
 * does not wash out under the PBR lighting the way a raw sRGB lerp would.
 */

import {
  linearRampOf,
  writeLinearRampColor,
  writeTerrainElevationColor,
  type ElevationRampStop,
} from '@/lib/terrain/elevation-ramp';

/**
 * ADR-650 M6 — the CUT/FILL ramp (Civil 3D «Cut/Fill analysis» convention, and the colours
 * every earthworks drawing in the trade is read in): what must be EXCAVATED reads warm/red,
 * what must be FILLED reads cool/blue, and the zero line — the daylight line, where the ground
 * already sits at the design level — reads pale. A surveyor recognises the picture before
 * reading a single number.
 *
 * `t` is the SIGNED Δz normalised symmetrically: 0 = deepest fill, 0.5 = exactly on the design
 * level, 1 = deepest cut. Symmetric on purpose — a site that is 90 % fill must still show its
 * balance line in the same place as one that is 90 % cut.
 *
 * It stays here: cut/fill is a viewer-only analysis, nothing outside the subapp reads it. Its stops are DATA
 * handed to the ONE shared evaluator.
 */
const CUTFILL_RAMP: readonly ElevationRampStop[] = [
  { t: 0.0, color: 0x1d4e89 }, // deep fill — blue
  { t: 0.3, color: 0x6ba3d6 }, // shallow fill — pale blue
  { t: 0.5, color: 0xf2efe6 }, // the zero / daylight line — bone
  { t: 0.7, color: 0xe08a5c }, // shallow cut — ochre-red
  { t: 1.0, color: 0x9e2b25 }, // deep cut — deep red
];

const LINEAR_CUTFILL_RAMP = linearRampOf(CUTFILL_RAMP);

/**
 * Colour for a normalised elevation `t` ∈ [0,1], written into `out` at float offset `i`
 * as linear-working-space RGB (the layout `BufferGeometry`'s `color` attribute expects).
 * `t` outside the range is clamped — a flat surface (min == max) reads as the valley tone.
 */
export function writeTerrainRampColor(out: Float32Array, i: number, t: number): void {
  writeTerrainElevationColor(out, i, t);
}

/** ADR-650 M6 — cut/fill colour for a symmetric, normalised Δz `t` ∈ [0,1] (0.5 = zero line). */
export function writeTerrainCutFillColor(out: Float32Array, i: number, t: number): void {
  writeLinearRampColor(out, i, t, LINEAR_CUTFILL_RAMP);
}
