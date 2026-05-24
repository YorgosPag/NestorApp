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
// RELATIONSHIP TYPE OPTIONS — Built from centralized config + ADR-372 matrix
// ============================================================================

/**
 * Builds ComboboxOption[] for relationship types filtered by crossing.
 *
 * @param sourceType   - contact type of the page owner (source side)
 * @param t            - i18n translation function
 * @param currentValue - already-saved type; prepended if absent from filtered list
 * @param targetType   - contact type of the selected target (ADR-372: enables 2D matrix filter)
 *                       When provided, only types valid for the (source→target) crossing are shown.
 *                       When absent, falls back to source-only filter (backward compat).
 */
export function getRelationshipTypeOptions(
  sourceType: ContactType,
  t: (key: string) => string,
  currentValue?: string,
  targetType?: ContactType
): ComboboxOption[] {
  const types = getAvailableRelationshipTypes(sourceType, targetType);

  const options: ComboboxOption[] = types.map(typeKey => {
    const config = getRelationshipTypeConfig(typeKey);
    const label = config?.label ? t(config.label) : typeKey;
    return { value: typeKey, label };
  });

  // When editing a relationship from the opposite contact's side, the saved type may not be
  // in the filtered list (e.g. 'business_contact' was set from person's side, but a company
  // is opening the form). Prepend it with its proper label so the UI never shows raw keys.
  if (currentValue && !options.some(o => o.value === currentValue)) {
    const fallbackConfig = getRelationshipTypeConfig(currentValue);
    const fallbackLabel = fallbackConfig?.label ? t(fallbackConfig.label) : currentValue;
    options.unshift({ value: currentValue, label: fallbackLabel });
  }

  return options;
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
