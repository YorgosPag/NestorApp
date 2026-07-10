/**
 * @module core/commands/drag-vertex-edit-command
 * @description Template-Method base for drag-coalescing vertex-edit commands.
 *
 * The move-vertex family (`MoveVertexCommand`, `MoveOverlayVertexCommand`,
 * `MoveMultipleOverlayVerticesCommand`) repeated an identical merge skeleton:
 * `redo() → execute()`, plus a `canMergeWith` that gates on *same concrete
 * command + same target + live-drag window* and a `mergeWith` that keeps the
 * original old position(s) and adopts the latest new position(s). Only three
 * things genuinely vary — the concrete-type guard, the same-target test, and the
 * merged-clone construction — so those stay abstract; the coalescing policy lives
 * here once (ADR-507 §8 drag-sample rule, AutoCAD/Figma smooth-undo pattern).
 *
 * @see ./base-command.ts (id/timestamp/serialize envelope)
 * @see ./merge-window.ts (canMergeDragSamples — the SSoT drag-window predicate)
 */

import type { ICommand } from './interfaces';
import { BaseCommand } from './base-command';
import { canMergeDragSamples } from './merge-window';

/**
 * Base for a vertex-edit command that coalesces consecutive live-drag samples of
 * the same target into a single undo step.
 *
 * @typeParam TSelf The concrete subclass — makes `sameTarget`/`cloneForMerge`
 * receive an already-narrowed instance.
 */
export abstract class DragVertexEditCommand<
  TSelf extends DragVertexEditCommand<TSelf>,
> extends BaseCommand {
  /**
   * @param isDragging True only for per-frame samples of a live drag. Two
   * DISTINCT edits of the same target (both `false`) never coalesce.
   */
  protected constructor(protected readonly isDragging: boolean) {
    super();
  }

  /** Drag re-application: default redo re-runs execute. */
  redo(): void {
    this.execute();
  }

  /** Narrow `other` to the same concrete command (its `instanceof`). */
  protected abstract isSameCommand(other: ICommand): other is TSelf;
  /** True when `other` edits the exact same target (entity/overlay + vertex). */
  protected abstract sameTarget(other: TSelf): boolean;
  /** Build the merged command: original old position(s) + `latest` new one(s). */
  protected abstract cloneForMerge(latest: TSelf): ICommand;

  canMergeWith(other: ICommand): boolean {
    return (
      this.isSameCommand(other) &&
      this.sameTarget(other) &&
      canMergeDragSamples(this, other, this.isDragging, other.isDragging)
    );
  }

  mergeWith(other: ICommand): ICommand {
    return this.cloneForMerge(other as TSelf);
  }
}
