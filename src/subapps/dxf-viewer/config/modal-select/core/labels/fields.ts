/**
 * @fileoverview Field Labels Module - i18n Keys
 * @description Extracted from modal-select.ts - FIELD LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @updated 2025-01-18 - ENTERPRISE i18n MIGRATION
 * @version 2.0.0 - ENTERPRISE i18n ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - SAP/Salesforce Pattern
 *
 * 🏢 ENTERPRISE i18n PATTERN:
 * - All values are i18n keys (not hardcoded strings)
 * - Keys correspond to forms.json namespace
 * - Use useFormLabels hook to translate at runtime
 * - Follows SAP, Salesforce, Microsoft Dynamics i18n patterns
 */

// ====================================================================
// FIELD LABELS - 🏢 ENTERPRISE i18n KEYS
// ====================================================================

/**
 * Company Basic Information Field Labels (i18n Keys)
 * ✅ CENTRALIZED: Single source of truth for company form field i18n keys
 * ✅ ENTERPRISE: Use useFormLabels().getCompanyLabel(key) to translate
 *
 * @example
 * ```tsx
 * const { getCompanyLabel } = useFormLabels();
 * const label = getCompanyLabel('companyName'); // Returns translated string
 * ```
 */
export const MODAL_SELECT_COMPANY_FIELD_LABELS = {
  // Basic Company Info - i18n keys
  company_name: 'company.companyName',
  trade_name: 'company.tradeName',
  vat_number: 'company.vatNumber',
  gemi_number: 'company.gemiNumber',
  legal_form: 'company.legalForm',
  gemi_status: 'company.gemiStatus',
  activity_code: 'company.activityCode',
  activity_description: 'company.activityDescription',
  activity_type: 'company.activityType',
  chamber: 'company.chamber',
  capital_amount: 'company.capitalAmount',
  currency: 'company.currency',
  extraordinary_capital: 'company.extraordinaryCapital',
  registration_date: 'company.registrationDate',
  status_date: 'company.statusDate',
  prefecture: 'company.prefecture',
  municipality: 'company.municipality',
  gemi_department: 'company.gemiDepartment',
  address_type: 'company.addressType',
  street: 'company.street',
  street_number: 'company.streetNumber',
  postal_code: 'company.postalCode',
  city: 'company.city',
  region: 'company.region',
  shareholder_type: 'company.shareholderType',
  shareholder_id: 'company.shareholderId',
  share_type: 'company.shareType',
  share_percentage: 'company.sharePercentage',
  nominal_value: 'company.nominalValue',
  document_type: 'company.documentType',
  document_date: 'company.documentDate',
  document_subject: 'company.documentSubject',
  decision_date: 'company.decisionDate',
  decision_subject: 'company.decisionSubject',
  protocol_number: 'company.protocolNumber',
  decision_summary: 'company.decisionSummary',
  version_date: 'company.versionDate',
  change_description: 'company.changeDescription',
  previous_value: 'company.previousValue',
  new_value: 'company.newValue',
  representative_name: 'company.representativeName',
  representative_role: 'company.representativeRole',
  representative_tax: 'company.representativeTax',
  representative_doy: 'company.representativeDoy',
  representative_phone: 'company.representativePhone',
  announcement_date: 'company.announcementDate',
  issue_paper: 'company.issuePaper',
  announcement_subject: 'company.announcementSubject',
  announcement_summary: 'company.announcementSummary',
  announcement_file: 'company.announcementFile',
  current_status: 'company.currentStatus',
  status_change_date: 'company.statusChangeDate',
  status_reason: 'company.statusReason',
  previous_status: 'company.previousStatus',
  relationships_summary: 'company.relationshipsSummary'
} as const;

/**
 * Service Form Field Labels (i18n Keys) - Centralized από service-config.ts
 * ✅ ENTERPRISE: Single source of truth για όλα τα service form i18n keys
 * ✅ ENTERPRISE: Use useFormLabels().getServiceLabel(key) to translate
 * 🔧 FIX: Updated to use contacts.service.fields.* keys with .label suffix (2026-01-19)
 */
export const MODAL_SELECT_SERVICE_FIELD_LABELS = {
  // Basic Info - i18n keys (updated to match contacts.json structure)
  service_name: 'contacts.service.fields.name.label',
  short_name: 'contacts.service.fields.shortName.label',
  category: 'contacts.service.fields.category.label',
  supervision_ministry: 'contacts.service.fields.supervisionMinistry.label',

  // Administrative - i18n keys (updated to match contacts.json structure)
  legal_status: 'contacts.service.fields.legalStatus.label',
  establishment_law: 'contacts.service.fields.establishmentLaw.label',
  head_title: 'contacts.service.fields.headTitle.label',
  head_name: 'contacts.service.fields.headName.label',

  // Contact Info - i18n keys (reuse company keys)
  street: 'company.street',
  street_number: 'company.streetNumber',
  city: 'company.city',
  postal_code: 'company.postalCode',
  phone: 'company.representativePhone',
  email: 'labels.email',
  website: 'service.website',

  // Responsibilities & Services - i18n keys (updated to match contacts.json structure)
  main_responsibilities: 'contacts.service.fields.mainResponsibilities.label',
  citizen_services: 'contacts.service.fields.citizenServices.label',
  online_services: 'contacts.service.fields.onlineServices.label',
  service_hours: 'contacts.service.fields.serviceHours.label',

  // Sections - i18n keys
  basic_info_section: 'sections.basicInfo',
  administrative_section: 'sections.administrative',
  contact_section: 'sections.contactInfo',
  services_section: 'sections.servicesResponsibilities',
  logo_section: 'sections.logo',
  relationships_section: 'sections.employeesOrganization'
} as const;

/**
 * Filter Panel Titles (i18n Keys) - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded filter titles from AdvancedFilters/configs.ts
 * ✅ ENTERPRISE: Use useFormLabels().getFilterLabel(key) to translate
 */
export const MODAL_SELECT_FILTER_PANEL_TITLES = {
  // Filter Panel Titles - i18n keys
  units: 'filters.title',
  contacts: 'filters.contacts',
  buildings: 'filters.buildings',
  projects: 'filters.projects',

  // Advanced Filter Titles - i18n keys
  advanced: 'filters.advanced'
} as const;

/**
 * Search Placeholders (i18n Keys) - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded search placeholders
 * ✅ ENTERPRISE: Use useFormLabels().getPlaceholder(key) to translate
 */
export const MODAL_SELECT_SEARCH_PLACEHOLDERS = {
  // Search Field Placeholders - i18n keys
  units_search: 'searchPlaceholders.units',
  contacts_search: 'searchPlaceholders.contacts',
  buildings_search: 'searchPlaceholders.buildings',
  projects_search: 'searchPlaceholders.projects',

  // Field Placeholders - i18n keys
  status_placeholder: 'searchPlaceholders.status',
  project_placeholder: 'searchPlaceholders.selectProject',
  building_placeholder: 'searchPlaceholders.selectBuilding',
  floor_placeholder: 'searchPlaceholders.selectFloor',
  type_placeholder: 'searchPlaceholders.selectType',
  priority_placeholder: 'searchPlaceholders.selectPriority',
  location_placeholder: 'searchPlaceholders.selectLocation',
  company_placeholder: 'searchPlaceholders.selectCompany',
  client_placeholder: 'searchPlaceholders.selectClient',
  energy_class_placeholder: 'searchPlaceholders.selectEnergyClass',
  renovation_placeholder: 'searchPlaceholders.selectRenovation',
  risk_level_placeholder: 'searchPlaceholders.selectRiskLevel',
  complexity_placeholder: 'searchPlaceholders.selectComplexity'
} as const;

/**
 * Field Labels (i18n Keys) - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded field labels
 * ✅ ENTERPRISE: Use useFormLabels().getFilterLabel(key) to translate
 */
export const MODAL_SELECT_FIELD_LABELS = {
  // Common Field Labels - i18n keys
  search: 'filters.search',
  status: 'labels.status',
  type: 'filters.type',
  priority: 'filters.priority',
  location: 'filters.location',
  company: 'labels.company',
  client: 'filters.client',
  project: 'filters.project',
  building: 'filters.building',
  floor: 'labels.floor',

  // Unit-specific Labels - i18n keys
  price_range: 'filters.priceRange',
  area_range: 'filters.areaRange',
  property_type: 'filters.propertyType',

  // Contact-specific Labels - i18n keys
  contact_type: 'filters.contactType',
  units_count: 'filters.unitsCount',
  total_area: 'filters.totalArea',
  has_properties: 'filters.hasProperties',
  is_favorite: 'filters.isFavorite',
  show_archived: 'filters.showArchived',

  // Building-specific Labels - i18n keys
  value_range: 'filters.valueRange',
  units_range: 'filters.unitsRange',
  year_range: 'filters.yearRange',
  has_parking: 'filters.hasParking',
  has_elevator: 'filters.hasElevator',
  has_garden: 'filters.hasGarden',
  has_pool: 'filters.hasPool',
  energy_class: 'filters.energyClass',
  accessibility: 'filters.accessibility',
  furnished: 'filters.furnished',
  renovation: 'filters.renovation',

  // Project-specific Labels - i18n keys
  budget_range: 'filters.budgetRange',
  duration_range: 'filters.durationRange',
  progress_range: 'filters.progressRange',
  start_year_range: 'filters.startYearRange',
  has_permits: 'filters.hasPermits',
  has_financing: 'filters.hasFinancing',
  is_ecological: 'filters.isEcological',
  has_subcontractors: 'filters.hasSubcontractors',
  risk_level: 'filters.riskLevel',
  complexity: 'filters.complexity',
  is_active: 'filters.isActive',
  has_issues: 'filters.hasIssues'
} as const;

/**
 * Advanced Filter Options (i18n Keys) - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded advanced filter labels
 */
export const MODAL_SELECT_ADVANCED_FILTER_OPTIONS = {
  // Unit Features - i18n keys
  parking: 'features.parking',
  storage: 'features.storage',
  fireplace: 'features.fireplace',
  view: 'features.view',
  pool: 'features.pool',

  // Contact Features - i18n keys
  is_favorite_contacts: 'features.isFavoriteContacts',
  has_email: 'features.hasEmail',
  has_phone: 'features.hasPhone',
  recent_activity: 'features.recentActivity'
} as const;

/**
 * Range Labels (i18n Keys) - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates ALL hardcoded range option labels
 */
export const MODAL_SELECT_RANGE_LABELS = {
  // Units Count Options - i18n keys
  units_all: 'rangeOptions.allUnits',
  units_1_2: 'rangeOptions.units1to2',
  units_3_5: 'rangeOptions.units3to5',
  units_6_plus: 'rangeOptions.units6plus',

  // Area Options - i18n keys
  areas_all: 'rangeOptions.allAreas',
  area_up_to_100: 'rangeOptions.areaUpTo100',
  area_101_300: 'rangeOptions.area101to300',
  area_301_plus: 'rangeOptions.area301plus'
} as const;

/**
 * Energy Class Labels - Centralized Source of Truth
 * ✅ ENTERPRISE: Eliminates hardcoded energy class options
 */
export const MODAL_SELECT_ENERGY_CLASS_LABELS = {
  'A+': 'A+',
  'A': 'A',
  'B+': 'B+',
  'B': 'B',
  'C': 'C',
  'D': 'D',
  'E': 'E',
  'F': 'F',
  'G': 'G'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get company field labels
 * ✅ CENTRALIZED: Getter function for company field labels
 */
export function getCompanyFieldLabels() {
  return MODAL_SELECT_COMPANY_FIELD_LABELS;
}

/**
 * Get service field labels
 * ✅ CENTRALIZED: Getter function για service form fields
 */
export function getServiceFieldLabels() {
  return MODAL_SELECT_SERVICE_FIELD_LABELS;
}

/**
 * Get filter panel titles
 * ✅ CENTRALIZED: Getter function για filter panel titles
 */
export function getFilterPanelTitles() {
  return MODAL_SELECT_FILTER_PANEL_TITLES;
}

/**
 * Get search placeholders
 * ✅ CENTRALIZED: Getter function για search placeholders
 */
export function getSearchPlaceholders() {
  return MODAL_SELECT_SEARCH_PLACEHOLDERS;
}

/**
 * Get field labels
 * ✅ CENTRALIZED: Getter function για field labels
 */
export function getFieldLabels() {
  return MODAL_SELECT_FIELD_LABELS;
}

/**
 * Get advanced filter options
 * ✅ CENTRALIZED: Getter function για advanced filter options
 */
export function getAdvancedFilterOptions() {
  return MODAL_SELECT_ADVANCED_FILTER_OPTIONS;
}

/**
 * Get range labels
 * ✅ CENTRALIZED: Getter function για range labels
 */
export function getRangeLabels() {
  return MODAL_SELECT_RANGE_LABELS;
}

/**
 * Get energy class labels
 * ✅ CENTRALIZED: Getter function για energy class labels
 */
export function getEnergyClassLabels() {
  return MODAL_SELECT_ENERGY_CLASS_LABELS;
}