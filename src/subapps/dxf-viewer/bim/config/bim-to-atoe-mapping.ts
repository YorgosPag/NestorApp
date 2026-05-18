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

export type BimEntityType = 'wall' | 'opening' | 'slab' | 'column' | 'beam';

export interface AtoeMappingEntry {
  /** Latin OIK-x.xx code — must match boq_categories or be a valid subcategory. */
  readonly categoryCode: string;
  readonly unit: BOQMeasurementUnit;
  /** Greek title stored in the auto-generated BOQ item. */
  readonly titleEL: string;
}

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

  const typeMap = BIM_TO_ATOE_MAPPING[entityType] as Readonly<Record<string, AtoeMappingEntry>>;
  return typeMap?.[kind] ?? null;
}
