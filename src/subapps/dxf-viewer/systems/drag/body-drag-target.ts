/**
 * BODY-DRAG TARGET RESOLVER — ADR (Entity Body-Drag: move / Ctrl-copy)
 *
 * Pure decision for "which entities travel when the user presses the mouse over
 * an entity body in select mode". AutoCAD/Figma semantics:
 *   - press over a SELECTED entity → drag the WHOLE current selection
 *   - press over an UNSELECTED entity → adopt just that entity (Figma-style)
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
}

/**
 * Returns the entity ids to drag, or `null` when no body-drag should start.
 */
export function resolveBodyDragTarget(input: BodyDragTargetInput): string[] | null {
  const { hoveredEntityId, isSelected, selectedIds } = input;
  if (!hoveredEntityId) return null;

  if (isSelected(hoveredEntityId)) {
    // Grab the whole selection (the hovered entity is part of it).
    return selectedIds.length > 0 ? [...selectedIds] : [hoveredEntityId];
  }
  // Hovered but not selected → adopt just this entity.
  return [hoveredEntityId];
}
