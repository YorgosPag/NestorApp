/**
 * COMPANY GEMI FIELDS CONFIGURATION
 *
 * Single Source of Truth για όλα τα πεδία ΓΕΜΗ εταιρειών
 * Χρησιμοποιείται από:
 * - CompanyContactSection.tsx (Form creation/editing)
 * - ContactDetails.tsx (Display tabs)
 * - Future generic form/display components
 *
 * @version 2.0.0 - CENTRALIZED LABELS
 * @updated 2025-12-27 - ENTERPRISE: Using centralized label system
 */

import { MODAL_SELECT_COMPANY_FIELD_LABELS } from '../subapps/dxf-viewer/config/modal-select/core/labels/fields';
import { MODAL_SELECT_COMPANY_HELP_TEXTS } from '../subapps/dxf-viewer/config/modal-select/core/options/company';
import {
  getLegalFormOptions,
  getGemiStatusOptions,
  getCurrencyOptions,
  getActivityTypeOptions,
  getAddressTypeOptions,
  getShareholderTypeOptions,
  getDocumentTypeOptions,
  getBoardTypeOptions,
  getRepresentativePositionOptions,
  MODAL_SELECT_GEMI_STATUSES
} from '../subapps/dxf-viewer/config/modal-select';

const companyLabels = MODAL_SELECT_COMPANY_FIELD_LABELS;
const gemiHelps = {
  company_name_help: MODAL_SELECT_COMPANY_HELP_TEXTS.BUSINESS_NAME,
  trade_name_help: MODAL_SELECT_COMPANY_HELP_TEXTS.TRADE_NAME,
  vat_number_help: MODAL_SELECT_COMPANY_HELP_TEXTS.AFM,
  gemi_number_help: MODAL_SELECT_COMPANY_HELP_TEXTS.GEMI_NUMBER,
  legal_form_help: MODAL_SELECT_COMPANY_HELP_TEXTS.LEGAL_FORM,
  company_status_help: 'Κατάσταση εταιρείας στο ΓΕΜΗ',
  kad_code_help: MODAL_SELECT_COMPANY_HELP_TEXTS.ACTIVITY_CODE,
  business_description_help: 'Περιγραφή επιχειρηματικής δραστηριότητας',
  activity_category_help: 'Κατηγορία δραστηριότητας',
  chamber_office_help: 'Επιμελητήριο εγγραφής',
  capital_amount_help: MODAL_SELECT_COMPANY_HELP_TEXTS.CAPITAL,
  currency_help: 'Νόμισμα κεφαλαίου',
  guarantee_capital_help: 'Εγγυημένα κεφάλαια',
  registration_date_help: 'Ημερομηνία εγγραφής στο ΓΕΜΗ',
  last_change_date_help: 'Ημερομηνία τελευταίας μεταβολής',
  region_help: 'Περιφέρεια έδρας',
  municipality_help: 'Δήμος έδρας',
  local_office_help: 'Τοπική υπηρεσία ΓΕΜΗ',
  address_type_help: 'Τύπος διεύθυνσης',
  street_number_help: 'Αριθμός οδού',
  postal_code_help: 'Ταχυδρομικός κώδικας',
  city_help: 'Πόλη έδρας',
  region_address_help: 'Περιφέρεια διεύθυνσης',
  shareholder_name_help: 'Επωνυμία μετόχου',
  shareholder_type_help: 'Τύπος μετόχου',
  shareholder_id_help: 'Αριθμός ταυτότητας μετόχου',
  share_category_help: 'Κατηγορία μετοχών',
  participation_percentage_help: 'Ποσοστό συμμετοχής στο κεφάλαιο',
  nominal_value_help: 'Ονομαστική αξία μετοχής',
  document_category_help: 'Κατηγορία εγγράφου',
  document_date_help: 'Ημερομηνία έκδοσης εγγράφου',
  document_subject_help: 'Θέμα εγγράφου',
  decision_date_help: 'Ημερομηνία λήψης απόφασης',
  decision_subject_help: 'Θέμα απόφασης',
  protocol_number_help: 'Αριθμός πρωτοκόλλου απόφασης'
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type FieldType = 'input' | 'select' | 'textarea' | 'date' | 'number' | 'email' | 'tel';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  /** Unique field identifier (matches ContactFormData property) */
  id: string;
  /** Display label */
  label: string;
  /** Field type */
  type: FieldType;
  /** Required field */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum length for input fields */
  maxLength?: number;
  /** Select options (only for type='select') */
  options?: SelectOption[];
  /** Default value */
  defaultValue?: string;
  /** Help text or description */
  helpText?: string;
  /** CSS class names for styling */
  className?: string;
}

export interface SectionConfig {
  /** Section unique identifier */
  id: string;
  /** Section display title */
  title: string;
  /** Section emoji icon */
  icon: string;
  /** Section description */
  description?: string;
  /** Fields in this section */
  fields: FieldConfig[];
  /** Section order priority */
  order: number;
}

// ============================================================================
// FIELD OPTIONS CONFIGURATIONS
// ============================================================================

/**
 * ENTERPRISE BUSINESS RULES INTEGRATION
 *
 * Database-driven legal forms and company statuses using EnterpriseBusinessRulesService.
 * Replaces hardcoded values with dynamic configuration.
 *
 * @enterprise-migration true
 * @version 2.0.0
 */

import { businessRulesService } from '../services/business/EnterpriseBusinessRulesService';

/** @deprecated Use EnterpriseBusinessRulesService.getLegalFormsForSelect() instead */

const getDefaultLegalForms = (): SelectOption[] => {
    const centralizedForms = getLegalFormOptions();

  // Convert to match local interface (value case conversion if needed)
  return centralizedForms.map(form => ({
    value: form.value.toUpperCase(), // Convert to uppercase for compatibility
    label: form.label
  }));
};

/**
 * @deprecated Hardcoded legal forms - Use EnterpriseBusinessRulesService instead
 *
 * MIGRATION PATH:
 * Before: LEGAL_FORM_OPTIONS
 * After: await businessRulesService.getLegalFormsForSelect(tenantId, jurisdiction, environment)
 *
 * This fallback will be removed in v3.0.0
 */
export const LEGAL_FORM_OPTIONS: SelectOption[] = (() => {
  try {
    // Try to load from environment variable
    const envLegalForms = process.env.NEXT_PUBLIC_LEGAL_FORMS_JSON;
    if (envLegalForms) {
      return JSON.parse(envLegalForms);
    }
  } catch (error) {
    console.warn('Failed to parse NEXT_PUBLIC_LEGAL_FORMS_JSON, using defaults');
  }
  return getDefaultLegalForms();
})();

/**
 * @deprecated Hardcoded company statuses - Use EnterpriseBusinessRulesService instead
 *
 * MIGRATION PATH:
 * Before: GEMI_STATUS_OPTIONS
 * After: await businessRulesService.getCompanyStatusesForSelect(tenantId, jurisdiction, environment)
 *
 * This fallback will be removed in v3.0.0
 */
export const GEMI_STATUS_OPTIONS: SelectOption[] =
    getGemiStatusOptions().map(status => ({
    value: status.value,
    label: status.label
  }));

/**
 * Enterprise legal forms loader function
 *
 * @example
 * ```typescript
 * const legalForms = await loadLegalForms('my-tenant', 'GR');
 * ```
 */
export async function loadLegalForms(
  tenantId: string = 'default',
  jurisdiction: string = 'GR',
  environment: string = 'production'
): Promise<SelectOption[]> {
  try {
    // Try to load from enterprise service
    return await businessRulesService.getLegalFormsForSelect(
      tenantId,
      jurisdiction,
      environment
    );
  } catch (error) {
    console.warn('Failed to load legal forms from service, using fallback:', error);

    // Fallback to hardcoded values
    return LEGAL_FORM_OPTIONS;
  }
}

/**
 * Enterprise company statuses loader function
 *
 * @example
 * ```typescript
 * const statuses = await loadCompanyStatuses('my-tenant', 'GR');
 * ```
 */
export async function loadCompanyStatuses(
  tenantId: string = 'default',
  jurisdiction: string = 'GR',
  environment: string = 'production'
): Promise<SelectOption[]> {
  try {
    // Try to load from enterprise service
    return await businessRulesService.getCompanyStatusesForSelect(
      tenantId,
      jurisdiction,
      environment
    );
  } catch (error) {
    console.warn('Failed to load company statuses from service, using fallback:', error);

    // Fallback to hardcoded values
    return GEMI_STATUS_OPTIONS;
  }
}

/**
 * Get enterprise legal forms with business rules validation
 *
 * @param options Configuration options
 * @returns Promise resolving to legal forms array with validation support
 */
export async function getEnterpriseLegalForms(options: {
  tenantId?: string;
  jurisdiction?: string;
  environment?: string;
  includeRequirements?: boolean;
} = {}): Promise<Array<SelectOption & {
  description?: string;
  minCapital?: { amount: number; currency: string };
  requirements?: string[];
}>> {
  const {
    tenantId = 'default',
    jurisdiction = 'GR',
    environment = 'production',
    includeRequirements = false
  } = options;

  try {
    if (includeRequirements) {
      // Get full legal forms with requirements
      const legalForms = await businessRulesService.getLegalForms(
        tenantId,
        jurisdiction,
        environment
      );

      return legalForms.map(lf => ({
        value: lf.value,
        label: lf.label,
        description: lf.description,
        minCapital: lf.minCapital,
        requirements: lf.requirements
      }));
    } else {
      // Get simple select options
      return await businessRulesService.getLegalFormsForSelect(
        tenantId,
        jurisdiction,
        environment
      );
    }
  } catch (error) {
    console.warn('Failed to load enterprise legal forms, using fallback:', error);

    // Enhanced fallback
    return LEGAL_FORM_OPTIONS.map(option => ({
      ...option,
      description: `Legal form: ${option.label}`
    }));
  }
}

/**
 * Get enterprise company statuses with workflow support
 *
 * @param options Configuration options
 * @returns Promise resolving to company statuses array with transition rules
 */
export async function getEnterpriseCompanyStatuses(options: {
  tenantId?: string;
  jurisdiction?: string;
  environment?: string;
  includeTransitions?: boolean;
} = {}): Promise<Array<SelectOption & {
  category?: string;
  businessImpact?: string;
  allowedTransitions?: string[];
}>> {
  const {
    tenantId = 'default',
    jurisdiction = 'GR',
    environment = 'production',
    includeTransitions = false
  } = options;

  try {
    if (includeTransitions) {
      // Get full status configurations with transitions
      const statuses = await businessRulesService.getCompanyStatuses(
        tenantId,
        jurisdiction,
        environment
      );

      return statuses.map(cs => ({
        value: cs.value,
        label: cs.label,
        category: cs.category,
        businessImpact: cs.businessImpact,
        allowedTransitions: cs.allowedTransitions
      }));
    } else {
      // Get simple select options
      return await businessRulesService.getCompanyStatusesForSelect(
        tenantId,
        jurisdiction,
        environment
      );
    }
  } catch (error) {
    console.warn('Failed to load enterprise company statuses, using fallback:', error);

    // Enhanced fallback
    return GEMI_STATUS_OPTIONS.map(option => ({
      ...option,
      category: 'operational'
    }));
  }
}

/** Τύπος δραστηριότητας */
export const ACTIVITY_TYPE_OPTIONS: SelectOption[] = [
    ...getActivityTypeOptions(),
];

/** ENTERPRISE: Configurable currencies for different regions */
const getDefaultCurrencies = (): SelectOption[] =>
    getCurrencyOptions().map(currency => ({
    value: currency.value,
    label: currency.label
  }));

/** Νόμισμα με environment configuration */
export const CURRENCY_OPTIONS: SelectOption[] = (() => {
  try {
    // Try to load from environment variable
    const envCurrencies = process.env.NEXT_PUBLIC_CURRENCIES_JSON;
    if (envCurrencies) {
      return JSON.parse(envCurrencies);
    }

    // Or use primary currency from environment
    const primaryCurrency = process.env.NEXT_PUBLIC_PRIMARY_CURRENCY;
    if (primaryCurrency) {
      const defaults = getDefaultCurrencies();
      const primary = defaults.find(c => c.value === primaryCurrency);
      if (primary) {
        return [primary, ...defaults.filter(c => c.value !== primaryCurrency)];
      }
    }
  } catch (error) {
    console.warn('Failed to parse currency configuration, using defaults');
  }
  return getDefaultCurrencies();
})();

// ============================================================================
// COMPANY GEMI SECTIONS CONFIGURATION
// ============================================================================

export const COMPANY_GEMI_SECTIONS: SectionConfig[] = [
  // -------------------------------------------------------------------------
  // 1. ΒΑΣΙΚΑ ΣΤΟΙΧΕΙΑ ΓΕΜΗ
  // -------------------------------------------------------------------------
  {
    id: 'basicInfo',
    title: 'Βασικά Στοιχεία ΓΕΜΗ',
    icon: 'info',
    description: 'Βασικές πληροφορίες εταιρείας από το ΓΕΜΗ',
    order: 1,
    fields: [
      {
        id: 'companyName',
        label: companyLabels.company_name,
        type: 'input',
        required: true,
        helpText: gemiHelps.company_name_help,
      },
      {
        id: 'tradeName',
        label: companyLabels.trade_name,
        type: 'input',
        helpText: gemiHelps.trade_name_help,
      },
      {
        id: 'vatNumber', // FIX: Changed from 'companyVatNumber' to 'vatNumber' to match Contact interface
        label: companyLabels.vat_number,
        type: 'input',
        required: true,
        maxLength: 9,
        placeholder: '999999999',
        helpText: gemiHelps.vat_number_help,
      },
      {
        id: 'gemiNumber',
        label: companyLabels.gemi_number,
        type: 'input',
        helpText: gemiHelps.gemi_number_help,
      },
      {
        id: 'legalForm',
        label: companyLabels.legal_form,
        type: 'select',
        options: LEGAL_FORM_OPTIONS,
        helpText: gemiHelps.legal_form_help,
      },
      {
        id: 'gemiStatus',
        label: companyLabels.gemi_status,
        type: 'select',
        options: GEMI_STATUS_OPTIONS,
        defaultValue: 'active',
        helpText: gemiHelps.company_status_help,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2. ΔΡΑΣΤΗΡΙΟΤΗΤΕΣ & ΚΑΔ
  // -------------------------------------------------------------------------
  {
    id: 'activities',
    title: 'Δραστηριότητες & ΚΑΔ',
    icon: 'file-text',
    description: 'Κωδικοί και περιγραφές επιχειρηματικής δραστηριότητας',
    order: 2,
    fields: [
      {
        id: 'activityCodeKAD',
        label: companyLabels.activity_code,
        type: 'input',
        placeholder: 'π.χ. 47.11.10',
        helpText: gemiHelps.kad_code_help,
      },
      {
        id: 'activityDescription',
        label: companyLabels.activity_description,
        type: 'input',
        helpText: gemiHelps.business_description_help,
      },
      {
        id: 'activityType',
        label: companyLabels.activity_type,
        type: 'select',
        options: ACTIVITY_TYPE_OPTIONS,
        defaultValue: 'main',
        helpText: gemiHelps.activity_category_help,
      },
      {
        id: 'chamber',
        label: companyLabels.chamber,
        type: 'input',
        helpText: gemiHelps.chamber_office_help,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3. ΚΕΦΑΛΑΙΟ & ΟΙΚΟΝΟΜΙΚΑ
  // -------------------------------------------------------------------------
  {
    id: 'capital',
    title: 'Κεφάλαιο & Οικονομικά',
    icon: 'dollar-sign',
    description: 'Κεφάλαιο και οικονομικά στοιχεία εταιρείας',
    order: 3,
    fields: [
      {
        id: 'capitalAmount',
        label: companyLabels.capital_amount,
        type: 'number',
        placeholder: 'π.χ. 50000',
        helpText: gemiHelps.capital_amount_help,
      },
      {
        id: 'currency',
        label: companyLabels.currency,
        type: 'select',
        options: CURRENCY_OPTIONS,
        defaultValue: 'EUR',
        helpText: gemiHelps.currency_help,
      },
      {
        id: 'extraordinaryCapital',
        label: companyLabels.extraordinary_capital,
        type: 'number',
        helpText: gemiHelps.guarantee_capital_help,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4. ΗΜΕΡΟΜΗΝΙΕΣ & ΤΟΠΟΘΕΣΙΑ
  // -------------------------------------------------------------------------
  {
    id: 'datesLocation',
    title: 'Ημερομηνίες & Τοποθεσία',
    icon: 'calendar',
    description: 'Χρονολογικά και γεωγραφικά στοιχεία',
    order: 4,
    fields: [
      {
        id: 'registrationDate',
        label: companyLabels.registration_date,
        type: 'date',
        helpText: gemiHelps.registration_date_help,
      },
      {
        id: 'gemiStatusDate',
        label: companyLabels.status_date,
        type: 'date',
        helpText: gemiHelps.last_change_date_help,
      },
      {
        id: 'prefecture',
        label: companyLabels.prefecture,
        type: 'input',
        helpText: gemiHelps.region_help,
      },
      {
        id: 'municipality',
        label: companyLabels.municipality,
        type: 'input',
        helpText: gemiHelps.municipality_help,
      },
      {
        id: 'gemiDepartment',
        label: companyLabels.gemi_department,
        type: 'input',
        helpText: gemiHelps.local_office_help,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5. ΔΙΕΥΘΥΝΣΕΙΣ & ΥΠΟΚΑΤΑΣΤΗΜΑΤΑ
  // -------------------------------------------------------------------------
  {
    id: 'addresses',
    title: 'Διευθύνσεις & Υποκαταστήματα',
    icon: 'map-pin',
    description: 'Έδρα και υποκαταστήματα εταιρείας',
    order: 5,
    fields: [
      {
        id: 'addressType',
        label: companyLabels.address_type,
        type: 'select',
        options: [
          ...getAddressTypeOptions()
        ],
        helpText: gemiHelps.address_type_help,
      },
      {
        id: 'street',
        label: companyLabels.street,
        type: 'input',
        helpText: 'Όνομα οδού',
      },
      {
        id: 'streetNumber',
        label: companyLabels.street_number,
        type: 'input',
        helpText: gemiHelps.street_number_help,
      },
      {
        id: 'postalCode',
        label: companyLabels.postal_code,
        type: 'input',
        maxLength: 5,
        helpText: gemiHelps.postal_code_help,
      },
      {
        id: 'city',
        label: companyLabels.city,
        type: 'input',
        helpText: gemiHelps.city_help,
      },
      {
        id: 'region',
        label: companyLabels.region,
        type: 'input',
        helpText: gemiHelps.region_address_help,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 6. ΜΕΤΟΧΙΚΗ ΣΥΝΘΕΣΗ & ΕΤΑΙΡΟΙ
  // -------------------------------------------------------------------------
  {
    id: 'shareholders',
    title: 'Μετοχική Σύνθεση & Εταίροι',
    icon: 'users',
    description: 'Μέτοχοι και εταιρική σύνθεση',
    order: 6,
    fields: [
      {
        id: 'shareholderName',
        label: 'Όνομα Μετόχου',
        type: 'input',
        helpText: gemiHelps.shareholder_name_help,
      },
      {
        id: 'shareholderType',
        label: companyLabels.shareholder_type,
        type: 'select',
        options: [
          ...getShareholderTypeOptions()
        ],
        helpText: gemiHelps.shareholder_type_help,
      },
      {
        id: 'shareholderIdNumber',
        label: companyLabels.shareholder_id,
        type: 'input',
        helpText: gemiHelps.shareholder_id_help,
      },
      {
        id: 'shareType',
        label: companyLabels.share_type,
        type: 'input',
        helpText: gemiHelps.share_category_help,
      },
      {
        id: 'sharePercentage',
        label: companyLabels.share_percentage,
        type: 'number',
        helpText: gemiHelps.participation_percentage_help,
      },
      {
        id: 'nominalValue',
        label: companyLabels.nominal_value,
        type: 'number',
        helpText: gemiHelps.nominal_value_help,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 7. ΕΓΓΡΑΦΑ & ΠΙΣΤΟΠΟΙΗΤΙΚΑ
  // -------------------------------------------------------------------------
  {
    id: 'documents',
    title: 'Έγγραφα & Πιστοποιητικά',
    icon: 'file-text',
    description: 'Έγγραφα ΓΕΜΗ, ανακοινώσεις και πιστοποιητικά',
    order: 7,
    fields: [
      {
        id: 'documentType',
        label: companyLabels.document_type,
        type: 'select',
        options: [
          ...getDocumentTypeOptions()
        ],
        helpText: gemiHelps.document_category_help,
      },
      {
        id: 'documentDate',
        label: companyLabels.document_date,
        type: 'date',
        helpText: gemiHelps.document_date_help,
      },
      {
        id: 'documentSubject',
        label: companyLabels.document_subject,
        type: 'input',
        helpText: gemiHelps.document_subject_help,
      },
      {
        id: 'documentUrl',
        label: 'Link Εγγράφου',
        type: 'input',
        helpText: 'URL για download εγγράφου',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 8. ΑΠΟΦΑΣΕΙΣ ΟΡΓΑΝΩΝ
  // -------------------------------------------------------------------------
  {
    id: 'decisions',
    title: 'Αποφάσεις Οργάνων',
    icon: 'gavel',
    description: 'Αποφάσεις Γενικών Συνελεύσεων και Διοικητικών Συμβουλίων',
    order: 8,
    fields: [
      {
        id: 'decisionDate',
        label: companyLabels.decision_date,
        type: 'date',
        helpText: gemiHelps.decision_date_help,
      },
      {
        id: 'organType',
        label: 'Όργανο',
        type: 'select',
        options: [
          ...getBoardTypeOptions()
        ],
        helpText: 'Όργανο που έλαβε την απόφαση',
      },
      {
        id: 'decisionSubject',
        label: companyLabels.decision_subject,
        type: 'input',
        helpText: gemiHelps.decision_subject_help,
      },
      {
        id: 'protocolNumber',
        label: companyLabels.protocol_number,
        type: 'input',
        helpText: gemiHelps.protocol_number_help,
      },
      {
        id: 'decisionSummary',
        label: companyLabels.decision_summary,
        type: 'textarea',
        helpText: 'Σύντομη περίληψη απόφασης',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 9. ΙΣΤΟΡΙΚΟ & ΜΕΤΑΒΟΛΕΣ
  // -------------------------------------------------------------------------
  {
    id: 'companyVersions',
    title: 'Ιστορικό & Μεταβολές',
    icon: 'history',
    description: 'Ιστορικό εκδόσεων και μεταβολών εταιρείας',
    order: 9,
    fields: [
      {
        id: 'versionDate',
        label: companyLabels.version_date,
        type: 'date',
        helpText: 'Ημερομηνία καταχώρησης μεταβολής',
      },
      {
        id: 'changeDescription',
        label: companyLabels.change_description,
        type: 'input',
        helpText: 'Περιγραφή της μεταβολής (π.χ. αλλαγή επωνυμίας)',
      },
      {
        id: 'previousValue',
        label: companyLabels.previous_value,
        type: 'input',
        helpText: 'Προηγούμενη τιμή πεδίου (αν εφαρμόζεται)',
      },
      {
        id: 'newValue',
        label: companyLabels.new_value,
        type: 'input',
        helpText: 'Νέα τιμή μετά τη μεταβολή',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 10. ΕΚΠΡΟΣΩΠΟΙ & ΔΙΟΙΚΗΣΗ
  // -------------------------------------------------------------------------
  {
    id: 'representatives',
    title: 'Εκπρόσωποι & Διοίκηση',
    icon: 'user-check',
    description: 'Νόμιμοι εκπρόσωποι και διοικητικά στελέχη',
    order: 10,
    fields: [
      {
        id: 'representativeFullName',
        label: companyLabels.representative_name,
        type: 'input',
        helpText: 'Ονοματεπώνυμο εκπροσώπου',
      },
      {
        id: 'representativeRole',
        label: companyLabels.representative_role,
        type: 'select',
        options: [
          ...getRepresentativePositionOptions()
        ],
        helpText: 'Θέση ή ιδιότητα στην εταιρεία',
      },
      {
        id: 'representativeTaxNumber',
        label: companyLabels.representative_tax,
        type: 'input',
        maxLength: 9,
        helpText: 'Αριθμός Φορολογικού Μητρώου εκπροσώπου',
      },
      {
        id: 'representativeTaxOffice',
        label: companyLabels.representative_doy,
        type: 'input',
        helpText: 'Δημόσια Οικονομική Υπηρεσία',
      },
      {
        id: 'representativeEmail',
        label: 'Email',
        type: 'email',
        helpText: 'Email επικοινωνίας εκπροσώπου',
      },
      {
        id: 'representativePhone',
        label: companyLabels.representative_phone,
        type: 'tel',
        helpText: 'Τηλέφωνο επικοινωνίας εκπροσώπου',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 11. ΑΝΑΚΟΙΝΩΣΕΙΣ & ΔΗΜΟΣΙΕΥΣΕΙΣ
  // -------------------------------------------------------------------------
  {
    id: 'announcements',
    title: 'Ανακοινώσεις & Δημοσιεύσεις',
    icon: 'megaphone',
    description: 'Ανακοινώσεις εταιρείας και δημοσιεύσεις σε επίσημα φύλλα',
    order: 11,
    fields: [
      {
        id: 'announcementDate',
        label: companyLabels.announcement_date,
        type: 'date',
        helpText: 'Ημερομηνία δημοσίευσης ανακοίνωσης',
      },
      {
        id: 'issuePaper',
        label: companyLabels.issue_paper,
        type: 'input',
        helpText: 'Όνομα επίσημου φύλλου (π.χ. ΦΕΚ)',
      },
      {
        id: 'announcementSubject',
        label: companyLabels.announcement_subject,
        type: 'input',
        helpText: 'Περιγραφή θέματος ανακοίνωσης',
      },
      {
        id: 'announcementSummary',
        label: companyLabels.announcement_summary,
        type: 'textarea',
        helpText: 'Σύντομη περίληψη ανακοίνωσης',
      },
      {
        id: 'announcementFile',
        label: companyLabels.announcement_file,
        type: 'input',
        helpText: 'Link ή path αρχείου ανακοίνωσης',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 12. ΚΑΤΑΣΤΑΣΕΙΣ & LIFECYCLE
  // -------------------------------------------------------------------------
  {
    id: 'statuses',
    title: 'Καταστάσεις & Lifecycle',
    icon: 'activity',
    description: 'Ιστορικό καταστάσεων εταιρείας (ενεργή, διαγραφείσα κλπ)',
    order: 12,
    fields: [
      {
        id: 'currentStatus',
        label: companyLabels.current_status,
        type: 'select',
        options: MODAL_SELECT_GEMI_STATUSES.filter(status =>
          ['active', 'inactive', 'dissolved', 'bankruptcy', 'liquidation'].includes(status.value)
        ),
        helpText: 'Τρέχουσα κατάσταση εταιρείας',
      },
      {
        id: 'statusChangeDate',
        label: companyLabels.status_change_date,
        type: 'date',
        helpText: gemiHelps.last_change_date_help,
      },
      {
        id: 'statusReason',
        label: companyLabels.status_reason,
        type: 'input',
        helpText: 'Αιτιολογία αλλαγής κατάστασης',
      },
      {
        id: 'previousStatus',
        label: companyLabels.previous_status,
        type: 'input',
        helpText: 'Κατάσταση πριν την τελευταία αλλαγή',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 13. ΛΟΓΟΤΥΠΟ & ΦΩΤΟΓΡΑΦΙΕΣ ΕΤΑΙΡΕΙΑΣ
  // -------------------------------------------------------------------------
  {
    id: 'companyPhotos',
    title: 'Λογότυπο & Φωτογραφίες',
    icon: 'image',
    description: 'Λογότυπο εταιρείας και φωτογραφία εκπροσώπου',
    order: 13,
    fields: [
      // Αυτό το tab θα περιέχει το UnifiedPhotoManager component
      // Τα actual photo uploads θα γίνονται από το UnifiedPhotoManager
    ],
  },

  // -------------------------------------------------------------------------
  // 14. ΣΧΕΣΕΙΣ
  // -------------------------------------------------------------------------
  {
    id: 'relationships',
    title: 'Μέτοχοι & Εργαζόμενοι',
    icon: 'users',
    description: 'Διαχείριση μετόχων, διοικητικού συμβουλίου και εργαζομένων',
    order: 14,
    fields: [
      // Main tab displays RelationshipsSummary component with overview
      // Full management happens in modal via ContactRelationshipManager
      {
        id: 'relationshipsSummary',
        label: companyLabels.relationships_summary,
        type: 'input', // Dummy field - actual rendering handled by custom renderer
        helpText: 'Στατιστικά και περίληψη σχέσεων εταιρείας'
      }
    ],
  },

];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Αποκτά όλα τα πεδία από όλες τις ενότητες
 */
export function getAllCompanyFields(): FieldConfig[] {
  return COMPANY_GEMI_SECTIONS.flatMap(section => section.fields);
}

/**
 * Αποκτά μια συγκεκριμένη ενότητα πεδίων
 */
export function getCompanySection(sectionId: string): SectionConfig | undefined {
  return COMPANY_GEMI_SECTIONS.find(section => section.id === sectionId);
}

/**
 * Αποκτά ένα συγκεκριμένο πεδίο από όλες τις ενότητες
 */
export function getCompanyField(fieldId: string): FieldConfig | undefined {
  return getAllCompanyFields().find(field => field.id === fieldId);
}

/**
 * Δημιουργεί mapping από field ID σε FieldConfig για γρήγορη αναζήτηση
 */
export function createFieldsMap(): Map<string, FieldConfig> {
  const map = new Map<string, FieldConfig>();
  getAllCompanyFields().forEach(field => {
    map.set(field.id, field);
  });
  return map;
}

/**
 * Ελέγχει αν ένα πεδίο είναι required
 */
export function isFieldRequired(fieldId: string): boolean {
  const field = getCompanyField(fieldId);
  return field?.required ?? false;
}

/**
 * Αποκτά τις ενότητες ταξινομημένες κατά σειρά priority
 */
export function getSortedSections(): SectionConfig[] {
  return [...COMPANY_GEMI_SECTIONS].sort((a, b) => a.order - b.order);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  sections: COMPANY_GEMI_SECTIONS,
  getAllFields: getAllCompanyFields,
  getSection: getCompanySection,
  getField: getCompanyField,
  createFieldsMap,
  isFieldRequired,
  getSortedSections,
};