/**
 * @module systems/guides/commands/guide-scale-equalize-commands
 * @description Commands for scaling and equalizing construction guides
 *
 * @see ADR-189 B32 (Scale), B33 (Equalize)
 * @since 2026-02-19
 */

import type { ICommand, SerializedCommand } from '../../../core/commands/interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { generateEntityId } from '../../entity-creation/utils';

// ============================================================================
// EQUALIZE GUIDES COMMAND (B33)
// ============================================================================

/**
 * Command for equalizing spacing between 3+ same-axis guides.
 *
 * Keeps the first (lowest offset) and last (highest offset) guides in place,
 * then redistributes all intermediate guides with equal spacing.
 *
 * Requirements:
 * - All selected guides must share the same axis (X or Y)
 * - XZ (diagonal) guides are excluded — equalization is offset-based
 * - Minimum 3 guides required
 *
 * @see ADR-189 B33 (Smart Equalize — ισαπόσταση παράλληλων οδηγών)
 */
export class EqualizeGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'EqualizeGuides';
  readonly type = 'equalize-guides';
  readonly timestamp: number;

  /** Original offsets keyed by guide.id (for undo) */
  private readonly originalOffsets: Map<string, number> = new Map();
  /** New equalized offsets keyed by guide.id */
  private readonly newOffsets: Map<string, number> = new Map();
  /** Computed spacing (for event emission) */
  readonly spacing: number;

  constructor(
    private readonly store: GuideStore,
    guideIds: readonly string[],
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.spacing = 0;

    const guides: Guide[] = [];
    for (const gid of guideIds) {
      const g = store.getGuideById(gid);
      if (g && g.axis !== 'XZ') guides.push(g);
    }

    if (guides.length < 3) return;

    const firstAxis = guides[0].axis;
    if (!guides.every(g => g.axis === firstAxis)) return;

    const sorted = [...guides].sort((a, b) => a.offset - b.offset);
    const firstOffset = sorted[0].offset;
    const lastOffset = sorted[sorted.length - 1].offset;
    this.spacing = (lastOffset - firstOffset) / (sorted.length - 1);

    for (let i = 0; i < sorted.length; i++) {
      this.originalOffsets.set(sorted[i].id, sorted[i].offset);
      this.newOffsets.set(sorted[i].id, firstOffset + i * this.spacing);
    }
  }

  /** Whether the command has valid work to do */
  get isValid(): boolean {
    return this.newOffsets.size >= 3;
  }

  execute(): void {
    for (const [guideId, offset] of this.newOffsets) {
      this.store.moveGuideById(guideId, offset);
    }
  }

  undo(): void {
    for (const [guideId, offset] of this.originalOffsets) {
      this.store.moveGuideById(guideId, offset);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Equalize ${this.newOffsets.size} guides (equal spacing)`;
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
        guideCount: this.newOffsets.size,
        originalOffsets: Object.fromEntries(this.originalOffsets),
        newOffsets: Object.fromEntries(this.newOffsets),
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return Array.from(this.newOffsets.keys());
  }
}

// ============================================================================
// SCALE ALL GUIDES COMMAND (B32)
// ============================================================================

/**
 * Command for scaling ALL visible, unlocked guides from an origin point.
 *
 * X/Y guides: newOffset = origin + (offset - origin) * scaleFactor
 * XZ guides: newStart/End = origin + (point - origin) * scaleFactor
 *
 * Unlike rotation (B28-B30), scaling preserves axis type — X stays X, Y stays Y.
 * Only offsets/positions change, not the axis direction.
 *
 * @see ADR-189 B32 (Κλιμάκωση κάνναβου — Scale)
 */
export class ScaleAllGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'ScaleAllGuides';
  readonly type = 'scale-all-guides';
  readonly timestamp: number;

  /** Original guide snapshots for undo */
  private readonly originalSnapshots: Guide[] = [];
  /** Pre-computed scaled values per guide: X/Y = new offset, XZ = new endpoints */
  private readonly scaledValues: Map<string, { offset?: number; start?: Point2D; end?: Point2D }> = new Map();

  constructor(
    private readonly store: GuideStore,
    private readonly origin: Point2D,
    private readonly scaleFactor: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();

    const guides = store.getGuides();
    for (const guide of guides) {
      if (!guide.visible || guide.locked) continue;

      if (guide.axis === 'X') {
        this.scaledValues.set(guide.id, {
          offset: this.origin.x + (guide.offset - this.origin.x) * scaleFactor,
        });
      } else if (guide.axis === 'Y') {
        this.scaledValues.set(guide.id, {
          offset: this.origin.y + (guide.offset - this.origin.y) * scaleFactor,
        });
      } else if (guide.startPoint && guide.endPoint) {
        this.scaledValues.set(guide.id, {
          start: {
            x: this.origin.x + (guide.startPoint.x - this.origin.x) * scaleFactor,
            y: this.origin.y + (guide.startPoint.y - this.origin.y) * scaleFactor,
          },
          end: {
            x: this.origin.x + (guide.endPoint.x - this.origin.x) * scaleFactor,
            y: this.origin.y + (guide.endPoint.y - this.origin.y) * scaleFactor,
          },
        });
      }
    }
  }

  /** Whether the command has valid work to do */
  get isValid(): boolean {
    return this.scaledValues.size > 0 && this.scaleFactor !== 1;
  }

  execute(): void {
    const isFirstExecution = this.originalSnapshots.length === 0;

    for (const [guideId, values] of this.scaledValues) {
      const guide = this.store.getGuideById(guideId);
      if (!guide) continue;

      if (isFirstExecution) {
        this.originalSnapshots.push({ ...guide });
      }

      if (values.offset !== undefined) {
        this.store.moveGuideById(guideId, values.offset);
      } else if (values.start && values.end) {
        this.store.moveDiagonalGuideById(guideId, values.start, values.end);
      }
    }
  }

  undo(): void {
    for (let i = this.originalSnapshots.length - 1; i >= 0; i--) {
      const snap = this.originalSnapshots[i];
      if (snap.axis === 'XZ' && snap.startPoint && snap.endPoint) {
        this.store.moveDiagonalGuideById(snap.id, snap.startPoint, snap.endPoint);
      } else {
        this.store.moveGuideById(snap.id, snap.offset);
      }
    }
  }

  redo(): void {
    for (const [guideId, values] of this.scaledValues) {
      if (values.offset !== undefined) {
        this.store.moveGuideById(guideId, values.offset);
      } else if (values.start && values.end) {
        this.store.moveDiagonalGuideById(guideId, values.start, values.end);
      }
    }
  }

  getDescription(): string {
    return `Scale all guides (${this.scaledValues.size}) by ${this.scaleFactor}x from (${this.origin.x.toFixed(1)}, ${this.origin.y.toFixed(1)})`;
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
        origin: this.origin,
        scaleFactor: this.scaleFactor,
        guideCount: this.scaledValues.size,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return Array.from(this.scaledValues.keys());
  }
}
