/**
 * HitTester Utility Functions — ADR-065 SRP split
 * Filters, priority calculation, normalization, bounds calculation.
 * Extracted from HitTester.ts.
 */

import type { Entity } from '../../types/entities';
import type { SpatialQueryResult } from '../../core/spatial';
import type { HitTestOptions } from './hit-tester-types';
import { BoundingBox, BoundsCalculator } from './Bounds';
import { getLayerNameOrDefault } from '../../config/layer-config';
import { createInfinityBounds, isInfinityBounds } from '../../config/geometry-constants';

/** Calculate bounds from an array of entities */
export function calculateBoundsFromEntities(entities: Entity[]): BoundingBox | null {
  if (!entities.length) return null;

  const bounds = createInfinityBounds();

  for (const entity of entities) {
    try {
      const entityBounds = BoundsCalculator.calculateEntityBounds(entity, 0);
      if (entityBounds) {
        bounds.minX = Math.min(bounds.minX, entityBounds.minX);
        bounds.minY = Math.min(bounds.minY, entityBounds.minY);
        bounds.maxX = Math.max(bounds.maxX, entityBounds.maxX);
        bounds.maxY = Math.max(bounds.maxY, entityBounds.maxY);
      }
    } catch {
      continue;
    }
  }

  if (isInfinityBounds(bounds)) return null;

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  return {
    minX: bounds.minX, minY: bounds.minY,
    maxX: bounds.maxX, maxY: bounds.maxY,
    width, height,
    centerX: bounds.minX + width / 2,
    centerY: bounds.minY + height / 2,
  };
}

/** Calculate bounds for a single entity */
export function calculateEntityBounds(entity: Entity): BoundingBox | null {
  try {
    return BoundsCalculator.calculateEntityBounds(entity, 0);
  } catch (error) {
    console.warn(`Failed to calculate bounds for entity ${entity.id}:`, error);
    return null;
  }
}

/** Calculate entity priority for hit-test sorting */
export function calculatePriority(entity: Entity): number {
  let priority = 0;
  switch (entity.type) {
    case 'point': priority += 100; break;
    case 'line': priority += 80; break;
    case 'circle': priority += 70; break;
    case 'text': priority += 60; break;
    default: priority += 50; break;
  }

  const entityWithLayer = entity as { layer?: string };
  const layer = entityWithLayer.layer;
  if (layer === 'construction') priority -= 20;
  if (layer === 'annotation') priority += 10;

  return priority;
}

/** Check if entity passes filter options */
export function passesFilters(entity: Entity, options: HitTestOptions): boolean {
  const entityWithVisibility = entity as { visible?: boolean };
  if (!options.includeInvisible && entityWithVisibility.visible === false) return false;

  const entityWithLayer = entity as { layer?: string };
  const entityLayer = entityWithLayer.layer;
  if (options.layerFilter?.length && (!entityLayer || !options.layerFilter.includes(entityLayer))) {
    return false;
  }

  if (options.typeFilter?.length && !options.typeFilter.includes(entity.type)) {
    return false;
  }

  return true;
}

/** Type guard for Entity */
export function isEntity(value: unknown): value is Entity {
  if (!value || typeof value !== 'object') return false;
  if (!('id' in value) || !('type' in value)) return false;
  return typeof (value as { id?: unknown }).id === 'string';
}

/** Normalize spatial query results to ensure Entity data access */
export function normalizeResults(results: SpatialQueryResult[]): SpatialQueryResult<Entity>[] {
  return results
    .map(result => normalizeResult(result))
    .filter((result): result is SpatialQueryResult<Entity> => Boolean(result));
}

function normalizeResult(result: SpatialQueryResult): SpatialQueryResult<Entity> | null {
  const directEntity = isEntity(result.data) ? result.data : null;
  const itemEntity = !directEntity && isEntity(result.item?.data) ? result.item.data : null;
  const entity = directEntity ?? itemEntity;
  if (!entity) return null;

  return {
    ...result,
    data: entity,
    item: { ...result.item, data: entity },
  };
}

/** Get layer name with fallback via ADR-130 */
export { getLayerNameOrDefault };
