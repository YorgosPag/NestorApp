
'use client';

import { useMemo } from 'react';
import type { Property, FilterState } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';
// 🏢 ADR-051: Use centralized filter utilities
import {
  matchesSearchTerm,
  matchesNumericRange,
  matchesArrayFilter,
  matchesFeatures
} from '@/components/core/AdvancedFilters';


/**
 * 🏢 ENTERPRISE: Property type constants for filtering
 * Per local_4.log architecture - Units, Storage, Parking are PARALLEL categories
 */
const STORAGE_TYPES = ['storage', 'αποθήκη', 'αποθηκη'] as const;

/**
 * 🏢 ENTERPRISE: Check if a property is a storage unit
 * Storage units should NOT appear in the Units list (per local_4.log)
 */
function isStorageUnit(property: Property): boolean {
  // 🏢 ENTERPRISE: Check only property.type (propertyType doesn't exist on Property interface)
  const type = (property.type || '').toLowerCase();

  return STORAGE_TYPES.some(storageType => type.includes(storageType));
}

export function usePropertyFilters(
  properties: Property[],
  filters: FilterState,
  /** 🏢 ENTERPRISE (local_4.log): Exclude storage units from results */
  excludeStorageUnits: boolean = true
) {
  const { filteredProperties, stats } = useMemo(() => {
    if (!properties || !filters) {
      // 🎯 DOMAIN SEPARATION: Default stats without deprecated sales metrics
      const emptyStats: PropertyStats = {
        totalProperties: 0, availableProperties: 0, totalValue: 0, totalArea: 0, averagePrice: 0,
        propertiesByStatus: {}, propertiesByType: {}, propertiesByFloor: {},
        totalStorageUnits: 0, availableStorageUnits: 0,
        uniqueBuildings: 0,
        // Operational status metrics
        underConstructionProperties: 0,
        maintenanceProperties: 0,
        inspectionProperties: 0,
        draftProperties: 0,
      };
      return { filteredProperties: [], stats: emptyStats };
    }

    // 🏢 ENTERPRISE (local_4.log): Pre-filter to exclude storage units
    // Storage units are a PARALLEL category to Units, not part of Units
    const baseProperties = excludeStorageUnits
      ? properties.filter(p => !isStorageUnit(p))
      : properties;

    // 🏢 ADR-051: Use undefined for empty ranges (enterprise-grade type consistency)
    const {
      searchTerm = '',
      project = [],
      building = [],
      floor = [],
      propertyType = [],
      status = [],
      priceRange = { min: undefined, max: undefined },
      areaRange = { min: undefined, max: undefined },
      features = [],
      coverage = {},
    } = filters;

    // 🏢 ADR-051: Use centralized filter utilities
    const filtered = baseProperties.filter(property => {
      // Cast property to FilterableEntity for centralized utilities
      const entity = property as unknown as { id: string; [key: string]: unknown };

      // 🏢 CENTRALIZED: Search match using matchesSearchTerm
      const searchMatch = matchesSearchTerm(entity, searchTerm, ['name', 'description']);

      // 🏢 CENTRALIZED: Array filters using matchesArrayFilter
      const projectMatch = matchesArrayFilter(property.project, project);
      const buildingMatch = matchesArrayFilter(property.building, building);
      const floorMatch = matchesArrayFilter(String(property.floor), floor);
      const typeMatch = matchesArrayFilter(property.type, propertyType);
      const statusMatch = matchesArrayFilter(property.status, status);

      // 🏢 CENTRALIZED: Range filters using matchesNumericRange
      const priceMatch = matchesNumericRange(property.price, priceRange);
      const areaMatch = matchesNumericRange(property.area, areaRange);

      // 🏢 CENTRALIZED: Features filter using matchesFeatures
      const featuresMatch = matchesFeatures(property.features, features);

      // ✅ DOMAIN-SPECIFIC: Coverage filters for "missing X" functionality
      // This is property-specific logic, not generic filtering
      const coverageMatch = !coverage || Object.keys(coverage).length === 0 || (() => {
        const { missingPhotos, missingFloorplans, missingDocuments } = coverage;

        // If no coverage filters are active, include all units
        if (!missingPhotos && !missingFloorplans && !missingDocuments) {
          return true;
        }

        // ⚠️ BACKWARD COMPATIBILITY: Handle units without unitCoverage (treat as "missing")
        const unitCoverage = property.unitCoverage;

        // Check each filter condition
        const photosCondition = !missingPhotos || (unitCoverage?.hasPhotos !== true);
        const floorplansCondition = !missingFloorplans || (unitCoverage?.hasFloorplans !== true);
        const documentsCondition = !missingDocuments || (unitCoverage?.hasDocuments !== true);

        return photosCondition && floorplansCondition && documentsCondition;
      })();

      return searchMatch && projectMatch && buildingMatch && floorMatch && typeMatch && statusMatch && priceMatch && areaMatch && featuresMatch && coverageMatch;
    });
    
    // 🎯 DOMAIN SEPARATION: Stats use operationalStatus where available
    const calculatedStats: PropertyStats = {
      totalProperties: filtered.length,
      // availableProperties = operationalStatus 'ready' (Physical readiness)
      availableProperties: filtered.filter(p => p.operationalStatus === 'ready').length,
      totalValue: filtered.reduce((sum, p) => sum + (p.price || 0), 0),
      totalArea: filtered.reduce((sum, p) => sum + (p.area || 0), 0),
      averagePrice: filtered.length > 0 ? filtered.reduce((sum, p) => sum + (p.price || 0), 0) / filtered.length : 0,
      // propertiesByStatus uses operationalStatus (not sales status)
      propertiesByStatus: filtered.reduce((acc, p) => {
        const status = p.operationalStatus || 'draft';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      propertiesByType: filtered.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {} as Record<string, number>),
      propertiesByFloor: filtered.reduce((acc, p) => { const floorLabel = `Όροφος ${p.floor}`; acc[floorLabel] = (acc[floorLabel] || 0) + 1; return acc; }, {} as Record<string, number>),
      totalStorageUnits: 0, // storageUnits not available in this Property type
      availableStorageUnits: 0,
      uniqueBuildings: [...new Set(filtered.map(p => p.building))].length,
      // Operational status metrics
      underConstructionProperties: filtered.filter(p => p.operationalStatus === 'under-construction').length,
      maintenanceProperties: filtered.filter(p => p.operationalStatus === 'maintenance').length,
      inspectionProperties: filtered.filter(p => p.operationalStatus === 'inspection').length,
      draftProperties: filtered.filter(p => p.operationalStatus === 'draft').length,
    };

    return { filteredProperties: filtered, stats: calculatedStats };
  }, [properties, filters, excludeStorageUnits]);

  return { filteredProperties, stats };
}

/**
 * 🏢 ENTERPRISE: Export isStorageUnit για χρήση σε άλλα components
 */
export { isStorageUnit, STORAGE_TYPES };
