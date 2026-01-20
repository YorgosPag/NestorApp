/**
 * @fileoverview Status Labels Module
 * @description Extracted from modal-select.ts - STATUS LABELS
 * @author Claude (Anthropic AI)
 * @date 2025-12-28
 * @version 1.0.0 - ENTERPRISE MODULAR ARCHITECTURE
 * @compliance CLAUDE.md Enterprise Standards - MODULAR SPLITTING
 * 🌐 i18n: All labels converted to i18n keys - 2026-01-18
 */

// ====================================================================
// STATUS LABELS - 🏢 ENTERPRISE CENTRALIZED
// 🌐 i18n: Uses keys from various namespaces (projects, units, common, etc.)
// ====================================================================

/**
 * Centralized project status labels
 * 🌐 i18n: Uses keys from projects.json namespace
 */
export const MODAL_SELECT_PROJECT_STATUS_LABELS = {
  planning: 'projects.status.planning',
  in_progress: 'projects.status.inProgress',
  completed: 'projects.status.completed',
  on_hold: 'projects.status.onHold',
  cancelled: 'projects.status.cancelled',
  review: 'projects.status.review',
  approved: 'projects.status.approved'
} as const;

/**
 * Centralized unit availability status labels
 * 🌐 i18n: Uses keys from units.json namespace
 */
export const MODAL_SELECT_UNIT_STATUS_LABELS = {
  available: 'units.status.available',
  occupied: 'units.status.occupied',
  maintenance: 'units.status.maintenance',
  for_sale: 'units.status.forSale',
  for_rent: 'units.status.forRent',
  sold: 'units.status.sold',
  rented: 'units.status.rented',
  under_construction: 'units.status.underConstruction',
  planned: 'units.status.planned'
} as const;

/**
 * Centralized contact status labels
 * 🌐 i18n: Uses keys from contacts.json namespace
 */
export const MODAL_SELECT_CONTACT_STATUS_LABELS = {
  active: 'contacts.status.active',
  inactive: 'contacts.status.inactive',
  pending: 'contacts.status.pending',
  blocked: 'contacts.status.blocked',
  archived: 'contacts.status.archived'
} as const;

/**
 * Centralized contact type labels
 * 🌐 i18n: Uses keys from contacts.json namespace
 */
export const MODAL_SELECT_CONTACT_TYPE_LABELS = {
  individual: 'contacts.types.individual',
  company: 'contacts.types.company',
  service: 'contacts.types.service'
} as const;

/**
 * Centralized property market status labels
 * 🌐 i18n: Uses keys from properties.json namespace
 */
export const MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS = {
  available: 'properties.status.available',
  reserved: 'properties.status.reserved',
  sold: 'properties.status.sold',
  pending: 'properties.status.pending',
  withdrawn: 'properties.status.withdrawn',
  expired: 'properties.status.expired',
  // 🏢 ENTERPRISE: Added for UNIT_SALE_STATUS_LABELS centralization
  not_sold: 'properties.status.notSold'
} as const;

/**
 * Centralized rental type labels
 * 🌐 i18n: Uses keys from properties.json namespace
 */
export const MODAL_SELECT_RENTAL_TYPE_LABELS = {
  rent_only: 'properties.rental.rentOnly',
  long_term: 'properties.rental.longTerm',
  short_term: 'properties.rental.shortTerm'
} as const;

/**
 * Centralized property special status labels
 * 🌐 i18n: Uses keys from properties.json namespace
 */
export const MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS = {
  reserved_pending: 'properties.specialStatus.reservedPending',
  contract_signed: 'properties.specialStatus.contractSigned',
  deposit_paid: 'properties.specialStatus.depositPaid',
  corporate: 'properties.specialStatus.corporate',
  not_for_sale: 'properties.specialStatus.notForSale',
  family: 'properties.specialStatus.family',
  pre_launch: 'properties.specialStatus.preLaunch',
  exclusive: 'properties.specialStatus.exclusive',
  reduced_price: 'properties.specialStatus.reducedPrice',
  urgent_sale: 'properties.specialStatus.urgentSale',
  under_renovation: 'properties.specialStatus.underRenovation',
  legal_issues: 'properties.specialStatus.legalIssues',
  inspection_required: 'properties.specialStatus.inspectionRequired',
  pending_documents: 'properties.specialStatus.pendingDocuments',
  for_sale: 'properties.status.forSale',
  for_rent: 'properties.status.forRent',
  rented: 'properties.status.rented',
  under_negotiation: 'properties.specialStatus.underNegotiation',
  available_soon: 'properties.specialStatus.availableSoon',
  landowner: 'properties.specialStatus.landowner',
  off_market: 'properties.specialStatus.offMarket',
  unavailable: 'properties.specialStatus.unavailable',
  // 🏢 ENTERPRISE: Added missing labels για property-hover/constants.ts complete coverage
  sold: 'properties.status.sold',
  reserved: 'properties.status.reserved',
  unknown: 'common.status.unknown'
} as const;

/**
 * Centralized storage unit status labels
 * 🌐 i18n: Uses keys from storage.json namespace
 */
export const MODAL_SELECT_STORAGE_STATUS_LABELS = {
  available: 'storage.general.status.available',
  occupied: 'storage.general.status.occupied',
  sold: 'storage.general.status.sold',
  maintenance: 'storage.general.status.maintenance',
  reserved: 'storage.general.status.reserved'
} as const;

/**
 * Centralized priority/alert level labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const MODAL_SELECT_PRIORITY_LABELS = {
  none: 'common.priority.none',
  empty: 'common.priority.empty',
  warning: 'common.priority.warning',
  attention: 'common.priority.attention',
  success: 'common.priority.success',
  info: 'common.priority.info'
} as const;

/**
 * Centralized record state labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const MODAL_SELECT_RECORD_STATE_LABELS = {
  new: 'common.recordState.new',
  updated: 'common.recordState.updated',
  deleted: 'common.recordState.deleted'
} as const;

/**
 * Centralized entity type labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const MODAL_SELECT_ENTITY_TYPE_LABELS = {
  company: 'common.entityType.company',
  main: 'common.entityType.main',
  secondary: 'common.entityType.secondary'
} as const;

/**
 * Centralized document status labels
 * 🌐 i18n: Uses keys from common.json namespace
 */
export const MODAL_SELECT_DOCUMENT_STATUS_LABELS = {
  draft: 'common.documentStatus.draft',
  completed: 'common.documentStatus.completed',
  approved: 'common.documentStatus.approved'
} as const;

/**
 * Centralized property type labels
 * 🌐 i18n: Uses keys from building.json namespace
 */
export const MODAL_SELECT_PROPERTY_TYPE_LABELS = {
  studio: 'building.propertyTypes.studio',
  garsoniera: 'building.propertyTypes.garsoniera',
  apartment: 'building.propertyTypes.apartment',
  maisonette: 'building.propertyTypes.maisonette'
} as const;

// ====================================================================
// ACCESSOR FUNCTIONS - 🏢 ENTERPRISE CENTRALIZED
// ====================================================================

/**
 * Get centralized project status labels
 */
export function getProjectStatusLabels() {
  return MODAL_SELECT_PROJECT_STATUS_LABELS;
}

/**
 * Get centralized unit status labels
 */
export function getUnitStatusLabels() {
  return MODAL_SELECT_UNIT_STATUS_LABELS;
}

/**
 * Get centralized contact status labels
 */
export function getContactStatusLabels() {
  return MODAL_SELECT_CONTACT_STATUS_LABELS;
}

/**
 * Get centralized contact type labels
 */
export function getContactTypeLabels() {
  return MODAL_SELECT_CONTACT_TYPE_LABELS;
}

/**
 * Get centralized property market status labels
 */
export function getPropertyMarketStatusLabels() {
  return MODAL_SELECT_PROPERTY_MARKET_STATUS_LABELS;
}

/**
 * Get centralized rental type labels
 */
export function getRentalTypeLabels() {
  return MODAL_SELECT_RENTAL_TYPE_LABELS;
}

/**
 * Get centralized property special status labels
 */
export function getPropertySpecialStatusLabels() {
  return MODAL_SELECT_PROPERTY_SPECIAL_STATUS_LABELS;
}

/**
 * Get centralized storage status labels
 */
export function getStorageStatusLabels() {
  return MODAL_SELECT_STORAGE_STATUS_LABELS;
}

/**
 * Get centralized priority labels
 */
export function getPriorityLabels() {
  return MODAL_SELECT_PRIORITY_LABELS;
}

/**
 * Get centralized record state labels
 */
export function getRecordStateLabels() {
  return MODAL_SELECT_RECORD_STATE_LABELS;
}

/**
 * Get centralized entity type labels
 */
export function getEntityTypeLabels() {
  return MODAL_SELECT_ENTITY_TYPE_LABELS;
}

/**
 * Get centralized document status labels
 */
export function getDocumentStatusLabels() {
  return MODAL_SELECT_DOCUMENT_STATUS_LABELS;
}

/**
 * Get centralized property type labels
 */
export function getPropertyTypeLabels() {
  return MODAL_SELECT_PROPERTY_TYPE_LABELS;
}