/**
 * @fileoverview Modal Select System - Main Hub (Barrel Exports)
 * @description Enterprise modular architecture - Central export point
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR SPLIT
 * @compliance CLAUDE.md Enterprise Standards - TREE-SHAKING OPTIMIZED
 */

// ====================================================================
// 🏢 ENTERPRISE BARREL EXPORTS - MODULAR ARCHITECTURE
// ====================================================================

// 🎨 STYLES MODULE
export {
  MODAL_SELECT_STYLES
} from './core/styles/select-styles';

// 🎨 PATTERNS MODULE
export {
  MODAL_SELECT_ITEM_PATTERNS
} from './core/styles/patterns';

// 🔧 OPTIONS MODULE - ENCODING
export {
  MODAL_SELECT_ENCODING_OPTIONS,
  MODAL_SELECT_BOOLEAN_OPTIONS,
  getEncodingOptions,
  getBooleanOptions
} from './core/options/encoding';

// 🏢 OPTIONS MODULE - COMPANY
export {
  MODAL_SELECT_LEGAL_FORMS,
  MODAL_SELECT_GEMI_STATUSES,
  MODAL_SELECT_SERVICE_CATEGORIES,
  MODAL_SELECT_LEGAL_STATUSES,
  MODAL_SELECT_ACTIVITY_TYPES,
  MODAL_SELECT_ADDRESS_TYPES,
  MODAL_SELECT_SHAREHOLDER_TYPES,
  MODAL_SELECT_COMPANY_HELP_TEXTS,
  getLegalFormOptions,
  getGemiStatusOptions,
  getServiceCategoryOptions,
  getLegalStatusOptions,
  getActivityTypeOptions,
  getAddressTypeOptions,
  getShareholderTypeOptions,
  getGemiHelpTexts
} from './core/options/company';

// 👥 OPTIONS MODULE - INDIVIDUAL
export {
  MODAL_SELECT_GENDER_OPTIONS,
  MODAL_SELECT_IDENTITY_TYPES,
  MODAL_SELECT_COUNTRY_OPTIONS,
  MODAL_SELECT_CURRENCY_OPTIONS,
  getGenderOptions,
  getIdentityTypeOptions,
  getCountryOptions,
  getCurrencyOptions
} from './core/options/individual';

// 🏷️ LABELS MODULE - STATUS
export {
  MODAL_SELECT_PROJECT_STATUS_LABELS,
  MODAL_SELECT_UNIT_STATUS_LABELS,
  MODAL_SELECT_CONTACT_STATUS_LABELS,
  MODAL_SELECT_CONTACT_TYPE_LABELS,
  MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS,
  MODAL_SELECT_RENTAL_TYPE_LABELS,
  MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS,
  MODAL_SELECT_STORAGE_STATUS_LABELS,
  MODAL_SELECT_PRIORITY_LABELS,
  MODAL_SELECT_RECORD_STATE_LABELS,
  MODAL_SELECT_ENTITY_TYPE_LABELS,
  MODAL_SELECT_DOCUMENT_STATUS_LABELS,
  MODAL_SELECT_PROPERTY_TYPE_LABELS,
  getProjectStatusLabels,
  getUnitStatusLabels,
  getContactStatusLabels,
  getContactTypeLabels,
  getPropertyMarketStatusLabels,
  getRentalTypeLabels,
  getPropertySpecialStatusLabels,
  getStorageStatusLabels,
  getPriorityLabels,
  getRecordStateLabels,
  getEntityTypeLabels,
  getDocumentStatusLabels,
  getPropertyTypeLabels
} from './core/labels/status';

// 🏷️ LABELS MODULE - FIELDS
export {
  MODAL_SELECT_COMPANY_FIELD_LABELS,
  MODAL_SELECT_SERVICE_FIELD_LABELS,
  MODAL_SELECT_FILTER_PANEL_TITLES,
  MODAL_SELECT_SEARCH_PLACEHOLDERS,
  MODAL_SELECT_FIELD_LABELS,
  MODAL_SELECT_ADVANCED_FILTER_OPTIONS,
  MODAL_SELECT_RANGE_LABELS,
  MODAL_SELECT_ENERGY_CLASS_LABELS,
  getCompanyFieldLabels,
  getServiceFieldLabels,
  getFilterPanelTitles,
  getSearchPlaceholders,
  getFieldLabels,
  getAdvancedFilterOptions,
  getRangeLabels,
  getEnergyClassLabels
} from './core/labels/fields';

// 🏷️ LABELS MODULE - NAVIGATION
export {
  MODAL_SELECT_NAVIGATION_LEVEL_TITLES,
  MODAL_SELECT_NAVIGATION_BASE_LABELS,
  MODAL_SELECT_NAVIGATION_SEARCH_PLACEHOLDERS,
  MODAL_SELECT_NAVIGATION_TOOLTIPS,
  MODAL_SELECT_NAVIGATION_FILTER_CATEGORIES,
  MODAL_SELECT_NAVIGATION_SORT_OPTIONS,
  MODAL_SELECT_COMPACT_TOOLBAR_SEARCH_PLACEHOLDERS,
  MODAL_SELECT_COMPACT_TOOLBAR_NEW_ITEM_LABELS,
  MODAL_SELECT_COMPACT_TOOLBAR_CONTEXT_LABELS,
  MODAL_SELECT_COMPACT_TOOLBAR_TOOLTIPS,
  getNavigationLevelTitles,
  getNavigationBaseLabels,
  getNavigationSearchPlaceholders,
  getNavigationTooltips,
  getNavigationFilterCategories,
  getNavigationSortOptions,
  getCompactToolbarSearchPlaceholders,
  getCompactToolbarNewItemLabels,
  getCompactToolbarContextLabels,
  getCompactToolbarTooltips
} from './core/labels/navigation';

// 🔧 TOOLBAR MODULE
export {
  MODAL_SELECT_ACTION_BUTTONS_LABELS,
  getDesktopConnectionModals,
  getDesktopNavigationHeaders,
  getDesktopCounters,
  getDesktopNavigationActions,
  getDesktopStatusMessages,
  getDesktopConfirmationDialog,
  getActionButtons
} from './toolbar/configurations';

// 📝 VALIDATION MODULE
export {
  MODAL_SELECT_VALIDATION_MESSAGES,
  getValidationMessages,
  getRequiredFieldMessages,
  getFormatValidationMessages,
  getDateValidationMessages,
  getGenericValidationMessages
} from './validation/messages';

// 🏷️ TAB LABELS MODULE
export {
  MODAL_SELECT_BUILDING_TAB_LABELS,
  MODAL_SELECT_CONTACT_TAB_LABELS,
  MODAL_SELECT_PROJECT_TAB_LABELS,
  MODAL_SELECT_CRM_DASHBOARD_TAB_LABELS,
  MODAL_SELECT_UNITS_TAB_LABELS,
  MODAL_SELECT_STORAGE_TAB_LABELS,
  getBuildingTabLabels,
  getContactTabLabels,
  getProjectTabLabels,
  getCRMDashboardTabLabels,
  getUnitsTabLabels,
  getStorageTabLabels,
  getAllTabLabels,
  getCommonTabLabels
} from './core/labels/tabs';

// 🔧 UTILITY ACCESSORS MODULE
export {
  MODAL_SELECT_DOCUMENT_TYPES,
  MODAL_SELECT_BOARD_TYPES,
  MODAL_SELECT_REPRESENTATIVE_POSITIONS,
  MODAL_SELECT_PROPERTY_TYPE_OPTIONS,
  MODAL_SELECT_UNIT_FILTER_OPTIONS,
  getDocumentTypeOptions,
  getBoardTypeOptions,
  getRepresentativePositionOptions,
  getPropertyTypeOptions,
  getUnitFilterOptions,
  getCompanyOptions,
  getPropertyOptions,
  getAllUtilityOptions
} from './utils/accessors';

// ====================================================================
// 🔄 BACKWARD COMPATIBILITY - TEMPORARY RE-EXPORTS
// ====================================================================

// Re-export everything from original file for now
// This will be gradually replaced as we migrate more modules
export * from '../modal-select';