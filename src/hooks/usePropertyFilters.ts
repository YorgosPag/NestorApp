
'use client';

import { useMemo } from 'react';
import type { Property, FilterState } from '@/types/property-viewer';
import type { PropertyStats } from '@/types/property';


export function usePropertyFilters(
  properties: Property[],
  filters: FilterState
) {
  const { filteredProperties, stats } = useMemo(() => {
    if (!properties || !filters) {
      const emptyStats: PropertyStats = {
        totalProperties: 0, availableProperties: 0, soldProperties: 0, totalValue: 0, totalArea: 0, averagePrice: 0,
        propertiesByStatus: {}, propertiesByType: {}, propertiesByFloor: {},
        totalStorageUnits: 0, availableStorageUnits: 0, soldStorageUnits: 0,
        uniqueBuildings: 0, reserved: 0
      };
      return { filteredProperties: [], stats: emptyStats };
    }

    const {
      searchTerm = '',
      project = [],
      building = [],
      floor = [],
      propertyType = [],
      status = [],
      priceRange = { min: null, max: null },
      areaRange = { min: null, max: null },
      features = [],
    } = filters;

    const filtered = properties.filter(property => {
      const searchMatch = !searchTerm ||
        (property.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (property.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const projectMatch = !project || project.length === 0 || project.includes(property.project);
      const buildingMatch = !building || building.length === 0 || building.includes(property.building);
      const floorMatch = !floor || floor.length === 0 || floor.includes(String(property.floor));
      const typeMatch = !propertyType || propertyType.length === 0 || propertyType.includes(property.type);
      const statusMatch = !status || status.length === 0 || status.includes(property.status);
      
      const priceMatch = 
        (priceRange?.min === null || (property.price ?? 0) >= priceRange.min) &&
        (priceRange?.max === null || (property.price ?? 0) <= priceRange.max);
        
      const areaMatch = 
        (areaRange?.min === null || (property.area ?? 0) >= areaRange.min) &&
        (areaRange?.max === null || (property.area ?? 0) <= areaRange.max);

      const featuresMatch = !features || features.length === 0 || features.every(feature => (property.features || []).includes(feature));

      return searchMatch && projectMatch && buildingMatch && floorMatch && typeMatch && statusMatch && priceMatch && areaMatch && featuresMatch;
    });
    
    const calculatedStats: PropertyStats = {
      totalProperties: filtered.length,
      availableProperties: filtered.filter(p => p.status === 'for-sale' || p.status === 'for-rent').length,
      soldProperties: filtered.filter(p => p.status === 'sold').length,
      totalValue: filtered.reduce((sum, p) => sum + (p.price || 0), 0),
      totalArea: filtered.reduce((sum, p) => sum + (p.area || 0), 0),
      averagePrice: filtered.length > 0 ? filtered.reduce((sum, p) => sum + (p.price || 0), 0) / filtered.length : 0,
      propertiesByStatus: filtered.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {} as Record<string, number>),
      propertiesByType: filtered.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {} as Record<string, number>),
      propertiesByFloor: filtered.reduce((acc, p) => { const floorLabel = `Όροφος ${p.floor}`; acc[floorLabel] = (acc[floorLabel] || 0) + 1; return acc; }, {} as Record<string, number>),
      totalStorageUnits: 0, // storageUnits not available in this Property type
      availableStorageUnits: 0,
      soldStorageUnits: 0,
      uniqueBuildings: [...new Set(filtered.map(p => p.building))].length,
      reserved: filtered.filter(p => p.status === 'reserved').length,
    };

    return { filteredProperties: filtered, stats: calculatedStats };
  }, [properties, filters]);

  return { filteredProperties, stats };
}
