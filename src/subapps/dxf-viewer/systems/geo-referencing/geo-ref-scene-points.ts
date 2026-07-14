/**
 * ADR-650 M10 — building point set for AUTO-ALIGN (robust center of the plan).
 *
 * Auto-align needs a representative LOCAL point per drawing entity so
 * {@link computeRobustCenter} can find the building center while trimming a stray
 * ~17 km stamp/legend cluster + outliers (Εύρημα #1). One bbox CENTER per entity is
 * exactly the per-entity-center shape the robust estimator expects (mirrors
 * `computeRobustBounds`' input) — cheap, and independent of entity type.
 *
 * @see ../zoom/utils/robust-bounds.ts — computeRobustCenter
 * @see ../../rendering/hitTesting/entity-bounds-ssot.ts — resolveEntityBounds (SSoT)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import { resolveEntityBounds } from '../../rendering/hitTesting/entity-bounds-ssot';

/**
 * The bbox center (LOCAL canonical mm) of every entity whose bounds resolve. Entities
 * with no computable bounds (e.g. degenerate) are skipped, never invented.
 */
export function sceneEntityCenters(entities: readonly Entity[]): Point2D[] {
  const out: Point2D[] = [];
  for (const e of entities) {
    const b = resolveEntityBounds(e);
    if (!b) continue;
    out.push({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
  }
  return out;
}
