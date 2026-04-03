import type { CompactToolbarConfig } from '@/components/core/CompactToolbar/types';
import { createToolbarConfig } from './builders';
import type { ToolbarConfigFactoryArgs, ToolbarLevelConfigFactory } from './types';

const COMPANIES_ACTIONS: CompactToolbarConfig['availableActions'] = {
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
  help: true,
};

const PROJECT_ACTIONS: CompactToolbarConfig['availableActions'] = {
  newItem: true,
  editItem: true,
  deleteItems: true,
  filters: true,
  refresh: true,
  export: true,
  sorting: true,
  reports: true,
  share: true,
  help: true,
};

const BUILDING_ACTIONS: CompactToolbarConfig['availableActions'] = {
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

export const companiesToolbarConfigFactory: ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => {
  const { t } = args;
  return createToolbarConfig(
    args,
    'companies',
    t('toolbar.search.company'),
    'toolbar.actions.companies',
    [
      {
        id: 'type',
        label: t('filters.companies.typeLabel'),
        options: [
          { value: 'construction', label: t('filters.companies.construction') },
          { value: 'development', label: t('filters.companies.development') },
          { value: 'investment', label: t('filters.companies.investment') },
          { value: 'management', label: t('filters.companies.management') },
        ],
      },
      {
        id: 'status',
        label: t('filters.companies.statusLabel'),
        options: [
          { value: 'active', label: t('filters.companies.active') },
          { value: 'with_projects', label: t('filters.companies.withProjects') },
          { value: 'without_projects', label: t('filters.companies.withoutProjects') },
        ],
      },
    ],
    [
      { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
      { field: 'date', ascLabel: t('toolbar.sort.dateOldest'), descLabel: t('toolbar.sort.dateNewest') },
    ],
    COMPANIES_ACTIONS
  );
};

export const projectsToolbarConfigFactory: ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => {
  const { t } = args;
  return createToolbarConfig(
    args,
    'projects',
    t('toolbar.search.project'),
    'toolbar.actions.projects',
    [
      {
        id: 'status',
        label: t('filters.projects.statusLabel'),
        options: [
          { value: 'planning', label: t('filters.projects.planning') },
          { value: 'construction', label: t('filters.projects.construction') },
          { value: 'completed', label: t('filters.projects.completed') },
          { value: 'on_hold', label: t('filters.projects.onHold') },
        ],
      },
      {
        id: 'type',
        label: t('filters.projects.typeLabel'),
        options: [
          { value: 'residential', label: t('filters.projects.residential') },
          { value: 'commercial', label: t('filters.projects.commercial') },
          { value: 'mixed', label: t('filters.projects.mixed') },
        ],
      },
    ],
    [
      { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
      { field: 'progress', ascLabel: t('toolbar.sort.progressLow'), descLabel: t('toolbar.sort.progressHigh') },
      { field: 'date', ascLabel: t('toolbar.sort.dateOldest'), descLabel: t('toolbar.sort.dateNewest') },
    ],
    PROJECT_ACTIONS
  );
};

export const buildingsToolbarConfigFactory: ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => {
  const { t } = args;
  return createToolbarConfig(
    args,
    'buildings',
    t('toolbar.search.building'),
    'toolbar.actions.buildings',
    [
      {
        id: 'type',
        label: t('filters.buildings.typeLabel'),
        options: [
          { value: 'residential', label: t('filters.buildings.residential') },
          { value: 'commercial', label: t('filters.buildings.commercial') },
          { value: 'office', label: t('filters.buildings.office') },
          { value: 'mixed', label: t('filters.buildings.mixed') },
        ],
      },
      {
        id: 'floors',
        label: t('filters.buildings.floorsLabel'),
        options: [
          { value: '1-3', label: t('filters.buildings.floors1to3') },
          { value: '4-6', label: t('filters.buildings.floors4to6') },
          { value: '7+', label: t('filters.buildings.floors7plus') },
        ],
      },
    ],
    [
      { field: 'name', ascLabel: t('toolbar.sort.nameAsc'), descLabel: t('toolbar.sort.nameDesc') },
      { field: 'area', ascLabel: t('toolbar.sort.areaSmall'), descLabel: t('toolbar.sort.areaLarge') },
    ],
    BUILDING_ACTIONS
  );
};
