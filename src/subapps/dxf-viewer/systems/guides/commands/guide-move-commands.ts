/**
 * @module systems/guides/commands/guide-move-commands
 * @description Command for moving construction guides
 *
 * @see ADR-189 B5 (Guide Drag & Drop)
 * @see ADR-613 (Guide command SSoT — BaseCommand base)
 * @since 2026-02-19
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { GridAxis } from '../../../ai-assistant/grid-types';
import type { GuideStore } from '../guide-store';
import { BaseCommand } from '../../../core/commands/base-command';

// ============================================================================
// MOVE GUIDE COMMAND
// ============================================================================

/**
 * Command for moving a construction guide to a new position.
 * Supports X/Y (offset change) and XZ (start/end point change).
 * Stores old and new positions for undo/redo.
 *
 * @see ADR-189 B5 (Guide Drag & Drop)
 */
export class MoveGuideCommand extends BaseCommand {
  readonly name = 'MoveGuide';
  readonly type = 'move-guide';

  constructor(
    private readonly store: GuideStore,
    private readonly guideId: string,
    private readonly axis: GridAxis,
    private readonly oldOffset: number,
    private readonly newOffset: number,
    private readonly oldStartPoint: Point2D | undefined,
    private readonly oldEndPoint: Point2D | undefined,
    private readonly newStartPoint: Point2D | undefined,
    private readonly newEndPoint: Point2D | undefined,
  ) {
    super();
  }

  execute(): void {
    if (this.axis === 'XZ' && this.newStartPoint && this.newEndPoint) {
      this.store.moveDiagonalGuideById(this.guideId, this.newStartPoint, this.newEndPoint);
    } else {
      this.store.moveGuideById(this.guideId, this.newOffset);
    }
  }

  undo(): void {
    if (this.axis === 'XZ' && this.oldStartPoint && this.oldEndPoint) {
      this.store.moveDiagonalGuideById(this.guideId, this.oldStartPoint, this.oldEndPoint);
    } else {
      this.store.moveGuideById(this.guideId, this.oldOffset);
    }
  }

  getDescription(): string {
    if (this.axis === 'XZ') {
      return `Move diagonal guide ${this.guideId}`;
    }
    return `Move ${this.axis} guide from ${this.oldOffset.toFixed(1)} to ${this.newOffset.toFixed(1)}`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      guideId: this.guideId,
      axis: this.axis,
      oldOffset: this.oldOffset,
      newOffset: this.newOffset,
      oldStartPoint: this.oldStartPoint,
      oldEndPoint: this.oldEndPoint,
      newStartPoint: this.newStartPoint,
      newEndPoint: this.newEndPoint,
    };
  }

  getAffectedEntityIds(): string[] {
    return [this.guideId];
  }
}
