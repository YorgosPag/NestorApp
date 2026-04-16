/**
 * =============================================================================
 * Level Reconciliation — ADR-236 Phase 5 (Bidirectional Type Symmetry)
 * =============================================================================
 *
 * Pure SSoT helper that reconciles `levels` / `levelData` when the property
 * `type` changes. Mirrors forward direction (single → multi auto-create) with
 * a complementary reverse direction (multi → single cleanup) and aggregates
 * per-level totals into flat fields BEFORE clearing — zero perceived data loss.
 *
 * Google contract: if A→B creates N level cards, then B→A removes them.
 * No orphan UI state, no silent data loss.
 *
 * @module services/property/level-reconciliation
 * @since ADR-236 Phase 5 (Batch 22)
 */

import type { PropertyLevel, LevelData } from '@/types/property';
import { isMultiLevelCapableType } from '@/config/domain-constants';
import { aggregateLevelData } from '@/services/multi-level.service';

// =============================================================================
// TYPES
// =============================================================================

export type LevelTransition = 'multi-to-single' | 'single-to-multi' | 'none';

/** Flat per-area / per-layout snapshot consumed/produced by the helper. */
export interface FlatLevelFields {
  areaGross: number;
  areaNet: number;
  areaBalcony: number;
  areaTerrace: number;
  areaGarden: number;
  bedrooms: number;
  bathrooms: number;
  wc: number;
  orientations: string[];
}

export interface ReconcileLevelsParams {
  /** Old property type (before change). */
  oldType: string;
  /** New property type (after change). */
  newType: string;
  /** Current PropertyLevel array. */
  currentLevels: PropertyLevel[];
  /** Current per-level data map. */
  currentLevelData: Record<string, LevelData>;
  /** Current flat fields (single-level surface). */
  flatFields: FlatLevelFields;
}

export interface ReconcileLevelsResult {
  /** Direction of the type transition. */
  transition: LevelTransition;
  /** New levels array (cleared on multi→single, untouched otherwise). */
  newLevels: PropertyLevel[];
  /** New per-level data map (cleared on multi→single, untouched otherwise). */
  newLevelData: Record<string, LevelData>;
  /** Flat patch to merge into form / Firestore (aggregated totals on multi→single). */
  flatPatch: Partial<FlatLevelFields>;
  /** When true, caller should reset the active level tab (multi→single only). */
  clearActiveLevel: boolean;
  /**
   * When true, caller may auto-create levels (single→multi). The actual
   * creation happens via `useAutoLevelCreation` (needs Firestore floor query).
   */
  shouldAutoCreate: boolean;
  /**
   * Persist payload for `onAutoSaveFields` (edit mode) — only set on
   * multi→single. Mirrors `newLevels`/`newLevelData`/aggregated flat fields.
   */
  autoSavePayload: Record<string, unknown> | null;
}

// =============================================================================
// CORE
// =============================================================================

/**
 * Reconcile `levels` + `levelData` for a property type change.
 *
 * - **multi → single**: aggregate per-level totals into flat fields, then clear
 *   `levels` / `levelData`. Zero data loss for areas/layout/orientations.
 *   Finishes (per-level only by ADR-236 Phase 2 contract) ARE lost.
 * - **single → multi**: leave existing state untouched and signal caller that
 *   auto-creation is appropriate (caller owns Firestore floor query).
 * - **none**: identity result. Same type-class, no work to do.
 *
 * Pure function — no side effects, safe for client + server.
 */
export function reconcileLevelsForType(
  params: ReconcileLevelsParams,
): ReconcileLevelsResult {
  const { oldType, newType, currentLevels, currentLevelData, flatFields } = params;

  const oldIsMulti = isMultiLevelCapableType(oldType);
  const newIsMulti = isMultiLevelCapableType(newType);
  const hasMultiState = currentLevels.length >= 2 || Object.keys(currentLevelData).length > 0;

  // Transition: multi → single
  // Trigger when new type can NOT be multi-level AND we currently have
  // multi-level state that would otherwise become orphan.
  if (!newIsMulti && hasMultiState) {
    const aggregated = aggregateLevelData(currentLevelData);

    // Aggregated flat patch — only override flat fields when aggregation
    // yields a non-zero value (otherwise we would zero out manually entered
    // single-level data on a no-op level set).
    const flatPatch: Partial<FlatLevelFields> = {
      areaGross: aggregated.areas.gross > 0 ? aggregated.areas.gross : flatFields.areaGross,
      areaNet: aggregated.areas.net > 0 ? aggregated.areas.net : flatFields.areaNet,
      areaBalcony: aggregated.areas.balcony > 0 ? aggregated.areas.balcony : flatFields.areaBalcony,
      areaTerrace: aggregated.areas.terrace > 0 ? aggregated.areas.terrace : flatFields.areaTerrace,
      areaGarden: aggregated.areas.garden > 0 ? aggregated.areas.garden : flatFields.areaGarden,
      bedrooms: aggregated.layout.bedrooms > 0 ? aggregated.layout.bedrooms : flatFields.bedrooms,
      bathrooms: aggregated.layout.bathrooms > 0 ? aggregated.layout.bathrooms : flatFields.bathrooms,
      wc: aggregated.layout.wc > 0 ? aggregated.layout.wc : flatFields.wc,
      orientations: aggregated.orientations.length > 0
        ? Array.from(new Set([...flatFields.orientations, ...aggregated.orientations]))
        : flatFields.orientations,
    };

    const autoSavePayload: Record<string, unknown> = {
      isMultiLevel: false,
      levels: [],
      levelData: {},
      areas: {
        gross: flatPatch.areaGross ?? 0,
        net: flatPatch.areaNet ?? 0,
        balcony: flatPatch.areaBalcony ?? 0,
        terrace: flatPatch.areaTerrace ?? 0,
        garden: flatPatch.areaGarden ?? 0,
      },
      layout: {
        bedrooms: flatPatch.bedrooms ?? 0,
        bathrooms: flatPatch.bathrooms ?? 0,
        wc: flatPatch.wc ?? 0,
      },
      orientations: flatPatch.orientations ?? [],
    };

    return {
      transition: 'multi-to-single',
      newLevels: [],
      newLevelData: {},
      flatPatch,
      clearActiveLevel: true,
      shouldAutoCreate: false,
      autoSavePayload,
    };
  }

  // Transition: single → multi (signal only — caller owns auto-create flow)
  if (newIsMulti && !oldIsMulti) {
    return {
      transition: 'single-to-multi',
      newLevels: currentLevels,
      newLevelData: currentLevelData,
      flatPatch: {},
      clearActiveLevel: false,
      shouldAutoCreate: true,
      autoSavePayload: null,
    };
  }

  // No-op: same type-class (multi→multi or single→single, or multi→single
  // with no existing level state to clean up).
  return {
    transition: 'none',
    newLevels: currentLevels,
    newLevelData: currentLevelData,
    flatPatch: {},
    clearActiveLevel: false,
    shouldAutoCreate: newIsMulti && currentLevels.length < 2,
    autoSavePayload: null,
  };
}
