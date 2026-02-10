/**
 * COMPANY GEMI LEGAL FORMS OPTIONS
 *
 * Enterprise wrapper για legal forms από centralized systems
 * ZERO HARDCODED VALUES - Uses existing modal-select system
 *
 * @version 1.0.0 - ENTERPRISE WRAPPER
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SelectOption, EnterpriseOptions } from '../core/field-types';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('legal-forms');

// ENTERPRISE: Import από existing centralized system - ZERO DUPLICATES
import { getLegalFormOptions } from '../../../subapps/dxf-viewer/config/modal-select';
import { businessRulesService } from '../../../services/business/EnterpriseBusinessRulesService';

// ============================================================================
// LEGAL FORMS OPTIONS - ENTERPRISE WRAPPER
// ============================================================================

/**
 * Get default legal forms από centralized system
 * ENTERPRISE: Uses existing getLegalFormOptions - NO HARDCODED VALUES
 */
const getDefaultLegalForms = (): SelectOption[] => {
  const centralizedForms = getLegalFormOptions();

  // Convert to match local interface (value case conversion if needed)
  return centralizedForms.map(form => ({
    value: form.value.toUpperCase(), // Convert to uppercase for compatibility
    label: form.label
  }));
};

/**
 * Static legal form options με fallback
 * ENTERPRISE: Environment-aware loading από centralized system
 */
export const LEGAL_FORM_OPTIONS: SelectOption[] = (() => {
  try {
    // Try to load from environment variable
    const envLegalForms = process.env.NEXT_PUBLIC_LEGAL_FORMS_JSON;
    if (envLegalForms) {
      return JSON.parse(envLegalForms);
    }
  } catch (error) {
    logger.warn('Failed to parse NEXT_PUBLIC_LEGAL_FORMS_JSON, using defaults');
  }
  return getDefaultLegalForms();
})();

/**
 * Enterprise legal forms loader function
 * ENTERPRISE: Uses existing EnterpriseBusinessRulesService
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
    logger.warn('Failed to load legal forms from service, using fallback', { error });

    // Fallback to hardcoded values
    return LEGAL_FORM_OPTIONS;
  }
}

/**
 * Get enterprise legal forms με business rules validation
 * ENTERPRISE: Uses existing EnterpriseBusinessRulesService με metadata
 */
export async function getEnterpriseLegalForms(options: EnterpriseOptions = {}): Promise<Array<SelectOption & {
  description?: string;
  minCapital?: { amount: number; currency: string };
  requirements?: string[];
}>> {
  const {
    tenantId = 'default',
    jurisdiction = 'GR',
    environment = 'production',
    includeMetadata = false
  } = options;

  try {
    if (includeMetadata) {
      // Get full legal forms με requirements από existing service
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
      // Get simple select options από existing service
      return await businessRulesService.getLegalFormsForSelect(
        tenantId,
        jurisdiction,
        environment
      );
    }
  } catch (error) {
    logger.warn('Failed to load enterprise legal forms, using fallback', { error });

    // Enhanced fallback
    return LEGAL_FORM_OPTIONS.map(option => ({
      ...option,
      description: `Legal form: ${option.label}`
    }));
  }
}