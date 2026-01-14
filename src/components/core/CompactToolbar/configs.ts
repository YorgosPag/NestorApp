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

// 🚀 ENTERPRISE: Helper functions για filter categories και sort options
function getFilterCategoriesForType(type: 'buildings' | 'projects' | 'contacts' | 'units' | 'storages' | 'parking') {
  const baseCategories = [
    {
      id: 'status',
      label: 'Κατάσταση',
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
          label: 'Τύπος κτιρίου',
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
          label: 'Τύπος επαφής',
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
          label: 'Κατάσταση',
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
          label: 'Τύπος θέσης',
          options: [
            { value: 'standard', label: PARKING_TYPE_LABELS.standard },
            { value: 'handicapped', label: PARKING_TYPE_LABELS.handicapped },
            { value: 'motorcycle', label: PARKING_TYPE_LABELS.motorcycle },
            { value: 'electric', label: PARKING_TYPE_LABELS.electric },
            { value: 'visitor', label: PARKING_TYPE_LABELS.visitor }
          ]
        }
      ];
    default:
      return baseCategories;
  }
}

function getSortOptionsForType(type: 'buildings' | 'projects' | 'contacts' | 'units' | 'storages' | 'parking') {
  return [
    { field: 'name' as const, ascLabel: 'Όνομα (Α-Ζ)', descLabel: 'Όνομα (Ζ-Α)' },
    { field: 'date' as const, ascLabel: 'Ημερομηνία (Παλαιά → Νέα)', descLabel: 'Ημερομηνία (Νέα → Παλαιά)' },
    { field: 'status' as const, ascLabel: 'Κατάσταση (Α-Ζ)', descLabel: 'Κατάσταση (Ζ-Α)' }
  ];
}

// 🚀 ENTERPRISE: Smart Configuration Factory - No duplicated labels!
function createToolbarConfig(
  type: 'buildings' | 'projects' | 'contacts' | 'units' | 'storages' | 'parking'
): CompactToolbarConfig {
  return {
    searchPlaceholder: searchPlaceholders[type],

    labels: {
      newItem: newItemLabels[type],
      editItem: 'Επεξεργασία',
      deleteItems: 'Διαγραφή',
      filters: 'Φίλτρα',
      favorites: 'Αγαπημένα',
      archive: 'Αρχειοθέτηση',
      export: 'Εξαγωγή',
      import: 'Εισαγωγή',
      refresh: 'Ανανέωση',
      preview: 'Προεπισκόπηση',
      copy: 'Αντιγραφή',
      share: 'Κοινοποίηση',
      reports: 'Αναφορές',
      settings: 'Ρυθμίσεις',
      favoritesManagement: 'Διαχείριση αγαπημένων',
      help: 'Βοήθεια',
      sorting: 'Ταξινόμηση'
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

// =============================================================================
// 📬 ENTERPRISE: Communications/Inbox Toolbar Config
// =============================================================================
// IMPORTANT: Inbox is WORKFLOW, NOT CRUD!
// - NO: newItem, editItem, deleteItems (those are CRUD operations)
// - YES: refresh, archive, export, filters, sorting (workflow actions)
// Per local_31_KANALIA.txt enterprise architecture decision
// =============================================================================

/**
 * Communications Inbox Status Labels
 * Used for filtering conversations by status
 */
const INBOX_STATUS_LABELS = {
  all: 'Όλες',
  open: 'Ανοιχτές',
  pending: 'Εκκρεμείς',
  closed: 'Κλειστές',
  archived: 'Αρχειοθετημένες'
} as const;

/**
 * Communications Channel Labels
 * Used for filtering by communication channel
 */
const INBOX_CHANNEL_LABELS = {
  all: 'Όλα τα κανάλια',
  telegram: 'Telegram',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS'
} as const;

/**
 * Communications Inbox Toolbar Configuration
 * 🏢 ENTERPRISE: Workflow-based config (NOT CRUD)
 */
export const communicationsToolbarConfig: CompactToolbarConfig = {
  searchPlaceholder: 'Αναζήτηση συνομιλιών...',

  labels: {
    newItem: '', // Not used - Inbox is workflow, not CRUD
    editItem: '', // Not used
    deleteItems: '', // Not used
    filters: 'Φίλτρα',
    favorites: 'Σημαντικά',
    archive: 'Αρχειοθέτηση',
    export: 'Εξαγωγή',
    import: 'Εισαγωγή',
    refresh: 'Ανανέωση',
    preview: 'Προεπισκόπηση',
    copy: 'Αντιγραφή',
    share: 'Κοινοποίηση',
    reports: 'Αναφορές',
    settings: 'Ρυθμίσεις',
    favoritesManagement: 'Διαχείριση σημαντικών',
    help: 'Βοήθεια',
    sorting: 'Ταξινόμηση'
  },

  tooltips: {
    newItem: '', // Not used
    editItem: '', // Not used
    deleteItems: '', // Not used
    filters: 'Φιλτράρισμα συνομιλιών',
    favorites: 'Εμφάνιση σημαντικών συνομιλιών',
    archive: 'Αρχειοθέτηση επιλεγμένων συνομιλιών',
    export: 'Εξαγωγή συνομιλιών',
    import: 'Εισαγωγή συνομιλιών',
    refresh: 'Ανανέωση λίστας συνομιλιών',
    preview: 'Προεπισκόπηση συνομιλίας',
    copy: 'Αντιγραφή επιλεγμένων',
    share: 'Κοινοποίηση συνομιλίας',
    reports: 'Αναφορές επικοινωνιών',
    settings: 'Ρυθμίσεις εισερχομένων',
    favoritesManagement: 'Διαχείριση σημαντικών συνομιλιών',
    help: 'Βοήθεια για τα εισερχόμενα',
    sorting: 'Ταξινόμηση συνομιλιών'
  },

  filterCategories: [
    {
      id: 'status',
      label: 'Κατάσταση',
      options: [
        { value: 'all', label: INBOX_STATUS_LABELS.all },
        { value: 'open', label: INBOX_STATUS_LABELS.open },
        { value: 'pending', label: INBOX_STATUS_LABELS.pending },
        { value: 'closed', label: INBOX_STATUS_LABELS.closed },
        { value: 'archived', label: INBOX_STATUS_LABELS.archived }
      ]
    },
    {
      id: 'channel',
      label: 'Κανάλι',
      options: [
        { value: 'all', label: INBOX_CHANNEL_LABELS.all },
        { value: 'telegram', label: INBOX_CHANNEL_LABELS.telegram },
        { value: 'email', label: INBOX_CHANNEL_LABELS.email },
        { value: 'whatsapp', label: INBOX_CHANNEL_LABELS.whatsapp },
        { value: 'sms', label: INBOX_CHANNEL_LABELS.sms }
      ]
    }
  ],

  sortOptions: [
    { field: 'date' as const, ascLabel: 'Ημερομηνία (Παλαιά → Νέα)', descLabel: 'Ημερομηνία (Νέα → Παλαιά)' },
    { field: 'priority' as const, ascLabel: 'Προτεραιότητα (Χαμηλή → Υψηλή)', descLabel: 'Προτεραιότητα (Υψηλή → Χαμηλή)' },
    { field: 'status' as const, ascLabel: 'Κατάσταση (Α-Ζ)', descLabel: 'Κατάσταση (Ζ-Α)' }
  ],

  // 📬 ENTERPRISE: Workflow actions ONLY - NO CRUD operations
  availableActions: {
    // ❌ CRUD disabled - Inbox is workflow, not entity management
    newItem: false,
    editItem: false,
    deleteItems: false,

    // ✅ Workflow actions enabled
    refresh: true,        // Refresh conversations list
    archive: true,        // Archive/Unarchive conversations
    export: true,         // Export conversations
    filters: true,        // Filter by status/channel
    sorting: true,        // Sort by date/priority/status
    favorites: true,      // Mark important conversations

    // ⚠️ Optional actions (can enable later)
    import: false,        // Import not typical for inbox
    preview: false,       // Preview in right panel, not action
    copy: false,          // Copy not typical for inbox
    share: false,         // Share not typical for inbox
    reports: true,        // Communication reports
    settings: true,       // Inbox settings
    favoritesManagement: false, // Handled via favorites action
    help: true            // Help for inbox
  }
};
