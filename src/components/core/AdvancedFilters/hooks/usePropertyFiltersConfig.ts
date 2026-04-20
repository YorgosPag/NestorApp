'use client';

import { useMemo } from 'react';
import { propertyListFiltersConfig } from '../configs/propertyFiltersConfig';
import type { FilterPanelConfig } from '../types';
import type { Property } from '@/types/property-viewer';

export function usePropertyFiltersConfig(properties: Property[]): FilterPanelConfig {
  return useMemo(() => {
    // Extract unique values from properties
    const uniqueProjects = Array.from(
      new Set(properties.map(p => p.project).filter(Boolean))
    ).sort();

    const uniqueBuildings = Array.from(
      new Set(properties.map(p => p.building).filter(Boolean))
    ).sort();

    const uniqueFloors = Array.from(
      new Set(properties.map(p => p.floor).filter(p => p !== null && p !== undefined))
    ).sort((a, b) => (a as number) - (b as number));

    const uniqueTypes = Array.from(
      new Set(properties.map(p => p.type).filter(Boolean))
    ).sort();

    // Deep clone config to avoid mutations
    const config = JSON.parse(JSON.stringify(propertyListFiltersConfig)) as FilterPanelConfig;

    // Update secondary-filters row with dynamic options
    const secondaryRow = config.rows.find(r => r.id === 'secondary-filters');
    if (secondaryRow) {
      // Project field
      const projectField = secondaryRow.fields.find(f => f.id === 'project');
      if (projectField) {
        projectField.options = [
          { value: 'all', label: 'filters.allProjects' },
          ...uniqueProjects.map(p => ({
            value: p,
            label: p // Use project name directly as label
          }))
        ];
      }

      // Building field
      const buildingField = secondaryRow.fields.find(f => f.id === 'building');
      if (buildingField) {
        buildingField.options = [
          { value: 'all', label: 'filters.allBuildings' },
          ...uniqueBuildings.map(b => ({
            value: b,
            label: b // Use building name directly as label
          }))
        ];
      }

      // Floor field
      const floorField = secondaryRow.fields.find(f => f.id === 'floor');
      if (floorField) {
        floorField.options = [
          { value: 'all', label: 'filters.allFloors' },
          ...uniqueFloors.map(f => ({
            value: String(f),
            label: `${f}` // Floor number as label
          }))
        ];
      }

      // Type field
      const typeField = secondaryRow.fields.find(f => f.id === 'type');
      if (typeField) {
        typeField.options = [
          { value: 'all', label: 'filters.allTypes' },
          ...uniqueTypes.map(t => ({
            value: t,
            label: `properties.types.${t}` // Use i18n key
          }))
        ];
      }
    }

    return config;
  }, [properties]);
}
