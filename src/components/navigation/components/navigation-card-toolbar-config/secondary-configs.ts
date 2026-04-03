import type { CompactToolbarConfig } from '@/components/core/CompactToolbar/types';
import { createToolbarConfig } from './builders';
import type { ToolbarConfigFactoryArgs, ToolbarLevelConfigFactory } from './types';

const STANDARD_ACTIONS: CompactToolbarConfig['availableActions'] = {
  newItem: true,
  editItem: true,
  deleteItems: true,
  filters: true,
  refresh: true,
  export: true,
  sorting: true,
  reports: true,
  help: true,
};

export const floorsToolbarConfigFactory: ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => {
  const { t } = args;
  return createToolbarConfig(
    args,
    'floors',
    t('toolbar.search.floor'),
    'toolbar.actions.floors',
    [
      {
        id: 'type',
        label: t('filters.floors.typeLabel'),
        options: [
          { value: 'basement', label: t('filters.floors.basement') },
          { value: 'ground', label: t('filters.floors.ground') },
          { value: 'floor', label: t('filters.floors.floor') },
          { value: 'penthouse', label: t('filters.floors.penthouse') },
        ],
      },
      {
        id: 'units',
        label: t('filters.floors.unitsLabel'),
        options: [
          { value: '1-2', label: t('filters.floors.units1to2') },
          { value: '3-5', label: t('filters.floors.units3to5') },
          { value: '6+', label: t('filters.floors.units6plus') },
        ],
      },
    ],
    [
      { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
      { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') },
    ],
    STANDARD_ACTIONS
  );
};

export const propertiesToolbarConfigFactory: ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => {
  const { t } = args;
  return createToolbarConfig(
    args,
    'properties',
    t('toolbar.search.unit'),
    'toolbar.actions.units',
    [
      {
        id: 'type',
        label: t('filters.units.typeLabel'),
        options: [
          { value: 'apartment', label: t('filters.units.apartment') },
          { value: 'office', label: t('filters.units.office') },
          { value: 'shop', label: t('filters.units.shop') },
          { value: 'storage', label: t('filters.units.storage') },
          { value: 'parking', label: t('filters.units.parking') },
        ],
      },
      {
        id: 'status',
        label: t('filters.units.statusLabel'),
        options: [
          { value: 'available', label: t('filters.units.available') },
          { value: 'occupied', label: t('filters.units.occupied') },
          { value: 'reserved', label: t('filters.units.reserved') },
          { value: 'maintenance', label: t('filters.units.maintenance') },
        ],
      },
      {
        id: 'rooms',
        label: t('filters.units.roomsLabel'),
        options: [
          { value: '1', label: t('filters.units.rooms1') },
          { value: '2', label: t('filters.units.rooms2') },
          { value: '3', label: t('filters.units.rooms3') },
          { value: '4+', label: t('filters.units.rooms4plus') },
        ],
      },
    ],
    [
      { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
      { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') },
      { field: 'rooms', ascLabel: t('toolbar.sort.roomsFew'), descLabel: t('toolbar.sort.roomsMany') },
    ],
    STANDARD_ACTIONS
  );
};

export const storageToolbarConfigFactory: ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => {
  const { t } = args;
  return createToolbarConfig(
    args,
    'storage',
    t('toolbar.search.storage'),
    'toolbar.actions.storage',
    [
      {
        id: 'type',
        label: t('filters.storage.typeLabel'),
        options: [
          { value: 'basement', label: t('filters.storage.basement') },
          { value: 'ground', label: t('filters.storage.ground') },
          { value: 'external', label: t('filters.storage.external') },
        ],
      },
      {
        id: 'status',
        label: t('filters.storage.statusLabel'),
        options: [
          { value: 'available', label: t('filters.storage.available') },
          { value: 'occupied', label: t('filters.storage.occupied') },
          { value: 'reserved', label: t('filters.storage.reserved') },
        ],
      },
    ],
    [
      { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
      { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') },
    ],
    STANDARD_ACTIONS
  );
};

export const parkingToolbarConfigFactory: ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => {
  const { t } = args;
  return createToolbarConfig(
    args,
    'parking',
    t('toolbar.search.parking'),
    'toolbar.actions.parking',
    [
      {
        id: 'type',
        label: t('filters.parking.typeLabel'),
        options: [
          { value: 'standard', label: t('filters.parking.standard') },
          { value: 'disabled', label: t('filters.parking.disabled') },
          { value: 'electric', label: t('filters.parking.electric') },
        ],
      },
      {
        id: 'location',
        label: t('filters.parking.locationLabel'),
        options: [
          { value: 'ground', label: t('filters.parking.ground') },
          { value: 'basement', label: t('filters.parking.basement') },
          { value: 'pilotis', label: t('filters.parking.pilotis') },
        ],
      },
      {
        id: 'status',
        label: t('filters.parking.statusLabel'),
        options: [
          { value: 'available', label: t('filters.parking.available') },
          { value: 'occupied', label: t('filters.parking.occupied') },
          { value: 'reserved', label: t('filters.parking.reserved') },
        ],
      },
    ],
    [
      { field: 'number', ascLabel: t('toolbar.sort.numberAsc'), descLabel: t('toolbar.sort.numberDesc') },
      { field: 'location', ascLabel: t('toolbar.sort.locationAsc'), descLabel: t('toolbar.sort.locationDesc') },
    ],
    STANDARD_ACTIONS
  );
};
