/**
 * ADR-364 — Escape Priority SSoT (DXF Viewer)
 *
 * Single source of truth for ESC dispatch priorities. EVERY registration with
 * the EscapeCommandBus MUST use a constant from this file — never raw numbers.
 *
 * Industry parallel: AutoCAD command-line precedence, Revit modal-stack
 * Esc semantics, Google Docs / VSCode "command bus" — when multiple things
 * could respond to ESC, the most-modal / most-immediate context wins.
 *
 * Higher number = runs first. Gaps of 50 leave room for future insertions
 * without renumbering the entire chain.
 */

export const ESC_PRIORITY = {
  /**
   * P1000 — Hard-modal dialog / overlay above the canvas.
   *
   * Examples: TextEditorOverlay (editing a text/mtext entity), MirrorConfirmOverlay
   * (Yes/No keep originals), DimStyleCreateDialog, modal property editors.
   */
  MODAL_DIALOG: 1000,

  /**
   * P950 — Canvas Numeric Input (ADR-189).
   *
   * Floating numeric entry that intercepts digits during drag/measure flows.
   * Must beat Dynamic Input because numeric input is fully owned by the canvas.
   */
  CANVAS_NUMERIC: 950,

  /**
   * P900 — Dynamic Input (AutoCAD-style cursor-anchored prompt).
   *
   * `allowWhenEditable: true` — owns ESC while the dynamic input field has focus.
   */
  DYNAMIC_INPUT: 900,

  /**
   * P800 — Popover / dropdown.
   *
   * Ribbon split dropdown, layer-state dropdown, grip context menu,
   * quick-properties mini-panel, selection-cycling popover.
   */
  POPOVER_DROPDOWN: 800,

  /**
   * P750 — Command line (ADR-357 Phase 14-B).
   *
   * Visible command-line input prompt — ESC clears buffer + hides prompt.
   */
  COMMAND_LINE: 750,

  /**
   * P700 — Selection cycling (Shift+Space hover-and-pick popover).
   */
  SELECTION_CYCLING: 700,

  /**
   * P650 — Crop tool in-progress (polygon-crop, lasso-crop).
   *
   * Cancels the half-drawn crop region.
   */
  CROP_TOOL: 650,

  /**
   * P600 — Modify tool active.
   *
   * Move, mirror, scale, stretch, mstretch, trim, extend, array-polar,
   * array-path, rotation. AutoCAD parity: ESC exits the active command entirely.
   */
  MODIFY_TOOL: 600,

  /**
   * P550 — Dim tool active (ADR-362 family).
   *
   * dim-smart, dim-linear, dim-aligned, dim-angular2L, dim-angular3P,
   * dim-radius, dim-diameter, dim-arc-length, dim-jogged-radius,
   * dim-ordinate, dim-baseline, dim-continued.
   */
  DIM_TOOL: 550,

  /**
   * P500 — Drawing tool active (entity-creation tools).
   *
   * line, polyline, polygon, rectangle, circle, stair, wall, column, beam,
   * slab, slab-opening, opening, measure-area, measure-distance, measure-angle.
   */
  DRAW_TOOL: 500,

  /**
   * P450 — Unified grip interaction (mid-drag / following-cursor).
   *
   * Reverts grip drag back to idle.
   */
  GRIP_DRAG: 450,

  /**
   * P400 — Draft polygon non-empty.
   *
   * Clears in-progress polygon points that aren't yet a saved overlay.
   */
  DRAFT_POLYGON: 400,

  /**
   * P350 — Overlay draw mode active (no draft points yet).
   *
   * Exits overlay draw-mode and returns to overlay-select.
   */
  OVERLAY_DRAW_MODE: 350,

  /**
   * P300 — Grip selection non-empty.
   *
   * Clears selected grips while leaving entity selection intact.
   */
  GRIP_SELECTION: 300,

  /**
   * P250 — Entity selection non-empty (DXF + overlays).
   *
   * AutoCAD/BricsCAD pattern: ESC deselects after all higher contexts cleared.
   */
  ENTITY_SELECTION: 250,

  /**
   * P150 — Keyboard focus ring active (ADR-366 Phase 4.6 / A.7.Q1).
   *
   * Cross-mode: 2D + 3D viewers each own a `KeyboardFocusManager` instance.
   * ESC clears the focus ring without touching the selection set — runs after
   * entity selection so selection-clear still has its own slot at P250.
   */
  FOCUS_CLEAR: 150,

  /**
   * P100 — Fallback: close color/menu palette.
   *
   * Lowest priority — runs only when nothing else claimed the ESC.
   */
  COLOR_MENU: 100,
} as const;

/**
 * Type helper — all valid priority values.
 * Use in handler signatures to forbid arbitrary numbers at the call site.
 */
export type EscapePriority = (typeof ESC_PRIORITY)[keyof typeof ESC_PRIORITY];
