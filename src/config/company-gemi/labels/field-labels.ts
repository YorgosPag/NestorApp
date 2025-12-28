/**
 * COMPANY GEMI FIELD LABELS
 *
 * Κεντρικοποιημένα labels για όλα τα company GEMI fields
 * Uses established centralized label system από modal-select
 *
 * @version 1.0.0 - ENTERPRISE LABELS
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

// ENTERPRISE: Import από centralized modal-select system
import { MODAL_SELECT_COMPANY_FIELD_LABELS } from '../../../subapps/dxf-viewer/config/modal-select/core/labels/fields';

// ============================================================================
// FIELD LABELS MAPPING
// ============================================================================

/**
 * Company field labels mapping
 * Uses centralized MODAL_SELECT_COMPANY_FIELD_LABELS για consistency
 */
export const COMPANY_FIELD_LABELS = MODAL_SELECT_COMPANY_FIELD_LABELS;

/**
 * Convenient field labels object με clean API
 * Enterprise pattern: Expose commonly used labels με descriptive names
 */
export const fieldLabels = {
  // Basic Info
  companyName: COMPANY_FIELD_LABELS.company_name,
  tradeName: COMPANY_FIELD_LABELS.trade_name,
  vatNumber: COMPANY_FIELD_LABELS.vat_number,
  gemiNumber: COMPANY_FIELD_LABELS.gemi_number,
  legalForm: COMPANY_FIELD_LABELS.legal_form,
  gemiStatus: COMPANY_FIELD_LABELS.gemi_status,

  // Activities
  activityCode: COMPANY_FIELD_LABELS.activity_code,
  activityDescription: COMPANY_FIELD_LABELS.activity_description,
  activityType: COMPANY_FIELD_LABELS.activity_type,
  chamber: COMPANY_FIELD_LABELS.chamber,

  // Capital
  capitalAmount: COMPANY_FIELD_LABELS.capital_amount,
  currency: COMPANY_FIELD_LABELS.currency,
  extraordinaryCapital: COMPANY_FIELD_LABELS.extraordinary_capital,

  // Dates & Location
  registrationDate: COMPANY_FIELD_LABELS.registration_date,
  statusDate: COMPANY_FIELD_LABELS.status_date,
  prefecture: COMPANY_FIELD_LABELS.prefecture,
  municipality: COMPANY_FIELD_LABELS.municipality,
  gemiDepartment: COMPANY_FIELD_LABELS.gemi_department,

  // Addresses
  addressType: COMPANY_FIELD_LABELS.address_type,
  street: COMPANY_FIELD_LABELS.street,
  streetNumber: COMPANY_FIELD_LABELS.street_number,
  postalCode: COMPANY_FIELD_LABELS.postal_code,
  city: COMPANY_FIELD_LABELS.city,
  region: COMPANY_FIELD_LABELS.region,

  // Shareholders
  shareholderType: COMPANY_FIELD_LABELS.shareholder_type,
  shareholderId: COMPANY_FIELD_LABELS.shareholder_id,
  shareType: COMPANY_FIELD_LABELS.share_type,
  sharePercentage: COMPANY_FIELD_LABELS.share_percentage,
  nominalValue: COMPANY_FIELD_LABELS.nominal_value,

  // Documents
  documentType: COMPANY_FIELD_LABELS.document_type,
  documentDate: COMPANY_FIELD_LABELS.document_date,
  documentSubject: COMPANY_FIELD_LABELS.document_subject,

  // Decisions
  decisionDate: COMPANY_FIELD_LABELS.decision_date,
  decisionSubject: COMPANY_FIELD_LABELS.decision_subject,
  protocolNumber: COMPANY_FIELD_LABELS.protocol_number,
  decisionSummary: COMPANY_FIELD_LABELS.decision_summary,

  // History
  versionDate: COMPANY_FIELD_LABELS.version_date,
  changeDescription: COMPANY_FIELD_LABELS.change_description,
  previousValue: COMPANY_FIELD_LABELS.previous_value,
  newValue: COMPANY_FIELD_LABELS.new_value,

  // Representatives
  representativeName: COMPANY_FIELD_LABELS.representative_name,
  representativeRole: COMPANY_FIELD_LABELS.representative_role,
  representativeTax: COMPANY_FIELD_LABELS.representative_tax,
  representativeDoy: COMPANY_FIELD_LABELS.representative_doy,
  representativePhone: COMPANY_FIELD_LABELS.representative_phone,

  // Announcements
  announcementDate: COMPANY_FIELD_LABELS.announcement_date,
  issuePaper: COMPANY_FIELD_LABELS.issue_paper,
  announcementSubject: COMPANY_FIELD_LABELS.announcement_subject,
  announcementSummary: COMPANY_FIELD_LABELS.announcement_summary,
  announcementFile: COMPANY_FIELD_LABELS.announcement_file,

  // Statuses
  currentStatus: COMPANY_FIELD_LABELS.current_status,
  statusChangeDate: COMPANY_FIELD_LABELS.status_change_date,
  statusReason: COMPANY_FIELD_LABELS.status_reason,
  previousStatus: COMPANY_FIELD_LABELS.previous_status,

  // Relationships
  relationshipsSummary: COMPANY_FIELD_LABELS.relationships_summary,
} as const;