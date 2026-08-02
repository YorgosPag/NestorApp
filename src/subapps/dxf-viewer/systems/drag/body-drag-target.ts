/**
 * BODY-DRAG TARGET RESOLVER — ADR-560 (Entity Body-Drag: move / Ctrl-copy)
 *
 * Pure decision for "which entities travel when the user presses the mouse over
 * an entity body in select mode". AutoCAD semantics (SELECT-FIRST):
 *   - press over a SELECTED entity → drag the WHOLE current selection
 *   - press over an UNSELECTED entity → null: DO NOT arm a drag. The press must
 *     fall through to the normal click-select pipeline so the entity gets
 *     selected AND its grips are shown (a first click selects; a second press on
 *     the now-selected body drags). Arming on an unselected body — the old
 *     Figma-style behaviour — hijacked EVERY entity mousedown and returned before
 *     the lasso-down/click-select was recorded, so entities selected "silently"
 *     with no grips (regression: global select/grip break, all DXF + BIM).
 *   - press over empty space → null (caller falls through to lasso/select)
 *
 * Kept pure (no store imports) so the mousedown gate is unit-testable.
 */

export interface BodyDragTargetInput {
  /** Entity currently under the cursor (hover SSoT), or null. */
  readonly hoveredEntityId: string | null;
  /** Membership test against the live selection. */
  readonly isSelected: (id: string) => boolean;
  /** All currently selected scene entity ids. */
  readonly selectedIds: readonly string[];
  /**
   * 🔴 ADR-739 §27.15 — an in-place cell editor has already claimed this press.
   *
   * A table under edit turns its own body into a **grid**: pressing inside it means "select
   * cells", exactly as in Excel, and dragging means "extend the selection" — never "move the
   * object". The claim is raised by the table's capture-phase listener, which runs *before*
   * this gate, and expires with the gesture (`table-cell-session-focus.ts`).
   *
   * Same shape as the grip-guard at the call site: **a press aimed at something smaller than
   * the body never moves the whole body**. Kept as an input (not a store read) so this file
   * stays pure and unit-testable, exactly as its header promises.
   */
  readonly claimedByCellEditor?: boolean;
}

/**
 * Returns the entity ids to drag, or `null` when no body-drag should start.
 */
export function resolveBodyDragTarget(input: BodyDragTargetInput): string[] | null {
  const { hoveredEntityId, isSelected, selectedIds, claimedByCellEditor } = input;
  // ADR-739 §27.15 — the press belongs to an in-place cell editor: never a body move.
  if (claimedByCellEditor) return null;
  if (!hoveredEntityId) return null;

  // SELECT-FIRST (AutoCAD): only an ALREADY-selected body starts a drag. An
  // unselected hovered entity returns null so the press falls through to normal
  // click-select (selects it + shows grips). This prevents the mousedown gate from
  // swallowing every first click.
  if (!isSelected(hoveredEntityId)) return null;

  // Grab the whole selection (the hovered entity is part of it).
  return selectedIds.length > 0 ? [...selectedIds] : [hoveredEntityId];
}
