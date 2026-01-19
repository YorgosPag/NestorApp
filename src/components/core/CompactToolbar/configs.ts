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

// 🏢 ENTERPRISE: Import centralized CompactToolbar labels from modal-select
import {
  getCompactToolbarSearchPlaceholders,
  getCompactToolbarNewItemLabels,
  getCompactToolbarTooltips
} from '@/subapps/dxf-viewer/config/modal-select';

// 🅿️ ENTERPRISE: Import parking labels
import {
  PARKING_TYPE_LABELS,
  PARKING_STATUS_LABELS
} from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

// 🏢 ENTERPRISE: Get centralized labels ONCE - Smart Configuration Factory
const searchPlaceholders = getCompactToolbarSearchPlaceholders();
const newItemLabels = getCompactToolbarNewItemLabels();
const tooltips = getCompactToolbarTooltips();

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
            { value: 'residential', label: PROPERTY_BUILDING_TYPE_LABELS.RESIDENTIAL },
            { value: 'commercial', label: PROPERTY_BUILDING_TYPE_LABELS.COMMERCIAL },
            { value: 'mixed', label: PROPERTY_BUILDING_TYPE_LABELS.MIXED }
          ]
        }
      ];
    case 'contacts':
      return [
        {
          id: 'type',
          label: 'toolbar.filters.categories.contactType',
          options: [
            { value: 'customer', label: CONTACT_BUSINESS_TYPE_LABELS.CUSTOMER },
            { value: 'supplier', label: CONTACT_BUSINESS_TYPE_LABELS.SUPPLIER },
            { value: 'contractor', label: CONTACT_BUSINESS_TYPE_LABELS.CONTRACTOR }
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

// 🚀 ENTERPRISE: Smart Configuration Factory - No duplicated labels!
function createToolbarConfig(
  type: 'buildings' | 'projects' | 'contacts' | 'units' | 'storages' | 'parking' | 'communications'
): CompactToolbarConfig {
  return {
    searchPlaceholder: searchPlaceholders[type],

    // 🌐 i18n: All labels converted to i18n keys - 2026-01-18
    labels: {
      newItem: newItemLabels[type],
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

    // 🏢 ENTERPRISE: 100% Centralized Tooltips - ZERO HARDCODED VALUES
    tooltips: {
      newItem: tooltips[`new_${type.slice(0, -1)}_tooltip` as keyof typeof tooltips] || tooltips.new_building_tooltip,
      editItem: tooltips[`edit_${type.slice(0, -1)}` as keyof typeof tooltips] || tooltips.edit_generic,
      deleteItems: tooltips[`delete_${type.slice(0, -1)}` as keyof typeof tooltips] || tooltips.delete_generic,
      filters: tooltips.filters,
      favorites: tooltips.favorites,
      archive: tooltips.archive,
      export: tooltips.export,
      import: tooltips.import,
      refresh: tooltips.refresh,
      preview: tooltips.preview,
      copy: tooltips.copy,
      share: tooltips[`share_${type.slice(0, -1)}` as keyof typeof tooltips] || tooltips.share_generic,
      reports: tooltips.reports,
      settings: tooltips.settings,
      favoritesManagement: tooltips.favorites_management,
      help: tooltips.help,
      sorting: tooltips.sorting
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
    filters: tooltips.filters,
    favorites: 'toolbar.communications.markAsImportant',
    archive: tooltips.archive,
    export: tooltips.export,
    import: '',
    refresh: tooltips.refresh,
    preview: '',
    copy: '',
    share: '',
    reports: tooltips.reports,
    settings: tooltips.settings,
    favoritesManagement: '',
    help: tooltips.help,
    sorting: tooltips.sorting
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
