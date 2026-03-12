'use client';

/**
 * ADR-203: Buildings Page State — thin wrapper around useEntityPageState
 *
 * Entity-specific concerns:
 * - URL param: buildingId
 * - Filter logic: building-specific filters (energyClass, renovation, nested ranges)
 */

import { useCallback } from 'react';
import type { Building } from '@/components/building-management/BuildingsPageContent';
import { defaultBuildingFilters, type BuildingFilterState } from '@/components/core/AdvancedFilters';
import { useEntityPageState, type EntityPageStateConfig } from './useEntityPageState';

// ---------------------------------------------------------------------------
// Filter function
// ---------------------------------------------------------------------------

function filterBuildings(buildings: Building[], filters: BuildingFilterState): Building[] {
  return buildings.filter((building) => {
    // Search filter
    if (filters.searchTerm) {
      const s = filters.searchTerm.toLowerCase();
      const matches =
        building.name.toLowerCase().includes(s) ||
        building.description?.toLowerCase().includes(s) ||
        building.address?.toLowerCase().includes(s) ||
        building.location?.toLowerCase().includes(s) ||
        building.project?.toLowerCase().includes(s);
      if (!matches) return false;
    }

    // Array-based select filters
    const selectFilters: Array<{ arr: string[] | undefined; field: keyof Building }> = [
      { arr: filters.status, field: 'status' },
      { arr: filters.type, field: 'type' },
      { arr: filters.project, field: 'project' },
      { arr: filters.location, field: 'location' },
      { arr: filters.company, field: 'company' },
      { arr: filters.priority, field: 'priority' },
      { arr: filters.energyClass, field: 'energyClass' },
      { arr: filters.renovation, field: 'renovation' },
    ];
    for (const { arr, field } of selectFilters) {
      const val = arr && arr.length > 0 ? arr[0] : null;
      if (val && val !== 'all' && building[field] !== val) return false;
    }

    // Nested range filters
    const { ranges } = filters;

    const valueRange = ranges?.valueRange;
    if (valueRange?.min !== undefined && building.totalValue && building.totalValue < valueRange.min) return false;
    if (valueRange?.max !== undefined && building.totalValue && building.totalValue > valueRange.max) return false;

    const areaRange = ranges?.areaRange;
    if (areaRange?.min !== undefined && building.totalArea && building.totalArea < areaRange.min) return false;
    if (areaRange?.max !== undefined && building.totalArea && building.totalArea > areaRange.max) return false;

    const unitsRange = ranges?.unitsRange;
    if (unitsRange?.min !== undefined && building.totalUnits && building.totalUnits < unitsRange.min) return false;
    if (unitsRange?.max !== undefined && building.totalUnits && building.totalUnits > unitsRange.max) return false;

    const yearRange = ranges?.yearRange;
    if (yearRange?.min !== undefined && building.constructionYear && building.constructionYear < yearRange.min) return false;
    if (yearRange?.max !== undefined && building.constructionYear && building.constructionYear > yearRange.max) return false;

    // Boolean feature filters
    if (filters.hasParking && !building.hasParking) return false;
    if (filters.hasElevator && !building.hasElevator) return false;
    if (filters.hasGarden && !building.hasGarden) return false;
    if (filters.hasPool && !building.hasPool) return false;
    if (filters.accessibility && !building.accessibility) return false;
    if (filters.furnished && !building.furnished) return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBuildingsPageState(initialBuildings: Building[]) {
  const stableFilterFn = useCallback(filterBuildings, []);

  const config: EntityPageStateConfig<Building, BuildingFilterState> = {
    urlParamName: 'buildingId',
    loggerName: 'useBuildingsPageState',
    defaultFilters: defaultBuildingFilters,
    filterFn: stableFilterFn,
  };

  const {
    selectedItem,
    setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredItems,
    filters,
    setFilters,
  } = useEntityPageState(initialBuildings, config);

  return {
    selectedBuilding: selectedItem,
    setSelectedBuilding: setSelectedItem,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredBuildings: filteredItems,
    filters,
    setFilters,
  };
}
