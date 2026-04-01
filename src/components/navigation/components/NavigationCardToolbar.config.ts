/**
 * Navigation Card Toolbar Helpers
 * Helper functions and types for NavigationCardToolbar component
 *
 * Extracted from NavigationCardToolbar.tsx for SRP compliance (ADR-261)
 *
 * 🏢 ENTERPRISE: Full i18n support - ZERO HARDCODED STRINGS
 */

import React from 'react';
import type { CompactToolbarConfig } from '@/components/core/CompactToolbar/types';
// 🏢 ENTERPRISE: Icons/Colors από centralized config - ZERO hardcoded values
import { NAVIGATION_ENTITIES, NAVIGATION_ACTIONS } from '../config';

/**
 * 🏢 ENTERPRISE: Extended navigation levels
 * Includes storage and parking as parallel categories to units (per local_4.log architecture)
 */
export type NavigationLevel = 'companies' | 'projects' | 'buildings' | 'floors' | 'properties' | 'storage' | 'parking';

// 🏢 ENTERPRISE: Type for translation function
export type TranslationFn = (key: string) => string;

// 🏢 ENTERPRISE: Helper functions using centralized config - ZERO hardcoded values

/**
 * Get level title using i18n translations
 * 🏢 ENTERPRISE: Uses i18n keys for full localization support
 */
export const getLevelTitle = (level: NavigationLevel, t: TranslationFn): string => {
  switch (level) {
    case 'companies': return t('entities.company.plural');
    case 'projects': return t('entities.project.plural');
    case 'buildings': return t('entities.building.plural');
    case 'floors': return t('entities.floor.plural');
    case 'properties': return t('entities.unit.plural');
    case 'storage': return t('entities.storage.plural');
    case 'parking': return t('entities.parking.plural');
    default: return '';
  }
};

/**
 * 🏢 ENTERPRISE: Icons για τους τίτλους των στηλών
 * Χρησιμοποιεί centralized NAVIGATION_ENTITIES config
 */
export const getLevelIcon = (level: NavigationLevel): React.ComponentType<{ className?: string }> => {
  switch (level) {
    case 'companies': return NAVIGATION_ENTITIES.company.icon;
    case 'projects': return NAVIGATION_ENTITIES.project.icon;
    case 'buildings': return NAVIGATION_ENTITIES.building.icon;
    case 'floors': return NAVIGATION_ENTITIES.floor.icon;
    case 'properties': return NAVIGATION_ENTITIES.property.icon;
    case 'storage': return NAVIGATION_ENTITIES.storage.icon;
    case 'parking': return NAVIGATION_ENTITIES.parking.icon;
    default: return NAVIGATION_ENTITIES.building.icon;
  }
};

/**
 * 🏢 ENTERPRISE: Get the correct delete/unlink icon per level
 * Χρησιμοποιεί centralized NAVIGATION_ACTIONS config
 * - Companies: delete action (αφαίρεση από navigation)
 * - Projects/Buildings/Floors/Units: unlink action (αποσύνδεση σχέσης)
 */
export const getDeleteIcon = (level: NavigationLevel): React.ComponentType<{ className?: string }> => {
  switch (level) {
    case 'companies': return NAVIGATION_ACTIONS.delete.icon;
    case 'projects': return NAVIGATION_ACTIONS.unlink.icon;
    case 'buildings': return NAVIGATION_ACTIONS.unlink.icon;
    case 'floors': return NAVIGATION_ACTIONS.unlink.icon;
    case 'properties': return NAVIGATION_ACTIONS.unlink.icon;
    case 'storage': return NAVIGATION_ACTIONS.unlink.icon;
    case 'parking': return NAVIGATION_ACTIONS.unlink.icon;
    default: return NAVIGATION_ACTIONS.delete.icon;
  }
};

/**
 * 🏢 ENTERPRISE: Get the correct new item icon per level
 * Χρησιμοποιεί centralized NAVIGATION_ACTIONS config
 * - Companies: add action (προσθήκη στη λίστα πλοήγησης)
 * - Projects/Buildings/Floors/Units: link action (σύνδεση με parent entity)
 */
export const getNewItemIcon = (level: NavigationLevel): React.ComponentType<{ className?: string }> => {
  switch (level) {
    case 'companies': return NAVIGATION_ACTIONS.add.icon;
    case 'projects': return NAVIGATION_ACTIONS.link.icon;
    case 'buildings': return NAVIGATION_ACTIONS.link.icon;
    case 'floors': return NAVIGATION_ACTIONS.link.icon;
    case 'properties': return NAVIGATION_ACTIONS.link.icon;
    case 'storage': return NAVIGATION_ACTIONS.link.icon;
    case 'parking': return NAVIGATION_ACTIONS.link.icon;
    default: return NAVIGATION_ACTIONS.add.icon;
  }
};

/**
 * 🏢 ENTERPRISE: Get the correct icon color per level
 * Χρησιμοποιεί centralized NAVIGATION_ENTITIES config
 */
export const getLevelIconColor = (level: NavigationLevel): string => {
  switch (level) {
    case 'companies': return NAVIGATION_ENTITIES.company.color;
    case 'projects': return NAVIGATION_ENTITIES.project.color;
    case 'buildings': return NAVIGATION_ENTITIES.building.color;
    case 'floors': return NAVIGATION_ENTITIES.floor.color;
    case 'properties': return NAVIGATION_ENTITIES.property.color;
    case 'storage': return NAVIGATION_ENTITIES.storage.color;
    case 'parking': return NAVIGATION_ENTITIES.parking.color;
    default: return NAVIGATION_ENTITIES.company.color;
  }
};

// Configuration per navigation level - accepts t() for i18n support
export const getToolbarConfig = (
  level: NavigationLevel,
  t: TranslationFn,
  tCommon: TranslationFn
): CompactToolbarConfig => {
  const baseConfig = {
    labels: {
      newItem: level === 'companies' ? tCommon('buttons.add') : t('toolbar.labels.link'),
      editItem: tCommon('buttons.edit'),
      deleteItems: level === 'companies' ? t('toolbar.labels.remove') : t('toolbar.labels.unlink'),
      filters: t('toolbar.labels.filters'),
      favorites: t('toolbar.labels.favorites'),
      archive: t('toolbar.labels.archive'),
      export: tCommon('buttons.export'),
      import: tCommon('buttons.import'),
      refresh: tCommon('buttons.refresh'),
      preview: t('toolbar.labels.preview'),
      copy: t('toolbar.labels.copy'),
      share: t('toolbar.labels.share'),
      reports: t('toolbar.labels.reports'),
      settings: t('toolbar.labels.settings'),
      favoritesManagement: t('toolbar.labels.favoritesManagement'),
      help: t('toolbar.labels.help'),
      sorting: t('toolbar.labels.sorting')
    },
    tooltips: {
      newItem: '',
      editItem: '',
      deleteItems: '',
      filters: t('toolbar.tooltips.filters'),
      favorites: t('toolbar.tooltips.favorites'),
      archive: t('toolbar.tooltips.archive'),
      export: t('toolbar.tooltips.exportData'),
      import: t('toolbar.tooltips.importData'),
      refresh: t('toolbar.tooltips.refreshData'),
      preview: t('toolbar.tooltips.preview'),
      copy: t('toolbar.tooltips.copy'),
      share: t('toolbar.tooltips.share'),
      reports: t('toolbar.tooltips.reports'),
      settings: t('toolbar.tooltips.settings'),
      favoritesManagement: t('toolbar.tooltips.favoritesManagement'),
      help: t('toolbar.tooltips.help'),
      sorting: t('toolbar.tooltips.sorting')
    }
  };

  switch (level) {
    case 'companies':
      return {
        searchPlaceholder: t('toolbar.search.company'),
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: t('toolbar.actions.companies.new'),
          editItem: t('toolbar.actions.companies.edit'),
          deleteItems: t('toolbar.actions.companies.delete')
        },
        filterCategories: [
          {
            id: 'type',
            label: t('filters.companies.typeLabel'),
            options: [
              { value: 'construction', label: t('filters.companies.construction') },
              { value: 'development', label: t('filters.companies.development') },
              { value: 'investment', label: t('filters.companies.investment') },
              { value: 'management', label: t('filters.companies.management') }
            ]
          },
          {
            id: 'status',
            label: t('filters.companies.statusLabel'),
            options: [
              { value: 'active', label: t('filters.companies.active') },
              { value: 'with_projects', label: t('filters.companies.withProjects') },
              { value: 'without_projects', label: t('filters.companies.withoutProjects') }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
          { field: 'date', ascLabel: t('toolbar.sort.dateOldest'), descLabel: t('toolbar.sort.dateNewest') }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          import: true,
          sorting: true,
          reports: true,
          settings: true,
          help: true
        }
      };

    case 'projects':
      return {
        searchPlaceholder: t('toolbar.search.project'),
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: t('toolbar.actions.projects.new'),
          editItem: t('toolbar.actions.projects.edit'),
          deleteItems: t('toolbar.actions.projects.delete')
        },
        filterCategories: [
          {
            id: 'status',
            label: t('filters.projects.statusLabel'),
            options: [
              { value: 'planning', label: t('filters.projects.planning') },
              { value: 'construction', label: t('filters.projects.construction') },
              { value: 'completed', label: t('filters.projects.completed') },
              { value: 'on_hold', label: t('filters.projects.onHold') }
            ]
          },
          {
            id: 'type',
            label: t('filters.projects.typeLabel'),
            options: [
              { value: 'residential', label: t('filters.projects.residential') },
              { value: 'commercial', label: t('filters.projects.commercial') },
              { value: 'mixed', label: t('filters.projects.mixed') }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
          { field: 'progress', ascLabel: t('toolbar.sort.progressLow'), descLabel: t('toolbar.sort.progressHigh') },
          { field: 'date', ascLabel: t('toolbar.sort.dateOldest'), descLabel: t('toolbar.sort.dateNewest') }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          share: true,
          help: true
        }
      };

    case 'buildings':
      return {
        searchPlaceholder: t('toolbar.search.building'),
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: t('toolbar.actions.buildings.new'),
          editItem: t('toolbar.actions.buildings.edit'),
          deleteItems: t('toolbar.actions.buildings.delete')
        },
        filterCategories: [
          {
            id: 'type',
            label: t('filters.buildings.typeLabel'),
            options: [
              { value: 'residential', label: t('filters.buildings.residential') },
              { value: 'commercial', label: t('filters.buildings.commercial') },
              { value: 'office', label: t('filters.buildings.office') },
              { value: 'mixed', label: t('filters.buildings.mixed') }
            ]
          },
          {
            id: 'floors',
            label: t('filters.buildings.floorsLabel'),
            options: [
              { value: '1-3', label: t('filters.buildings.floors1to3') },
              { value: '4-6', label: t('filters.buildings.floors4to6') },
              { value: '7+', label: t('filters.buildings.floors7plus') }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
          { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    case 'floors':
      return {
        searchPlaceholder: t('toolbar.search.floor'),
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: t('toolbar.actions.floors.new'),
          editItem: t('toolbar.actions.floors.edit'),
          deleteItems: t('toolbar.actions.floors.delete')
        },
        filterCategories: [
          {
            id: 'type',
            label: t('filters.floors.typeLabel'),
            options: [
              { value: 'basement', label: t('filters.floors.basement') },
              { value: 'ground', label: t('filters.floors.ground') },
              { value: 'floor', label: t('filters.floors.floor') },
              { value: 'penthouse', label: t('filters.floors.penthouse') }
            ]
          },
          {
            id: 'units',
            label: t('filters.floors.unitsLabel'),
            options: [
              { value: '1-2', label: t('filters.floors.units1to2') },
              { value: '3-5', label: t('filters.floors.units3to5') },
              { value: '6+', label: t('filters.floors.units6plus') }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
          { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    case 'properties':
      return {
        searchPlaceholder: t('toolbar.search.unit'),
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: t('toolbar.actions.units.new'),
          editItem: t('toolbar.actions.units.edit'),
          deleteItems: t('toolbar.actions.units.delete')
        },
        filterCategories: [
          {
            id: 'type',
            label: t('filters.units.typeLabel'),
            options: [
              { value: 'apartment', label: t('filters.units.apartment') },
              { value: 'office', label: t('filters.units.office') },
              { value: 'shop', label: t('filters.units.shop') },
              { value: 'storage', label: t('filters.units.storage') },
              { value: 'parking', label: t('filters.units.parking') }
            ]
          },
          {
            id: 'status',
            label: t('filters.units.statusLabel'),
            options: [
              { value: 'available', label: t('filters.units.available') },
              { value: 'occupied', label: t('filters.units.occupied') },
              { value: 'reserved', label: t('filters.units.reserved') },
              { value: 'maintenance', label: t('filters.units.maintenance') }
            ]
          },
          {
            id: 'rooms',
            label: t('filters.units.roomsLabel'),
            options: [
              { value: '1', label: t('filters.units.rooms1') },
              { value: '2', label: t('filters.units.rooms2') },
              { value: '3', label: t('filters.units.rooms3') },
              { value: '4+', label: t('filters.units.rooms4plus') }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
          { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') },
          { field: 'rooms', ascLabel: t('toolbar.sort.roomsFew'), descLabel: t('toolbar.sort.roomsMany') }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    // 🏢 ENTERPRISE: Storage configuration (parallel category to units per local_4.log)
    case 'storage':
      return {
        searchPlaceholder: t('toolbar.search.storage'),
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: t('toolbar.actions.storage.new'),
          editItem: t('toolbar.actions.storage.edit'),
          deleteItems: t('toolbar.actions.storage.delete')
        },
        filterCategories: [
          {
            id: 'type',
            label: t('filters.storage.typeLabel'),
            options: [
              { value: 'basement', label: t('filters.storage.basement') },
              { value: 'ground', label: t('filters.storage.ground') },
              { value: 'external', label: t('filters.storage.external') }
            ]
          },
          {
            id: 'status',
            label: t('filters.storage.statusLabel'),
            options: [
              { value: 'available', label: t('filters.storage.available') },
              { value: 'occupied', label: t('filters.storage.occupied') },
              { value: 'reserved', label: t('filters.storage.reserved') }
            ]
          }
        ],
        sortOptions: [
          { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
          { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    // 🏢 ENTERPRISE: Parking configuration (parallel category to units per local_4.log)
    case 'parking':
      return {
        searchPlaceholder: t('toolbar.search.parking'),
        ...baseConfig,
        tooltips: {
          ...baseConfig.tooltips,
          newItem: t('toolbar.actions.parking.new'),
          editItem: t('toolbar.actions.parking.edit'),
          deleteItems: t('toolbar.actions.parking.delete')
        },
        filterCategories: [
          {
            id: 'type',
            label: t('filters.parking.typeLabel'),
            options: [
              { value: 'standard', label: t('filters.parking.standard') },
              { value: 'disabled', label: t('filters.parking.disabled') },
              { value: 'electric', label: t('filters.parking.electric') }
            ]
          },
          {
            id: 'location',
            label: t('filters.parking.locationLabel'),
            options: [
              { value: 'ground', label: t('filters.parking.ground') },
              { value: 'basement', label: t('filters.parking.basement') },
              { value: 'pilotis', label: t('filters.parking.pilotis') }
            ]
          },
          {
            id: 'status',
            label: t('filters.parking.statusLabel'),
            options: [
              { value: 'available', label: t('filters.parking.available') },
              { value: 'occupied', label: t('filters.parking.occupied') },
              { value: 'reserved', label: t('filters.parking.reserved') }
            ]
          }
        ],
        sortOptions: [
          { field: 'number', ascLabel: t('toolbar.sort.numberAsc'), descLabel: t('toolbar.sort.numberDesc') },
          { field: 'location', ascLabel: t('toolbar.sort.locationAsc'), descLabel: t('toolbar.sort.locationDesc') }
        ],
        availableActions: {
          newItem: true,
          editItem: true,
          deleteItems: true,
          filters: true,
          refresh: true,
          export: true,
          sorting: true,
          reports: true,
          help: true
        }
      };

    default:
      throw new Error(`Unknown navigation level: ${level}`);
  }
};
