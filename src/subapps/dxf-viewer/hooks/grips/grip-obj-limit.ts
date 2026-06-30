/**
 * ADR-559 — AutoCAD `GRIPOBJLIMIT` predicate (SSoT).
 *
 * The ONE rule that decides whether a selection is too large to draw grips for. When the
 * number of selected OBJECTS exceeds the limit, ALL grips are suppressed — the objects stay
 * selected, only their grip rendering is skipped (performance). Mirrors AutoCAD's
 * `GRIPOBJLIMIT` system variable (default 100, range 0-32767, `0` = no limit).
 *
 * Reused by every grip producer so 2D (`grip-registry`) and 3D (raw-DXF seater +
 * BIM footprint reshape) share ONE definition of the limit — no divergent copies.
 *
 * Distinct from `maxGripsPerEntity` (the per-SINGLE-entity grip cap). This predicate is
 * about the COUNT of selected objects, not the grip count of one object.
 */

/**
 * True when grips must be hidden because the selection holds MORE objects than the limit.
 * A non-positive `gripObjLimit` (the AutoCAD `0` sentinel) means "no limit" ⇒ never suppress.
 *
 * @param selectedCount number of selected objects (DXF entities + overlays)
 * @param gripObjLimit   AutoCAD GRIPOBJLIMIT value (`0` = unlimited)
 */
export function isGripObjLimitExceeded(selectedCount: number, gripObjLimit: number): boolean {
  return gripObjLimit > 0 && selectedCount > gripObjLimit;
}
