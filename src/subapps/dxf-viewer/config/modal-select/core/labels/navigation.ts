/**
 * @fileoverview Navigation Labels Module
 * @description Extracted from modal-select.ts - NAVIGATION LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 */

// ====================================================================
// NAVIGATION LABELS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Navigation Level Titles - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλους τους navigation level titles
 * 🌐 i18n: Uses keys from navigation.json namespace
 */
export const MODAL_SELECT_NAVIGATION_LEVEL_TITLES = {
  companies: 'entities.company.title',
  projects: 'entities.project.title',
  buildings: 'entities.building.title',
  floors: 'entities.floor.title',
  units: 'entities.unit.title'
} as const;

/**
 * Navigation Base Labels - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλα τα base navigation labels
 * 🌐 i18n: Uses keys from navigation.json namespace
 */
export const MODAL_SELECT_NAVIGATION_BASE_LABELS = {
  // Action Labels
  add: 'toolbar.labels.link',
  connect: 'toolbar.labels.link',
  edit: 'common.actions.edit',
  remove: 'toolbar.labels.remove',
  disconnect: 'toolbar.labels.unlink',
  filters: 'toolbar.labels.filters',
  favorites: 'toolbar.labels.favorites',
  archive: 'toolbar.labels.archive',
  export: 'common.actions.export',
  import: 'common.actions.import',
  refresh: 'common.actions.refresh',
  preview: 'toolbar.labels.preview',
  copy: 'toolbar.labels.copy',
  share: 'toolbar.labels.share',
  reports: 'toolbar.labels.reports',
  settings: 'toolbar.labels.settings',
  favorites_management: 'toolbar.labels.favoritesManagement',
  help: 'toolbar.labels.help',
  sorting: 'toolbar.labels.sorting',

  // Tooltip Labels
  filtering: 'toolbar.tooltips.filters',
  archiving: 'toolbar.tooltips.archive',
  export_data: 'toolbar.tooltips.exportData',
  import_data: 'toolbar.tooltips.importData',
  refresh_data: 'toolbar.tooltips.refreshData'
} as const;

/**
 * Navigation Search Placeholders - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλα τα search placeholders
 * 🌐 i18n: Uses keys from navigation.json namespace
 */
export const MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS = {
  companies: 'toolbar.search.company',
  projects: 'toolbar.search.project',
  buildings: 'toolbar.search.building',
  floors: 'toolbar.search.floor',
  units: 'toolbar.search.unit'
} as const;

/**
 * Navigation Tooltip Labels - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλα τα navigation tooltips
 * 🌐 i18n: Uses keys from navigation.json namespace
 */
export const MODAL_SELECT_NAVIGATION_TOOLTIPS = {
  // Companies Tooltips
  add_company: 'toolbar.actions.companies.new',
  edit_company: 'toolbar.actions.companies.edit',
  remove_company: 'toolbar.actions.companies.delete',

  // Projects Tooltips
  connect_project: 'toolbar.actions.projects.new',
  edit_project: 'toolbar.actions.projects.edit',
  disconnect_project: 'toolbar.actions.projects.delete',

  // Buildings Tooltips
  connect_building: 'toolbar.actions.buildings.new',
  edit_building: 'toolbar.actions.buildings.edit',
  disconnect_building: 'toolbar.actions.buildings.delete',

  // Floors Tooltips
  connect_floor: 'toolbar.actions.floors.new',
  edit_floor: 'toolbar.actions.floors.edit',
  disconnect_floor: 'toolbar.actions.floors.delete',

  // Units Tooltips
  connect_unit: 'toolbar.actions.units.new',
  edit_unit: 'toolbar.actions.units.edit',
  disconnect_unit: 'toolbar.actions.units.delete'
} as const;

/**
 * Navigation Filter Categories - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλες τις filter κατηγορίες
 * 🌐 i18n: Uses keys from navigation.json namespace
 */
export const MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES = {
  // Companies Filters
  company_type_label: 'filters.companies.typeLabel',
  company_construction: 'filters.companies.construction',
  company_development: 'filters.companies.development',
  company_investment: 'filters.companies.investment',
  company_management: 'filters.companies.management',
  company_status_label: 'filters.companies.statusLabel',
  company_active: 'filters.companies.active',
  company_with_projects: 'filters.companies.withProjects',
  company_without_projects: 'filters.companies.withoutProjects',
  project_without_buildings: 'filters.projects.withoutBuildings',
  building_without_units: 'filters.buildings.withoutUnits',

  // Projects Filters
  project_status_label: 'filters.projects.statusLabel',
  project_planning: 'filters.projects.planning',
  project_construction: 'filters.projects.construction',
  project_completed: 'filters.projects.completed',
  project_on_hold: 'filters.projects.onHold',
  project_type_label: 'filters.projects.typeLabel',
  project_residential: 'filters.projects.residential',
  project_commercial: 'filters.projects.commercial',
  project_mixed: 'filters.projects.mixed',

  // Buildings Filters
  building_type_label: 'filters.buildings.typeLabel',
  building_residential: 'filters.buildings.residential',
  building_commercial: 'filters.buildings.commercial',
  building_office: 'filters.buildings.office',
  building_mixed: 'filters.buildings.mixed',
  building_floors_label: 'filters.buildings.floorsLabel',
  building_floors_1_3: 'filters.buildings.floors1to3',
  building_floors_4_6: 'filters.buildings.floors4to6',
  building_floors_7_plus: 'filters.buildings.floors7plus',

  // Floors Filters
  floor_type_label: 'filters.floors.typeLabel',
  floor_basement: 'filters.floors.basement',
  floor_ground: 'filters.floors.ground',
  floor_floor: 'filters.floors.floor',
  floor_penthouse: 'filters.floors.penthouse',
  floor_units_label: 'filters.floors.unitsLabel',
  floor_units_1_2: 'filters.floors.units1to2',
  floor_units_3_5: 'filters.floors.units3to5',
  floor_units_6_plus: 'filters.floors.units6plus',

  // Units Filters
  unit_type_label: 'filters.units.typeLabel',
  unit_apartment: 'filters.units.apartment',
  unit_office: 'filters.units.office',
  unit_shop: 'filters.units.shop',
  unit_storage: 'filters.units.storage',
  unit_parking: 'filters.units.parking',
  unit_status_label: 'filters.units.statusLabel',
  unit_available: 'filters.units.available',
  unit_occupied: 'filters.units.occupied',
  unit_reserved: 'filters.units.reserved',
  unit_maintenance: 'filters.units.maintenance',
  unit_rooms_label: 'filters.units.roomsLabel',
  unit_1_room: 'filters.units.rooms1',
  unit_2_rooms: 'filters.units.rooms2',
  unit_3_rooms: 'filters.units.rooms3',
  unit_4_plus_rooms: 'filters.units.rooms4plus'
} as const;

/**
 * Navigation Sort Options - Centralized από NavigationCardToolbar.tsx
 * ✅ ENTERPRISE: Single source of truth για όλες τις sort επιλογές
 * 🌐 i18n: Uses keys from navigation.json namespace
 */
export const MODAL_SELECT_NAVIGATION_SORT_OPTIONS = {
  // Common Sort Options
  name_asc: 'toolbar.sort.nameAsc',
  name_desc: 'toolbar.sort.nameDesc',
  date_asc: 'toolbar.sort.dateOldest',
  date_desc: 'toolbar.sort.dateNewest',
  companies_date_asc: 'toolbar.sort.dateOldest',
  companies_date_desc: 'toolbar.sort.dateNewest',

  // Projects Sort Options
  progress_asc: 'toolbar.sort.progressLow',
  progress_desc: 'toolbar.sort.progressHigh',

  // Buildings & Floors Sort Options
  area_asc: 'toolbar.sort.areaSmall',
  area_desc: 'toolbar.sort.areaLarge',

  // Units Sort Options
  rooms_asc: 'toolbar.sort.roomsFew',
  rooms_desc: 'toolbar.sort.roomsMany'
} as const;

/**
 * Compact Toolbar Search Placeholders - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα compact toolbar search placeholders
 * 🏢 ENTERPRISE: Now uses i18n keys - translations in building.json
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_SEARCH_PLACEHOLDERS = {
  buildings: 'placeholders.searchBuildings',
  projects: 'placeholders.searchProjects',
  contacts: 'placeholders.searchContacts',
  units: 'placeholders.searchUnits',
  storages: 'placeholders.searchStorages',
  parking: 'placeholders.searchParking',
  communications: 'placeholders.searchCommunications'
} as const;

/**
 * Compact Toolbar New Item Labels - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα "New Item" labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_NEW_ITEM_LABELS = {
  new_building: 'common.actions.newBuilding',
  new_project: 'common.actions.newProject',
  new_contact: 'common.actions.newContact',
  new_unit: 'common.actions.newUnit',
  new_storage: 'common.actions.newStorage',
  parking: 'common.actions.newParking'
} as const;

/**
 * Compact Toolbar Context Labels - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα context-specific labels
 * 🌐 i18n: Uses keys from navigation.json and common.json namespaces
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_CONTEXT_LABELS = {
  // Buildings Context
  favorites_feminine: 'toolbar.labels.favorites',
  favorites_feminine_plural: 'toolbar.labels.favorites',

  // Sorting Context
  sorting_buildings: 'toolbar.tooltips.sorting',
  sorting_projects: 'toolbar.tooltips.sorting',
  sorting_contacts: 'toolbar.tooltips.sorting',
  sorting_units: 'toolbar.tooltips.sorting',
  sorting_storages: 'toolbar.tooltips.sorting',

  // Management Labels
  favorites_management: 'toolbar.labels.favoritesManagement',

  // Action Labels που δεν υπάρχουν στα navigation labels
  share_alt: 'toolbar.labels.share',
  delete_items: 'common.actions.delete'
} as const;

/**
 * Compact Toolbar Detailed Tooltips - Centralized από CompactToolbar/configs.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα detailed tooltips
 * 🏢 ENTERPRISE: Extended με ΟΛΑ τα tooltips για 100% κεντρικοποίηση
 * 🌐 i18n: Uses keys from navigation.json and common.json namespaces
 */
export const MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS = {
  // ========================================================================
  // 🆕 NEW ITEM TOOLTIPS (Context-specific)
  // ========================================================================
  new_building_tooltip: 'common.tooltips.newBuildingShortcut',
  new_project_tooltip: 'common.tooltips.newProjectShortcut',
  new_contact_tooltip: 'common.tooltips.newContactShortcut',
  new_unit_tooltip: 'common.tooltips.newUnitShortcut',
  new_storage_tooltip: 'common.tooltips.newStorageShortcut',

  // ========================================================================
  // ✏️ EDIT TOOLTIPS (Context-specific)
  // ========================================================================
  edit_building: 'toolbar.actions.buildings.edit',
  edit_project: 'toolbar.actions.projects.edit',
  edit_contact: 'common.tooltips.editContact',
  edit_unit: 'toolbar.actions.units.edit',
  edit_storage: 'toolbar.actions.storage.edit',
  edit_generic: 'common.tooltips.editSelected',

  // ========================================================================
  // 🗑️ DELETE TOOLTIPS (Context-specific)
  // ========================================================================
  delete_building: 'toolbar.actions.buildings.delete',
  delete_project: 'toolbar.actions.projects.delete',
  delete_contact: 'common.tooltips.deleteContact',
  delete_unit: 'toolbar.actions.units.delete',
  delete_storage: 'toolbar.actions.storage.delete',
  delete_generic: 'common.tooltips.deleteSelected',

  // ========================================================================
  // 📤 SHARE TOOLTIPS (Context-specific)
  // ========================================================================
  share_building: 'common.tooltips.shareBuilding',
  share_project: 'common.tooltips.shareProject',
  share_contact: 'common.tooltips.shareContact',
  share_unit: 'common.tooltips.shareUnit',
  share_storage: 'common.tooltips.shareStorage',
  share_generic: 'toolbar.labels.share',

  // ========================================================================
  // 🔧 COMMON ACTION TOOLTIPS (Generic - used across all entity types)
  // ========================================================================
  filters: 'toolbar.tooltips.filters',
  favorites: 'toolbar.tooltips.favorites',
  archive: 'toolbar.tooltips.archive',
  export: 'toolbar.tooltips.exportData',
  import: 'toolbar.tooltips.importData',
  refresh: 'toolbar.tooltips.refreshData',
  preview: 'toolbar.tooltips.preview',
  copy: 'toolbar.tooltips.copy',
  reports: 'toolbar.tooltips.reports',
  settings: 'toolbar.tooltips.settings',
  help: 'toolbar.tooltips.help',
  sorting: 'toolbar.tooltips.sorting',

  // ========================================================================
  // ⭐ FAVORITES MANAGEMENT TOOLTIPS
  // ========================================================================
  manage_favorites: 'toolbar.tooltips.favoritesManagement',
  favorites_management: 'toolbar.labels.favoritesManagement',

  // ========================================================================
  // 📦 BULK ACTION TOOLTIPS
  // ========================================================================
  bulk_actions: 'common.tooltips.bulkActions'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get navigation level titles
 * ✅ CENTRALIZED: Getter function για navigation level titles
 */
export function getNavigationLevelTitles() {
  return MODAL_SELECT_NAVIGATION_LEVEL_TITLES;
}

/**
 * Get navigation base labels
 * ✅ CENTRALIZED: Getter function για navigation base labels
 */
export function getNavigationBaseLabels() {
  return MODAL_SELECT_NAVIGATION_BASE_LABELS;
}

/**
 * Get navigation search placeholders
 * ✅ CENTRALIZED: Getter function για navigation search placeholders
 */
export function getNavigationSearchPlaceholders() {
  return MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS;
}

/**
 * Get navigation tooltips
 * ✅ CENTRALIZED: Getter function για navigation tooltips
 */
export function getNavigationTooltips() {
  return MODAL_SELECT_NAVIGATION_TOOLTIPS;
}

/**
 * Get navigation filter categories
 * ✅ CENTRALIZED: Getter function για navigation filter categories
 */
export function getNavigationFilterCategories() {
  return MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES;
}

/**
 * Get navigation sort options
 * ✅ CENTRALIZED: Getter function για navigation sort options
 */
export function getNavigationSortOptions() {
  return MODAL_SELECT_NAVIGATION_SORT_OPTIONS;
}

/**
 * Get compact toolbar search placeholders
 * ✅ CENTRALIZED: Getter function για compact toolbar search placeholders
 */
export function getCompactToolbarSearchPlaceholders() {
  return MODAL_SELECT_COMPACT_TOOLBAR_SEARCH_PLACEHOLDERS;
}

/**
 * Get compact toolbar new item labels
 * ✅ CENTRALIZED: Getter function για compact toolbar new item labels
 */
export function getCompactToolbarNewItemLabels() {
  return MODAL_SELECT_COMPACT_TOOLBAR_NEW_ITEM_LABELS;
}

/**
 * Get compact toolbar context labels
 * ✅ CENTRALIZED: Getter function για compact toolbar context labels
 */
export function getCompactToolbarContextLabels() {
  return MODAL_SELECT_COMPACT_TOOLBAR_CONTEXT_LABELS;
}

/**
 * Get compact toolbar detailed tooltips
 * ✅ CENTRALIZED: Getter function για compact toolbar detailed tooltips
 */
export function getCompactToolbarTooltips() {
  return MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS;
}