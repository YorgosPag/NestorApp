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
   * P990 — **Εστιασμένη** αιωρούμενη παλέτα (ADR-723).
   *
   * Modeless παλέτες (Διαχειριστής Στρώσεων, Visibility/Graphics, Clash Report): μένουν
   * ανοιχτές ΕΝΩ ο χρήστης δουλεύει στον καμβά.
   *
   * ⚠️ ΚΑΘΕ handler σε αυτό το σκαλί ΟΦΕΙΛΕΙ να ελέγχει στο `canHandle()` ότι η εστίαση
   * βρίσκεται **μέσα** στην παλέτα. Χωρίς αυτόν τον έλεγχο, μια ανοιχτή παλέτα θα κατανάλωνε
   * **κάθε** ESC της εφαρμογής — δηλαδή θα σκότωνε το «ακύρωση εντολής / αποεπιλογή», που
   * είναι το συχνότερο πλήκτρο του καμβά. Αυτό ακριβώς είναι η παλινδρόμηση §10.12 του
   * ADR-364, σε νέα συσκευασία.
   *
   * ── ΓΙΑΤΙ ΠΑΝΩ ΑΠΟ ΤΟ {@link HOT_GRIP_OP} ──
   *
   * Επειδή το `canHandle()` είναι **αμοιβαία αποκλειστικό** με κάθε χειρισμό καμβά: αν η
   * εστίαση είναι στην παλέτα, ο χρήστης δεν κρατά grip. Άρα η σχετική σειρά δεν δεσμεύει
   * ποτέ στην πράξη· τοποθετείται ψηλά ώστε να διαβάζεται ως «όταν όντως ισχύει, κερδίζει».
   *
   * ── ΓΙΑΤΙ ΟΧΙ {@link MODAL_DIALOG} ──
   *
   * Το P1000 σημαίνει «ο καμβάς είναι μπλοκαρισμένος». Μια παλέτα δεν μπλοκάρει τίποτα· να
   * μοιράζεται σκαλί με τα hard-modal θα έκρυβε ακριβώς τη διαφορά που ορίζει το ADR-723.
   */
  FOCUSED_PALETTE: 990,

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
   * P505 — Zoom-window tool active (ADR-364 §10.14, Κ2 #11).
   *
   * ESC aborts the in-flight zoom rectangle AND exits the tool back to 'select'.
   *
   * ⚠️ WHY THIS IS NOT {@link DRAW_TOOL} (500): that slot's gate is
   * `isInteractiveTool(activeTool)`, which reads `category` from `TOOL_DEFINITIONS`
   * and matches only 'drawing' + 'measurement'. `zoom-window` is declared
   * `category: 'zoom'` (`systems/tools/tool-definitions.ts`) — so it is *explicitly*
   * outside that gate. Widening `isInteractiveTool` to admit it would silently give
   * ESC-cancel semantics to zoom-in / zoom-out / zoom-extents as well, and would
   * change what "interactive" means for every other consumer of that SSoT predicate.
   * A dedicated sibling slot is the narrow fix. Placed just above DRAW_TOOL because
   * the two gates are mutually exclusive — the exact relative order never binds.
   */
  ZOOM_WINDOW_TOOL: 505,

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
   * ⚠️ WHY IT HAD TO GO ABOVE 400 despite the identical «exit one level» semantics: the
   * stair-sub store is documented as «Cleared whenever the whole-entity selection moves
   * away from `stairId` or is dropped» — a sub-selection therefore ALWAYS coexists with
   * the stair being selected, so the 400 composite deselect would shadow it exactly as it
   * would shadow the gizmo.
   *
   * 📌 CORRECTION (2026-07-25, ADR-364 §10.14): this comment used to add «GROUP_EXIT /
   * BLOCK_EDITOR_EXIT survive at 274/275 only because entering a group / block editor
   * does not by itself leave an entity selected». That was **wrong** — measured in the
   * browser, entering either one REQUIRES a selected container and never clears it, so
   * both were shadowed on the first press exactly like this slot would have been. They
   * now sit at 408 / 407; see {@link GROUP_EXIT} for the measurement.
   */
  STAIR_SUB_EXIT: 415,

  /**
   * P414 — «Τμήμα» (κοντόστυλο) drill-in active (ADR-715, Revit Parts).
   *
   * ESC βγαίνει από το επιλεγμένο Τμήμα πίσω στην ΟΛΟΚΛΗΡΗ κολώνα — ίδια «exit one level»
   * σημασιολογία με το {@link STAIR_SUB_EXIT}, και για τον ίδιο λόγο **πάνω από το 400**: το
   * Τμήμα συνυπάρχει ΠΑΝΤΑ με την host κολώνα επιλεγμένη (ο pointer handler την επιλέγει ως
   * context· ο lifecycle guard καθαρίζει το Τμήμα μόλις πάψει να είναι), άρα ο σύνθετος
   * αποεπιλογέας στο {@link DRAFT_POLYGON} (400) θα σκίαζε αυτό το slot στο πρώτο πάτημα.
   *
   * ⚠️ Ξεχωριστό slot και όχι επαναχρησιμοποίηση του 415: τα δύο drill-downs είναι αμοιβαία
   * αποκλειόμενα (`exitSubElementSelections`), οπότε η σχετική τους σειρά δεν παίζει ρόλο
   * σήμερα — αλλά **δύο consumers στο ΙΔΙΟ priority** είναι ακριβώς το σχήμα που κάνει τη
   * σειρά εκτέλεσης να εξαρτάται από τη σειρά εγγραφής (mount order), δηλαδή μη-ντετερμινιστική.
   * Το ADR-364 έχει ήδη πληρώσει αυτό το μάθημα με τον ungated `focusClear`.
   */
  BURIED_PART_EXIT: 414,

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
   * P408 — Active group drill-in (ADR-575 §enter-group).
   *
   * While INSIDE a group (Revit «Edit Group» / Figma frame), ESC steps OUT one level
   * and re-selects the exited group, so the next ESC deselects it.
   *
   * ⚠️ MOVED 275 → 408 on 2026-07-25 (ADR-364 §10.14) AFTER LIVE MEASUREMENT.
   * At 275 it sat below the composite deselect at {@link DRAFT_POLYGON} (400), and the
   * old doc justified that with «entering a group does not by itself leave an entity
   * selected». **That claim was false.** Entering requires exactly one selected id
   * (`useCanvasSectionUI.ts` — `ids.length === 1`, double-click a SELECTED group) and
   * neither `enterGroup` nor `enterBlockEdit` touches the selection. Measured ladder
   * before the move (browser, real 131-entity group):
   *   1st ESC → `canvas/fallback-deselect` — status bar STILL «Επεξεργασία ομάδας ·
   *             Esc για έξοδο», i.e. the app's own on-screen promise was broken
   *   2nd ESC → `group/exit-active-group` — only now does it exit
   * The intermediate state (inside the group, nothing selected) serves no purpose and
   * contradicts the visible hint. Above 400 the first ESC exits, matching Revit «Edit
   * Group», Figma frame step-out and AutoCAD REFEDIT.
   */
  GROUP_EXIT: 408,

  /**
   * P407 — Active Block Editor (BEDIT) drill-in (ADR-641 §3).
   *
   * The BLOCK twin of {@link GROUP_EXIT}: ESC closes the editor and re-selects the
   * exited block. Moved 274 → 407 for exactly the same measured reason — entry is the
   * same «double-click a SELECTED block» path, so the 400 composite shadowed it too.
   * Mutually exclusive with GROUP_EXIT (a block and a group are never entered at the
   * same time), so the exact relative order to 408 never binds.
   */
  BLOCK_EDITOR_EXIT: 407,

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
   * P270 — Layering (overlay) tool exit (ADR-364 §10.14, Κ2 #12).
   *
   * ESC leaves the layering tool: cancels any draft overlay polygon and returns the
   * toolbar to 'select'.
   *
   * ⚠️ DELIBERATELY BELOW {@link DRAFT_POLYGON} (400), unlike {@link GROUP_EXIT} above —
   * and the difference is measured, not stylistic. Layering is a TOOL, not a container
   * drill-in: nothing on screen promises that one ESC exits it, and the pre-migration
   * owner (a private `window` capture listener in `app/useDxfViewerEffects.ts`) was
   * measured to fire ONLY when no bus slot consumed — `stopImmediatePropagation` cut it
   * otherwise (verified live: `command-line/dismiss` consumed, the tool stayed
   * «Επίπεδα»). Registering below 400 therefore preserves the shipped behaviour exactly:
   * with a selection the first ESC deselects, the second exits the tool.
   */
  LAYERING_EXIT: 270,

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
   */
  COLOR_MENU: 100,

  /**
   * P50 — LAST RESORT: return the toolbar to the 'select' tool (ADR-364 §10.14, Κ2 #13).
   *
   * AutoCAD's «ESC returns to the Command: prompt» / Revit's «Esc exits to Modify».
   * Higher rungs already do this for the tools they own — {@link MODIFY_TOOL} (600) via
   * each `handleXEscape`, {@link DRAW_TOOL} (500) via `onDrawingCancel`, and
   * {@link ZOOM_WINDOW_TOOL} (505). This slot is the safety net for the ~46 tools in the
   * 'editing' / 'utility' / 'zoom' / 'selection' categories that own no ESC slot at all
   * (pan, grip-edit, crop-window, match-properties, …), which would otherwise stay
   * active forever.
   *
   * ⚠️ WHY THE BOTTOM OF THE CHAIN, below even {@link COLOR_MENU} (100): its predecessor
   * — the raw `window` BUBBLE listener at `hooks/useDxfToolbarShortcuts.ts:215` — ran
   * only when the bus had consumed nothing (the bus's `stopImmediatePropagation` cut it
   * otherwise). Measured live 2026-07-25: in an idle 2D viewer it was THE `shadow-owner`
   * the dev audit reported, identified by stack trace. Registering at 50 reproduces that
   * position exactly, so nothing above it changes behaviour.
   *
   * ⚠️ MUST STAY GATED (`activeTool !== 'select'`). An ungated bottom slot is precisely
   * the §10.12 regression: it would consume every ESC in the application and make the
   * `shadow-owner` verdict unreachable again.
   */
  TOOL_RESET: 50,
} as const;

/**
 * Type helper — all valid priority values.
 * Use in handler signatures to forbid arbitrary numbers at the call site.
 */
export type EscapePriority = (typeof ESC_PRIORITY)[keyof typeof ESC_PRIORITY];
