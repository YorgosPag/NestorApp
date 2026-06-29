/**
 * ADR-363 Slice F — Rotation-handle placement POLICY (SSoT for every box-grip family).
 *
 * ONE rule, ONE constant, consumed by every rectangular BIM grip family:
 *   - `axis-box-grips.ts`      → axis-anchored wall / beam / foundation strip+tie-beam
 *   - `column-grip-utils.ts`   → centre-anchored column / shear-wall (+ L/T/I/U/poly variants)
 *   - `foundation-grips.ts`    → centre-anchored pad footing
 *   - `centred-box-grips.ts`   → the 8 placeable (mep-fixture / panel / furniture / …)
 *
 * The Revit rule, in exactly one place:
 *
 *   **The rotation control sits ON the footprint face OPPOSITE the primary
 *   perpendicular dimension handle** (thickness / width / depth / length edge), so
 *   it is NEVER coincident with a dimension handle — Giorgio «πάνω στην παρειά, όχι
 *   στον χώρο· σε παρειά που δεν υπάρχει λαβή». No stand-off into space:
 *   `ROTATION_HANDLE_OFFSET_MM` is a tunable knob, currently `0` (= on the face).
 *
 * Before this module the constant was redefined in THREE files and the "opposite
 * face + stand-off" formula was hand-written per family — some on the SAME face as
 * the dimension handle (the coincidence bug Giorgio reported: «το σημάδι
 * περιστροφής συμπίπτει με τη λαβή πάχους»). Families that carry NO perpendicular
 * dimension handle (the 8 centred-box placeable have only corners + rotation) have
 * no face to avoid, so they keep their face and consume only the shared constant.
 *
 * Pure, unit-agnostic: `halfExtent` and `offset` must share a unit (mm in the
 * centre-anchored local frames, scene units in the axis `RectFrame`s); the caller
 * converts the returned local-perp coordinate into world space. Zero React / DOM /
 * Firestore / canvas deps.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice F
 */

/**
 * mm. Extra stand-off of the rotation handle BEYOND the box face — the ONE
 * definition + tunable knob. `0` = the handle sits exactly ON the opposite face
 * (Giorgio: «πάνω στην παρειά, όχι στον χώρο»). A positive value would push it that
 * many mm into free space beyond the face.
 */
export const ROTATION_HANDLE_OFFSET_MM = 0;

/** A perpendicular-face sign: `+1` = positive face, `-1` = negative face. */
export type FaceSign = -1 | 1;

/**
 * The face OPPOSITE a dimension handle's face (Revit rule: the rotation control
 * never shares a face with a dimension handle). `+1 ⇄ -1`. Accepts any ±1 sign
 * (typed `RectSign`/`number` callers alike) and returns its negation.
 */
export function oppositeFace(dimensionFaceSign: number): number {
  return -dimensionFaceSign;
}

/**
 * Signed local-frame perpendicular coordinate of the rotation handle: the face
 * OPPOSITE `dimensionFaceSign`, plus an optional `offset` beyond the half-extent
 * (default `0` = exactly ON the opposite face). `halfExtent` and `offset` must be
 * in the SAME unit (the result is in that unit); the caller rotates + translates
 * it into world space.
 *
 * Example: a box with perpendicular half-extent `h`, its dimension handle on the
 * `+1` face → rotation handle at `-(h + offset)` = `-h` by default (ON the opposite
 * face); a positive `offset` stands it off into free space.
 */
export function rotationHandlePerpOffset(
  halfExtent: number,
  dimensionFaceSign: number,
  offset: number = ROTATION_HANDLE_OFFSET_MM,
): number {
  return oppositeFace(dimensionFaceSign) * (halfExtent + offset);
}

/**
 * Κλάσμα της clearance που επιτρέπεται να «καταναλώσει» η μετατοπισμένη λαβή ώστε να
 * μένει ασφαλώς ΜΕΣΑ στο σώμα (ο εγγεγραμμένος δίσκος ακτίνας `clearance` είναι εντός
 * πολυγώνου· `< 1` αφήνει περιθώριο). ADR-520.
 */
export const ROTATION_HANDLE_INSIDE_SAFETY = 0.85;

/**
 * ADR-363/518/520 — Η ΜΙΑ ΚΑΙ ΜΟΝΑΔΙΚΗ θέση (signed local-Y offset) της λαβής **περιστροφής**
 * των box/free-reshape στηλών: στο **ΜΕΣΟ** της νοητής γραμμής κέντρο→κάτω-edge = `−dimY/4`
 * (Giorgio 2026-06-15). ΠΟΤΕ πάνω στο κέντρο (όπου ο σταυρός μετακίνησης) ούτε στην περίμετρο.
 *
 * Πριν το ADR-520 ο κανόνας ήταν γραμμένος ΤΡΕΙΣ φορές (rect `−depth/4` inline, polygon
 * `−dimY/4` inline, free-reshape inline) — εδώ ζει ΜΙΑ φορά. Για **κοίλα** σώματα (free-reshape)
 * δίνεται `clearanceMm` ώστε το offset να μη βγει εκτός: φράσσεται σε `clearance·SAFETY`. Convex
 * (rect/polygon) → `clearanceMm = Infinity` (κανένα φράγμα). `dimY` και `clearanceMm` ίδια μονάδα.
 */
export function rotationHandleMidwayOffset(dimY: number, clearanceMm: number = Infinity): number {
  const bound = Number.isFinite(clearanceMm) ? clearanceMm * ROTATION_HANDLE_INSIDE_SAFETY : Infinity;
  return -Math.min(dimY / 4, bound);
}

/**
 * ADR-363 — Local-X (axial) sign that points toward the EAST-most axis end (Giorgio
 * 2026-06-30: η λαβή περιστροφής τοίχου πάνω στον κεντρικό άξονα, προς την ανατολική παρειά).
 *
 * For an axis `RectFrame`, local +X = the axis direction (start→end) rotated by `rotationDeg`,
 * so its world vector is `(cos θ, sin θ)`. The +X end is more to the east (greater world x)
 * iff `cos θ > 0`. Returns `+1` toward the +X end, `-1` toward the −X end. For a (near-)vertical
 * axis (`cos θ ≈ 0`, no east/west bias) it tie-breaks toward NORTH via `sin θ`. Pure, unit-agnostic;
 * the caller multiplies by `halfWidth/2` and feeds it through `rectLocalWorld` to land on the
 * centreline at quarter-length (the `'axis-quarter'` rotation placement).
 */
export function rotationHandleAxialEastSign(rotationDeg: number): FaceSign {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  if (Math.abs(cos) > 1e-9) return cos > 0 ? 1 : -1;
  return Math.sin(rad) >= 0 ? 1 : -1;
}
