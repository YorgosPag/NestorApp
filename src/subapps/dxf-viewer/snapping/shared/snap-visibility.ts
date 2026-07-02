/**
 * SSoT visibility predicate for snap eligibility (ADR-378).
 *
 * WHY: entities that come from a DXF import are persisted with a minimal field
 * set — `{ id, type, layerId, color, start, end }` — and DELIBERATELY omit the
 * optional `visible` field (see `types/entities.ts` `visible?: boolean`). App-drawn
 * entities set `visible: true` explicitly. Any snap engine that filtered with a
 * naive truthy check (`if (!entity.visible) continue;`) therefore treated
 * `visible === undefined` the SAME as `visible === false` and silently dropped
 * every imported-DXF entity from its spatial index — so OSNAP (endpoint, midpoint,
 * center, perpendicular, …) failed to trigger on imported geometry while working
 * on drawn geometry.
 *
 * CANON: only an EXPLICIT `visible === false` hides an entity from snapping — a
 * missing `visible` means visible. This mirrors the renderer
 * (`EntityRendererComposite`: missing `visible` → rendered) and hit-testing
 * (`hit-tester-utils`: only `visible === false` is skipped), so an entity that is
 * drawn on screen is always snappable.
 *
 * This is the ONE place that owns the rule. All snap engines MUST call it rather
 * than re-implementing the check, so the truthy-vs-strict trap cannot reappear.
 */
export function isEntityVisibleForSnap(entity: { visible?: boolean }): boolean {
  return entity.visible !== false;
}
