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
 */
export type WallHotGripOp = 'corner' | 'move' | 'rotate';

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
  // Beams (ADR-363 Phase 5.5d) — axis-based wall parity: midpoint MOVE (3-click),
  // rotation REFERENCE (6-click). Start/end/curve/width/depth stay press-drag.
  'beam-midpoint': 'move',
  'beam-rotation': 'rotate',
  // Columns (ADR-397) — center MOVE (3-click), rotation REFERENCE (6-click)
  'column-center': 'move',
  'column-rotation': 'rotate',
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
  return grip.wallGripKind ?? grip.beamGripKind ?? grip.columnGripKind ?? grip.stairGripKind ?? grip.mepFixtureGripKind ?? grip.electricalPanelGripKind ?? grip.furnitureGripKind ?? grip.floorplanSymbolGripKind;
}

/**
 * Hot-grip step within `phase === 'hotGrip'`. Each pick step waits for one
 * deliberate (moved) click; the terminal step's click commits.
 *
 *  - `'await-base'`        → move/rotate: pick the base point (move) / rotation
 *                            centre (rotate). No preview yet.
 *  - `'tracking'`          → move/corner terminal: anchor established, cursor
 *                            moves drive the live ghost + leader; next click commits.
 *  - `'await-ref-start'`   → rotate-reference: pick the 1st point of the existing
 *                            (reference) line.
 *  - `'await-ref-end'`     → rotate-reference: pick the 2nd point of the reference
 *                            line (rubber-band start→cursor). Fixes the reference angle.
 *  - `'await-align-start'` → rotate-reference: pick the 1st point of the alignment
 *                            (target) line.
 *  - `'await-align-end'`   → rotate-reference terminal: pick the 2nd alignment
 *                            point (wall rotates live: align angle − reference
 *                            angle, around the centre). Next click commits.
 *
 * Rotate uses the AutoCAD "ROTATE → Reference" flow (6 clicks total): glyph →
 * centre → reference line (2 clicks) → alignment line (2 clicks). The wall spins
 * so the reference direction maps onto the alignment direction.
 */
export type HotGripStep =
  | 'await-base'
  | 'tracking'
  | 'await-ref-start'
  | 'await-ref-end'
  | 'await-align-start'
  | 'await-align-end';

/** Corners anchor on the glyph itself (straight to tracking); move/rotate must pick a base first. */
export function initialHotGripStep(op: WallHotGripOp): HotGripStep {
  return op === 'corner' ? 'tracking' : 'await-base';
}

/**
 * Next step after a deliberate (moved) click during `step` for operation `op`.
 * Returns the SAME step when `step` is the terminal step for that op (the click
 * is a commit, not an advance). Pure table:
 *   corner: tracking (terminal)
 *   move:   await-base → tracking (terminal)
 *   rotate: await-base → await-ref-start → await-ref-end → await-align-start
 *           → await-align-end (terminal)
 */
export function advanceHotGripStep(op: WallHotGripOp, step: HotGripStep): HotGripStep {
  if (op === 'rotate') {
    switch (step) {
      case 'await-base': return 'await-ref-start';
      case 'await-ref-start': return 'await-ref-end';
      case 'await-ref-end': return 'await-align-start';
      case 'await-align-start': return 'await-align-end';
      default: return step; // await-align-end = terminal
    }
  }
  if (op === 'move' && step === 'await-base') return 'tracking';
  return step; // move/corner tracking = terminal
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
