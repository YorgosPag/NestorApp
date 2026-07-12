/**
 * ZOOM SYSTEM - ENTITY BOUNDS UTILITIES
 * Extracted from bounds.ts for SRP (ADR-065)
 *
 * Contains:
 * - Entity-level bounds calculation (getEntityBounds)
 * - Legacy bounds format converters
 * - Tight bounds calculation + position normalization
 *
 * @see ADR-010: Bounds Consolidation
 */

import type { Point2D } from '../../../rendering/types/Types';
// ADR-557 Φ-attachment (Φάση B) — attachment/rotation/widthFactor-aware text-box SSoT + the
// scene→flat projection it consumes, replacing the bespoke CHAR_WIDTH_WIDE monospace box.
import { textBoxAABB } from '../../../bim/text/text-box';
import { projectSceneTextToDxf } from '../../../bim/text/project-scene-text';
import { DEFAULT_BOUNDS } from '../../../config/geometry-constants';
import { createInfinityBounds, isInfinityBounds, expandInfinityBounds } from '../../../config/geometry-constants';
import { isValidPoint } from '../../../rendering/entities/shared/entity-validation-utils';
import type { Bounds } from './bounds';
// ADR-640 — a BLOCK instance (preserved DXF INSERT) must contribute its placed members' real
// bbox to zoom-extents / selection bounds, NOT a zero-size insertion point. Reuses the render
// expander SSoT so the bounds match exactly where the block draws.
import { expandBlockInstance } from '../../block/block-expander';
import type { BlockEntity } from '../../../types/entities';

// ============================================================================
// ENTITY BOUNDS CALCULATION
// ============================================================================

/**
 * Entity interface for bounds calculation.
 * Supports all common entity types without coupling to specific type systems.
 */
export interface BoundsEntity {
  type: string;
  start?: Point2D;
  end?: Point2D;
  vertices?: Point2D[];
  center?: Point2D;
  radius?: number;
  position?: Point2D;
  text?: string;
  height?: number;
  x?: number;
  y?: number;
  width?: number;
  /** ADR-635 — HATCH world-space geometry: rings of {x,y}. No primitive start/center field. */
  boundaryPaths?: Point2D[][];
}

/**
 * Legacy bounds format for backward compatibility.
 */
export interface LegacyBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Mutable entity interface for position normalization.
 */
export interface MutableBoundsEntity extends BoundsEntity {
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  position?: { x: number; y: number };
  boundaryPaths?: Array<Array<{ x: number; y: number }>>;
}

// ============================================================================
// ENTITY BOUNDS
// ============================================================================

/**
 * Get bounds for a single entity.
 * Returns modern Bounds format { min, max }.
 */
/** Degenerate (zero-size) bounds at a single insertion point — shared by the `point` case
 *  and the `block` empty-member fallback so both express "min === max === position" once. */
function pointBounds(position: Point2D): Bounds {
  return {
    min: { x: position.x, y: position.y },
    max: { x: position.x, y: position.y }
  };
}

export function getEntityBounds(entity: BoundsEntity): Bounds | null {
  switch (entity.type) {
    case 'line': {
      if (entity.start && entity.end) {
        return {
          min: {
            x: Math.min(entity.start.x, entity.end.x),
            y: Math.min(entity.start.y, entity.end.y)
          },
          max: {
            x: Math.max(entity.start.x, entity.end.x),
            y: Math.max(entity.start.y, entity.end.y)
          }
        };
      }
      break;
    }

    case 'polyline':
    case 'lwpolyline': {
      if (entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 0) {
        const polyBounds = createInfinityBounds();

        for (const vertex of entity.vertices) {
          if (isValidPoint(vertex)) {
            expandInfinityBounds(polyBounds, vertex.x, vertex.y);
          }
        }

        if (!isInfinityBounds(polyBounds)) {
          return {
            min: { x: polyBounds.minX, y: polyBounds.minY },
            max: { x: polyBounds.maxX, y: polyBounds.maxY }
          };
        }
      }
      break;
    }

    case 'circle':
    case 'arc': {
      if (entity.center && entity.radius !== undefined) {
        return {
          min: {
            x: entity.center.x - entity.radius,
            y: entity.center.y - entity.radius
          },
          max: {
            x: entity.center.x + entity.radius,
            y: entity.center.y + entity.radius
          }
        };
      }
      break;
    }

    case 'text':
    case 'mtext': {
      if (entity.position) {
        // ADR-557 Φ-attachment (Φάση B) — zoom bounds via the text-box SSoT instead of a
        // monospace CHAR_WIDTH_WIDE box (attachment-blind, rotation-blind, no MTEXT). The spread
        // preserves any runtime style/rotation/textNode/widthFactor fields this loose interface
        // under-declares, so the SSoT measures the real box. Empty id: bounds ignore it.
        const b = textBoxAABB(projectSceneTextToDxf({ ...entity, position: entity.position }, ''));
        return { min: { x: b.minX, y: b.minY }, max: { x: b.maxX, y: b.maxY } };
      }
      break;
    }

    case 'rectangle':
    case 'rect': {
      if (entity.x !== undefined && entity.y !== undefined &&
          entity.width !== undefined && entity.height !== undefined) {
        return {
          min: { x: entity.x, y: entity.y },
          max: { x: entity.x + entity.width, y: entity.y + entity.height }
        };
      }
      break;
    }

    case 'point': {
      if (entity.position) return pointBounds(entity.position);
      break;
    }

    case 'hatch': {
      // ADR-635 — a HATCH keeps its world-space geometry in `boundaryPaths` (rings of {x,y}),
      // never in a primitive start/center field, so bounds must scan the rings explicitly.
      // WITHOUT this the import's bottom-left→(0,0) normalization (io/dxf-import.ts →
      // calculateTightBounds) both EXCLUDED the hatch from the offset AND left it untranslated:
      // every other entity shifted to the origin while the hatch stayed at its absolute coords,
      // stranding it thousands of units away (repro: ΓΡΑΜΜΟΣΚΙΑΣΗ_ΜΕ_ΜΠΛΟΚ — «hatch & μπλοκ
      // σε μεγάλες αποστάσεις», 2026-07-12). Mirrors scene-builder (Φ C.13) & culling (Φ C.9).
      const hatchBounds = createInfinityBounds();
      for (const ring of entity.boundaryPaths ?? []) {
        for (const v of ring) {
          if (isValidPoint(v)) expandInfinityBounds(hatchBounds, v.x, v.y);
        }
      }
      if (!isInfinityBounds(hatchBounds)) {
        return {
          min: { x: hatchBounds.minX, y: hatchBounds.minY },
          max: { x: hatchBounds.maxX, y: hatchBounds.maxY }
        };
      }
      break;
    }

    case 'block': {
      // ADR-640 — real bbox: expand the block's placed members and union their bounds (reuses the
      // render SSoT). Falls back to the insertion point only for an empty/degenerate block.
      const block = entity as unknown as BlockEntity;
      if (Array.isArray(block.entities) && block.entities.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const member of expandBlockInstance(block)) {
          const b = getEntityBounds(member as unknown as BoundsEntity);
          if (!b) continue;
          minX = Math.min(minX, b.min.x); minY = Math.min(minY, b.min.y);
          maxX = Math.max(maxX, b.max.x); maxY = Math.max(maxY, b.max.y);
        }
        if (Number.isFinite(minX)) return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
      }
      if (entity.position) return pointBounds(entity.position);
      break;
    }
  }

  return null;
}

// ============================================================================
// LEGACY FORMAT CONVERTERS
// ============================================================================

/**
 * Get bounds in legacy format { minX, minY, maxX, maxY }.
 * @deprecated Prefer getEntityBounds() which returns modern Bounds format.
 */
export function getEntityBoundsLegacy(entity: BoundsEntity): LegacyBounds | null {
  const bounds = getEntityBounds(entity);
  if (!bounds) return null;

  return {
    minX: bounds.min.x,
    minY: bounds.min.y,
    maxX: bounds.max.x,
    maxY: bounds.max.y
  };
}

/**
 * Convert legacy bounds to modern Bounds format.
 */
export function legacyToModernBounds(legacy: LegacyBounds): Bounds {
  return {
    min: { x: legacy.minX, y: legacy.minY },
    max: { x: legacy.maxX, y: legacy.maxY }
  };
}

/**
 * Convert modern Bounds to legacy format.
 */
export function modernToLegacyBounds(modern: Bounds): LegacyBounds {
  return {
    minX: modern.min.x,
    minY: modern.min.y,
    maxX: modern.max.x,
    maxY: modern.max.y
  };
}

// ============================================================================
// SCENE BOUNDS NORMALIZATION
// ============================================================================

/**
 * Calculate tight bounds from entity array.
 *
 * Calculates precise bounds from all entities and optionally normalizes
 * positions so that bottom-left corner is at (0,0).
 */
export function calculateTightBounds(
  entities: BoundsEntity[],
  normalize: boolean = false
): Bounds {
  if (entities.length === 0) {
    return { ...DEFAULT_BOUNDS };
  }

  const bounds = createInfinityBounds();

  for (const entity of entities) {
    try {
      const entityBounds = getEntityBounds(entity);
      if (entityBounds) {
        bounds.minX = Math.min(bounds.minX, entityBounds.min.x);
        bounds.minY = Math.min(bounds.minY, entityBounds.min.y);
        bounds.maxX = Math.max(bounds.maxX, entityBounds.max.x);
        bounds.maxY = Math.max(bounds.maxY, entityBounds.max.y);
      }
    } catch (error) {
      console.warn('Error processing entity bounds:', entity, error);
    }
  }

  if (isInfinityBounds(bounds)) {
    console.warn('Invalid bounds calculated, using defaults');
    return { ...DEFAULT_BOUNDS };
  }

  if (normalize) {
    const offsetX = -bounds.minX;
    const offsetY = -bounds.minY;
    normalizeEntityPositions(entities as MutableBoundsEntity[], offsetX, offsetY);

    return {
      min: { x: 0, y: 0 },
      max: { x: bounds.maxX - bounds.minX, y: bounds.maxY - bounds.minY }
    };
  }

  return {
    min: { x: bounds.minX, y: bounds.minY },
    max: { x: bounds.maxX, y: bounds.maxY }
  };
}

/**
 * Calculate tight bounds and normalize positions.
 * Wrapper for calculateTightBounds with normalize=true.
 */
export function calculateTightBoundsNormalized(entities: MutableBoundsEntity[]): Bounds {
  return calculateTightBounds(entities, true);
}

/**
 * Normalize entity positions.
 * Applies offset to all entities so that bottom-left corner is at (0,0).
 * Mutates entities in place for performance.
 */
export function normalizeEntityPositions(
  entities: MutableBoundsEntity[],
  offsetX: number,
  offsetY: number
): void {
  for (const entity of entities) {
    try {
      switch (entity.type) {
        case 'line': {
          if (entity.start && entity.end) {
            entity.start.x += offsetX;
            entity.start.y += offsetY;
            entity.end.x += offsetX;
            entity.end.y += offsetY;
          }
          break;
        }

        case 'polyline':
        case 'lwpolyline': {
          if (entity.vertices && Array.isArray(entity.vertices)) {
            for (const vertex of entity.vertices) {
              if (isValidPoint(vertex)) {
                vertex.x += offsetX;
                vertex.y += offsetY;
              }
            }
          }
          break;
        }

        case 'circle':
        case 'arc': {
          if (entity.center) {
            entity.center.x += offsetX;
            entity.center.y += offsetY;
          }
          break;
        }

        case 'text':
        case 'point':
        case 'block': {
          if (entity.position) {
            entity.position.x += offsetX;
            entity.position.y += offsetY;
          }
          break;
        }

        case 'hatch': {
          // ADR-635 — translate the hatch's boundary rings exactly like every other geometry so
          // the import recenter moves it WITH its siblings instead of stranding it at absolute
          // coords (see the getEntityBounds 'hatch' case for the full repro/rationale).
          for (const ring of entity.boundaryPaths ?? []) {
            for (const vertex of ring) {
              if (isValidPoint(vertex)) {
                vertex.x += offsetX;
                vertex.y += offsetY;
              }
            }
          }
          break;
        }

        case 'rectangle':
        case 'rect': {
          if (entity.x !== undefined && entity.y !== undefined) {
            (entity as { x: number; y: number }).x += offsetX;
            (entity as { x: number; y: number }).y += offsetY;
          }
          break;
        }
      }
    } catch (error) {
      console.warn('Error normalizing entity:', entity, error);
    }
  }
}
