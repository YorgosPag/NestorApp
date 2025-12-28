/**
 * COMPANY GEMI CONFIGURATION - ENTERPRISE INDEX
 *
 * Κεντρικό entry point για όλο το GEMI configuration system
 * ENTERPRISE: Clean API exports με centralized systems integration
 *
 * @version 1.0.0 - ENTERPRISE FOUNDATION
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 *
 * ENTERPRISE MIGRATION από company-gemi-config.ts:
 * - Modular architecture με separate concerns
 * - ZERO HARDCODED VALUES - All από centralized systems
 * - Type-safe interfaces με enterprise standards
 * - Scalable section management
 * - Performance optimized field utilities
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

// Types & Interfaces
export type {
  FieldType,
  SelectOption,
  FieldConfig,
  SectionConfig,
  EnterpriseOptions,
  EnterpriseSelectOption
} from './core/field-types';

// Main section registry
export { COMPANY_GEMI_SECTIONS } from './core/section-registry';
// Import για default export με fallback
import { COMPANY_GEMI_SECTIONS } from './core/section-registry';

// ============================================================================
// LABELS & HELP TEXTS
// ============================================================================

export { COMPANY_FIELD_LABELS, fieldLabels } from './labels/field-labels';
export { gemiHelps, type GemiHelpTextKey } from './labels/help-texts';

// ============================================================================
// SELECT OPTIONS
// ============================================================================

export {
  // Legal Forms
  LEGAL_FORM_OPTIONS,
  loadLegalForms,
  getEnterpriseLegalForms,

  // GEMI Statuses
  GEMI_STATUS_OPTIONS,
  loadCompanyStatuses,
  getEnterpriseCompanyStatuses,
  getLifecycleGemiStatuses,

  // Currencies
  CURRENCY_OPTIONS,
  getRegionalCurrencies,

  // Activity Types
  ACTIVITY_TYPE_OPTIONS,

  // Additional Options από centralized systems
  ADDRESS_TYPE_OPTIONS,
  SHAREHOLDER_TYPE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  BOARD_TYPE_OPTIONS,
  REPRESENTATIVE_POSITION_OPTIONS,
} from './options';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export {
  getAllCompanyFields,
  getCompanySection,
  getCompanyField,
  createFieldsMap,
  isFieldRequired,
  getSortedSections,
  getFieldsBySection,
  getRequiredFields,
  getSectionsWithRequiredFields,
} from './utils/field-utilities';

// ============================================================================
// ENTERPRISE SERVICES (Future Integration)
// ============================================================================

// Business Rules Service integration already available through options
// Additional enterprise services can be added here as the system grows

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Default export object για backward compatibility με lazy loading
 * ENTERPRISE: Maintains existing API while avoiding circular dependencies
 */
export default {
  sections: COMPANY_GEMI_SECTIONS || [],
  get getAllFields() {
    const { getAllCompanyFields } = require('./utils/field-utilities');
    return getAllCompanyFields;
  },
  get getSection() {
    const { getCompanySection } = require('./utils/field-utilities');
    return getCompanySection;
  },
  get getField() {
    const { getCompanyField } = require('./utils/field-utilities');
    return getCompanyField;
  },
  get createFieldsMap() {
    const { createFieldsMap } = require('./utils/field-utilities');
    return createFieldsMap;
  },
  get isFieldRequired() {
    const { isFieldRequired } = require('./utils/field-utilities');
    return isFieldRequired;
  },
  get getSortedSections() {
    const { getSortedSections } = require('./utils/field-utilities');
    return getSortedSections;
  },
} as const;

// ============================================================================
// ENTERPRISE DOCUMENTATION
// ============================================================================

/**
 * ENTERPRISE ARCHITECTURE SUMMARY:
 *
 * 📁 MODULAR STRUCTURE:
 * ├── core/           - Types, interfaces, registries
 * ├── labels/         - Field labels και help texts
 * ├── options/        - Select options από centralized systems
 * ├── sections/       - Individual section definitions
 * ├── services/       - Business logic services (future)
 * └── utils/          - Utility functions
 *
 * 🎯 KEY PRINCIPLES:
 * - ZERO HARDCODED VALUES - All από existing centralized systems
 * - Modular imports για tree-shaking optimization
 * - Type-safe APIs με enterprise standards
 * - Backward compatibility maintained
 * - Scalable architecture για future growth
 *
 * 🚀 USAGE EXAMPLES:
 *
 * Basic import:
 * import { COMPANY_GEMI_SECTIONS } from '@/config/company-gemi';
 *
 * Modular imports:
 * import { fieldLabels, gemiHelps } from '@/config/company-gemi';
 * import { LEGAL_FORM_OPTIONS } from '@/config/company-gemi';
 *
 * Utility functions:
 * import { getAllCompanyFields, getCompanySection } from '@/config/company-gemi';
 *
 * Enterprise features:
 * import { loadLegalForms, getEnterpriseLegalForms } from '@/config/company-gemi';
 */