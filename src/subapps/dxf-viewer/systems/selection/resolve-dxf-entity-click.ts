/**
 * resolve-dxf-entity-click — SSoT for "how a user CLICK on a DXF entity mutates the selection".
 *
 * ADR-543 — the 2D canvas (SelectionSystem.handleEntityClick) and the 3D viewport pick
 * (use-bim3d-pointer-handlers) must behave IDENTICALLY: AutoCAD PICKADD=1 semantics —
 *   · Shift+click           → toggle the entity in/out of the multi-selection
 *   · plain click, existing  → ADD without clearing (accumulate a multi-selection)
 *   · plain click, empty      → single select (replace)
 *
 * Previously this decision lived ONLY in `SelectionSystem.handleEntityClick`; the 3D DXF pick
 * duplicated it (badly — always replace, no Shift), so 3D could never multi-select two lines.
 * This pure function is now the ONE decision both viewports call, parameterised over the
 * concrete selection mutators (the 2D React context vs the `SelectedEntitiesStore` facade), so
 * there is no divergence.
 */

export interface DxfEntityClickOps {
  /** Add the entity if absent, remove it if present (Shift semantics). */
  toggle(entityId: string): void;
  /** Append the entity to the current selection without clearing (PICKADD). */
  add(entityId: string): void;
  /** Replace the whole selection with this single entity. */
  replaceWithSingle(entityId: string): void;
  /** True when this entity id is already selected. */
  isSelected(entityId: string): boolean;
  /** How many DXF entities are currently selected. */
  selectedDxfCount(): number;
}

/** Apply the shared click→selection decision (AutoCAD PICKADD=1). Pure routing — no state of its own. */
export function applyDxfEntityClickSelection(
  entityId: string,
  shiftKey: boolean,
  ops: DxfEntityClickOps,
): void {
  if (shiftKey) {
    ops.toggle(entityId);
    return;
  }
  if (ops.selectedDxfCount() > 0) {
    // PICKADD=1: an existing selection → add without clearing (accumulate).
    if (!ops.isSelected(entityId)) ops.add(entityId);
    return;
  }
  // No prior selection → single select (replace).
  ops.replaceWithSingle(entityId);
}
