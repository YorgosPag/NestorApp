/**
 * @module systems/guides/commands/guide-delete-commands
 * @description Commands for deleting construction guides — single and batch
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @since 2026-02-19
 */

import type { ICommand, SerializedCommand } from '../../../core/commands/interfaces';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { generateEntityId } from '../../entity-creation/utils';

// ============================================================================
// DELETE GUIDE COMMAND
// ============================================================================

/**
 * Command for deleting a construction guide.
 * Stores a snapshot for undo (restore).
 */
export class DeleteGuideCommand implements ICommand {
  readonly id: string;
  readonly name = 'DeleteGuide';
  readonly type = 'delete-guide';
  readonly timestamp: number;

  private deletedGuide: Guide | null = null;

  constructor(
    private readonly store: GuideStore,
    private readonly guideId: string,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
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

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Delete guide ${this.guideId}`;
  }

  canMergeWith(): boolean {
    return false;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        guideId: this.guideId,
        deletedGuide: this.deletedGuide,
      },
      version: 1,
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
export class BatchDeleteGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'BatchDeleteGuides';
  readonly type = 'batch-delete-guides';
  readonly timestamp: number;
  private deletedGuides: Guide[] = [];

  constructor(
    private readonly store: GuideStore,
    private readonly guideIds: readonly string[],
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
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

  redo(): void { this.execute(); }

  getDescription(): string {
    return `Batch delete ${this.deletedGuides.length} guides`;
  }

  canMergeWith(): boolean { return false; }

  serialize(): SerializedCommand {
    return {
      type: this.type, id: this.id, name: this.name, timestamp: this.timestamp,
      data: { guideIds: [...this.guideIds], deletedCount: this.deletedGuides.length },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.deletedGuides.map(g => g.id);
  }
}
