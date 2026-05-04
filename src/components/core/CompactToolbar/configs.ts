// CompactToolbar Configurations for different list types
// 🏢 ENTERPRISE: 100% CENTRALIZED - ZERO HARDCODED VALUES

import type { CompactToolbarConfig } from './types';
import { getCompactToolbarSearchPlaceholders } from '@/subapps/dxf-viewer/config/modal-select/core/labels/navigation';
import {
  type ToolbarType,
  getFilterCategoriesForType,
  getSortOptionsForType,
  NEW_ITEM_LABELS_BY_TYPE,
  NEW_ITEM_TOOLTIP_BY_TYPE,
  EDIT_ITEM_TOOLTIP_BY_TYPE,
  DELETE_ITEM_TOOLTIP_BY_TYPE,
  SHARE_TOOLTIP_BY_TYPE,
} from './filter-definitions';

const searchPlaceholders = getCompactToolbarSearchPlaceholders();

// ============================================================================
// FACTORY
// ============================================================================

function createToolbarConfig(type: ToolbarType): CompactToolbarConfig {
  let searchPlaceholder: string;
  if (type === 'procurement') {
    searchPlaceholder = 'procurement:list.searchPlaceholder';
  } else if (type === 'quotes') {
    searchPlaceholder = 'quotes:list.searchPlaceholder';
  } else if (type === 'vendors') {
    searchPlaceholder = 'procurement:hub.vendorMaster.searchPlaceholder';
  } else if (type === 'materials') {
    searchPlaceholder = 'procurement:hub.materialCatalog.searchPlaceholder';
  } else if (type === 'agreements') {
    searchPlaceholder = 'procurement:hub.frameworkAgreements.searchPlaceholder';
  } else {
    searchPlaceholder = searchPlaceholders[type as keyof typeof searchPlaceholders];
  }

  return {
    searchPlaceholder,
    labels: {
      newItem: NEW_ITEM_LABELS_BY_TYPE[type],
      editItem: 'toolbar.actions.edit',
      deleteItems: 'toolbar.actions.delete',
      filters: 'toolbar.actions.filters',
      favorites: 'toolbar.actions.favorites',
      archive: 'toolbar.actions.archive',
      export: 'toolbar.actions.export',
      import: 'toolbar.actions.import',
      refresh: 'toolbar.actions.refresh',
      preview: 'toolbar.actions.preview',
      copy: 'toolbar.actions.copy',
      share: 'toolbar.actions.share',
      reports: 'toolbar.actions.reports',
      settings: 'toolbar.actions.settings',
      favoritesManagement: 'toolbar.actions.favoritesManagement',
      help: 'toolbar.actions.help',
      sorting: 'toolbar.actions.sorting',
    },
    tooltips: {
      newItem: NEW_ITEM_TOOLTIP_BY_TYPE[type],
      editItem: EDIT_ITEM_TOOLTIP_BY_TYPE[type],
      deleteItems: DELETE_ITEM_TOOLTIP_BY_TYPE[type],
      filters: 'toolbar.tooltips.filters',
      favorites: 'toolbar.tooltips.favorites',
      archive: 'toolbar.tooltips.archive',
      export: 'toolbar.tooltips.exportData',
      import: 'toolbar.tooltips.importData',
      refresh: 'toolbar.tooltips.refreshData',
      preview: 'toolbar.tooltips.preview',
      copy: 'toolbar.tooltips.copy',
      share: SHARE_TOOLTIP_BY_TYPE[type],
      reports: 'toolbar.tooltips.reports',
      settings: 'toolbar.tooltips.settings',
      favoritesManagement: 'toolbar.labels.favoritesManagement',
      help: 'toolbar.tooltips.help',
      sorting: 'toolbar.tooltips.sorting',
    },
    filterCategories: getFilterCategoriesForType(type),
    sortOptions: getSortOptionsForType(type),
    availableActions: {
      newItem: true,
      editItem: true,
      deleteItems: true,
      filters: true,
      favorites: true,
      archive: type !== 'properties',
      export: true,
      import: true,
      refresh: true,
      sorting: true,
      preview: type !== 'contacts',
      copy: true,
      share: true,
      reports: true,
      settings: type !== 'projects',
      favoritesManagement: true,
      help: true,
    },
  };
}

// ============================================================================
// EXPORTED CONFIGS
// ============================================================================

export const buildingsToolbarConfig: CompactToolbarConfig = createToolbarConfig('buildings');
export const projectsToolbarConfig: CompactToolbarConfig = createToolbarConfig('projects');

const _contactsBase = createToolbarConfig('contacts');
export const contactsToolbarConfig: CompactToolbarConfig = {
  ..._contactsBase,
  availableActions: {
    ..._contactsBase.availableActions,
    copy: false,
    refresh: false,
    favorites: false,
    favoritesManagement: false,
    reports: false,
    settings: false,
    preview: false,
    help: false,
  },
};

export const propertiesToolbarConfig: CompactToolbarConfig = createToolbarConfig('properties');
export const storagesToolbarConfig: CompactToolbarConfig = createToolbarConfig('storages');
export const parkingToolbarConfig: CompactToolbarConfig = createToolbarConfig('parking');

const _procurementBase = createToolbarConfig('procurement');
export const procurementToolbarConfig: CompactToolbarConfig = {
  ..._procurementBase,
  availableActions: {
    ..._procurementBase.availableActions,
    favorites: false,
    favoritesManagement: false,
    import: false,
    preview: false,
    copy: false,
    refresh: false,
    reports: false,
    settings: false,
    help: false,
    deleteItems: false,
    archive: false,
  },
};

const _quotesBase = createToolbarConfig('quotes');
export const quotesToolbarConfig: CompactToolbarConfig = {
  ..._quotesBase,
  availableActions: {
    ..._quotesBase.availableActions,
    favorites: false,
    favoritesManagement: false,
    import: false,
    preview: false,
    copy: false,
    refresh: false,
    reports: false,
    settings: false,
    help: false,
    deleteItems: false,
    archive: false,
    share: false,
  },
};

const _vendorsBase = createToolbarConfig('vendors');
export const vendorsToolbarConfig: CompactToolbarConfig = {
  ..._vendorsBase,
  availableActions: {
    ..._vendorsBase.availableActions,
    favorites: false,
    favoritesManagement: false,
    import: false,
    preview: false,
    copy: false,
    refresh: false,
    reports: false,
    settings: false,
    help: false,
    editItem: false,
    deleteItems: false,
    archive: false,
    share: false,
  },
};

const _materialsBase = createToolbarConfig('materials');
export const materialsToolbarConfig: CompactToolbarConfig = {
  ..._materialsBase,
  availableActions: {
    ..._materialsBase.availableActions,
    favorites: false,
    favoritesManagement: false,
    import: false,
    preview: false,
    copy: false,
    refresh: false,
    reports: false,
    settings: false,
    help: false,
    archive: false,
    share: false,
  },
};

const _agreementsBase = createToolbarConfig('agreements');
export const agreementsToolbarConfig: CompactToolbarConfig = {
  ..._agreementsBase,
  availableActions: {
    ..._agreementsBase.availableActions,
    favorites: false,
    favoritesManagement: false,
    import: false,
    preview: false,
    copy: false,
    refresh: false,
    reports: false,
    settings: false,
    help: false,
    archive: false,
    share: false,
  },
};

export const communicationsConfig: CompactToolbarConfig = {
  searchPlaceholder: searchPlaceholders.communications,
  labels: {
    newItem: '',
    editItem: '',
    deleteItems: '',
    filters: 'toolbar.actions.filters',
    favorites: 'toolbar.communications.important',
    archive: 'toolbar.actions.archive',
    export: 'toolbar.actions.export',
    import: '',
    refresh: 'toolbar.actions.refresh',
    preview: '',
    copy: '',
    share: '',
    reports: 'toolbar.actions.reports',
    settings: 'toolbar.actions.settings',
    favoritesManagement: '',
    help: 'toolbar.actions.help',
    sorting: 'toolbar.actions.sorting',
  },
  tooltips: {
    newItem: '',
    editItem: '',
    deleteItems: '',
    filters: 'toolbar.tooltips.filters',
    favorites: 'toolbar.communications.markAsImportant',
    archive: 'toolbar.tooltips.archive',
    export: 'toolbar.tooltips.exportData',
    import: '',
    refresh: 'toolbar.tooltips.refreshData',
    preview: '',
    copy: '',
    share: '',
    reports: 'toolbar.tooltips.reports',
    settings: 'toolbar.tooltips.settings',
    favoritesManagement: '',
    help: 'toolbar.tooltips.help',
    sorting: 'toolbar.tooltips.sorting',
  },
  filterCategories: getFilterCategoriesForType('communications'),
  sortOptions: getSortOptionsForType('communications'),
  availableActions: {
    refresh: true,
    filters: true,
    sorting: true,
    favorites: true,
    archive: true,
    export: true,
    reports: true,
    settings: true,
    help: true,
    newItem: false,
    editItem: false,
    deleteItems: false,
    import: false,
    preview: false,
    copy: false,
    share: false,
    favoritesManagement: false,
  },
};
