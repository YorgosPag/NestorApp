/**
 * ADR-650 M4 — hypsometric elevation ramp (Civil 3D «Elevation Banding» analysis style).
 *
 * The cartographic convention every surveying/GIS stack ships (Civil 3D elevation analysis,
 * QGIS/GRASS hypsometric tints, USGS topo sheets): low ground reads green, mid ground reads
 * ochre/yellow, high ground reads brown, peaks read pale. It is not decoration — it is how a
 * surveyor reads relief at a glance before contours are even drawn.
 *
 * Colours are LINEARLY interpolated between stops in sRGB (the same space the stops are
 * authored in), then handed to `THREE.Color`, which converts into the renderer's working
 * colour space — so a hypsometric hill matches its swatch and does not wash out under the PBR
 * lighting the way a raw linear-space lerp would.
 */

import * as THREE from 'three';

/** One ramp stop: `t` = normalised elevation within the surface's own min→max range. */
interface RampStop {
  readonly t: number;
  readonly color: number;
}

/**
 * The ramp, low → high. Relative to the surface's OWN vertical range (not an absolute
 * altitude), so a 3 m garden mound and a 300 m hillside both read across the full ramp —
 * which is what an analysis style is for.
 */
const RAMP: readonly RampStop[] = [
  { t: 0.0, color: 0x2f6b3c }, // valley floor — deep green
  { t: 0.28, color: 0x7fae53 }, // low slopes — grass
  { t: 0.52, color: 0xd8cd7d }, // mid slopes — ochre
  { t: 0.76, color: 0xa8744d }, // upper slopes — earth brown
  { t: 1.0, color: 0xf0ece4 }, // crest — pale rock
];

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
 */
const CUTFILL_RAMP: readonly RampStop[] = [
  { t: 0.0, color: 0x1d4e89 }, // deep fill — blue
  { t: 0.3, color: 0x6ba3d6 }, // shallow fill — pale blue
  { t: 0.5, color: 0xf2efe6 }, // the zero / daylight line — bone
  { t: 0.7, color: 0xe08a5c }, // shallow cut — ochre-red
  { t: 1.0, color: 0x9e2b25 }, // deep cut — deep red
];

const scratch = new THREE.Color();
const lowStop = new THREE.Color();
const highStop = new THREE.Color();

/**
 * Colour for a normalised elevation `t` ∈ [0,1], written into `out` at float offset `i`
 * as linear-working-space RGB (the layout `BufferGeometry`'s `color` attribute expects).
 * `t` outside the range is clamped — a flat surface (min == max) reads as the valley tone.
 */
export function writeTerrainRampColor(out: Float32Array, i: number, t: number): void {
  writeRampColor(out, i, t, RAMP);
}

/** ADR-650 M6 — cut/fill colour for a symmetric, normalised Δz `t` ∈ [0,1] (0.5 = zero line). */
export function writeTerrainCutFillColor(out: Float32Array, i: number, t: number): void {
  writeRampColor(out, i, t, CUTFILL_RAMP);
}

/** The one ramp evaluator — both styles are DATA (stop tables), not two copies of this code. */
function writeRampColor(
  out: Float32Array,
  i: number,
  t: number,
  ramp: readonly RampStop[],
): void {
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const upperIndex = findUpperStopIndex(clamped, ramp);
  const lower = ramp[upperIndex - 1]!;
  const upper = ramp[upperIndex]!;

  const span = upper.t - lower.t;
  const local = span > 0 ? (clamped - lower.t) / span : 0;

  // `setHex` (sRGB by default) converts into the working colour space; lerp there.
  lowStop.setHex(lower.color);
  highStop.setHex(upper.color);
  scratch.copy(lowStop).lerp(highStop, local);

  out[i] = scratch.r;
  out[i + 1] = scratch.g;
  out[i + 2] = scratch.b;
}

/** Index of the first stop at or above `t` (never 0 — `t ≥ 0` always has a lower stop). */
function findUpperStopIndex(t: number, ramp: readonly RampStop[]): number {
  for (let i = 1; i < ramp.length; i++) {
    if (t <= ramp[i]!.t) return i;
  }
  return ramp.length - 1;
}
