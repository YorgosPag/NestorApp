/**
 * COMPANY GEMI CORE TYPES & INTERFACES
 *
 * Enterprise-grade TypeScript definitions για company GEMI configuration
 *
 * @version 1.0.0 - ENTERPRISE FOUNDATION
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

// ============================================================================
// CORE TYPE DEFINITIONS
// ============================================================================

/** Supported field types για form rendering */
export type FieldType = 'input' | 'select' | 'textarea' | 'date' | 'number' | 'email' | 'tel';

// ============================================================================
// CORE INTERFACES
// ============================================================================

/** Select option interface για dropdown fields */
export interface SelectOption {
  /** Option value (stored in database) */
  value: string;
  /** Display label (shown to user) */
  label: string;
}

/** Field configuration interface */
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

/** Section configuration interface */
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
// ENTERPRISE BUSINESS RULES INTERFACES
// ============================================================================

/** Enterprise configuration options για business rules loading */
export interface EnterpriseOptions {
  /** Tenant identifier για multi-tenant support */
  tenantId?: string;
  /** Jurisdiction code (e.g., 'GR', 'EU') */
  jurisdiction?: string;
  /** Environment ('development', 'production', 'staging') */
  environment?: string;
  /** Include additional metadata (requirements, transitions, etc.) */
  includeMetadata?: boolean;
}

/** Enhanced select option με enterprise metadata */
export interface EnterpriseSelectOption extends SelectOption {
  /** Additional description */
  description?: string;
  /** Minimum capital requirements (for legal forms) */
  minCapital?: { amount: number; currency: string };
  /** Legal/business requirements */
  requirements?: string[];
  /** Category classification */
  category?: string;
  /** Business impact level */
  businessImpact?: string;
  /** Allowed transitions (for statuses) */
  allowedTransitions?: string[];
}