/**
 * BIM → ΑΤΟΕ Mapping Config (ADR-363 Phase 6)
 *
 * Resolves BIM entity type + kind/category → ΑΤΟΕ category code + BOQ unit.
 * Single Source of Truth for BIM-to-BOQ auto-feed category assignment.
 * Phase 6.2 will derive mappings from material library (bim_materials.atoeCode).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see docs/centralized-systems/reference/adrs/ADR-175-quantity-surveying-measurements-system.md
 */

import type { BOQMeasurementUnit } from '@/types/boq';
import type { WallCategory } from '../types/wall-types';
import type { OpeningKind } from '../types/opening-types';
import type { SlabKind } from '../types/slab-types';
import type { ColumnKind } from '../types/column-types';
import type { BeamKind } from '../types/beam-types';

// ============================================================================
// TYPES
// ============================================================================

export type BimEntityType = 'wall' | 'opening' | 'slab' | 'column' | 'beam' | 'stair';

export interface AtoeMappingEntry {
  /** Latin OIK-x.xx code — must match boq_categories or be a valid subcategory. */
  readonly categoryCode: string;
  readonly unit: BOQMeasurementUnit;
  /** Greek title stored in the auto-generated BOQ item. */
  readonly titleEL: string;
}

/**
 * ADR-395 Phase 2 (G1) — a stair is NOT a single-row entity like walls/slabs.
 * It produces THREE independent BOQ rows (Revit Material Takeoff pattern):
 * concrete (m³) + tread cladding (m²) + handrail (m). Each row is keyed by a
 * fixed component (not the stair `kind`), so it lives outside the
 * kind-dispatched `BIM_TO_ATOE_MAPPING` table and is resolved via
 * `resolveStairComponentMapping`.
 */
export type StairBoqComponent = 'concrete' | 'cladding' | 'handrail';

// ============================================================================
// MAPPING TABLE
// ============================================================================

const WALL_MAPPING: Readonly<Record<WallCategory, AtoeMappingEntry>> = {
  exterior:  { categoryCode: 'OIK-3.05', unit: 'm2', titleEL: 'Τοιχοποιία εξωτερική (BIM)' },
  interior:  { categoryCode: 'OIK-3.06', unit: 'm2', titleEL: 'Τοιχοποιία εσωτερική (BIM)' },
  partition: { categoryCode: 'OIK-3.06', unit: 'm2', titleEL: 'Τοιχοποιία διαχωριστική (BIM)' },
  parapet:   { categoryCode: 'OIK-3.05', unit: 'm2', titleEL: 'Στηθαίο τοιχοποιία (BIM)' },
  fence:     { categoryCode: 'OIK-3.05', unit: 'm2', titleEL: 'Τοιχοποιία περίφραξης (BIM)' },
};

const OPENING_MAPPING: Readonly<Record<OpeningKind, AtoeMappingEntry>> = {
  'door':         { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα πόρτας (BIM)' },
  'window':       { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα παραθύρου (BIM)' },
  'sliding-door': { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα συρόμενο (BIM)' },
  'french-door':  { categoryCode: 'OIK-5.01', unit: 'pcs', titleEL: 'Κούφωμα γαλλικής πόρτας (BIM)' },
  'fixed':        { categoryCode: 'OIK-5.02', unit: 'pcs', titleEL: 'Κούφωμα σταθερό (BIM)' },
};

const SLAB_MAPPING: Readonly<Record<SlabKind, AtoeMappingEntry>> = {
  floor:      { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα ορόφου RC (BIM)' },
  ceiling:    { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα οροφής RC (BIM)' },
  roof:       { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα στέγης RC (BIM)' },
  ground:     { categoryCode: 'OIK-2.01', unit: 'm3', titleEL: 'Πλάκα ισογείου RC (BIM)' },
  foundation: { categoryCode: 'OIK-2.02', unit: 'm3', titleEL: 'Πλάκα θεμελίωσης (BIM)' },
};

const COLUMN_MAPPING: Readonly<Record<ColumnKind, AtoeMappingEntry>> = {
  'rectangular': { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC ορθογωνική (BIM)' },
  'circular':    { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC κυκλική (BIM)' },
  'L-shape':     { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC Γ-τομής (BIM)' },
  'T-shape':     { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC Τ-τομής (BIM)' },
  'polygon':     { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Κολώνα RC πολυγωνική (BIM)' },
  'shear-wall':  { categoryCode: 'OIK-2.03', unit: 'm3', titleEL: 'Τοιχείο RC (BIM)' },
  'I-shape':     { categoryCode: 'OIK-12.10', unit: 'kg', titleEL: 'Κολώνα μεταλλική Ι-τομής (BIM)' },
};

/**
 * ADR-395 Phase 2 (G1) — stair component → ΑΤΟΕ. Three fixed rows per stair:
 *   - concrete  → OIK-2 Σκυροδέματα (next after slab/column/beam 2.01-2.04)
 *   - cladding  → OIK-5 Πατώματα/Δάπεδα (tread surface, marble/tile)
 *   - handrail  → OIK-12 Μεταλλικά (master catalog explicitly lists «κάγκελα, σκάλες»)
 */
const STAIR_COMPONENT_MAPPING: Readonly<Record<StairBoqComponent, AtoeMappingEntry>> = {
  concrete: { categoryCode: 'OIK-2.05',  unit: 'm3', titleEL: 'Σκάλα σκυρόδεμα (BIM)' },
  cladding: { categoryCode: 'OIK-5.05',  unit: 'm2', titleEL: 'Σκάλα επένδυση πατημάτων (BIM)' },
  handrail: { categoryCode: 'OIK-12.01', unit: 'm',  titleEL: 'Σκάλα κουπαστή (BIM)' },
};

const BEAM_MAPPING: Readonly<Record<BeamKind, AtoeMappingEntry>> = {
  straight:    { categoryCode: 'OIK-2.04', unit: 'm3', titleEL: 'Δοκός RC ευθύγραμμη (BIM)' },
  curved:      { categoryCode: 'OIK-2.04', unit: 'm3', titleEL: 'Δοκός RC καμπύλη (BIM)' },
  cantilever:  { categoryCode: 'OIK-2.04', unit: 'm3', titleEL: 'Πρόβολος RC (BIM)' },
};

/** Lookup map keyed by entity type for runtime dispatch. */
export const BIM_TO_ATOE_MAPPING = {
  wall:    WALL_MAPPING,
  opening: OPENING_MAPPING,
  slab:    SLAB_MAPPING,
  column:  COLUMN_MAPPING,
  beam:    BEAM_MAPPING,
} as const;

// ============================================================================
// RESOLVER
// ============================================================================

/**
 * Resolve the ΑΤΟΕ mapping for a BIM entity.
 *
 * @param entityType  'wall' | 'opening' | 'slab' | 'column' | 'beam'
 * @param kind        entity.kind (e.g. 'straight', 'door', 'floor')
 * @param category    entity.params.category — required for walls (WallCategory discriminator)
 * @returns AtoeMappingEntry or null when entityType/kind is unknown
 */
export function resolveAtoeMapping(
  entityType: BimEntityType,
  kind: string,
  category?: string,
): AtoeMappingEntry | null {
  if (entityType === 'wall') {
    const wallCategory = category as WallCategory | undefined;
    if (!wallCategory) return null;
    return WALL_MAPPING[wallCategory] ?? null;
  }

  // Stair is multi-row (concrete/cladding/handrail) — resolved per component,
  // never per kind. Callers use `resolveStairComponentMapping` instead.
  if (entityType === 'stair') return null;

  const typeMap = BIM_TO_ATOE_MAPPING[entityType] as Readonly<Record<string, AtoeMappingEntry>>;
  return typeMap?.[kind] ?? null;
}

/** Resolve the ΑΤΟΕ mapping for a single stair BOQ component (ADR-395 §G1). */
export function resolveStairComponentMapping(component: StairBoqComponent): AtoeMappingEntry {
  return STAIR_COMPONENT_MAPPING[component];
}

/**
 * Derive the primary BOQ quantity from a unit + computed geometry cache.
 *
 * SSoT for the geometry→quantity rule shared by the auto-feed bridge
 * (`BimToBoqBridge`) and the Schedule combined preset (`mapCombined`):
 *   - `pcs` → 1 (openings count as one piece)
 *   - `m2`  → `geometry.area`
 *   - `m3`  → `geometry.volume`
 *
 * ADR-395 §4.6 (G5): geometry is the single source of truth for BIM
 * quantities — the legacy `entity.qto` field was never populated and was
 * removed. Anything reading a primary quantity reads it from geometry here.
 */
export function deriveAtoeQuantity(
  unit: BOQMeasurementUnit,
  geometry?: { readonly area?: number; readonly volume?: number } | null,
): number {
  if (unit === 'pcs') return 1;
  if (unit === 'm2') return geometry?.area ?? 0;
  if (unit === 'm3') return geometry?.volume ?? 0;
  return 0;
}
