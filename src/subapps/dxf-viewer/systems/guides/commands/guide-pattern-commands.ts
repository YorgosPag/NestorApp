/**
 * @module systems/guides/commands/guide-pattern-commands
 * @description Commands for guide patterns — mirror, polar array, copy pattern
 *
 * @see ADR-189 B19 (Mirror), B31 (Polar Array), B17 (Copy Pattern)
 * @see ADR-613 (Guide command SSoT — CreatedGuidesCommand base)
 * @since 2026-02-19
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { CreatedGuidesCommand } from './guide-command-base';
import { pushStyledGuide } from './guide-command-geometry';

/** Half-length extent for radial (polar-array) guides. */
const POLAR_EXTENT = 10_000;

// ============================================================================
// MIRROR GUIDES COMMAND (ADR-189 B19)
// ============================================================================

/**
 * Mirrors all visible/unlocked guides across a selected axis guide.
 * Creates NEW mirrored copies — original guides remain unchanged.
 * Only supports X/Y axis guides as mirror axis (not XZ).
 */
export class MirrorGuidesCommand extends CreatedGuidesCommand {
  readonly name = 'MirrorGuides';
  readonly type = 'mirror-guides';

  private readonly mirrorAxis: 'X' | 'Y';
  private readonly mirrorOffset: number;

  constructor(
    store: GuideStore,
    private readonly axisGuideId: string,
  ) {
    super(store);

    const axisGuide = store.getGuides().find((g) => g.id === axisGuideId);
    this.mirrorAxis = axisGuide?.axis === 'Y' ? 'Y' : 'X';
    this.mirrorOffset = axisGuide?.offset ?? 0;
  }

  get isValid(): boolean {
    const axisGuide = this.store.getGuides().find((g) => g.id === this.axisGuideId);
    if (!axisGuide || axisGuide.axis === 'XZ') return false;
    return this.store.getGuides().some((g) =>
      g.id !== this.axisGuideId && g.visible && !g.locked,
    );
  }

  protected buildGuides(): Guide[] {
    const created: Guide[] = [];
    const ax = this.mirrorOffset;

    for (const guide of this.store.getGuides()) {
      if (guide.id === this.axisGuideId || !guide.visible || guide.locked) continue;

      const parallelAxis = this.mirrorAxis; // 'X' mirrors X guides, 'Y' mirrors Y guides
      if (guide.axis === parallelAxis) {
        const newOffset = 2 * ax - guide.offset;
        if (Math.abs(newOffset - guide.offset) < 0.001) continue;
        pushStyledGuide(created, this.store.addGuideRaw(parallelAxis, newOffset, guide.label), guide);
      } else if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        const start: Point2D = this.mirrorAxis === 'X'
          ? { x: 2 * ax - guide.startPoint.x, y: guide.startPoint.y }
          : { x: guide.startPoint.x, y: 2 * ax - guide.startPoint.y };
        const end: Point2D = this.mirrorAxis === 'X'
          ? { x: 2 * ax - guide.endPoint.x, y: guide.endPoint.y }
          : { x: guide.endPoint.x, y: 2 * ax - guide.endPoint.y };
        pushStyledGuide(created, this.store.addDiagonalGuideRaw(start, end, guide.label), guide);
      }
    }

    return created;
  }

  getDescription(): string {
    return `Mirror ${this.createdGuides.length} guides across ${this.mirrorAxis} axis at offset ${this.mirrorOffset.toFixed(1)}`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      axisGuideId: this.axisGuideId,
      mirrorAxis: this.mirrorAxis,
      mirrorOffset: this.mirrorOffset,
      createdCount: this.createdGuides.length,
    };
  }
}

// ============================================================================
// POLAR ARRAY GUIDES COMMAND (B31)
// ============================================================================

/**
 * Command for creating N guides at equal angular intervals around a center point.
 *
 * Creates radial guides (spokes) through the center point, each as an XZ diagonal
 * guide extending +/-10000 units. The angle between consecutive guides is 360/count.
 *
 * @see ADR-189 B31 (Polar Array — N οδηγοί σε ίσες γωνίες γύρω από κέντρο)
 */
export class PolarArrayGuidesCommand extends CreatedGuidesCommand {
  readonly name = 'PolarArrayGuides';
  readonly type = 'polar-array-guides';

  readonly angleIncrement: number;
  readonly startAngleDeg: number;

  constructor(
    store: GuideStore,
    private readonly center: Point2D,
    private readonly count: number,
    startAngleDeg: number = 0,
  ) {
    super(store);
    this.angleIncrement = count > 0 ? 360 / count : 0;
    this.startAngleDeg = startAngleDeg;
  }

  get isValid(): boolean {
    return this.count >= 2 && this.angleIncrement > 0;
  }

  protected buildGuides(): Guide[] {
    const created: Guide[] = [];

    for (let i = 0; i < this.count; i++) {
      const angleDeg = this.startAngleDeg + i * this.angleIncrement;
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * POLAR_EXTENT;
      const dy = Math.sin(rad) * POLAR_EXTENT;

      const startPoint: Point2D = { x: this.center.x - dx, y: this.center.y - dy };
      const endPoint: Point2D = { x: this.center.x + dx, y: this.center.y + dy };

      const guide = this.store.addDiagonalGuideRaw(startPoint, endPoint);
      if (guide) created.push(guide);
    }

    return created;
  }

  getDescription(): string {
    const startInfo = this.startAngleDeg !== 0 ? ` starting at ${this.startAngleDeg.toFixed(1)}°` : '';
    return `Polar array: ${this.count} guides at ${this.angleIncrement.toFixed(1)}° intervals${startInfo}`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      center: this.center,
      count: this.count,
      angleIncrement: this.angleIncrement,
      startAngleDeg: this.startAngleDeg,
      createdGuideIds: this.createdGuides.map((g) => g.id),
    };
  }
}

// ============================================================================
// COPY GUIDE PATTERN COMMAND (ADR-189 B17)
// ============================================================================

/**
 * Copies selected guides with an offset, repeating N times.
 * For X/Y guides: offset is added to the guide offset.
 * For XZ guides: perpendicular shift by offset distance.
 */
export class CopyGuidePatternCommand extends CreatedGuidesCommand {
  readonly name = 'CopyGuidePattern';
  readonly type = 'copy-guide-pattern';

  constructor(
    store: GuideStore,
    private readonly sourceGuideIds: readonly string[],
    private readonly offsetDistance: number,
    private readonly repetitions: number,
  ) {
    super(store);
  }

  get isValid(): boolean {
    return this.sourceGuideIds.length > 0 && this.repetitions >= 1 && this.offsetDistance !== 0;
  }

  protected buildGuides(): Guide[] {
    const created: Guide[] = [];
    const guides = this.store.getGuides();

    for (const sourceId of this.sourceGuideIds) {
      const source = guides.find((g) => g.id === sourceId);
      if (!source) continue;

      for (let i = 1; i <= this.repetitions; i++) {
        if (source.axis === 'X' || source.axis === 'Y') {
          const newOffset = source.offset + i * this.offsetDistance;
          pushStyledGuide(created, this.store.addGuideRaw(source.axis, newOffset, source.label), source);
        } else if (source.axis === 'XZ' && source.startPoint && source.endPoint) {
          const dx = source.endPoint.x - source.startPoint.x;
          const dy = source.endPoint.y - source.startPoint.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.001) continue;
          const nx = -dy / len;
          const ny = dx / len;
          const shift = i * this.offsetDistance;
          const newStart: Point2D = { x: source.startPoint.x + nx * shift, y: source.startPoint.y + ny * shift };
          const newEnd: Point2D = { x: source.endPoint.x + nx * shift, y: source.endPoint.y + ny * shift };
          pushStyledGuide(created, this.store.addDiagonalGuideRaw(newStart, newEnd, source.label), source);
        }
      }
    }

    return created;
  }

  getDescription(): string {
    return `Copy ${this.sourceGuideIds.length} guides x ${this.repetitions} repetitions, offset ${this.offsetDistance}`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      sourceGuideIds: [...this.sourceGuideIds],
      offsetDistance: this.offsetDistance,
      repetitions: this.repetitions,
      createdCount: this.createdGuides.length,
    };
  }
}
