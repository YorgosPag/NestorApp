/**
 * ADR-363 Phase 1G — Wall corner hot-grip state-machine decisions (pure).
 *
 * AutoCAD "hot grip" pattern για τα 4 corner grips τοίχου: 1ο κλικ ενεργοποιεί
 * move mode (όχι drag), ο κέρσορας σύρει live (rubber-band + ghost), 2ο κλικ
 * οριστικοποιεί. Press-drag-release καταργείται ΜΟΝΟ για αυτά τα 4 kinds — όλα
 * τα υπόλοιπα wall grips (start/end/midpoint/thickness/rotation/curve/vertex)
 * παραμένουν drag.
 *
 * Zero React / DOM / store deps — οι αποφάσεις της μηχανής ζουν εδώ ώστε να
 * unit-testάρονται ανεξάρτητα από το `useUnifiedGripInteraction` wiring.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1G
 */

import type { WallGripKind } from '../useGripMovement';
import type { UnifiedGripPhase } from './unified-grip-types';

/** Τα 4 corner grip kinds που υποστηρίζουν hot-grip (asymmetric corner drag, Phase 1C-bis). */
export const WALL_CORNER_GRIP_KINDS: readonly WallGripKind[] = [
  'wall-corner-start-pos',
  'wall-corner-start-neg',
  'wall-corner-end-pos',
  'wall-corner-end-neg',
] as const;

/** True μόνο για τα 4 corner grip kinds — αυτά παίρνουν 2-click hot-grip. */
export function isWallCornerGripKind(kind: WallGripKind | undefined | null): boolean {
  return kind != null && (WALL_CORNER_GRIP_KINDS as readonly string[]).includes(kind);
}

/**
 * ADR-363 Phase 1G — hot-grip operation flavours:
 *  - `'corner'` → 2-click (the grip itself is the anchor; Phase 1C-bis corners).
 *  - `'move'`   → 3-click (`wall-midpoint` glyph): click glyph → pick base point →
 *                 move (rubber-band base→cursor) → commit (whole-wall translate).
 *  - `'rotate'` → 3-click (`wall-rotation` glyph): click glyph → pick rotation
 *                 centre → rotate (rubber-band centre→cursor) → commit.
 */
export type WallHotGripOp = 'corner' | 'move' | 'rotate';

/** Map a wall grip kind to its hot-grip operation, or null if it stays drag. */
export function hotGripOpForKind(kind: WallGripKind | undefined | null): WallHotGripOp | null {
  if (isWallCornerGripKind(kind)) return 'corner';
  if (kind === 'wall-midpoint') return 'move';
  if (kind === 'wall-rotation') return 'rotate';
  return null;
}

/** True for any wall grip kind that uses the hot-grip (click-click) flow. */
export function isWallHotGripKind(kind: WallGripKind | undefined | null): boolean {
  return hotGripOpForKind(kind) !== null;
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
  hitWallGripKind: WallGripKind | undefined | null,
): HotGripMouseDownAction {
  if (phase === 'hotGrip') return 'consume';
  if (isWallHotGripKind(hitWallGripKind)) return 'enter';
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
