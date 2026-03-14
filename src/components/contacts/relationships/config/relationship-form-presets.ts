// ============================================================================
// RELATIONSHIP FORM PRESETS — SINGLE SOURCE OF TRUTH
// ============================================================================
//
// 🎯 PURPOSE: Centralized preset options for relationship form fields:
//    - Relationship Types (per contact type)
//    - Positions (Θέσεις)
//    - Departments (Τμήματα)
//
// 🏢 STANDARDS: All labels are i18n keys. Zero hardcoded text.
// 🔗 USED BY: RelationshipFormFields (via SearchableCombobox)
//
// ============================================================================

import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import type { ContactType } from '@/types/contacts/contracts';
import {
  getAvailableRelationshipTypes,
  getRelationshipTypeConfig
} from '../utils/relationship-types';

// ============================================================================
// RELATIONSHIP TYPE OPTIONS — Built from existing centralized config
// ============================================================================

/**
 * Builds ComboboxOption[] for relationship types based on contact type.
 * Wraps existing `getAvailableRelationshipTypes` + `getRelationshipTypeConfig`.
 *
 * @param contactType - individual | company | service
 * @param t - i18n translation function
 */
export function getRelationshipTypeOptions(
  contactType: ContactType,
  t: (key: string) => string
): ComboboxOption[] {
  const types = getAvailableRelationshipTypes(contactType);

  return types.map(typeKey => {
    const config = getRelationshipTypeConfig(typeKey);
    const label = config?.label ? t(config.label) : typeKey;
    return { value: typeKey, label };
  });
}

// ============================================================================
// POSITION PRESETS — Θέσεις
// ============================================================================

/**
 * Predefined position options (i18n keys).
 * Users can also add custom positions via the "Add new" feature.
 */
const POSITION_PRESET_KEYS = [
  { value: 'director', labelKey: 'relationships.presets.positions.director' },
  { value: 'manager', labelKey: 'relationships.presets.positions.manager' },
  { value: 'supervisor', labelKey: 'relationships.presets.positions.supervisor' },
  { value: 'engineer', labelKey: 'relationships.presets.positions.engineer' },
  { value: 'accountant', labelKey: 'relationships.presets.positions.accountant' },
  { value: 'secretary', labelKey: 'relationships.presets.positions.secretary' },
  { value: 'technician', labelKey: 'relationships.presets.positions.technician' },
  { value: 'sales_rep', labelKey: 'relationships.presets.positions.salesRep' },
] as const;

/**
 * Returns ComboboxOption[] for positions, translated via i18n.
 * @param t - translation function
 */
export function getPositionOptions(t: (key: string) => string): ComboboxOption[] {
  return POSITION_PRESET_KEYS.map(({ value, labelKey }) => ({
    value,
    label: t(labelKey)
  }));
}

// ============================================================================
// DEPARTMENT PRESETS — Τμήματα
// ============================================================================

/**
 * Predefined department options (i18n keys).
 * Users can also add custom departments via the "Add new" feature.
 */
const DEPARTMENT_PRESET_KEYS = [
  { value: 'management', labelKey: 'relationships.presets.departments.management' },
  { value: 'finance', labelKey: 'relationships.presets.departments.finance' },
  { value: 'hr', labelKey: 'relationships.presets.departments.hr' },
  { value: 'sales', labelKey: 'relationships.presets.departments.sales' },
  { value: 'engineering', labelKey: 'relationships.presets.departments.engineering' },
  { value: 'operations', labelKey: 'relationships.presets.departments.operations' },
  { value: 'legal', labelKey: 'relationships.presets.departments.legal' },
  { value: 'it', labelKey: 'relationships.presets.departments.it' },
] as const;

/**
 * Returns ComboboxOption[] for departments, translated via i18n.
 * @param t - translation function
 */
export function getDepartmentOptions(t: (key: string) => string): ComboboxOption[] {
  return DEPARTMENT_PRESET_KEYS.map(({ value, labelKey }) => ({
    value,
    label: t(labelKey)
  }));
}
