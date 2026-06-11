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
 *   **The rotation control is NEVER coincident with a dimension handle.** It stands
 *   off `ROTATION_HANDLE_OFFSET_MM` beyond the footprint face OPPOSITE the primary
 *   perpendicular dimension handle (thickness / width / depth / length edge).
 *
 * Before this module the constant `200` was redefined in THREE files and the
 * "opposite face + stand-off" formula was hand-written per family — some on the
 * SAME face as the dimension handle (the coincidence bug Giorgio reported:
 * «το σημάδι περιστροφής συμπίπτει με τη λαβή πάχους»). Families that carry NO
 * perpendicular dimension handle (the 8 centred-box placeable have only corners +
 * rotation) have no face to avoid, so they keep their face and consume only the
 * shared constant.
 *
 * Pure, unit-agnostic: `halfExtent` and `offset` must share a unit (mm in the
 * centre-anchored local frames, scene units in the axis `RectFrame`s); the caller
 * converts the returned local-perp coordinate into world space. Zero React / DOM /
 * Firestore / canvas deps.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md Slice F
 */

/** mm. Stand-off of the rotation handle beyond the box face. The ONE definition. */
export const ROTATION_HANDLE_OFFSET_MM = 200;

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
 * OPPOSITE `dimensionFaceSign`, standing off `offset` beyond the half-extent.
 * `halfExtent` and `offset` must be in the SAME unit (the result is in that unit);
 * the caller rotates + translates it into world space.
 *
 * Example: a box with perpendicular half-extent `h`, its dimension handle on the
 * `+1` face → rotation handle at `-(h + offset)` (opposite face, standing off).
 */
export function rotationHandlePerpOffset(
  halfExtent: number,
  dimensionFaceSign: number,
  offset: number = ROTATION_HANDLE_OFFSET_MM,
): number {
  return oppositeFace(dimensionFaceSign) * (halfExtent + offset);
}
