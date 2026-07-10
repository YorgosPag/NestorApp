/**
 * ADR-363 Phase 1G + ADR-397 — BIM hot-grip state-machine decisions (pure,
 * entity-agnostic).
 *
 * AutoCAD "hot grip" pattern: 1st click activates move mode (not drag), the
 * cursor tracks live (rubber-band + ghost), subsequent clicks pick points and
 * the terminal click commits. Press-drag-release is replaced ONLY for the kinds
 * registered in {@link HOT_GRIP_OP_REGISTRY} — every other grip stays drag.
 *
 * ADR-397: generalized from wall-only to ALL BIM entities (wall corners/move/
 * rotate + column center/rotation + future). The step engine was already
 * entity-agnostic; only the kind→op mapping is now a shared registry so a new
 * entity opts in by adding rows, never by forking this FSM.
 *
 * Zero React / DOM / store deps — decisions live here so they unit-test
 * independently of the `useUnifiedGripInteraction` wiring.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md §12 D2
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1G
 */

import type { WallGripKind } from '../useGripMovement';
import type { UnifiedGripInfo, UnifiedGripPhase } from './unified-grip-types';

/** Τα 4 corner grip kinds που υποστηρίζουν hot-grip (asymmetric corner drag, Phase 1C-bis). */
export const WALL_CORNER_GRIP_KINDS: readonly WallGripKind[] = [
  'wall-corner-start-pos',
  'wall-corner-start-neg',
  'wall-corner-end-pos',
  'wall-corner-end-neg',
] as const;

/** True μόνο για τα 4 wall corner grip kinds — αυτά παίρνουν 2-click hot-grip. */
export function isWallCornerGripKind(kind: string | undefined | null): boolean {
  return kind != null && (WALL_CORNER_GRIP_KINDS as readonly string[]).includes(kind);
}

/**
 * ADR-363 Phase 1G — hot-grip operation flavours:
 *  - `'corner'` → 2-click (the grip itself is the anchor; wall Phase 1C-bis corners).
 *  - `'move'`   → 3-click (move glyph): click glyph → pick base point → move
 *                 (rubber-band base→cursor) → commit (whole-entity translate).
 *  - `'rotate'` → 6-click AutoCAD ROTATE→Reference (rotation glyph): click glyph →
 *                 pick centre → reference line (2 pts) → alignment line (2 pts).
 *  - `'endpoint-stretch'` → 2-click plain-LINE endpoint reshape (ADR-513 §grip-parity):
 *                 click the endpoint (release the button) → the end follows the cursor
 *                 button-UP → click to place. Same shape as `'corner'` (the grabbed grip
 *                 is the anchor, `tracking` is terminal) so the «Δαχτυλίδι Εντολών» wedges
 *                 are clickable while the button is free. Entered bespoke (the endpoint grip
 *                 carries NO kind, so it is absent from {@link HOT_GRIP_OP_REGISTRY}) only
 *                 when Dynamic Input is ON; otherwise the endpoint stays press-drag.
 */
export type WallHotGripOp = 'corner' | 'move' | 'rotate' | 'endpoint-stretch';

/**
 * ADR-397 §12 D2 — single registry mapping a grip KIND (any BIM entity) to its
 * hot-grip operation. A kind absent here stays press-drag-release. Add rows to
 * opt an entity's grip in — never fork the FSM.
 */
export const HOT_GRIP_OP_REGISTRY: Readonly<Record<string, WallHotGripOp>> = {
  // Walls (ADR-363 Phase 1G)
  'wall-corner-start-pos': 'corner',
  'wall-corner-start-neg': 'corner',
  'wall-corner-end-pos': 'corner',
  'wall-corner-end-neg': 'corner',
  'wall-midpoint': 'move',
  'wall-rotation': 'rotate',
  // Stairs (ADR-393 Phase C, 2026-07-10) — full wall parity for the STRAIGHT variant:
  // the centre `stair-base` cross = MOVE (3-click move + per-arm directional),
  // `stair-direction` = ROTATION (6-click reference / free spin around a picked pivot).
  // Without these rows the move-popup + rotation flow never arm (they stay press-drag).
  // The 4 corners + 4 mid-edges resize via the shared axis-box engine on press-drag
  // (absent here on purpose — resize is a plain drag, like the wall corners' 2-click is
  // opt-in only where asymmetric-anchor matters; the stair keeps them press-drag).
  'stair-base': 'move',
  'stair-direction': 'rotate',
  // Beams (ADR-363 Phase 5.5d) — axis-based wall parity: midpoint MOVE (3-click),
  // rotation REFERENCE (6-click). Start/end/curve/width/depth stay press-drag.
  'beam-midpoint': 'move',
  'beam-rotation': 'rotate',
  // Columns (ADR-397) — center MOVE (3-click), rotation REFERENCE (6-click)
  'column-center': 'move',
  'column-rotation': 'rotate',
  // Foundations (ADR-436 Slice 1b) — pad: rotation REFERENCE (6-click). center
  // MOVE (Alt+drag, not emitted). width/length stay press-drag.
  'foundation-center': 'move',
  'foundation-rotation': 'rotate',
  // MEP fixtures (ADR-406) — full wall parity: move MOVE (3-click), rotation
  // REFERENCE (6-click), 4 corners 2-click. Diameter (circular) stays press-drag.
  'mep-fixture-move': 'move',
  'mep-fixture-rotation': 'rotate',
  'mep-fixture-corner-ne': 'corner',
  'mep-fixture-corner-nw': 'corner',
  'mep-fixture-corner-sw': 'corner',
  'mep-fixture-corner-se': 'corner',
  // Electrical panels (ADR-408 Φ3) — full wall parity (rectangular-only): move
  // MOVE (3-click), rotation REFERENCE (6-click), 4 corners 2-click.
  'electrical-panel-move': 'move',
  'electrical-panel-rotation': 'rotate',
  'electrical-panel-corner-ne': 'corner',
  'electrical-panel-corner-nw': 'corner',
  'electrical-panel-corner-sw': 'corner',
  'electrical-panel-corner-se': 'corner',
  // MEP manifolds (ADR-408 Φ12) — full wall parity (rectangular-only): move
  // MOVE (3-click), rotation REFERENCE (6-click), 4 corners 2-click.
  'mep-manifold-move': 'move',
  'mep-manifold-rotation': 'rotate',
  'mep-manifold-corner-ne': 'corner',
  'mep-manifold-corner-nw': 'corner',
  'mep-manifold-corner-sw': 'corner',
  'mep-manifold-corner-se': 'corner',
  // MEP segments (ADR-408 Φ8) — linear element beam parity: midpoint MOVE (3-click),
  // rotation REFERENCE (6-click). Start/end/section stay press-drag (no hot-grip).
  'mep-segment-midpoint': 'move',
  'mep-segment-rotation': 'rotate',
  // Furniture (ADR-410) — full wall parity (rectangular-only): move MOVE (3-click),
  // rotation REFERENCE (6-click), 4 corners 2-click.
  'furniture-move': 'move',
  'furniture-rotation': 'rotate',
  'furniture-corner-ne': 'corner',
  'furniture-corner-nw': 'corner',
  'furniture-corner-sw': 'corner',
  'furniture-corner-se': 'corner',
  // Floorplan symbols (ADR-415) — full wall parity: move MOVE (3-click),
  // rotation REFERENCE (6-click), 4 corners 2-click. Status-bar prompts inherited.
  'floorplan-symbol-move': 'move',
  'floorplan-symbol-rotation': 'rotate',
  'floorplan-symbol-corner-ne': 'corner',
  'floorplan-symbol-corner-nw': 'corner',
  'floorplan-symbol-corner-sw': 'corner',
  'floorplan-symbol-corner-se': 'corner',
  // Plain DXF line (ADR-363 Slice F/G.5) — rotation REFERENCE (6-click) / free spin
  // + the ¼-west MOVE cross (3-click move + per-arm directional click→distance),
  // full wall parity. The line's endpoint + centre-midpoint grips stay press-drag.
  'line-rotation': 'rotate',
  'line-move': 'move',
  // Plain DXF primitives (ADR-561) — full wall parity for the whole-entity handles.
  // Circle = ΜΟΝΟ move (συμμετρικός). Arc + polyline (incl. rectangle) = move (3-click
  // + per-arm directional) + rotate (6-click reference / free spin). Vertex / quadrant /
  // edge / arc-apex grips stay press-drag (absent here).
  'circle-move': 'move',
  'arc-move': 'move',
  'arc-rotation': 'rotate',
  'polyline-move': 'move',
  'polyline-rotation': 'rotate',
  // Hatch (ADR-627) — whole-hatch handles on the outer boundary ring, FULL parity με το
  // περίγραμμα εμβαδού / polyline: move MOVE (3-click + per-arm directional) + rotation
  // (6-click reference / free spin). Vertex / edge-midpoint / gradient grips stay press-drag.
  'hatch-move': 'move',
  'hatch-rotation': 'rotate',
  // Text / MText (ADR-557) — full rect-box parity with the column: centre MOVE
  // (3-click move + per-arm directional) + rotation (6-click reference / free
  // spin). The 4 corners + 4 edge midpoints stay press-drag (absent here).
  'text-move': 'move',
  'text-rotation': 'rotate',
  // GROUP gizmo (ADR-575 §8) — the whole-group move cross + rotation handle, full
  // wall parity: move MOVE (3-click) + rotation REFERENCE (6-click) / free spin. The
  // commit recurses the group members (`calculateMovedGeometry` / `rotateEntity`).
  'group-move': 'move',
  'group-rotation': 'rotate',
  // Annotation symbol (ADR-583) — North arrow: move cross (3-click move + per-arm
  // directional) + rotation (6-click reference / free spin), full parity με τον arc.
  // NO resize (fixed aspect, D5).
  'annotation-symbol-move': 'move',
  'annotation-symbol-rotation': 'rotate',
  // Graphic scale-bar (ADR-583 Φ2/Φ3) — the ROTATION handle opts into the SAME hot-grip
  // rotate flow as the arc/annotation-symbol (Giorgio 2026-07-09: «να λειτουργεί όπως τα άλλα»
  // — click → armed/κόκκινο → όρισε κέντρο → free spin, ΟΧΙ press-drag). The bar orbits the
  // picked centre (position + angleRad) via the pivot-aware `applyScaleBarGripDrag`. The
  // move/length/length-start/height handles stay press-drag (absent here).
  'scale-bar-rotation': 'rotate',
  // Opening info tag (ADR-612, Giorgio 2026-07-09 «όπως ο τοίχος») — the rotation handle opts into
  // the SAME click-armed hot-grip rotate flow (click → armed/κόκκινο → όρισε κέντρο → free spin, ΟΧΙ
  // press-drag). The box orbits the picked centre (position + angleRad) via the pivot-aware
  // `applyOpeningInfoTagGripDrag`. The move/size handles stay press-drag (absent here).
  'opening-info-tag-rotation': 'rotate',
} as const;

/** Map any grip kind to its hot-grip operation, or null if it stays drag. */
export function hotGripOpForKind(kind: string | undefined | null): WallHotGripOp | null {
  if (kind == null) return null;
  return HOT_GRIP_OP_REGISTRY[kind] ?? null;
}

/** True for any grip kind that uses the hot-grip (click-click) flow. */
export function isWallHotGripKind(kind: string | undefined | null): boolean {
  return hotGripOpForKind(kind) !== null;
}

/**
 * ADR-397 — read the parametric grip kind from a unified grip regardless of which
 * BIM entity owns it (wall / column / stair are mutually exclusive discriminators).
 * Entity-agnostic key for the hot-grip routing in `grip-mouse-handlers`.
 */
export function hotGripKindOf(grip: UnifiedGripInfo | null | undefined): string | undefined {
  if (!grip) return undefined;
  // ADR-561 — circle/arc/polyline discriminators join the chain so their
  // move/rotation handles opt into the shared hot-grip flow. Non-hot polyline
  // kinds (vertex / segment-midpoint / arc-apex) resolve to a string that is
  // simply absent from HOT_GRIP_OP_REGISTRY → `hotGripOpForKind` returns null
  // (stays press-drag), so widening the chain is safe.
  // ADR-557 — `textGripKind` joins the chain so the text centre-move + rotation
  // handles opt into the shared hot-grip flow (3-click move / free-rotate + «R»
  // reference), IDENTICAL to the column. The non-hot text kinds (corner / edge
  // resize) resolve to a string simply absent from HOT_GRIP_OP_REGISTRY → they
  // stay press-drag, so widening the chain is safe.
  // ADR-575 §8 — `groupGripKind` joins the chain so the whole-group move + rotation
  // handles opt into the shared hot-grip flow (3-click move / free-rotate + «R»
  // reference), IDENTICAL to the line/column. The group is the sole owner of this kind.
  // ADR-583 — `annotationSymbolGripKind` joins the chain so the North arrow's move +
  // rotation handles opt into the shared hot-grip flow (IDENTICAL to the arc). The
  // symbol is the sole owner of this kind.
  // ADR-602 Stage 4 — the 18-entity `??` chain collapses to the ONE tagged
  // discriminator: `gripKind.kind` is whatever kind this grip carries, entity-agnostic
  // (same runtime result under the Stage-1/3 dual-write invariant). Non-hot kinds
  // resolve to a string absent from HOT_GRIP_OP_REGISTRY → `hotGripOpForKind` returns
  // null (stays press-drag), so widening to all 31 entities is safe.
  return grip.gripKind?.kind;
}

/**
 * Hot-grip step within `phase === 'hotGrip'`. Each pick step waits for one
 * deliberate (moved) click; the terminal step's click commits.
 *
 *  - `'await-base'`        → move/rotate: pick the base point (move) / rotation
 *                            centre (rotate). No preview yet.
 *  - `'tracking'`          → move/corner terminal: anchor established, cursor
 *                            moves drive the live ghost + leader; next click commits.
 *  - `'rotate-free'`       → rotate terminal (ADR-397, Revit/AutoCAD default): the
 *                            centre is locked, the entity spins live with the cursor
 *                            (rubber-band sweep measured from the first move so it
 *                            starts at 0, no jump); next click commits. Pressing «R»
 *                            opts into the 6-click reference flow below.
 *  - `'await-ref-start'`   → rotate-reference (opt-in via «R»): pick the 1st point of
 *                            the existing (reference) line.
 *  - `'await-ref-end'`     → rotate-reference: pick the 2nd point of the reference
 *                            line (rubber-band start→cursor). Fixes the reference angle.
 *  - `'await-align-start'` → rotate-reference: pick the 1st point of the alignment
 *                            (target) line.
 *  - `'await-align-end'`   → rotate-reference terminal: pick the 2nd alignment
 *                            point (wall rotates live: align angle − reference
 *                            angle, around the centre). Next click commits.
 *
 * Rotate (ADR-397) defaults to the Revit/AutoCAD FREE rotate (glyph → centre →
 * spin live → click): `await-base → rotate-free` (terminal). Pressing «R» during
 * `rotate-free` jumps to the legacy "ROTATE → Reference" flow (glyph → centre →
 * reference line 2 clicks → alignment line 2 clicks) — opt-in, never lost.
 */
export type HotGripStep =
  | 'await-base'
  | 'tracking'
  | 'rotate-free'
  | 'await-ref-start'
  | 'await-ref-end'
  | 'await-align-start'
  | 'await-align-end';

/**
 * Corners AND plain-line endpoint reshape (ADR-513) anchor on the grabbed grip itself
 * (straight to the terminal `tracking` step — 2-click); move/rotate must pick a base first.
 */
export function initialHotGripStep(op: WallHotGripOp): HotGripStep {
  return op === 'corner' || op === 'endpoint-stretch' ? 'tracking' : 'await-base';
}

/**
 * ADR-397 — «R» during free rotate opts into the 6-click AutoCAD ROTATE→Reference
 * flow. Pure predicate (no heavy deps), so the keyboard wiring stays testable here
 * alongside the rest of the hot-grip decision SSoT.
 */
export function isReferenceFlowKey(key: string): boolean {
  return key === 'r' || key === 'R';
}

/**
 * Next step after a deliberate (moved) click during `step` for operation `op`.
 * Returns the SAME step when `step` is the terminal step for that op (the click
 * is a commit, not an advance). Pure table:
 *   corner: tracking (terminal)
 *   move:   await-base → tracking (terminal)
 *   rotate: await-base → rotate-free (terminal — Revit/AutoCAD free rotate default).
 *           «R» re-routes to: await-ref-start → await-ref-end → await-align-start
 *           → await-align-end (terminal — opt-in 6-click reference flow).
 */
export function advanceHotGripStep(op: WallHotGripOp, step: HotGripStep): HotGripStep {
  if (op === 'rotate') {
    switch (step) {
      // ADR-397 — centre picked → FREE rotate by default (terminal: click commits).
      // The «R» key handler re-routes to 'await-ref-start' for the reference flow.
      case 'await-base': return 'rotate-free';
      case 'rotate-free': return 'rotate-free';     // terminal (Revit/AutoCAD free rotate)
      case 'await-ref-start': return 'await-ref-end';
      case 'await-ref-end': return 'await-align-start';
      case 'await-align-start': return 'await-align-end';
      default: return step; // await-align-end = terminal
    }
  }
  if (op === 'move' && step === 'await-base') return 'tracking';
  return step; // move/corner/endpoint-stretch tracking = terminal
}

/**
 * Απόφαση για mousedown πάνω σε grip:
 *  - `'consume'` → ήδη σε hot-grip· το mousedown είναι το 2ο κλικ. Καταναλώνεται
 *    για να μη οπλίσει lasso/selection· ο commit γίνεται στο επόμενο mouseup.
 *  - `'enter'`   → δεν είμαστε σε hot-grip και το grip είναι corner → μπες σε hot-grip.
 *  - `'none'`    → δεν αφορά hot-grip· ο caller συνεχίζει με το κανονικό drag path.
 */
export type HotGripMouseDownAction = 'enter' | 'consume' | 'none';

export function resolveHotGripMouseDown(
  phase: UnifiedGripPhase,
  hitGripKind: string | undefined | null,
): HotGripMouseDownAction {
  if (phase === 'hotGrip') return 'consume';
  if (isWallHotGripKind(hitGripKind)) return 'enter';
  return 'none';
}

/**
 * Απόφαση για mouseup ενώ είμαστε σε hot-grip. Σειρά αξιολόγησης:
 *   none → arm → stay → (advance | commit)
 *
 *  - `'arm'`     → release του 1ου κλικ (awaitingFirstRelease) → μένει hot.
 *  - `'stay'`    → release ΧΩΡΙΣ ενδιάμεση κίνηση κέρσορα (`!movedSinceArm`) →
 *                  stray/redundant release (π.χ. 2ο fire του διπλού canvas+
 *                  container mouseup του ίδιου tick). Μένει hot, ΔΕΝ ορίζει σημείο
 *                  και ΔΕΝ κάνει commit/reset. Ισχύει για ΚΑΘΕ step.
 *  - `'advance'` → deliberate (moved) click σε μη-terminal step → ορίζει το σημείο
 *                  του τρέχοντος step (base/centre/ref/align) και προχωρά step.
 *  - `'commit'`  → deliberate (moved) click στο terminal step → οριστικοποίηση + reset.
 *  - `'none'`    → δεν είμαστε σε hot-grip· ο caller συνεχίζει με το κανονικό path.
 *
 * Το `'stay'`-πριν-`'advance'/'commit'` guard λύνει το διπλό-fire bug: το async
 * `handleMouseUp` κάνει το `finally` (mutex release) σύγχρονα, οπότε το 2ο mouseup
 * fire του ίδιου tick δεν μπλοκάρεται. Χωρίς αυτό κάθε κλικ θα «έκαιγε» 2 βήματα.
 * Ο `movedSinceArm` (που ανεβαίνει μόνο σε πραγματικό mousemove, ΟΧΙ στο same-tick
 * double fire) ξεχωρίζει το αληθινό deliberate κλικ από το stray release.
 *
 * Το terminal step ανά op προκύπτει από το `advanceHotGripStep` (terminal ⇔ το
 * επόμενο step ισούται με το τρέχον).
 */
export type HotGripMouseUpAction = 'arm' | 'advance' | 'stay' | 'commit' | 'none';

export function resolveHotGripMouseUp(
  op: WallHotGripOp | null,
  phase: UnifiedGripPhase,
  awaitingFirstRelease: boolean,
  step: HotGripStep,
  movedSinceArm: boolean,
): HotGripMouseUpAction {
  if (phase !== 'hotGrip') return 'none';
  if (awaitingFirstRelease) return 'arm';
  if (!movedSinceArm) return 'stay';
  if (op === null) return 'commit';
  return advanceHotGripStep(op, step) === step ? 'commit' : 'advance';
}
