/**
 * @module systems/guides/commands/guide-pattern-commands
 * @description Commands for guide patterns — mirror, polar array, copy pattern
 *
 * @see ADR-189 B19 (Mirror), B31 (Polar Array), B17 (Copy Pattern)
 * @since 2026-02-19
 */

import type { ICommand, SerializedCommand } from '../../../core/commands/interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { generateEntityId } from '../../entity-creation/utils';

// ============================================================================
// MIRROR GUIDES COMMAND (ADR-189 B19)
// ============================================================================

/**
 * Mirrors all visible/unlocked guides across a selected axis guide.
 * Creates NEW mirrored copies — original guides remain unchanged.
 * Only supports X/Y axis guides as mirror axis (not XZ).
 */
export class MirrorGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'MirrorGuides';
  readonly type = 'mirror-guides';
  readonly timestamp: number;
  private createdGuides: Guide[] = [];
  private readonly mirrorAxis: 'X' | 'Y';
  private readonly mirrorOffset: number;

  constructor(
    private readonly store: GuideStore,
    private readonly axisGuideId: string,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();

    const axisGuide = store.getGuides().find(g => g.id === axisGuideId);
    this.mirrorAxis = axisGuide?.axis === 'Y' ? 'Y' : 'X';
    this.mirrorOffset = axisGuide?.offset ?? 0;
  }

  get isValid(): boolean {
    const axisGuide = this.store.getGuides().find(g => g.id === this.axisGuideId);
    if (!axisGuide || axisGuide.axis === 'XZ') return false;
    return this.store.getGuides().some(g =>
      g.id !== this.axisGuideId && g.visible && !g.locked
    );
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const ax = this.mirrorOffset;
    const guides = this.store.getGuides();

    for (const guide of guides) {
      if (guide.id === this.axisGuideId || !guide.visible || guide.locked) continue;

      if (this.mirrorAxis === 'X') {
        if (guide.axis === 'X') {
          const newOffset = 2 * ax - guide.offset;
          if (Math.abs(newOffset - guide.offset) < 0.001) continue;
          const created = this.store.addGuideRaw('X', newOffset, guide.label);
          if (created) {
            if (guide.style) created.style = { ...guide.style };
            this.createdGuides.push(created);
          }
        } else if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
          const start: Point2D = { x: 2 * ax - guide.startPoint.x, y: guide.startPoint.y };
          const end: Point2D = { x: 2 * ax - guide.endPoint.x, y: guide.endPoint.y };
          const created = this.store.addDiagonalGuideRaw(start, end, guide.label);
          if (created) {
            if (guide.style) created.style = { ...guide.style };
            this.createdGuides.push(created);
          }
        }
      } else {
        if (guide.axis === 'Y') {
          const newOffset = 2 * ax - guide.offset;
          if (Math.abs(newOffset - guide.offset) < 0.001) continue;
          const created = this.store.addGuideRaw('Y', newOffset, guide.label);
          if (created) {
            if (guide.style) created.style = { ...guide.style };
            this.createdGuides.push(created);
          }
        } else if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
          const start: Point2D = { x: guide.startPoint.x, y: 2 * ax - guide.startPoint.y };
          const end: Point2D = { x: guide.endPoint.x, y: 2 * ax - guide.endPoint.y };
          const created = this.store.addDiagonalGuideRaw(start, end, guide.label);
          if (created) {
            if (guide.style) created.style = { ...guide.style };
            this.createdGuides.push(created);
          }
        }
      }
    }
  }

  undo(): void {
    for (const guide of this.createdGuides) {
      this.store.removeGuideById(guide.id);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    return `Mirror ${this.createdGuides.length} guides across ${this.mirrorAxis} axis at offset ${this.mirrorOffset.toFixed(1)}`;
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
        axisGuideId: this.axisGuideId,
        mirrorAxis: this.mirrorAxis,
        mirrorOffset: this.mirrorOffset,
        createdCount: this.createdGuides.length,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
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
export class PolarArrayGuidesCommand implements ICommand {
  readonly id: string;
  readonly name = 'PolarArrayGuides';
  readonly type = 'polar-array-guides';
  readonly timestamp: number;

  private createdGuides: Guide[] = [];
  readonly angleIncrement: number;
  readonly startAngleDeg: number;

  constructor(
    private readonly store: GuideStore,
    private readonly center: Point2D,
    private readonly count: number,
    startAngleDeg: number = 0,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
    this.angleIncrement = count > 0 ? 360 / count : 0;
    this.startAngleDeg = startAngleDeg;
  }

  get isValid(): boolean {
    return this.count >= 2 && this.angleIncrement > 0;
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const extent = 10_000;

    for (let i = 0; i < this.count; i++) {
      const angleDeg = this.startAngleDeg + i * this.angleIncrement;
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * extent;
      const dy = Math.sin(rad) * extent;

      const startPoint: Point2D = {
        x: this.center.x - dx,
        y: this.center.y - dy,
      };
      const endPoint: Point2D = {
        x: this.center.x + dx,
        y: this.center.y + dy,
      };

      const guide = this.store.addDiagonalGuideRaw(startPoint, endPoint);
      if (guide) {
        this.createdGuides.push(guide);
      }
    }
  }

  undo(): void {
    for (const guide of this.createdGuides) {
      this.store.removeGuideById(guide.id);
    }
  }

  redo(): void {
    this.execute();
  }

  getDescription(): string {
    const startInfo = this.startAngleDeg !== 0 ? ` starting at ${this.startAngleDeg.toFixed(1)}°` : '';
    return `Polar array: ${this.count} guides at ${this.angleIncrement.toFixed(1)}° intervals${startInfo}`;
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
        center: this.center,
        count: this.count,
        angleIncrement: this.angleIncrement,
        startAngleDeg: this.startAngleDeg,
        createdGuideIds: this.createdGuides.map(g => g.id),
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
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
export class CopyGuidePatternCommand implements ICommand {
  readonly id: string;
  readonly name = 'CopyGuidePattern';
  readonly type = 'copy-guide-pattern';
  readonly timestamp: number;
  private createdGuides: Guide[] = [];

  constructor(
    private readonly store: GuideStore,
    private readonly sourceGuideIds: readonly string[],
    private readonly offsetDistance: number,
    private readonly repetitions: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  get isValid(): boolean {
    return this.sourceGuideIds.length > 0 && this.repetitions >= 1 && this.offsetDistance !== 0;
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const guides = this.store.getGuides();
    for (const sourceId of this.sourceGuideIds) {
      const source = guides.find(g => g.id === sourceId);
      if (!source) continue;

      for (let i = 1; i <= this.repetitions; i++) {
        if (source.axis === 'X' || source.axis === 'Y') {
          const newOffset = source.offset + i * this.offsetDistance;
          const created = this.store.addGuideRaw(source.axis, newOffset, source.label);
          if (created) {
            if (source.style) created.style = { ...source.style };
            this.createdGuides.push(created);
          }
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
          const created = this.store.addDiagonalGuideRaw(newStart, newEnd, source.label);
          if (created) {
            if (source.style) created.style = { ...source.style };
            this.createdGuides.push(created);
          }
        }
      }
    }
  }

  undo(): void {
    for (const guide of this.createdGuides) {
      this.store.removeGuideById(guide.id);
    }
  }

  redo(): void { this.execute(); }

  getDescription(): string {
    return `Copy ${this.sourceGuideIds.length} guides x ${this.repetitions} repetitions, offset ${this.offsetDistance}`;
  }

  canMergeWith(): boolean { return false; }

  serialize(): SerializedCommand {
    return {
      type: this.type, id: this.id, name: this.name, timestamp: this.timestamp,
      data: {
        sourceGuideIds: [...this.sourceGuideIds],
        offsetDistance: this.offsetDistance,
        repetitions: this.repetitions,
        createdCount: this.createdGuides.length,
      },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
  }
}
