/**
 * @related ADR-186 §8 Q3+Q4 — Provenance + zone auto-fill helpers
 *
 * Pure helpers for the Phase 2 building-code draft. Kept separate from the
 * hook so the hook stays under the 500-line file budget and these mutations
 * remain unit-testable without a React renderer.
 */
import type {
  BuildingCodeProvenance,
  PlotFrontage,
  ProjectBuildingCodePhase2,
} from '@/types/project-building-code';
import type { PlotType } from '@/services/building-code/types/site.types';
import {
  ZONE_PARAMETERS,
} from '@/services/building-code/constants/zones.constants';
import { lookupZone } from '@/services/building-code/engines/zone-resolver';
import { expectedFrontagesForPlotType } from '@/services/building-code/validation/validate-phase2';

/**
 * Empty draft when a project has no `buildingCode` yet.
 * Sensible Greek-housing defaults; user must confirm via Save.
 */
export function createEmptyDraft(): ProjectBuildingCodePhase2 {
  return {
    plotType: 'mesaio',
    frontagesCount: 1,
    frontages: [{ index: 1 }],
    zoneId: null,
    sd: 0,
    coveragePct: 0,
    maxHeight: 0,
    provenance: { sd: 'user', coveragePct: 'user', maxHeight: 'user' },
    enabled: true,
    lastUpdated: new Date(0).toISOString(),
  };
}

/**
 * Apply a zone selection to the draft.
 * - When zoneId resolves: sd / coveragePct / maxHeight auto-fill from
 *   `ZONE_PARAMETERS`, and their provenance flips to 'zone'.
 * - When zoneId is null or unknown: numeric values are kept as-is and
 *   provenance is forced to 'user' (free-input mode).
 */
export function applyZoneSelection(
  draft: ProjectBuildingCodePhase2,
  zoneId: string | null,
): ProjectBuildingCodePhase2 {
  if (!zoneId) {
    return {
      ...draft,
      zoneId: null,
      provenance: { sd: 'user', coveragePct: 'user', maxHeight: 'user' },
    };
  }
  const zone = lookupZone(zoneId);
  if (!zone) {
    return {
      ...draft,
      zoneId,
      provenance: { sd: 'user', coveragePct: 'user', maxHeight: 'user' },
    };
  }
  return {
    ...draft,
    zoneId: zone.zoneId,
    sd: zone.SD,
    coveragePct: zone.coverage_pct,
    maxHeight: zone.maxHeight_m,
    provenance: { sd: 'zone', coveragePct: 'zone', maxHeight: 'zone' },
  };
}

/**
 * Apply a plot-type change. Auto-syncs `frontagesCount` to the type's
 * canonical count when defined (custom keeps the existing value).
 */
export function applyPlotType(
  draft: ProjectBuildingCodePhase2,
  plotType: PlotType,
): ProjectBuildingCodePhase2 {
  const expected = expectedFrontagesForPlotType(plotType);
  const newCount = expected ?? draft.frontagesCount;
  return {
    ...draft,
    plotType,
    frontagesCount: newCount,
    frontages: syncFrontagesArray(draft.frontages, newCount),
  };
}

type NumericFieldKey = 'sd' | 'coveragePct' | 'maxHeight';

/**
 * Update a numeric zone-derivable field. Always flips that field's
 * provenance to 'user' since the value came from a manual edit.
 */
export function applyNumericEdit(
  draft: ProjectBuildingCodePhase2,
  field: NumericFieldKey,
  value: number,
): ProjectBuildingCodePhase2 {
  const provenance: BuildingCodeProvenance = {
    ...draft.provenance,
    [field]: 'user',
  };
  return { ...draft, [field]: value, provenance };
}

/**
 * Reset a single zone-derivable field to its zone default.
 * No-op if no zone is selected or the zone is unknown.
 */
export function resetFieldToZone(
  draft: ProjectBuildingCodePhase2,
  field: NumericFieldKey,
): ProjectBuildingCodePhase2 {
  if (!draft.zoneId) return draft;
  const zone = lookupZone(draft.zoneId);
  if (!zone) return draft;
  const zoneValue =
    field === 'sd' ? zone.SD : field === 'coveragePct' ? zone.coverage_pct : zone.maxHeight_m;
  return {
    ...draft,
    [field]: zoneValue,
    provenance: { ...draft.provenance, [field]: 'zone' },
  };
}

/** Whether resetField would actually change anything. */
export function canResetField(
  draft: ProjectBuildingCodePhase2,
  field: NumericFieldKey,
): boolean {
  return draft.zoneId !== null && draft.provenance[field] === 'user';
}

/** Quick deep-equality for the 6 form values + zone + plotType + frontages. */
export function isDraftEqual(
  a: ProjectBuildingCodePhase2,
  b: ProjectBuildingCodePhase2,
): boolean {
  const frontagesEqual =
    JSON.stringify(a.frontages ?? []) === JSON.stringify(b.frontages ?? []);

  return (
    frontagesEqual &&
    a.plotType === b.plotType &&
    a.frontagesCount === b.frontagesCount &&
    a.zoneId === b.zoneId &&
    a.sd === b.sd &&
    a.coveragePct === b.coveragePct &&
    a.maxHeight === b.maxHeight &&
    a.enabled === b.enabled &&
    a.provenance.sd === b.provenance.sd &&
    a.provenance.coveragePct === b.provenance.coveragePct &&
    a.provenance.maxHeight === b.provenance.maxHeight
  );
}

/**
 * Sync the frontages array to match a new count.
 * Preserves existing entries; adds empty entries for new slots; trims extras.
 */
export function syncFrontagesArray(
  current: readonly PlotFrontage[] | undefined,
  count: number,
): readonly PlotFrontage[] {
  const existing = current ?? [];
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    return existing.find((f) => f.index === index) ?? { index };
  });
}

/** All ΝΟΚ zone IDs available for the dropdown. */
export const ALL_ZONE_IDS: readonly string[] = Object.keys(ZONE_PARAMETERS) as readonly string[];
