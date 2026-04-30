/**
 * floor-helpers — Pure helpers for floor↔property resolution
 *
 * Single-level + multi-level (ADR-236) aware. Consumed by ADR-329 BOQ scope
 * pickers (UI) and the cost allocation engine (service). Lives under `lib/`
 * to keep the service layer free of UI-tree imports.
 *
 * @module lib/properties/floor-helpers
 * @see ADR-329 §3.7.1 (visibility), ADR-236 (multi-level)
 */

import type { Property } from '@/types/property';

/**
 * Returns properties that occupy the given floor, including multi-level
 * properties whose `levels[]` array contains the floor.
 *
 * ADR-329 §3.7.1 — Επιλογή Γ: multi-level property εμφανίζεται σε όλους
 * τους ορόφους που πιάνει (όχι μόνο στον primary).
 */
export function propertiesOnFloor(floorId: string, properties: Property[]): Property[] {
  if (!floorId) return [];
  return properties.filter((p) => {
    if (p.floorId === floorId) return true;
    if (p.levels && p.levels.some((l) => l.floorId === floorId)) return true;
    return false;
  });
}

/**
 * Returns the area contribution of `property` on `floorId`:
 * - Multi-level with `levelData[floorId].areas.gross` → that partial area
 * - Multi-level without per-level data → fallback `property.areas.gross` (whole)
 * - Single-level (property.floorId === floorId) → `property.areas.gross`
 * - Otherwise → null (not on floor)
 *
 * ADR-329 §3.7.2 — partial-area cost allocation.
 */
export function propertyAreaOnFloor(
  property: Property,
  floorId: string,
): { area: number; isPartial: boolean; isFallback: boolean } | null {
  const onSingleLevel = property.floorId === floorId;
  const onMultiLevel = property.levels?.some((l) => l.floorId === floorId) ?? false;
  if (!onSingleLevel && !onMultiLevel) return null;

  if (onMultiLevel) {
    const partial = property.levelData?.[floorId]?.areas?.gross;
    if (typeof partial === 'number' && partial > 0) {
      return { area: partial, isPartial: true, isFallback: false };
    }
    const total = property.areas?.gross ?? 0;
    return { area: total, isPartial: false, isFallback: true };
  }

  const total = property.areas?.gross ?? 0;
  return { area: total, isPartial: false, isFallback: false };
}
