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
   * P975 — Active hot-grip operation (ADR-397).
   *
   * While the user is mid hot-grip (the AutoCAD click-flow move / corner / rotate,
   * including the rotate FREE spin AND the «R» 6-click reference sub-steps), ESC
   * cancels THAT operation before any tool / numeric handler can claim it. The
   * grip flow spans multiple clicks with `activeTool` still 'select', so a stray
   * tool handler must never win the ESC. Second only to a hard modal dialog.
   */
  HOT_GRIP_OP: 975,

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
   * P525 — Wall tool incremental-back (ADR-363 Phase 1H).
   *
   * Straight-wall 3-click flow only: while in `awaitingAlignment` (end picked,
   * side not yet picked), ESC steps back to `awaitingEnd` so the user can
   * re-pick the end instead of cancelling the whole tool. Must beat DRAW_TOOL
   * (500) so the generic "cancel drawing" handler does not deactivate the tool
   * first. Revit "Modify | Place Wall" parity: Esc backs out one pick at a time.
   */
  WALL_ALIGNMENT_BACK: 525,

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
   * P425 — Entity body-drag in progress (AutoCAD/Figma move / Ctrl-copy).
   *
   * Grabbing an entity on its body (not a grip) in select mode and dragging it.
   * ESC aborts the in-flight body drag with no commit — sibling of GRIP_DRAG,
   * placed just below it (the two gestures are mutually exclusive). Must beat
   * ENTITY_SELECTION (250) so ESC cancels the drag before it deselects.
   */
  BODY_DRAG: 425,

  /**
   * P420 — 3D BIM edit gizmo mounted (ADR-402 §Sub-Phase 2 → ADR-364 §10.13).
   *
   * First rung of the 3D ladder: ESC tears the move/rotate gizmo down and LEAVES the
   * selection intact, so the next ESC deselects (Revit «Modify» parity — Esc backs out
   * one context at a time). Below {@link BODY_DRAG} (425) so an in-flight 3D marquee
   * still aborts first.
   *
   * ⚠️ WHY 420 AND NOT THE 250-300 BAND (measured 2026-07-25, ADR-364 §10.13):
   * the gizmo is **auto-on-selection** (`use-bim3d-edit-interaction.ts` §syncFromSelection:
   * «a 3D BIM selection mounts the gizmo»). Gizmo mounted ⟹ a selection exists ⟹ the
   * composite deselect `canvas/fallback-deselect` at {@link DRAFT_POLYGON} (400) always
   * reports `canHandle === true` — and it is mounted in 3D too (`BimViewport3D` is a leaf
   * INSIDE `CanvasLayerStack`). Any gizmo slot below 400 is therefore **structurally
   * unreachable**: it would be dead code from birth. Measured, not assumed.
   */
  EDIT_GIZMO_3D: 420,

  /**
   * P415 — Stair sub-element drill-in active (ADR-358 Q19 «click-into components»).
   *
   * ESC steps OUT of the selected tread/riser/landing/waist back to the whole stair —
   * same «exit one level» semantics as {@link GROUP_EXIT} / {@link BLOCK_EDITOR_EXIT}.
   * Runs after {@link EDIT_GIZMO_3D}, preserving the legacy dispatcher order (the edit
   * branch ran before the stair-sub branch in `dispatchShortcut`).
   *
   * ⚠️ WHY NOT NEXT TO GROUP_EXIT (275) despite the identical semantics: the stair-sub
   * store is documented as «Cleared whenever the whole-entity selection moves away from
   * `stairId` or is dropped» — a sub-selection therefore ALWAYS coexists with the stair
   * being selected, so the 400 composite deselect would shadow it exactly as it would
   * shadow the gizmo. GROUP_EXIT/BLOCK_EDITOR_EXIT survive at 274/275 only because
   * entering a group / block editor does not by itself leave an entity selected.
   */
  STAIR_SUB_EXIT: 415,

  /**
   * P410 — 3D selection non-empty (ADR-402 / ADR-364 §10.13).
   *
   * Last rung of the 3D ladder: clears `Selection3DStore`, which cascades to the
   * universal selection through the EXISTING one-way bridge
   * (`use-3d-selection-universal-bridge`) — one action, both stores, zero new sync path.
   *
   * Sits just above the 2D composite deselect at {@link DRAFT_POLYGON} (400) and is
   * mode-gated to 3D, so in 2D the composite keeps owning deselect unchanged; there is
   * no tie and no double-clear.
   */
  SELECTION_3D_CLEAR: 410,

  /**
   * P400 — Draft polygon non-empty.
   *
   * ⚠️ Despite the name this is the LIVE canonical deselect: `canvas/fallback-deselect`
   * (`useCanvasEscapeRegistrations`) is a COMPOSITE handler — draft polygon + overlay
   * draw-mode + grip selection + **entity selection**, all on one press, mirroring the
   * legacy switch. {@link ENTITY_SELECTION} (250) below is documentation only; nothing
   * registers against it (verified 2026-07-25). Read this before assuming the deselect
   * rung lives at 250.
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
   * P275 — Active group drill-in (ADR-575 §enter-group).
   *
   * While INSIDE a group (Revit «Edit Group» / Figma), ESC steps OUT one level and
   * re-selects the exited group — BEFORE the plain deselect at ENTITY_SELECTION (250),
   * so the first ESC leaves the group (selecting it) and the next ESC deselects it.
   * Below GRIP_SELECTION (300) so clearing selected grips still wins first.
   */
  GROUP_EXIT: 275,

  /**
   * P274 — Active Block Editor (BEDIT) drill-in (ADR-641 §3).
   *
   * The BLOCK twin of {@link GROUP_EXIT}: while INSIDE a Block Editor (double-clicked a
   * block → exclusive block-local canvas), ESC closes the editor and re-selects the exited
   * block — BEFORE the plain deselect at ENTITY_SELECTION (250), so the first ESC leaves the
   * editor (block selected) and the next ESC deselects it. Below GRIP_SELECTION (300) so
   * clearing member grips still wins first. Mutually exclusive with GROUP_EXIT (a block and a
   * group are never entered at the same time), so the exact relative order to 275 never binds.
   */
  BLOCK_EDITOR_EXIT: 274,

  /**
   * P250 — Entity selection non-empty (DXF + overlays).
   *
   * AutoCAD/BricsCAD pattern: ESC deselects after all higher contexts cleared.
   *
   * ⚠️ **NO REGISTRATION USES THIS** (verified by grep 2026-07-25). The live deselect is
   * the composite `canvas/fallback-deselect` at {@link DRAFT_POLYGON} (400). The constant
   * is kept because several handler docs describe their own placement relative to it, but
   * it is a documentation landmark, NOT the rung the chain actually executes. Do not
   * derive a new handler's priority from it — derive it from 400.
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
