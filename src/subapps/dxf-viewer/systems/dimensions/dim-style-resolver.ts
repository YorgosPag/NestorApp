/**
 * ADR-362 Phase A2 — DIMSTYLE resolution chain.
 *
 * Render-time resolver. For a `DimensionEntity` returns the effective `DimStyle`
 * after applying overrides on top of the entity-referenced base style.
 *
 * Resolution order (last wins):
 *   1. Built-in default — ISO 129 (fallback if entity.styleId is missing)
 *   2. Entity-referenced style — `registry.getStyle(entity.styleId)`
 *   3. Per-entity overrides — `entity.overrides` (Partial<DimStyle>, D7)
 *
 * Pure functions — no side effects, easy to test in isolation.
 */

import type { DimensionEntity, DimStyle } from '../../types/dimension';
import type { DimStyleRegistry } from './dim-style-registry';

/** Full merged DIMSTYLE for an entity (built-in fallback → base → overrides). */
export function resolveDimStyle(
  entity: DimensionEntity,
  registry: DimStyleRegistry,
): DimStyle {
  const base = registry.getStyle(entity.styleId) ?? registry.getActiveStyle();
  if (!entity.overrides) return base;
  return { ...base, ...entity.overrides, id: base.id, isBuiltIn: base.isBuiltIn };
}

/**
 * Fast-path single-field lookup. Avoids the merged-object allocation when only
 * one DIMSTYLE variable is needed (hot rendering paths).
 */
export function resolveDimStyleField<K extends keyof DimStyle>(
  entity: DimensionEntity,
  registry: DimStyleRegistry,
  field: K,
): DimStyle[K] {
  const override = entity.overrides?.[field];
  if (override !== undefined) return override as DimStyle[K];
  const base = registry.getStyle(entity.styleId) ?? registry.getActiveStyle();
  return base[field];
}
