/**
 * 🏢 COMPANY GEMI FIELDS CONFIGURATION
 *
 * Single Source of Truth για όλα τα πεδία ΓΕΜΗ εταιρειών
 * Χρησιμοποιείται από:
 * - CompanyContactSection.tsx (Form creation/editing)
 * - ContactDetails.tsx (Display tabs)
 * - Future generic form/display components
 *
 * @version 2.0.0 - CENTRALIZED LABELS
 * @updated 2025-12-27 - ✅ ENTERPRISE: Using centralized label system
 */

// ✅ ENTERPRISE: Import centralized company labels
import { getCompanyFieldLabels, MODAL_SELECT_GEMI_STATUSES } from '@/subapps/dxf-viewer/config/modal-select';

// ✅ ENTERPRISE: Get centralized labels
const companyLabels = getCompanyFieldLabels();

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
 * 🏢 ENTERPRISE BUSINESS RULES INTEGRATION
 *
 * Database-driven legal forms and company statuses using EnterpriseBusinessRulesService.
 * Replaces hardcoded values with dynamic configuration.
 *
 * @enterprise-migration true
 * @version 2.0.0
 */

import { businessRulesService } from '@/services/business/EnterpriseBusinessRulesService';

/** @deprecated Use EnterpriseBusinessRulesService.getLegalFormsForSelect() instead */
// 🏢 ENTERPRISE: Use centralized legal forms from modal-select system
import {
  getLegalFormOptions,
  getGemiStatusOptions,
  getCurrencyOptions,
  getActivityTypeOptions,
  getAddressTypeOptions,
  getShareholderTypeOptions,
  getDocumentTypeOptions,
  getBoardTypeOptions,
  getRepresentativePositionOptions
} from '@/subapps/dxf-viewer/config/modal-select';

const getDefaultLegalForms = (): SelectOption[] => {
  // ✅ ENTERPRISE: Using centralized legal forms - NO MORE HARDCODED VALUES
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
  // ✅ ENTERPRISE: Using centralized GEMI status options - NO MORE HARDCODED VALUES
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
    console.warn('🏢 Failed to load legal forms from service, using fallback:', error);

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
    console.warn('🏢 Failed to load company statuses from service, using fallback:', error);

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
    console.warn('🏢 Failed to load enterprise legal forms, using fallback:', error);

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
    console.warn('🏢 Failed to load enterprise company statuses, using fallback:', error);

    // Enhanced fallback
    return GEMI_STATUS_OPTIONS.map(option => ({
      ...option,
      category: 'operational'
    }));
  }
}

/** Τύπος δραστηριότητας */
export const ACTIVITY_TYPE_OPTIONS: SelectOption[] = [
  // ✅ ENTERPRISE: Using centralized activity type options - NO MORE HARDCODED VALUES
  ...getActivityTypeOptions(),
];

/** 🌍 ENTERPRISE: Configurable currencies for different regions */
const getDefaultCurrencies = (): SelectOption[] =>
  // ✅ ENTERPRISE: Using centralized currency options - NO MORE HARDCODED VALUES
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
        helpText: 'Πλήρης επωνυμία όπως είναι καταχωρημένη στο ΓΕΜΗ',
      },
      {
        id: 'tradeName',
        label: companyLabels.trade_name,
        type: 'input',
        helpText: 'Εμπορική επωνυμία (αν διαφέρει από την επίσημη)',
      },
      {
        id: 'vatNumber', // 🔧 FIX: Changed from 'companyVatNumber' to 'vatNumber' to match Contact interface
        label: companyLabels.vat_number,
        type: 'input',
        required: true,
        maxLength: 9,
        placeholder: '999999999',
        helpText: 'Αριθμός Φορολογικού Μητρώου (9 ψηφία)',
      },
      {
        id: 'gemiNumber',
        label: companyLabels.gemi_number,
        type: 'input',
        helpText: 'Μοναδικός αριθμός εγγραφής στο ΓΕΜΗ',
      },
      {
        id: 'legalForm',
        label: companyLabels.legal_form,
        type: 'select',
        options: LEGAL_FORM_OPTIONS,
        helpText: 'Νομική μορφή εταιρείας',
      },
      {
        id: 'gemiStatus',
        label: companyLabels.gemi_status,
        type: 'select',
        options: GEMI_STATUS_OPTIONS,
        defaultValue: 'active',
        helpText: 'Τρέχουσα κατάσταση εταιρείας στο ΓΕΜΗ',
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
        helpText: 'Κωδικός Αριθμός Δραστηριότητας',
      },
      {
        id: 'activityDescription',
        label: companyLabels.activity_description,
        type: 'input',
        helpText: 'Αναλυτική περιγραφή της επιχειρηματικής δραστηριότητας',
      },
      {
        id: 'activityType',
        label: companyLabels.activity_type,
        type: 'select',
        options: ACTIVITY_TYPE_OPTIONS,
        defaultValue: 'main',
        helpText: 'Κατηγοριοποίηση δραστηριότητας',
      },
      {
        id: 'chamber',
        label: companyLabels.chamber,
        type: 'input',
        helpText: 'Επιμελητήριο ή τοπική υπηρεσία ΓΕΜΗ',
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
        helpText: 'Εταιρικό κεφάλαιο σε αριθμητική μορφή',
      },
      {
        id: 'currency',
        label: companyLabels.currency,
        type: 'select',
        options: CURRENCY_OPTIONS,
        defaultValue: 'EUR',
        helpText: 'Νόμισμα κεφαλαίου',
      },
      {
        id: 'extraordinaryCapital',
        label: companyLabels.extraordinary_capital,
        type: 'number',
        helpText: 'Εγγυητικά ή εξωλογιστικά κεφάλαια',
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
        helpText: 'Ημερομηνία πρώτης εγγραφής στο ΓΕΜΗ',
      },
      {
        id: 'gemiStatusDate',
        label: companyLabels.status_date,
        type: 'date',
        helpText: 'Ημερομηνία τελευταίας αλλαγής κατάστασης',
      },
      {
        id: 'prefecture',
        label: companyLabels.prefecture,
        type: 'input',
        helpText: 'Νομός έδρας εταιρείας',
      },
      {
        id: 'municipality',
        label: companyLabels.municipality,
        type: 'input',
        helpText: 'Δήμος έδρας εταιρείας',
      },
      {
        id: 'gemiDepartment',
        label: companyLabels.gemi_department,
        type: 'input',
        helpText: 'Αρμόδια τοπική υπηρεσία ΓΕΜΗ',
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
          // ✅ ENTERPRISE: Using centralized address type options - NO MORE HARDCODED VALUES
          ...getAddressTypeOptions()
        ],
        helpText: 'Είδος διεύθυνσης (έδρα ή υποκατάστημα)',
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
        helpText: 'Αριθμός οδού',
      },
      {
        id: 'postalCode',
        label: companyLabels.postal_code,
        type: 'input',
        maxLength: 5,
        helpText: 'Πενταψήφιος ταχυδρομικός κώδικας',
      },
      {
        id: 'city',
        label: companyLabels.city,
        type: 'input',
        helpText: 'Πόλη διεύθυνσης',
      },
      {
        id: 'region',
        label: companyLabels.region,
        type: 'input',
        helpText: 'Περιφέρεια Ελλάδας',
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
        helpText: 'Πλήρες όνομα μετόχου ή εταίρου',
      },
      {
        id: 'shareholderType',
        label: companyLabels.shareholder_type,
        type: 'select',
        options: [
          // ✅ ENTERPRISE: Using centralized shareholder type options - NO MORE HARDCODED VALUES
          ...getShareholderTypeOptions()
        ],
        helpText: 'Τύπος μετόχου (φυσικό ή νομικό πρόσωπο)',
      },
      {
        id: 'shareholderIdNumber',
        label: companyLabels.shareholder_id,
        type: 'input',
        helpText: 'Αριθμός ταυτότητας ή ΑΦΜ μετόχου',
      },
      {
        id: 'shareType',
        label: companyLabels.share_type,
        type: 'input',
        helpText: 'Κατηγορία μετοχών (κοινές, προνομιούχες κλπ)',
      },
      {
        id: 'sharePercentage',
        label: companyLabels.share_percentage,
        type: 'number',
        helpText: 'Ποσοστό συμμετοχής στο κεφάλαιο',
      },
      {
        id: 'nominalValue',
        label: companyLabels.nominal_value,
        type: 'number',
        helpText: 'Ονομαστική αξία μετοχών',
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
          // ✅ ENTERPRISE: Using centralized document type options - NO MORE HARDCODED VALUES
          ...getDocumentTypeOptions()
        ],
        helpText: 'Κατηγορία εγγράφου ΓΕΜΗ',
      },
      {
        id: 'documentDate',
        label: companyLabels.document_date,
        type: 'date',
        helpText: 'Ημερομηνία έκδοσης εγγράφου',
      },
      {
        id: 'documentSubject',
        label: companyLabels.document_subject,
        type: 'input',
        helpText: 'Περιγραφή θέματος εγγράφου',
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
        helpText: 'Ημερομηνία λήψης απόφασης',
      },
      {
        id: 'organType',
        label: 'Όργανο',
        type: 'select',
        options: [
          // ✅ ENTERPRISE: Using centralized board type options - NO MORE HARDCODED VALUES
          ...getBoardTypeOptions()
        ],
        helpText: 'Όργανο που έλαβε την απόφαση',
      },
      {
        id: 'decisionSubject',
        label: companyLabels.decision_subject,
        type: 'input',
        helpText: 'Περιγραφή θέματος απόφασης',
      },
      {
        id: 'protocolNumber',
        label: companyLabels.protocol_number,
        type: 'input',
        helpText: 'Αριθμός πρωτοκόλλου απόφασης',
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
          // ✅ ENTERPRISE: Using centralized representative position options - NO MORE HARDCODED VALUES
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
        helpText: 'Ημερομηνία τελευταίας αλλαγής κατάστασης',
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
  // 14. ΣΧΕΣΕΙΣ - 🏢 ENTERPRISE RELATIONSHIP MANAGEMENT
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