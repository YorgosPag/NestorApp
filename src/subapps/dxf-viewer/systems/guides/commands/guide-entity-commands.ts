/**
 * @module systems/guides/commands/guide-entity-commands
 * @description Commands for creating guides from DXF entities
 *
 * @see ADR-189 B8 (Guide from entity), B24 (Offset from entity), B37 (Batch from entities)
 * @since 2026-02-19
 */

import type { ICommand, SerializedCommand } from '../../../core/commands/interfaces';
import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { generateEntityId } from '../../entity-creation/utils';

/** Entity type info passed from entity picking to GuideFromEntityCommand */
export interface EntityGuideParams {
  entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE';
  /** For LINE/POLYLINE segment: start and end of the line segment */
  lineStart?: Point2D;
  lineEnd?: Point2D;
  /** For CIRCLE/ARC: center and radius */
  center?: Point2D;
  radius?: number;
  /** For ARC: click point (for radial guide direction) */
  clickPoint?: Point2D;
}

// ============================================================================
// GUIDE FROM ENTITY COMMAND (ADR-189 B8)
// ============================================================================

/**
 * Creates guide(s) from a DXF entity:
 * - LINE/POLYLINE segment -> XZ diagonal guide along the line direction (+/-10000)
 * - CIRCLE -> X + Y guides through center
 * - ARC -> XZ radial guide from center through click point
 */
export class GuideFromEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'GuideFromEntity';
  readonly type = 'guide-from-entity';
  readonly timestamp: number;
  private createdGuides: Guide[] = [];

  constructor(
    private readonly store: GuideStore,
    private readonly params: EntityGuideParams,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const { entityType, lineStart, lineEnd, center, clickPoint } = this.params;
    const extent = 10_000;

    if ((entityType === 'LINE' || entityType === 'POLYLINE') && lineStart && lineEnd) {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) {
        const nx = dx / len;
        const ny = dy / len;
        const mid: Point2D = { x: (lineStart.x + lineEnd.x) / 2, y: (lineStart.y + lineEnd.y) / 2 };
        const start: Point2D = { x: mid.x - nx * extent, y: mid.y - ny * extent };
        const end: Point2D = { x: mid.x + nx * extent, y: mid.y + ny * extent };
        const guide = this.store.addDiagonalGuideRaw(start, end);
        if (guide) this.createdGuides.push(guide);
      }
    } else if (entityType === 'CIRCLE' && center) {
      const gx = this.store.addGuideRaw('X', center.x);
      if (gx) this.createdGuides.push(gx);
      const gy = this.store.addGuideRaw('Y', center.y);
      if (gy) this.createdGuides.push(gy);
    } else if (entityType === 'ARC' && center && clickPoint) {
      const dx = clickPoint.x - center.x;
      const dy = clickPoint.y - center.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) {
        const nx = dx / len;
        const ny = dy / len;
        const start: Point2D = { x: center.x - nx * extent, y: center.y - ny * extent };
        const end: Point2D = { x: center.x + nx * extent, y: center.y + ny * extent };
        const guide = this.store.addDiagonalGuideRaw(start, end);
        if (guide) this.createdGuides.push(guide);
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
    return `Guide from ${this.params.entityType} entity (${this.createdGuides.length} guide${this.createdGuides.length !== 1 ? 's' : ''})`;
  }

  canMergeWith(): boolean { return false; }

  serialize(): SerializedCommand {
    return {
      type: this.type, id: this.id, name: this.name, timestamp: this.timestamp,
      data: { entityType: this.params.entityType, createdGuideIds: this.createdGuides.map(g => g.id) },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
  }
}

// ============================================================================
// GUIDE OFFSET FROM ENTITY COMMAND (ADR-189 B24)
// ============================================================================

/**
 * Creates guide(s) offset from a DXF entity edge by a perpendicular distance.
 * - LINE/POLYLINE -> shifted parallel lines (normal vector offset, both sides)
 * - CIRCLE -> 4 guides at center +/- offset on each axis
 */
export class GuideOffsetFromEntityCommand implements ICommand {
  readonly id: string;
  readonly name = 'GuideOffsetFromEntity';
  readonly type = 'guide-offset-entity';
  readonly timestamp: number;
  private createdGuides: Guide[] = [];

  constructor(
    private readonly store: GuideStore,
    private readonly params: EntityGuideParams,
    private readonly offsetDistance: number,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const { entityType, lineStart, lineEnd, center } = this.params;
    const offset = this.offsetDistance;
    const extent = 10_000;

    if ((entityType === 'LINE' || entityType === 'POLYLINE') && lineStart && lineEnd) {
      const dx = lineEnd.x - lineStart.x;
      const dy = lineEnd.y - lineStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0.001) {
        const nx = -dy / len;
        const ny = dx / len;
        const dir = { x: dx / len, y: dy / len };
        const mid: Point2D = { x: (lineStart.x + lineEnd.x) / 2, y: (lineStart.y + lineEnd.y) / 2 };

        for (const sign of [1, -1]) {
          const shiftedMid: Point2D = { x: mid.x + nx * offset * sign, y: mid.y + ny * offset * sign };
          const start: Point2D = { x: shiftedMid.x - dir.x * extent, y: shiftedMid.y - dir.y * extent };
          const end: Point2D = { x: shiftedMid.x + dir.x * extent, y: shiftedMid.y + dir.y * extent };
          const guide = this.store.addDiagonalGuideRaw(start, end);
          if (guide) this.createdGuides.push(guide);
        }
      }
    } else if (entityType === 'CIRCLE' && center) {
      for (const sign of [1, -1]) {
        const gx = this.store.addGuideRaw('X', center.x + offset * sign);
        if (gx) this.createdGuides.push(gx);
        const gy = this.store.addGuideRaw('Y', center.y + offset * sign);
        if (gy) this.createdGuides.push(gy);
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
    return `Offset ${this.offsetDistance}m from ${this.params.entityType} (${this.createdGuides.length} guides)`;
  }

  canMergeWith(): boolean { return false; }

  serialize(): SerializedCommand {
    return {
      type: this.type, id: this.id, name: this.name, timestamp: this.timestamp,
      data: { entityType: this.params.entityType, offset: this.offsetDistance, createdGuideIds: this.createdGuides.map(g => g.id) },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
  }
}

// ============================================================================
// BATCH GUIDE FROM ENTITIES COMMAND (ADR-189 B37)
// ============================================================================

/**
 * Creates guides from multiple selected entities (batch version of B8).
 * Reuses the same entity -> guide logic as GuideFromEntityCommand.
 */
export class BatchGuideFromEntitiesCommand implements ICommand {
  readonly id: string;
  readonly name = 'BatchGuideFromEntities';
  readonly type = 'batch-guide-from-entities';
  readonly timestamp: number;
  private createdGuides: Guide[] = [];

  constructor(
    private readonly store: GuideStore,
    private readonly entityParamsList: readonly EntityGuideParams[],
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (this.createdGuides.length > 0) {
      for (const guide of this.createdGuides) {
        this.store.restoreGuide(guide);
      }
      return;
    }

    const extent = 10_000;

    for (const params of this.entityParamsList) {
      const { entityType, lineStart, lineEnd, center, clickPoint } = params;

      if ((entityType === 'LINE' || entityType === 'POLYLINE') && lineStart && lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.001) {
          const nx = dx / len;
          const ny = dy / len;
          const mid: Point2D = { x: (lineStart.x + lineEnd.x) / 2, y: (lineStart.y + lineEnd.y) / 2 };
          const start: Point2D = { x: mid.x - nx * extent, y: mid.y - ny * extent };
          const end: Point2D = { x: mid.x + nx * extent, y: mid.y + ny * extent };
          const guide = this.store.addDiagonalGuideRaw(start, end);
          if (guide) this.createdGuides.push(guide);
        }
      } else if (entityType === 'CIRCLE' && center) {
        const gx = this.store.addGuideRaw('X', center.x);
        if (gx) this.createdGuides.push(gx);
        const gy = this.store.addGuideRaw('Y', center.y);
        if (gy) this.createdGuides.push(gy);
      } else if (entityType === 'ARC' && center && clickPoint) {
        const dx = clickPoint.x - center.x;
        const dy = clickPoint.y - center.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.001) {
          const nx = dx / len;
          const ny = dy / len;
          const start: Point2D = { x: center.x - nx * extent, y: center.y - ny * extent };
          const end: Point2D = { x: center.x + nx * extent, y: center.y + ny * extent };
          const guide = this.store.addDiagonalGuideRaw(start, end);
          if (guide) this.createdGuides.push(guide);
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
    return `Guides from ${this.entityParamsList.length} entities (${this.createdGuides.length} guides)`;
  }

  canMergeWith(): boolean { return false; }

  serialize(): SerializedCommand {
    return {
      type: this.type, id: this.id, name: this.name, timestamp: this.timestamp,
      data: { entityCount: this.entityParamsList.length, createdCount: this.createdGuides.length },
      version: 1,
    };
  }

  getAffectedEntityIds(): string[] {
    return this.createdGuides.map(g => g.id);
  }
}
