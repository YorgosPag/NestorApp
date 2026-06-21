/**
 * MERGE WINDOW — SSoT for the command-merge time predicate (ADR-507 §8).
 *
 * Every drag-coalescing command (`MoveEntityCommand`, `RotateEntityCommand`,
 * `MoveVertexCommand`, `MoveOverlayVertexCommand`, …) asked the SAME question to
 * decide whether two consecutive samples belong to one undo step:
 *
 *   (later.timestamp - earlier.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow
 *
 * That one line was copy-pasted verbatim across the whole transform/vertex
 * family. This helper centralises it so the 500ms window (Autodesk/Adobe parity)
 * lives in ONE place — change the policy once, every command follows.
 *
 * @see core/commands/entity-commands/SnapshotTransformCommand.ts — transform family
 * @see core/commands/vertex-commands/MoveVertexCommand.ts — vertex family
 */

import { dequal } from 'dequal';
import type { ICommand } from './interfaces';
import { DEFAULT_MERGE_CONFIG } from './interfaces';

/**
 * True when `later` was created within the canonical merge window after
 * `earlier` — i.e. the two are close enough in time to coalesce into a single
 * undo step. Identity matching (same entity / vertex / drag flag) is the
 * caller's responsibility; this owns ONLY the time policy.
 */
export function isWithinMergeWindow(earlier: ICommand, later: ICommand): boolean {
  return (later.timestamp - earlier.timestamp) < DEFAULT_MERGE_CONFIG.mergeTimeWindow;
}

/**
 * Shared drag-merge gate (ADR-507 §8): two command samples coalesce into ONE
 * undo step only when BOTH are live-drag samples AND they fall within the
 * canonical merge window. Identity matching (same entity / vertex / selection)
 * is the caller's responsibility — this owns the dragging + time policy shared
 * across the transform AND vertex command families, so the
 * `bothDragging && withinWindow` gate is written once.
 */
export function canMergeDragSamples(
  earlier: ICommand,
  later: ICommand,
  earlierDragging: boolean,
  laterDragging: boolean,
): boolean {
  return earlierDragging && laterDragging && isWithinMergeWindow(earlier, later);
}

/**
 * True when two id lists denote the SAME set of entities (order-independent,
 * deduplicated). The transform commands merge only when both samples target the
 * identical selection — this is that identity check. Uses the app-wide equality
 * SSoT `dequal` on Sets (membership-based, order-independent) — no bespoke
 * set-equality primitive.
 */
export function sameEntityIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return dequal(new Set(a), new Set(b));
}
