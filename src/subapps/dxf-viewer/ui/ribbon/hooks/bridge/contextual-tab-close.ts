/**
 * ADR-363 — «Κλείσιμο» contextual-tab action SSoT (pure, dependency-free).
 *
 * Every contextual ribbon tab exposes a `*.action(s).close` button whose only
 * job is to deselect the entity so the tab disappears. Previously this was
 * (mis)handled three different ways per bridge — `clearAll()` (worked),
 * `EventBus.emit('bim:select-none')` (dead — no listener ever existed), or not
 * at all (column/wall/slab/roof/opening/beam/foundation → button did nothing).
 *
 * This single predicate lets `routeRibbonAction` treat close as a uniform,
 * prefix-agnostic no-args deselect for ALL tabs, reusing the one working
 * primitive (`universalSelection.clearAll()`).
 *
 * Lives in its own dependency-free module so it is unit-testable without
 * dragging in the heavy bridge import graph (firebase/levels/etc.).
 */

/**
 * Returns `true` for any contextual-tab close key. Matches both the dominant
 * `*.actions.close` and the legacy singular `*.action.close`
 * (thermalSpace/hatch/floorFinish/wallCovering) key forms.
 */
export function isContextualTabCloseAction(action: string): boolean {
  return /\.actions?\.close$/.test(action);
}
