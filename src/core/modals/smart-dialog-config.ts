/**
 * =============================================================================
 * SMART DIALOG CONFIG - Entity Mappings & Validation Rules (SSoT)
 * =============================================================================
 *
 * Centralizes all entity-specific configurations:
 * - Field definitions per entity
 * - Required fields per entity
 * - Layout tokens per entity
 * - Validation rules
 * - Field type inference
 * - Placeholder mappings
 *
 * @module core/modals/smart-dialog-config
 */

import { i18n } from '@/i18n';
import {
  MODAL_SELECT_PLACEHOLDERS,
  getCompanyFieldLabels,
  getServiceFieldLabels,
  getContactTypeLabels,
  getProjectStatusLabels,
} from '../../subapps/dxf-viewer/config/modal-select';
import { DROPDOWN_PLACEHOLDERS } from '../../constants/property-statuses-enterprise';
import type {
  DialogEntityType,
  DialogOperationType,
  SmartDialogAction,
  SmartDialogConfiguration,
  SmartDialogField,
  ValidationRule,
} from './smart-dialog-types';

// =============================================================================
// ENTITY FIELD DEFINITIONS
// =============================================================================

const ENTITY_FIELDS: Record<DialogEntityType, string[]> = {
  contact: ['type', 'fullName', 'email', 'phone', 'notes'],
  company: ['company_name', 'vat_number', 'legal_form', 'activity_description'],
  project: ['name', 'description', 'status', 'company', 'budget'],
  building: ['name', 'address', 'floors', 'units', 'project'],
  unit: ['name', 'type', 'area', 'floor', 'status'],
  opportunity: ['title', 'fullName', 'email', 'phone', 'stage', 'estimatedValue'],
  property: ['name', 'type', 'status', 'price', 'area'],
  service: ['service_name', 'category', 'legal_status', 'phone', 'email'],
  task: ['title', 'description', 'type', 'priority', 'status'],
};

export function getCommonFieldsForEntity(entityType: DialogEntityType): string[] {
  return ENTITY_FIELDS[entityType] || [];
}

// =============================================================================
// REQUIRED FIELDS
// =============================================================================

const ENTITY_REQUIRED_FIELDS: Record<string, string[]> = {
  contact: ['type', 'fullName', 'email'],
  company: ['company_name', 'vat_number', 'legal_form'],
  project: ['name', 'status'],
  opportunity: ['fullName', 'email', 'stage'],
};

export function getRequiredFields(entityType: DialogEntityType, _operationType: DialogOperationType): string[] {
  return ENTITY_REQUIRED_FIELDS[entityType] || [];
}

// =============================================================================
// LAYOUT TOKENS
// =============================================================================

type LayoutConfig = {
  size: SmartDialogConfiguration['layout']['size'];
  gridColumns: SmartDialogConfiguration['layout']['gridColumns'];
  spacing: SmartDialogConfiguration['layout']['spacing'];
};

const ENTITY_LAYOUT: Record<DialogEntityType, LayoutConfig> = {
  contact: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  company: { size: 'xl', gridColumns: 2, spacing: 'comfortable' },
  project: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  opportunity: { size: 'md', gridColumns: 2, spacing: 'normal' },
  building: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  unit: { size: 'md', gridColumns: 2, spacing: 'normal' },
  property: { size: 'md', gridColumns: 2, spacing: 'normal' },
  task: { size: 'lg', gridColumns: 2, spacing: 'normal' },
  service: { size: 'md', gridColumns: 2, spacing: 'normal' },
};

const DEFAULT_LAYOUT: LayoutConfig = { size: 'md', gridColumns: 2, spacing: 'normal' };

export function getLayoutTokens(entityType: DialogEntityType): LayoutConfig {
  return ENTITY_LAYOUT[entityType] || DEFAULT_LAYOUT;
}

// =============================================================================
// VALIDATION RULES
// =============================================================================

/* eslint-disable custom/no-hardcoded-strings -- i18n fallback values for validation messages */
const STANDARD_VALIDATION_RULES: Record<string, ValidationRule> = {
  email: { type: 'email', message: i18n.t('validation.email_invalid', 'Παρακαλώ εισάγετε έγκυρη διεύθυνση email') },
  phone: { type: 'phone', message: i18n.t('validation.phone_invalid', 'Παρακαλώ εισάγετε έγκυρο τηλέφωνο') },
  vat_number: { type: 'pattern', message: i18n.t('validation.vat_invalid', 'Παρακαλώ εισάγετε έγκυρο ΑΦΜ'), options: { pattern: '^[0-9]{9}$' } },
};
/* eslint-enable custom/no-hardcoded-strings */

export function getValidationRules(): Record<string, ValidationRule> {
  return STANDARD_VALIDATION_RULES;
}

export function getFieldValidationRule(fieldName: string): ValidationRule | undefined {
  return STANDARD_VALIDATION_RULES[fieldName];
}

// =============================================================================
// FIELD TYPE INFERENCE
// =============================================================================

const FIELD_TYPE_MAP: Record<string, SmartDialogField['type']> = {
  email: 'input',
  phone: 'input',
  notes: 'textarea',
  description: 'textarea',
  status: 'select',
  type: 'select',
  category: 'select',
  stage: 'select',
  legal_form: 'select',
  company: 'select',
  project: 'select',
  building: 'select',
  floor: 'select',
};

export function inferFieldType(fieldName: string): SmartDialogField['type'] {
  if (fieldName.includes('date') || fieldName.includes('Date')) return 'date';
  if (fieldName.includes('file') || fieldName.includes('File')) return 'file';
  if (fieldName.includes('check') || fieldName.includes('enabled') || fieldName.includes('has_')) return 'checkbox';
  return FIELD_TYPE_MAP[fieldName] || 'input';
}

// =============================================================================
// FIELD LABELS
// =============================================================================

export function getFieldLabels(entityType: DialogEntityType): Record<string, string> {
  switch (entityType) {
    case 'company': return getCompanyFieldLabels();
    case 'service': return getServiceFieldLabels();
    case 'contact': return getContactTypeLabels();
    default: return {};
  }
}

export function getFallbackLabel(fieldName: string): string {
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');
}

// =============================================================================
// PLACEHOLDERS
// =============================================================================

const FIELD_PLACEHOLDER_MAP: Record<string, string> = {
  company: DROPDOWN_PLACEHOLDERS.SELECT_COMPANY,
  project: DROPDOWN_PLACEHOLDERS.SELECT_PROJECT,
  building: DROPDOWN_PLACEHOLDERS.SELECT_BUILDING,
  unit: DROPDOWN_PLACEHOLDERS.SELECT_UNIT,
  client: DROPDOWN_PLACEHOLDERS.SELECT_CLIENT,
  general: DROPDOWN_PLACEHOLDERS.GENERIC_SELECT,
  encoding: DROPDOWN_PLACEHOLDERS.SELECT_ENCODING,
};

export function getPlaceholder(fieldName: string): string | undefined {
  return FIELD_PLACEHOLDER_MAP[fieldName] || MODAL_SELECT_PLACEHOLDERS.default;
}

// =============================================================================
// FIELD OPTIONS
// =============================================================================

export function getFieldOptions(
  fieldName: string,
  entityType: DialogEntityType
): ReadonlyArray<{ value: string; label: string }> | undefined {
  if (fieldName === 'status' && entityType === 'project') {
    const statusLabels = getProjectStatusLabels();
    return Object.entries(statusLabels).map(([value, label]) => ({ value, label }));
  }
  return undefined;
}

// =============================================================================
// OPERATION & ACTION MAPPINGS
// =============================================================================

const PRIMARY_ACTION_VARIANTS: Record<DialogOperationType, SmartDialogAction['variant']> = {
  create: 'default',
  edit: 'default',
  update: 'default',
  delete: 'destructive',
  archive: 'secondary',
  select: 'default',
  duplicate: 'outline',
  import: 'default',
  export: 'outline',
  preview: 'ghost',
  approve: 'default',
};

export function getPrimaryActionVariant(operationType: DialogOperationType): SmartDialogAction['variant'] {
  return PRIMARY_ACTION_VARIANTS[operationType] || 'default';
}

const ACTION_BUTTON_KEY_MAP: Record<DialogOperationType, string> = {
  create: 'create',
  edit: 'update',
  update: 'update',
  delete: 'delete',
  archive: 'archive',
  select: 'select',
  duplicate: 'duplicate',
  import: 'import',
  export: 'export',
  preview: 'close',
  approve: 'approve',
};

export function getActionLabels(operationType: DialogOperationType) {
  const buttonKey = ACTION_BUTTON_KEY_MAP[operationType];
  const primary = i18n.t(`dialogs.actionButtons.${buttonKey}`, { ns: 'common' });
  const secondary = operationType === 'approve'
    ? i18n.t('dialogs.actionButtons.reject', { ns: 'common' })
    : i18n.t('dialogs.actionButtons.cancel', { ns: 'common' });
  return { primary, secondary };
}

// =============================================================================
// THEME & STYLING
// =============================================================================

export function getThemeForEntity(entityType: DialogEntityType): SmartDialogConfiguration['styling']['theme'] {
  if (entityType === 'building' || entityType === 'property') return 'dxf_technical';
  return 'default';
}

// =============================================================================
// DIALOG SIZE CLASSES
// =============================================================================

const DIALOG_SIZE_CLASSES: Record<string, string> = {
  sm: 'sm:max-w-[425px]',
  md: 'sm:max-w-[625px]',
  lg: 'sm:max-w-[800px]',
  xl: 'sm:max-w-[1000px]',
  full: 'sm:max-w-[90vw]',
};

export function getDialogSizeClass(size: 'sm' | 'md' | 'lg' | 'xl' | 'full'): string {
  return DIALOG_SIZE_CLASSES[size];
}
