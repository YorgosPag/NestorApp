'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Building } from '@/components/building-management/BuildingsPageContent';
import { defaultBuildingFilters, type BuildingFilterState } from '@/components/core/AdvancedFilters';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useBuildingsPageState');

export function useBuildingsPageState(initialBuildings: Building[]) {
  // [ENTERPRISE] URL parameter handling for contextual navigation
  const searchParams = useSearchParams();
  const buildingIdFromUrl = searchParams.get('buildingId');

  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
  const [showDashboard, setShowDashboard] = useState(false);

  // Use centralized filter state
  const [filters, setFilters] = useState<BuildingFilterState>(defaultBuildingFilters);

  // [ENTERPRISE] Auto-selection from URL parameter (contextual navigation)
  useEffect(() => {
    if (!initialBuildings.length) return;

    if (buildingIdFromUrl) {
      // URL parameter has priority - find and select the building
      const found = initialBuildings.find(b => b.id === buildingIdFromUrl);
      if (found) {
        logger.info('Auto-selecting building from URL', { buildingName: found.name });
        setSelectedBuilding(found);
        return;
      }
    }

    // Default: select first building if none selected
    if (!selectedBuilding && initialBuildings.length > 0) {
      setSelectedBuilding(initialBuildings[0]);
    }
  }, [initialBuildings, buildingIdFromUrl]);

  const filteredBuildings = useMemo(() => {
    return initialBuildings.filter(building => {
      // Search filter - extended search
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = building.name.toLowerCase().includes(searchLower) ||
                             building.description?.toLowerCase().includes(searchLower) ||
                             building.address?.toLowerCase().includes(searchLower) ||
                             building.location?.toLowerCase().includes(searchLower) ||
                             building.project?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      const statusFilter = filters.status && filters.status.length > 0 ? filters.status[0] : null;
      if (statusFilter && statusFilter !== 'all' && building.status !== statusFilter) {
        return false;
      }

      // Type filter
      const typeFilter = filters.type && filters.type.length > 0 ? filters.type[0] : null;
      if (typeFilter && typeFilter !== 'all' && building.type !== typeFilter) {
        return false;
      }

      // Project filter
      const projectFilter = filters.project && filters.project.length > 0 ? filters.project[0] : null;
      if (projectFilter && projectFilter !== 'all' && building.project !== projectFilter) {
        return false;
      }

      // Location filter
      const locationFilter = filters.location && filters.location.length > 0 ? filters.location[0] : null;
      if (locationFilter && locationFilter !== 'all' && building.location !== locationFilter) {
        return false;
      }

      // Company filter
      const companyFilter = filters.company && filters.company.length > 0 ? filters.company[0] : null;
      if (companyFilter && companyFilter !== 'all' && building.company !== companyFilter) {
        return false;
      }

      // Priority filter
      const priorityFilter = filters.priority && filters.priority.length > 0 ? filters.priority[0] : null;
      if (priorityFilter && priorityFilter !== 'all' && building.priority !== priorityFilter) {
        return false;
      }

      // Energy Class filter
      const energyClassFilter = filters.energyClass && filters.energyClass.length > 0 ? filters.energyClass[0] : null;
      if (energyClassFilter && energyClassFilter !== 'all' && building.energyClass !== energyClassFilter) {
        return false;
      }

      // Renovation filter
      const renovationFilter = filters.renovation && filters.renovation.length > 0 ? filters.renovation[0] : null;
      if (renovationFilter && renovationFilter !== 'all' && building.renovation !== renovationFilter) {
        return false;
      }

      // Value range filter
      const valueRange = filters.ranges?.valueRange;
      if (valueRange?.min !== undefined && building.totalValue && building.totalValue < valueRange.min) {
        return false;
      }
      if (valueRange?.max !== undefined && building.totalValue && building.totalValue > valueRange.max) {
        return false;
      }

      // Area range filter
      const areaRange = filters.ranges?.areaRange;
      if (areaRange?.min !== undefined && building.totalArea && building.totalArea < areaRange.min) {
        return false;
      }
      if (areaRange?.max !== undefined && building.totalArea && building.totalArea > areaRange.max) {
        return false;
      }

      // Units range filter
      const unitsRange = filters.ranges?.unitsRange;
      if (unitsRange?.min !== undefined && building.totalUnits && building.totalUnits < unitsRange.min) {
        return false;
      }
      if (unitsRange?.max !== undefined && building.totalUnits && building.totalUnits > unitsRange.max) {
        return false;
      }

      // Year range filter
      const yearRange = filters.ranges?.yearRange;
      if (yearRange?.min !== undefined && building.constructionYear && building.constructionYear < yearRange.min) {
        return false;
      }
      if (yearRange?.max !== undefined && building.constructionYear && building.constructionYear > yearRange.max) {
        return false;
      }

      // Boolean feature filters
      if (filters.hasParking && !building.hasParking) {
        return false;
      }
      if (filters.hasElevator && !building.hasElevator) {
        return false;
      }
      if (filters.hasGarden && !building.hasGarden) {
        return false;
      }
      if (filters.hasPool && !building.hasPool) {
        return false;
      }
      if (filters.accessibility && !building.accessibility) {
        return false;
      }
      if (filters.furnished && !building.furnished) {
        return false;
      }

      return true;
    });
  }, [initialBuildings, filters]);

  return {
    selectedBuilding,
    setSelectedBuilding,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filteredBuildings,
    // New centralized filter state
    filters,
    setFilters,
  };
}
