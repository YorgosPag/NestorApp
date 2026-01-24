// CompactToolbar Configurations for different list types
// 🏢 ENTERPRISE: 100% CENTRALIZED - ZERO HARDCODED VALUES

import type { CompactToolbarConfig } from './types';
import {
  UNIFIED_STATUS_FILTER_LABELS,
  PROPERTY_BUILDING_TYPE_LABELS,
  // 🏢 ENTERPRISE: Import additional centralized labels - ZERO HARDCODED VALUES
  CONTACT_BUSINESS_TYPE_LABELS,
  STORAGE_LABELS,
  AVAILABILITY_STATUS_LABELS,
  EXTENDED_PROPERTY_TYPE_LABELS,
  BUILDING_NAME_FILTER_LABELS
} from '@/constants/property-statuses-enterprise';

// 🏢 ENTERPRISE: Import centralized CompactToolbar search placeholders from modal-select
import { getCompactToolbarSearchPlaceholders } from '@/subapps/dxf-viewer/config/modal-select';

// 🅿️ ENTERPRISE: Import parking labels
import {
  PARKING_TYPE_LABELS,
  PARKING_STATUS_LABELS
} from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

// 🏢 ENTERPRISE: Get centralized search placeholders
const searchPlaceholders = getCompactToolbarSearchPlaceholders();

// 🏢 ENTERPRISE: Communications channel labels
// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// Labels are translated at runtime by components using useTranslation
const COMMUNICATIONS_CHANNEL_LABELS = {
  all: 'toolbar.communications.channels.all',
  email: 'toolbar.communications.channels.email',
  sms: 'toolbar.communications.channels.sms',
  telegram: 'toolbar.communications.channels.telegram'
} as const;

const COMMUNICATIONS_STATUS_LABELS = {
  all: 'toolbar.communications.status.all',
  sent: 'toolbar.communications.status.sent',
  received: 'toolbar.communications.status.received',
  pending: 'toolbar.communications.status.pending',
  failed: 'toolbar.communications.status.failed'
} as const;

// 🚀 ENTERPRISE: Helper functions για filter categories και sort options
function getFilterCategoriesForType(type: 'buildings' | 'projects' | 'contacts' | 'units' | 'storages' | 'parking' | 'communications') {
  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  const baseCategories = [
    {
      id: 'status',
      label: 'toolbar.filters.categories.status',
      options: [
        { value: 'available', label: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE },
        { value: 'occupied', label: UNIFIED_STATUS_FILTER_LABELS.OCCUPIED },
        { value: 'reserved', label: UNIFIED_STATUS_FILTER_LABELS.RESERVED },
        { value: 'maintenance', label: UNIFIED_STATUS_FILTER_LABELS.MAINTENANCE }
      ]
    }
  ];

  switch (type) {
    case 'buildings':
      return [
        ...baseCategories,
        {
          id: 'type',
          label: 'toolbar.filters.categories.buildingType',
          options: [
            { value: 'residential', label: PROPERTY_BUILDING_TYPE_LABELS.residential },
            { value: 'commercial', label: PROPERTY_BUILDING_TYPE_LABELS.commercial },
            { value: 'mixed', label: PROPERTY_BUILDING_TYPE_LABELS.mixed }
          ]
        }
      ];
    case 'contacts':
      return [
        {
          id: 'type',
          label: 'toolbar.filters.categories.contactType',
          options: [
            { value: 'customer', label: CONTACT_BUSINESS_TYPE_LABELS.customer },
            { value: 'supplier', label: CONTACT_BUSINESS_TYPE_LABELS.supplier },
            { value: 'contractor', label: CONTACT_BUSINESS_TYPE_LABELS.contractor }
          ]
        }
      ];
    case 'parking':
      return [
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'available', label: PARKING_STATUS_LABELS.available },
            { value: 'occupied', label: PARKING_STATUS_LABELS.occupied },
            { value: 'reserved', label: PARKING_STATUS_LABELS.reserved },
            { value: 'sold', label: PARKING_STATUS_LABELS.sold },
            { value: 'maintenance', label: PARKING_STATUS_LABELS.maintenance }
          ]
        },
        {
          id: 'type',
          label: 'toolbar.filters.categories.parkingType',
          options: [
            { value: 'standard', label: PARKING_TYPE_LABELS.standard },
            { value: 'handicapped', label: PARKING_TYPE_LABELS.handicapped },
            { value: 'motorcycle', label: PARKING_TYPE_LABELS.motorcycle },
            { value: 'electric', label: PARKING_TYPE_LABELS.electric },
            { value: 'visitor', label: PARKING_TYPE_LABELS.visitor }
          ]
        }
      ];
    case 'communications':
      return [
        {
          id: 'channel',
          label: 'toolbar.filters.categories.channel',
          options: [
            { value: 'all', label: COMMUNICATIONS_CHANNEL_LABELS.all },
            { value: 'email', label: COMMUNICATIONS_CHANNEL_LABELS.email },
            { value: 'sms', label: COMMUNICATIONS_CHANNEL_LABELS.sms },
            { value: 'telegram', label: COMMUNICATIONS_CHANNEL_LABELS.telegram }
          ]
        },
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'all', label: COMMUNICATIONS_STATUS_LABELS.all },
            { value: 'sent', label: COMMUNICATIONS_STATUS_LABELS.sent },
            { value: 'received', label: COMMUNICATIONS_STATUS_LABELS.received },
            { value: 'pending', label: COMMUNICATIONS_STATUS_LABELS.pending },
            { value: 'failed', label: COMMUNICATIONS_STATUS_LABELS.failed }
          ]
        }
      ];
    default:
      return baseCategories;
  }
}

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
function getSortOptionsForType(type: 'buildings' | 'projects' | 'contacts' | 'units' | 'storages' | 'parking' | 'communications') {
  if (type === 'communications') {
    return [
      { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
      { field: 'channel' as const, ascLabel: 'toolbar.sort.channel.asc', descLabel: 'toolbar.sort.channel.desc' },
      { field: 'status' as const, ascLabel: 'toolbar.sort.status.asc', descLabel: 'toolbar.sort.status.desc' }
    ];
  }
  return [
    { field: 'name' as const, ascLabel: 'toolbar.sort.name.asc', descLabel: 'toolbar.sort.name.desc' },
    { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
    { field: 'status' as const, ascLabel: 'toolbar.sort.status.asc', descLabel: 'toolbar.sort.status.desc' }
  ];
}

// 🏢 ENTERPRISE: Direct i18n key mappings for newItem labels per type
// NOTE: Keys are relative to 'common' namespace (no 'common.' prefix needed)
const NEW_ITEM_LABELS_BY_TYPE: Record<string, string> = {
  buildings: 'actions.newBuilding',
  projects: 'actions.newProject',
  contacts: 'actions.newContact',
  units: 'actions.newUnit',
  storages: 'actions.newStorage',
  parking: 'actions.newParking',
  communications: 'actions.newMessage'
};

// 🏢 ENTERPRISE: Direct i18n keys for entity-specific tooltips
// NOTE: Keys are relative to 'common' namespace (no 'common.' prefix needed)
const NEW_ITEM_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'tooltips.newBuildingShortcut',
  projects: 'tooltips.newProjectShortcut',
  contacts: 'tooltips.newContactShortcut',
  units: 'tooltips.newUnitShortcut',
  storages: 'tooltips.newStorageShortcut',
  parking: 'tooltips.newParkingShortcut',
  communications: 'tooltips.newMessageShortcut'
};

const EDIT_ITEM_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'toolbar.actions.buildings.edit',
  projects: 'toolbar.actions.projects.edit',
  contacts: 'tooltips.editContact',
  units: 'toolbar.actions.units.edit',
  storages: 'toolbar.actions.storage.edit',
  parking: 'tooltips.editSelected',
  communications: 'tooltips.editSelected'
};

const DELETE_ITEM_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'toolbar.actions.buildings.delete',
  projects: 'toolbar.actions.projects.delete',
  contacts: 'tooltips.deleteContact',
  units: 'toolbar.actions.units.delete',
  storages: 'toolbar.actions.storage.delete',
  parking: 'tooltips.deleteSelected',
  communications: 'tooltips.deleteSelected'
};

const SHARE_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'tooltips.shareBuilding',
  projects: 'tooltips.shareProject',
  contacts: 'tooltips.shareContact',
  units: 'tooltips.shareUnit',
  storages: 'tooltips.shareStorage',
  parking: 'toolbar.labels.share',
  communications: 'toolbar.labels.share'
};

// 🚀 ENTERPRISE: Smart Configuration Factory - No duplicated labels!
function createToolbarConfig(
  type: 'buildings' | 'projects' | 'contacts' | 'units' | 'storages' | 'parking' | 'communications'
): CompactToolbarConfig {
  return {
    searchPlaceholder: searchPlaceholders[type],

    // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
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
      sorting: 'toolbar.actions.sorting'
    },

    // 🏢 ENTERPRISE: 100% Direct i18n keys - No external function dependency
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
      sorting: 'toolbar.tooltips.sorting'
    },

    filterCategories: getFilterCategoriesForType(type),
    sortOptions: getSortOptionsForType(type),

    availableActions: {
      newItem: true,
      editItem: true,
      deleteItems: true,
      filters: true,
      favorites: true,
      archive: type !== 'units', // Units might not need archive
      export: true,
      import: true,
      refresh: true,
      sorting: true,
      preview: type !== 'contacts', // Contacts might not need preview
      copy: true,
      share: true,
      reports: true,
      settings: type !== 'projects', // Projects might not need settings
      favoritesManagement: true,
      help: true
    }
  };
}

// 🚀 ENTERPRISE: Buildings Configuration - Using Smart Factory (120+ lines → 1 line!)
export const buildingsToolbarConfig: CompactToolbarConfig = createToolbarConfig('buildings');

// 🚀 ENTERPRISE: Projects Configuration - Using Smart Factory (90+ lines → 1 line!)
export const projectsToolbarConfig: CompactToolbarConfig = createToolbarConfig('projects');

// 🚀 ENTERPRISE: Contacts Configuration - Using Smart Factory (90+ lines → 1 line!)
export const contactsToolbarConfig: CompactToolbarConfig = createToolbarConfig('contacts');

// 🚀 ENTERPRISE: Units Configuration - Using Smart Factory (100+ lines → 1 line!)
export const unitsToolbarConfig: CompactToolbarConfig = createToolbarConfig('units');

// 🚀 ENTERPRISE: Storages Configuration - Using Smart Factory (100+ lines → 1 line!)
export const storagesToolbarConfig: CompactToolbarConfig = createToolbarConfig('storages');

// 🅿️ ENTERPRISE: Parking Configuration - Using Smart Factory (100+ lines → 1 line!)
export const parkingToolbarConfig: CompactToolbarConfig = createToolbarConfig('parking');

// 📧 ENTERPRISE: Communications Configuration - WORKFLOW ACTIONS ONLY (not CRUD)
// Per ChatGPT guidance: Inbox toolbar = WORKFLOW, not CRUD
// Workflow actions: refresh, filters, sorting, favorites, archive, export, reports, settings, help
// NO CRUD actions: newItem, editItem, deleteItems, import, preview, copy, share, favoritesManagement
export const communicationsConfig: CompactToolbarConfig = {
  searchPlaceholder: searchPlaceholders.communications,

  // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
  labels: {
    newItem: '', // Not used - workflow only
    editItem: '', // Not used - workflow only
    deleteItems: '', // Not used - workflow only
    filters: 'toolbar.actions.filters',
    favorites: 'toolbar.communications.important',
    archive: 'toolbar.actions.archive',
    export: 'toolbar.actions.export',
    import: '', // Not used - workflow only
    refresh: 'toolbar.actions.refresh',
    preview: '', // Not used - workflow only
    copy: '', // Not used - workflow only
    share: '', // Not used - workflow only
    reports: 'toolbar.actions.reports',
    settings: 'toolbar.actions.settings',
    favoritesManagement: '', // Not used - workflow only
    help: 'toolbar.actions.help',
    sorting: 'toolbar.actions.sorting'
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
    sorting: 'toolbar.tooltips.sorting'
  },

  filterCategories: getFilterCategoriesForType('communications'),
  sortOptions: getSortOptionsForType('communications'),

  // 📧 WORKFLOW ACTIONS ONLY - No CRUD for inbox
  availableActions: {
    // ✅ WORKFLOW ACTIONS (enabled)
    refresh: true,
    filters: true,
    sorting: true,
    favorites: true, // For "Important" marking
    archive: true,
    export: true,
    reports: true,
    settings: true,
    help: true,
    // ❌ CRUD ACTIONS (disabled - not for inbox)
    newItem: false,
    editItem: false,
    deleteItems: false,
    import: false,
    preview: false,
    copy: false,
    share: false,
    favoritesManagement: false
  }
};
