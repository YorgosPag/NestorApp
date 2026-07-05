/**
 * SSoT: parse the trailing numeric index of a `<prefix>-N` grip kind
 * (e.g. `slab-vertex-3`, `roof-edge-midpoint-2`, `column-poly-edge-0`,
 * `wall-vertex-1`, `polyline-vertex-0`).
 *
 * For a vertex grip, `N` is BOTH the vertex index AND its outgoing-segment index
 * (they coincide). The index is always the final dash-delimited token, so a
 * single `lastIndexOf('-')` split serves every domain regardless of prefix.
 *
 * Returns `null` when the kind is absent / malformed / negative — callers then
 * short-circuit to a no-op. Domain-specific lower bounds (e.g. wall excludes
 * vertex 0) stay at the call site as an extra `idx >= k` check.
 *
 * Replaces the per-domain inline `parseInt(kind.slice(prefix.length), 10)`
 * copies in slab / roof / floor-finish / slab-opening / mep-underfloor /
 * column / wall grips and backs {@link parsePolylineSegIndex}
 * (N.0.2 boy-scout / N.12 SSoT).
 */
export function parseGripKindIndex(kind: string | undefined): number | null {
  if (!kind) return null;
  const dash = kind.lastIndexOf('-');
  if (dash < 0) return null;
  const n = Number.parseInt(kind.slice(dash + 1), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
