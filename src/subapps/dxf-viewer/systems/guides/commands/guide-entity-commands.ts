/**
 * @module systems/guides/commands/guide-entity-commands
 * @description Commands for creating guides from DXF entities
 *
 * @see ADR-189 B8 (Guide from entity), B24 (Offset from entity), B37 (Batch from entities)
 * @see ADR-613 (Guide command SSoT — CreatedGuidesCommand + geometry helpers)
 * @since 2026-02-19
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../guide-types';
import type { GuideStore } from '../guide-store';
import { CreatedGuidesCommand } from './guide-command-base';
import {
  buildGuidesFromEntityParams,
  extendThroughPoint,
  unitDirection,
  GUIDE_ENTITY_EXTENT,
} from './guide-command-geometry';

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
export class GuideFromEntityCommand extends CreatedGuidesCommand {
  readonly name = 'GuideFromEntity';
  readonly type = 'guide-from-entity';

  constructor(
    store: GuideStore,
    private readonly params: EntityGuideParams,
  ) {
    super(store);
  }

  protected buildGuides(): Guide[] {
    return buildGuidesFromEntityParams(this.store, this.params);
  }

  getDescription(): string {
    const n = this.createdGuides.length;
    return `Guide from ${this.params.entityType} entity (${n} guide${n !== 1 ? 's' : ''})`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      entityType: this.params.entityType,
      createdGuideIds: this.createdGuides.map((g) => g.id),
    };
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
export class GuideOffsetFromEntityCommand extends CreatedGuidesCommand {
  readonly name = 'GuideOffsetFromEntity';
  readonly type = 'guide-offset-entity';

  constructor(
    store: GuideStore,
    private readonly params: EntityGuideParams,
    private readonly offsetDistance: number,
  ) {
    super(store);
  }

  protected buildGuides(): Guide[] {
    const { entityType, lineStart, lineEnd, center } = this.params;
    const offset = this.offsetDistance;
    const created: Guide[] = [];

    if ((entityType === 'LINE' || entityType === 'POLYLINE') && lineStart && lineEnd) {
      const dir = unitDirection(lineStart, lineEnd);
      if (dir) {
        const normal: Point2D = { x: -dir.y, y: dir.x };
        const mid: Point2D = { x: (lineStart.x + lineEnd.x) / 2, y: (lineStart.y + lineEnd.y) / 2 };

        for (const sign of [1, -1]) {
          const shiftedMid: Point2D = { x: mid.x + normal.x * offset * sign, y: mid.y + normal.y * offset * sign };
          const { start, end } = extendThroughPoint(shiftedMid, dir, GUIDE_ENTITY_EXTENT);
          const guide = this.store.addDiagonalGuideRaw(start, end);
          if (guide) created.push(guide);
        }
      }
    } else if (entityType === 'CIRCLE' && center) {
      for (const sign of [1, -1]) {
        const gx = this.store.addGuideRaw('X', center.x + offset * sign);
        if (gx) created.push(gx);
        const gy = this.store.addGuideRaw('Y', center.y + offset * sign);
        if (gy) created.push(gy);
      }
    }

    return created;
  }

  getDescription(): string {
    return `Offset ${this.offsetDistance}m from ${this.params.entityType} (${this.createdGuides.length} guides)`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      entityType: this.params.entityType,
      offset: this.offsetDistance,
      createdGuideIds: this.createdGuides.map((g) => g.id),
    };
  }
}

// ============================================================================
// BATCH GUIDE FROM ENTITIES COMMAND (ADR-189 B37)
// ============================================================================

/**
 * Creates guides from multiple selected entities (batch version of B8).
 * Reuses the same entity -> guide logic as GuideFromEntityCommand.
 */
export class BatchGuideFromEntitiesCommand extends CreatedGuidesCommand {
  readonly name = 'BatchGuideFromEntities';
  readonly type = 'batch-guide-from-entities';

  constructor(
    store: GuideStore,
    private readonly entityParamsList: readonly EntityGuideParams[],
  ) {
    super(store);
  }

  protected buildGuides(): Guide[] {
    return this.entityParamsList.flatMap((params) => buildGuidesFromEntityParams(this.store, params));
  }

  getDescription(): string {
    return `Guides from ${this.entityParamsList.length} entities (${this.createdGuides.length} guides)`;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      entityCount: this.entityParamsList.length,
      createdCount: this.createdGuides.length,
    };
  }
}
