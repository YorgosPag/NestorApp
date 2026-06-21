/**
 * ADR-452 — Cut-Plane Z extents SSoT.
 *
 * Single source of truth that maps a scene entity to its vertical (Z) extents
 * in **mm above project origin** — the same convention the BIM renderers already
 * use when they build the `resolveCutState()` input (ADR-375 View Range). This
 * module centralises that per-type extraction in ONE place so the cut-plane hide
 * gate (`isHiddenByCutPlane`) lives at a single render-loop choke point
 * (`DxfRenderer.isEntityLayerSkipped`) instead of being duplicated across the
 * seven structural leaf renderers.
 *
 * Raw DXF primitives (line/arc/text/dimension/…) and BIM types we do not yet
 * gate (roof / railing / furniture / MEP) return `null` ⇒ NEVER hidden by the
 * cut plane (they fall through to the normal visibility pipeline).
 *
 * Units: all values are mm, compared directly against `ViewRange.cutPlaneMm`
 * (also mm). The comparison is therefore independent of the DXF scene units.
 */

import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewRange } from '../../config/bim-view-range';

/** Vertical extents of an entity, mm above project origin. */
export interface EntityZExtentsMm {
  zBottomMm: number;
  zTopMm: number;
}

/**
 * Read a nested BIM entity's `.params` whether the value is the wrapped
 * `DxfEntityUnion` variant (BIM nested under `<type>Entity`, the canvas render
 * path) OR the FLAT scene entity that `SlabPersistenceHost` /
 * `SlabOpeningPersistenceHost` / … push into `Bim3DEntitiesStore`
 * (`currentScene.entities.filter(...)`, params at the top level). Both shapes flow
 * into `getEntityZExtents` via the cut-plane range, so this guards the latter from
 * crashing on the missing wrapper (`undefined.params`).
 */
function nestedParams<T>(wrapper: { params: T } | undefined, entity: DxfEntityUnion): T {
  return (wrapper ?? (entity as unknown as { params: T })).params;
}

/**
 * Resolve the Z extents (mm) of a scene entity, or `null` when the entity has no
 * meaningful vertical extent for cut-plane purposes (raw DXF, or a BIM type not
 * gated in v1). The per-type formulas MIRROR the existing `resolveCutState()`
 * inputs in each renderer — keep them in lock-step if a renderer changes.
 */
export function getEntityZExtents(entity: DxfEntityUnion): EntityZExtentsMm | null {
  switch (entity.type) {
    // Walls & columns: base face + height (baseOffset absent ⇒ 0).
    case 'wall':
    case 'column': {
      const base = entity.params.baseOffset ?? 0;
      return { zBottomMm: base, zTopMm: base + entity.params.height };
    }
    // Beams hang DOWN by `depth` from their top face (topElevation + drop offset).
    case 'beam': {
      const top = entity.params.topElevation + (entity.params.zOffset ?? 0);
      return { zBottomMm: top - entity.params.depth, zTopMm: top };
    }
    // Slabs hang DOWN by `thickness` from their top FFL. NOTE: the canvas render
    // path nests the BIM entity under `slabEntity`, but the Bim3DEntitiesStore feed
    // is the FLAT scene entity (params at top level) — `nestedParams` handles both.
    case 'slab': {
      const p = nestedParams(entity.slabEntity, entity);
      const top = p.levelElevation + (p.heightOffsetFromLevel ?? 0);
      return { zBottomMm: top - p.thickness, zTopMm: top };
    }
    // Slab opening: stub 200 mm band below its override elevation (mirrors renderer).
    case 'slab-opening': {
      const top = nestedParams(entity.slabOpeningEntity, entity).elevationOverride ?? 0;
      return { zBottomMm: top - 200, zTopMm: top };
    }
    // Stair: base point Z + total rise.
    case 'stair': {
      const p = nestedParams(entity.stairEntity, entity);
      return { zBottomMm: p.basePoint.z, zTopMm: p.basePoint.z + p.totalRise };
    }
    // Wall opening (door/window): sill height + opening height.
    case 'opening': {
      const p = nestedParams(entity.openingEntity, entity);
      return { zBottomMm: p.sillHeight, zTopMm: p.sillHeight + p.height };
    }
    // Foundation hangs DOWN by `thicknessMm` from its (typically negative) top face.
    case 'foundation': {
      const top = entity.params.topElevationMm;
      return { zBottomMm: top - entity.params.thicknessMm, zTopMm: top };
    }
    default:
      return null;
  }
}

/**
 * Cut-plane hide rule (Revit View Range, single-plane simplification): an entity
 * is hidden ⇔ the cut plane is ACTIVE and the entity's BASE sits strictly ABOVE
 * the cut elevation. Everything at or below the plane stays visible (it is either
 * "cut" or seen in projection below). Entities with no Z extent are never hidden.
 *
 * Pure + side-effect-free so it is safe to call inside the per-entity render gate.
 */
export function isHiddenByCutPlane(
  entity: DxfEntityUnion,
  viewRange: ViewRange,
  cutPlaneActive: boolean,
): boolean {
  if (!cutPlaneActive) return false;
  const ext = getEntityZExtents(entity);
  if (!ext) return false;
  return ext.zBottomMm > viewRange.cutPlaneMm;
}
