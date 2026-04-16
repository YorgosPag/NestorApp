/**
 * =============================================================================
 * Areas value resolver (multi-level aware)
 * =============================================================================
 *
 * Picks the correct area measurements για το `AreaPlausibilityWarning` ανάλογα
 * με το mode του unit edit form:
 *   - Multi-level + `activeLevelId === null` → aggregated totals
 *   - Multi-level + active level                → `currentLevelData.areas`
 *   - Single-level / creation                    → flat `formData.area*` fields
 *
 * Extracted από `PropertyFieldsEditForm` για να παραμένει ο component εντός του
 * Google-style 500-line SRP limit (CLAUDE.md N.7.1).
 *
 * @module features/property-details/components/area-values-resolver
 * @since ADR-287 Batch 21
 */

import type { LevelData } from '@/types/property';

interface AreaTotalsShape {
  readonly gross: number;
  readonly net: number;
  readonly balcony: number;
  readonly terrace: number;
  readonly garden: number;
}

interface AggregatedTotalsShape {
  readonly areas: AreaTotalsShape;
}

interface FlatAreaFormData {
  readonly areaGross: number;
  readonly areaNet: number;
  readonly areaBalcony: number;
  readonly areaTerrace: number;
  readonly areaGarden: number;
}

export interface ResolvedAreaValues {
  readonly gross: number;
  readonly net: number;
  readonly balcony: number;
  readonly terrace: number;
  readonly garden: number;
}

export interface ResolveAreaValuesArgs {
  readonly formData: FlatAreaFormData;
  readonly currentLevelData: LevelData | null | undefined;
  readonly aggregatedTotals: AggregatedTotalsShape | null | undefined;
  readonly isMultiLevel: boolean;
  readonly activeLevelId: string | null;
}

export function resolveAreaValues(
  args: ResolveAreaValuesArgs,
): ResolvedAreaValues {
  const { formData, currentLevelData, aggregatedTotals, isMultiLevel, activeLevelId } = args;

  if (isMultiLevel && activeLevelId === null && aggregatedTotals) {
    return aggregatedTotals.areas;
  }

  if (isMultiLevel && activeLevelId) {
    const levelAreas = currentLevelData?.areas;
    return {
      gross: levelAreas?.gross ?? 0,
      net: levelAreas?.net ?? 0,
      balcony: levelAreas?.balcony ?? 0,
      terrace: levelAreas?.terrace ?? 0,
      garden: levelAreas?.garden ?? 0,
    };
  }

  return {
    gross: formData.areaGross,
    net: formData.areaNet,
    balcony: formData.areaBalcony,
    terrace: formData.areaTerrace,
    garden: formData.areaGarden,
  };
}
