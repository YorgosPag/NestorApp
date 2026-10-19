'use client';

/**
 * @fileoverview Ο πίνακας φίλτρων «Κτίρια» με **ζωντανές** επιλογές έργου/τοποθεσίας (ADR-840 §7.6).
 * @module components/core/AdvancedFilters/hooks/useBuildingFiltersConfig
 */

import { useMemo } from 'react';
import { buildingFiltersConfig } from '../configs/buildingProjectFiltersConfig';
import type { FilterPanelConfig } from '../types';
import { injectFilterOptions } from './filter-option-injection';
import { buildBuildingFilterOptions, type BuildingFilterSource } from './building-filter-options';
import { useHierarchyNames } from '@/components/navigation/core/hooks/useHierarchyNames';

export function useBuildingFiltersConfig(buildings: readonly BuildingFilterSource[]): FilterPanelConfig {
  const { projectName } = useHierarchyNames();
  return useMemo(
    () => injectFilterOptions(buildingFiltersConfig, buildBuildingFilterOptions(buildings, projectName)),
    [buildings, projectName],
  );
}
