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
  getGemiStatusOptions
} from '../subapps/dxf-viewer/config/modal-select';

import { getSortedSections, getAllCompanyFields, getCompanyField, type FieldConfig } from './company-gemi';

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

    // Fallback to centralized values
    return getDefaultLegalForms();
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

    // Fallback to centralized values
    return getGemiStatusOptions().map(option => ({
      value: option.value,
      label: option.label
    }));
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
    return getDefaultLegalForms().map(option => ({
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
    return getGemiStatusOptions().map(option => ({
      ...option,
      category: 'operational'
    }));
  }
}



// ============================================================================
// COMPANY GEMI SECTIONS CONFIGURATION
// ============================================================================


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================


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


// ============================================================================
// EXPORTS
// ============================================================================

export default {
  sections: getSortedSections(),
  createFieldsMap,
  isFieldRequired,
};
