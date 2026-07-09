/**
 * @module systems/guides/commands/guide-rotate-commands
 * @description Commands for rotating construction guides — single, group, all
 *
 * @see ADR-189 B28 (Rotate single), B29 (Rotate group), B30 (Rotate all)
 * @see ADR-613 (Guide command SSoT — BatchRotateGuidesCommand / geometry helper)
 * @since 2026-02-19
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { BaseCommand } from '../../../core/commands/base-command';
import { BatchRotateGuidesCommand } from './guide-command-base';
import { computeRotatedGuideEndpoints } from './guide-command-geometry';

// ============================================================================
// ROTATE GUIDE COMMAND (B28)
// ============================================================================

/**
 * Command for rotating a construction guide around a pivot point.
 *
 * For X/Y guides: Converts to XZ (diagonal) with computed startPoint/endPoint.
 * For XZ guides: Rotates existing startPoint and endPoint.
 *
 * Stores full original guide snapshot for perfect undo — restoring
 * the original axis, offset, and endpoint state.
 *
 * @see ADR-189 B28 (Περιστροφή μεμονωμένου οδηγού)
 * @see guide-command-geometry.ts (computeRotatedGuideEndpoints)
 */
export class RotateGuideCommand extends BaseCommand {
  readonly name = 'RotateGuide';
  readonly type = 'rotate-guide';

  private originalSnapshot: Guide | null = null;
  private readonly newStart: Point2D;
  private readonly newEnd: Point2D;

  constructor(
    private readonly store: GuideStore,
    private readonly guideId: string,
    private readonly pivot: Point2D,
    private readonly angleDeg: number,
  ) {
    super();

    const guide = store.getGuideById(guideId);
    if (guide) {
      const endpoints = computeRotatedGuideEndpoints(guide, pivot, angleDeg);
      this.newStart = endpoints.start;
      this.newEnd = endpoints.end;
    } else {
      this.newStart = { x: 0, y: 0 };
      this.newEnd = { x: 0, y: 0 };
    }
  }

  execute(): void {
    const snapshot = this.store.replaceGuideWithRotated(this.guideId, this.newStart, this.newEnd);
    if (snapshot && !this.originalSnapshot) {
      this.originalSnapshot = snapshot;
    }
  }

  undo(): void {
    if (this.originalSnapshot) {
      this.store.restoreGuideSnapshot(this.originalSnapshot);
    }
  }

  getDescription(): string {
    return `Rotate guide ${this.guideId} by ${this.angleDeg}° around (${this.pivot.x.toFixed(1)}, ${this.pivot.y.toFixed(1)})`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      guideId: this.guideId,
      pivot: this.pivot,
      angleDeg: this.angleDeg,
      newStart: this.newStart,
      newEnd: this.newEnd,
    };
  }

  getAffectedEntityIds(): string[] {
    return [this.guideId];
  }
}

// ============================================================================
// ROTATE ALL GUIDES COMMAND (B30)
// ============================================================================

/**
 * Command for rotating ALL visible, unlocked guides around a pivot point.
 *
 * Applies the shared rotation geometry to every eligible guide atomically.
 * Stores full snapshots of all affected guides for perfect undo.
 *
 * @see ADR-189 B30 (Περιστροφή ολόκληρου κάνναβου)
 */
export class RotateAllGuidesCommand extends BatchRotateGuidesCommand {
  readonly name = 'RotateAllGuides';
  readonly type = 'rotate-all-guides';

  constructor(store: GuideStore, pivot: Point2D, angleDeg: number) {
    super(store, pivot, angleDeg, store.getGuides().filter((g) => g.visible && !g.locked));
  }

  getDescription(): string {
    return `Rotate all guides (${this.rotatedEndpoints.size}) by ${this.angleDeg}° around (${this.pivot.x.toFixed(1)}, ${this.pivot.y.toFixed(1)})`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      pivot: this.pivot,
      angleDeg: this.angleDeg,
      guideCount: this.rotatedEndpoints.size,
    };
  }
}

// ============================================================================
// ROTATE GUIDE GROUP COMMAND (B29)
// ============================================================================

/**
 * Command for rotating a SELECTED GROUP of guides around a pivot point.
 *
 * Same geometry as RotateAllGuidesCommand but only operates on explicitly
 * provided guide IDs. Stores full snapshots for batch undo.
 *
 * @see ADR-189 B29 (Περιστροφή ομάδας οδηγών)
 */
export class RotateGuideGroupCommand extends BatchRotateGuidesCommand {
  readonly name = 'RotateGuideGroup';
  readonly type = 'rotate-guide-group';

  constructor(
    store: GuideStore,
    private readonly guideIds: readonly string[],
    pivot: Point2D,
    angleDeg: number,
  ) {
    super(
      store,
      pivot,
      angleDeg,
      guideIds.map((id) => store.getGuideById(id)).filter((g): g is Guide => g != null),
    );
  }

  getDescription(): string {
    return `Rotate ${this.rotatedEndpoints.size} guides by ${this.angleDeg}° around (${this.pivot.x.toFixed(1)}, ${this.pivot.y.toFixed(1)})`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      guideIds: this.guideIds,
      pivot: this.pivot,
      angleDeg: this.angleDeg,
      guideCount: this.rotatedEndpoints.size,
    };
  }
}
