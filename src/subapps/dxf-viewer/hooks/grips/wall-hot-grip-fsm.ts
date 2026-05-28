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
 * Hot-grip step within `phase === 'hotGrip'`:
 *  - `'await-base'` → move/rotate, waiting for the 2nd click to pick the base
 *    point / rotation centre (no preview yet).
 *  - `'tracking'`   → anchor established, cursor moves drive the live ghost +
 *    rubber-band; the next moved click commits.
 */
export type HotGripStep = 'await-base' | 'tracking';

/** Corners anchor on the glyph itself (straight to tracking); move/rotate must pick a base first. */
export function initialHotGripStep(op: WallHotGripOp): HotGripStep {
  return op === 'corner' ? 'tracking' : 'await-base';
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
 *   none → arm → stay → set-base → commit
 *
 *  - `'arm'`      → release του 1ου κλικ (awaitingFirstRelease) → μένει hot.
 *  - `'stay'`     → release ΧΩΡΙΣ ενδιάμεση κίνηση κέρσορα (`!movedSinceArm`) →
 *                   stray/redundant release (π.χ. 2ο fire του διπλού canvas+
 *                   container mouseup του ίδιου tick). Μένει hot, ΔΕΝ ορίζει base
 *                   και ΔΕΝ κάνει commit/reset. Ισχύει για ΚΑΘΕ step.
 *  - `'set-base'` → release ενώ `step === 'await-base'` ΜΕ προηγηθείσα κίνηση
 *                   (move/rotate 2ο κλικ) → ορίζει σημείο βάσης / κέντρο
 *                   περιστροφής, πάει σε tracking.
 *  - `'commit'`   → tracking release ΜΕ κίνηση → οριστικοποίηση + reset.
 *  - `'none'`     → δεν είμαστε σε hot-grip· ο caller συνεχίζει με το κανονικό path.
 *
 * Το `'stay'`-πριν-`'set-base'` guard λύνει το διπλό-fire bug: το async
 * `handleMouseUp` κάνει το `finally` (mutex release) σύγχρονα, οπότε το 2ο mouseup
 * fire του ίδιου tick δεν μπλοκάρεται. Χωρίς αυτό, στο 1ο κλικ ενός move/rotate
 * glyph το fire1='arm' και το fire2 (await-base, καμία ενδιάμεση κίνηση) θα έκανε
 * πρόωρα 'set-base' πάνω στη θέση του glyph — «καίγοντας» 2 βήματα στο 1ο κλικ
 * (το 3-click pattern κατέρρεε σε 2-click). Ο `movedSinceArm` (που ανεβαίνει μόνο
 * σε πραγματικό mousemove, ΟΧΙ στο same-tick double fire) ξεχωρίζει το αληθινό
 * 2ο κλικ από το stray release.
 */
export type HotGripMouseUpAction = 'arm' | 'set-base' | 'stay' | 'commit' | 'none';

export function resolveHotGripMouseUp(
  phase: UnifiedGripPhase,
  awaitingFirstRelease: boolean,
  step: HotGripStep,
  movedSinceArm: boolean,
): HotGripMouseUpAction {
  if (phase !== 'hotGrip') return 'none';
  if (awaitingFirstRelease) return 'arm';
  if (!movedSinceArm) return 'stay';
  if (step === 'await-base') return 'set-base';
  return 'commit';
}
