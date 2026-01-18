/**
 * COMPANY GEMI HELP TEXTS (i18n Keys)
 *
 * Κεντρικοποιημένα help text i18n keys για όλα τα company GEMI fields
 * Uses established centralized i18n system
 *
 * @version 2.0.0 - ENTERPRISE i18n ARCHITECTURE
 * @updated 2025-01-18 - ENTERPRISE i18n MIGRATION
 * @compliance CLAUDE.md Enterprise Standards - SAP/Salesforce Pattern
 *
 * 🏢 ENTERPRISE i18n PATTERN:
 * - All values are i18n keys (not hardcoded strings)
 * - Keys correspond to forms.json namespace (helpTexts section)
 * - Use useFormLabels().getHelpText(key) to translate
 * - Follows SAP, Salesforce, Microsoft Dynamics i18n patterns
 */

// ============================================================================
// HELP TEXTS MAPPING (i18n Keys)
// ============================================================================

/**
 * Company field help texts mapping (i18n Keys)
 * Maps field keys to i18n translation keys
 * ✅ ENTERPRISE: Use useFormLabels().getHelpText(key) to translate
 *
 * @example
 * ```tsx
 * const { getHelpText } = useFormLabels();
 * const help = getHelpText('companyName'); // Returns translated string
 * ```
 */
export const gemiHelps = {
  // Basic Info Help Texts - i18n keys
  company_name_help: 'helpTexts.companyName',
  trade_name_help: 'helpTexts.tradeName',
  vat_number_help: 'helpTexts.vatNumber',
  gemi_number_help: 'helpTexts.gemiNumber',
  legal_form_help: 'helpTexts.legalForm',
  company_status_help: 'helpTexts.gemiStatus',

  // Activities Help Texts - i18n keys
  kad_code_help: 'helpTexts.activityCode',
  business_description_help: 'helpTexts.activityDescription',
  activity_category_help: 'helpTexts.activityType',
  chamber_office_help: 'helpTexts.chamber',

  // Capital Help Texts - i18n keys
  capital_amount_help: 'helpTexts.capitalAmount',
  currency_help: 'helpTexts.currency',
  guarantee_capital_help: 'helpTexts.extraordinaryCapital',

  // Dates & Location Help Texts - i18n keys
  registration_date_help: 'helpTexts.registrationDate',
  last_change_date_help: 'helpTexts.statusDate',
  region_help: 'helpTexts.prefecture',
  municipality_help: 'helpTexts.municipality',
  local_office_help: 'helpTexts.gemiDepartment',

  // Address Help Texts - i18n keys
  address_type_help: 'helpTexts.addressType',
  street_help: 'helpTexts.street',
  street_number_help: 'helpTexts.streetNumber',
  postal_code_help: 'helpTexts.postalCode',
  city_help: 'helpTexts.city',
  region_address_help: 'helpTexts.region',

  // Shareholders Help Texts - i18n keys
  shareholder_name_help: 'helpTexts.shareholderType',
  shareholder_type_help: 'helpTexts.shareholderType',
  shareholder_id_help: 'helpTexts.shareholderId',
  share_category_help: 'helpTexts.shareType',
  participation_percentage_help: 'helpTexts.sharePercentage',
  nominal_value_help: 'helpTexts.nominalValue',

  // Documents Help Texts - i18n keys
  document_category_help: 'helpTexts.documentType',
  document_date_help: 'helpTexts.documentDate',
  document_subject_help: 'helpTexts.documentSubject',

  // Decisions Help Texts - i18n keys
  decision_date_help: 'helpTexts.decisionDate',
  decision_subject_help: 'helpTexts.decisionSubject',
  protocol_number_help: 'helpTexts.protocolNumber',

  // Representatives Help Texts - i18n keys
  representative_name_help: 'helpTexts.representativeName',
  representative_role_help: 'helpTexts.representativeRole',
  representative_tax_help: 'helpTexts.representativeTax',
  representative_doy_help: 'helpTexts.representativeDoy',
  representative_email_help: 'helpTexts.representativeName',
  representative_phone_help: 'helpTexts.representativeName',

  // History Help Texts - i18n keys
  version_date_help: 'helpTexts.versionDate',
  change_description_help: 'helpTexts.changeDescription',
  previous_value_help: 'helpTexts.previousValue',
  new_value_help: 'helpTexts.newValue',

  // Announcements Help Texts - i18n keys
  announcement_date_help: 'helpTexts.announcementDate',
  issue_paper_help: 'helpTexts.issuePaper',
  announcement_subject_help: 'helpTexts.announcementSubject',
  announcement_summary_help: 'helpTexts.announcementSummary',
  announcement_file_help: 'helpTexts.announcementFile',

  // Statuses Help Texts - i18n keys
  current_status_help: 'helpTexts.currentStatus',
  status_change_date_help: 'helpTexts.statusChangeDate',
  status_reason_help: 'helpTexts.statusReason',
  previous_status_help: 'helpTexts.previousStatus',

  // Relationships Help Texts - i18n keys
  relationships_summary_help: 'helpTexts.relationshipsSummary',

  // Additional Fields Help Texts - i18n keys
  document_url_help: 'helpTexts.documentType',
  decision_summary_help: 'helpTexts.decisionSubject',
  organ_type_help: 'helpTexts.decisionSubject',
} as const;

/**
 * Type-safe help text accessor
 * Enterprise pattern: Type-safe access σε help texts
 */
export type GemiHelpTextKey = keyof typeof gemiHelps;