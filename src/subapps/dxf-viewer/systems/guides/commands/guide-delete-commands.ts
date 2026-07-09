/**
 * @module systems/guides/commands/guide-delete-commands
 * @description Commands for deleting construction guides — single and batch
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see ADR-613 (Guide command SSoT — BaseCommand base)
 * @since 2026-02-19
 */

import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { BaseCommand } from '../../../core/commands/base-command';

// ============================================================================
// DELETE GUIDE COMMAND
// ============================================================================

/**
 * Command for deleting a construction guide.
 * Stores a snapshot for undo (restore).
 */
export class DeleteGuideCommand extends BaseCommand {
  readonly name = 'DeleteGuide';
  readonly type = 'delete-guide';

  private deletedGuide: Guide | null = null;

  constructor(
    private readonly store: GuideStore,
    private readonly guideId: string,
  ) {
    super();
  }

  execute(): void {
    const guide = this.store.removeGuideById(this.guideId);
    if (guide) {
      this.deletedGuide = guide;
    }
  }

  undo(): void {
    if (this.deletedGuide) {
      this.store.restoreGuide(this.deletedGuide);
    }
  }

  getDescription(): string {
    return `Delete guide ${this.guideId}`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      guideId: this.guideId,
      deletedGuide: this.deletedGuide,
    };
  }

  getAffectedEntityIds(): string[] {
    return [this.guideId];
  }
}

// ============================================================================
// BATCH DELETE GUIDES COMMAND (ADR-189 B14)
// ============================================================================

/**
 * Deletes multiple guides at once. Skips locked guides.
 * Stores snapshots for full undo/redo.
 */
export class BatchDeleteGuidesCommand extends BaseCommand {
  readonly name = 'BatchDeleteGuides';
  readonly type = 'batch-delete-guides';

  private deletedGuides: Guide[] = [];

  constructor(
    private readonly store: GuideStore,
    private readonly guideIds: readonly string[],
  ) {
    super();
  }

  execute(): void {
    if (this.deletedGuides.length > 0) {
      for (const guide of this.deletedGuides) {
        this.store.removeGuideById(guide.id);
      }
      return;
    }
    for (const gid of this.guideIds) {
      const removed = this.store.removeGuideById(gid);
      if (removed) this.deletedGuides.push(removed);
    }
  }

  undo(): void {
    for (let i = this.deletedGuides.length - 1; i >= 0; i--) {
      this.store.restoreGuide(this.deletedGuides[i]);
    }
  }

  getDescription(): string {
    return `Batch delete ${this.deletedGuides.length} guides`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      guideIds: [...this.guideIds],
      deletedCount: this.deletedGuides.length,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.deletedGuides.map((g) => g.id);
  }
}
