/**
 * BIM Schedule Export — Combined preset mapper (ADR-363 §6 Phase 8 / ADR-395 §4.6).
 *
 * The cross-type geometry-derived roll-up mapper, split out of
 * `schedule-preset-mappers.ts` to keep that file under the 500-line SRP ceiling
 * (N.7.1). This module owns the ΑΤΟΕ primary-quantity derivation + the combined
 * material summary; the parent mappers file re-exports `mapCombined` so the
 * registry keeps a single import surface.
 *
 * ADR-395 §4.6 (G5): the combined preset derives its primary quantity from
 * computed geometry + the ΑΤΟΕ SSoT (`deriveAtoeQuantity` / `resolveAtoeMapping`),
 * mirroring the BOQ auto-feed bridge — the legacy `qto` field was removed.
 *
 * @see ./schedule-preset-mappers.ts
 * @see docs/centralized-systems/reference/adrs/ADR-395-bim-quantities-building-measurements.md §4.6
 */

import type { AnyBimEntity } from './schedule-preset-mappers';
import type { OpeningParams } from '../types/opening-types';
import {
  resolveAtoeMapping,
  resolveStairComponentMapping,
  resolveFoundationMapping,
  deriveAtoeQuantity,
  type BimEntityType,
  type AtoeMappingEntry,
} from '../config/bim-to-atoe-mapping';
import { computeStairBoqQuantities } from '../stairs/stair-boq-quantities';
import { resolveOpeningMaterial } from '../family-types/resolve-opening-material';
import type { ScheduleLookups, ScheduleRow } from './types';
import { safeNumber, mapBuildingHeaderCells } from './schedule-cell-helpers';

/** Entity types covered by the kind-dispatched ΑΤΟΕ table (stair + foundation handled separately). */
const COMBINED_ATOE_TYPES: ReadonlySet<string> = new Set(['wall', 'opening', 'slab', 'column', 'beam', 'railing']);

interface CombinedPrimaryQuantity {
  readonly quantity: number;
  readonly unit: string | null;
  readonly atoeCategory: string | null;
}

/**
 * Fold an ΑΤΟΕ mapping + the entity's computed geometry into the combined
 * preset's primary quantity. Shared by the foundation branch (own resolver)
 * and the generic entity-type branch so the "no mapping → zero, else derive"
 * tail isn't duplicated (N.18 / jscpd).
 */
function atoeQuantityFromMapping(
  mapping: AtoeMappingEntry | null,
  entity: AnyBimEntity,
): CombinedPrimaryQuantity {
  if (!mapping) return { quantity: 0, unit: null, atoeCategory: null };
  const geometry = entity.geometry as { area?: number; volume?: number; lengthM?: number } | undefined;
  return { quantity: deriveAtoeQuantity(mapping.unit, geometry), unit: mapping.unit, atoeCategory: mapping.categoryCode };
}

/**
 * ADR-395 §4.6 (G5) — derive the combined preset's primary quantity from
 * computed geometry + the ΑΤΟΕ SSoT, NOT from the removed `qto` field.
 * Mirrors `BimToBoqBridge` for walls/openings/slabs/columns/beams and, for
 * stairs, the geometry-derived `computeStairBoqQuantities` (concrete volume,
 * falling back to tread cladding area on non-concrete structure types).
 * Slab-openings are subtractive → no positive BOQ quantity.
 */
function combinedPrimary(entity: AnyBimEntity): CombinedPrimaryQuantity {
  if (entity.type === 'stair') {
    const q = computeStairBoqQuantities(entity.params);
    if (q.concreteVolumeM3 > 0) {
      return { quantity: q.concreteVolumeM3, unit: 'm3', atoeCategory: resolveStairComponentMapping('concrete').categoryCode };
    }
    return { quantity: q.treadCladdingAreaM2, unit: 'm2', atoeCategory: resolveStairComponentMapping('cladding').categoryCode };
  }
  // ADR-441 — foundation: ΑΤΟΕ εκτός του BimEntityType table (δικό της resolver).
  // Όγκος (m³) = NET geometry (μέσω applyFoundationGridNet για grid strips).
  if (entity.type === 'foundation') {
    return atoeQuantityFromMapping(resolveFoundationMapping(entity.kind), entity);
  }
  if (!COMBINED_ATOE_TYPES.has(entity.type)) {
    return { quantity: 0, unit: null, atoeCategory: null };
  }
  const hasParams =
    'params' in entity && entity.params !== null && typeof entity.params === 'object';
  const category =
    hasParams && 'category' in entity.params
      ? (entity.params as { category?: string }).category
      : undefined;
  // ADR-363 Φ2 — beam steel discriminator.
  const sectionKind =
    hasParams && 'sectionKind' in entity.params
      ? (entity.params as { sectionKind?: string }).sectionKind
      : undefined;
  const mapping = resolveAtoeMapping(entity.type as BimEntityType, entity.kind, category, sectionKind);
  return atoeQuantityFromMapping(mapping, entity);
}

/**
 * Material summary for an opening row in the heterogeneous `combined` table.
 * The combined roll-up keeps ONE material column (walls/columns/slabs have no
 * leaf/glass/hardware), so per-part openings are summarised: the distinct
 * labels of the two solid surfaces — κάσα (frame) + φύλλο (leaf) — joined by
 * " / ". This surfaces the per-part story ("Ξύλο / Αλουμίνιο") without the
 * default glass/metal noise that would appear on every row, and — critically —
 * reads through `resolveOpeningMaterial` so a per-part opening (whose legacy
 * single `material` field is empty) no longer shows a blank cell. Detailed
 * per-part breakdown lives in the dedicated door/window schedules.
 */
function openingCombinedMaterial(params: OpeningParams, lookups: ScheduleLookups): string {
  const mats = resolveOpeningMaterial(params);
  const distinct = Array.from(
    new Set([lookups.material(mats.frame), lookups.material(mats.leaf)]),
  ).filter(Boolean);
  return distinct.join(' / ');
}

/** Legacy single-material label for a non-opening combined row. */
function legacyCombinedMaterial(entity: AnyBimEntity, lookups: ScheduleLookups): string {
  const material =
    'params' in entity && entity.params !== null && typeof entity.params === 'object' && 'material' in entity.params
      ? (entity.params as { material?: string }).material
      : undefined;
  return lookups.material(material);
}

export function mapCombined(entity: AnyBimEntity, lookups: ScheduleLookups): ScheduleRow['cells'] {
  const primary = combinedPrimary(entity);
  const material = entity.type === 'opening'
    ? openingCombinedMaterial(entity.params, lookups)
    : legacyCombinedMaterial(entity, lookups);
  return {
    ...mapBuildingHeaderCells(entity, lookups),
    type: lookups.translateType ? lookups.translateType(entity.type) : entity.type,
    primaryQuantity: safeNumber(primary.quantity),
    primaryUnit: primary.unit,
    atoeCategory: primary.atoeCategory,
    material,
  };
}
