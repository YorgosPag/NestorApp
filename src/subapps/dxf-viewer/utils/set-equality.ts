/**
 * SET EQUALITY — SSoT for "do these two sets contain the same members?".
 *
 * The same 3-line `Set` comparison (same size + every member shared) was
 * copy-pasted across unrelated domains — 3D selection highlighting
 * (`BimSelectionHighlighter`), isolate-mode membership (`IsolateEffectsStore`),
 * and the command-merge identity check (`merge-window.sameEntityIdSet`, array
 * variant). This neutral util owns the primitive once so no domain has to depend
 * on another's module just to compare two sets.
 *
 * Map equality (key + value comparison, e.g. `mep-segment-trim-store`) is a
 * different operation and intentionally NOT covered here.
 */

/**
 * True when `a` and `b` contain exactly the same members (order-independent).
 * Reference-equal sets short-circuit to `true`.
 */
export function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
