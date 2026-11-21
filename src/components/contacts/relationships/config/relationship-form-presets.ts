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
  UNASSIGNED_DEPARTMENT_KEY,
  departmentGroupKey,
} from '@/types/contacts/relationships/structures/organization';
import {
  decodeOrientedRole,
  encodeOrientedRole,
  getOfferedOrientedRoles,
  relationshipRoleLabelKey,
  type OrientedRole,
} from '@/types/contacts/relationships/core/relationship-orientation';
import { POSITION_PRESETS } from '@/types/contacts/relationships/core/relationship-positions';

// ============================================================================
// RELATIONSHIP ROLE OPTIONS — ADR-372 §Β1/§Β2 reciprocal-role model
// ============================================================================

function toOption(role: OrientedRole, t: (key: string) => string): ComboboxOption {
  return { value: encodeOrientedRole(role), label: t(relationshipRoleLabelKey(role.type, role.pickedSide)) };
}

/**
 * Role options when, on `currentType`'s card, the user links a `pickedType` contact.
 * Each option reads «the picked contact is <label> of the current one» — e.g. on a
 * company card «Εργαζόμενος», on a person card «Εργαζόμενος σε». The value encodes
 * the ORIENTED role (`encodeOrientedRole`), so the stored direction never depends
 * on which card the user started from. Labels are unique by construction (CHECK 3.73).
 *
 * @param currentValue - saved encoded role; prepended if absent from the filtered list
 * @param pickedType   - contact type of the picked contact; when absent, every role the
 *                       current contact can take part in is offered.
 */
export function getRelationshipTypeOptions(
  currentType: ContactType,
  t: (key: string) => string,
  currentValue?: string,
  pickedType?: ContactType
): ComboboxOption[] {
  const options = getOfferedOrientedRoles(currentType, pickedType).map(role => toOption(role, t));
  if (currentValue && !options.some(o => o.value === currentValue)) {
    const decoded = decodeOrientedRole(currentValue);
    options.unshift({ value: currentValue, label: t(relationshipRoleLabelKey(decoded.type, decoded.pickedSide)) });
  }
  return options;
}

/**
 * Only the roles the PICKED contact HOLDS (plain type values) — for flows whose
 * semantics are «the role of X at Y» (e.g. a quote signatory at the vendor).
 * The server orients the record with `pickedSide: 'source'`.
 */
export function getHolderRoleOptions(
  currentType: ContactType,
  t: (key: string) => string,
  pickedType: ContactType
): ComboboxOption[] {
  return getOfferedOrientedRoles(currentType, pickedType)
    .filter(role => role.pickedSide === 'source')
    .map(role => ({ value: role.type, label: t(relationshipRoleLabelKey(role.type, 'source')) }));
}

// ============================================================================
// POSITION PRESETS — Θέσεις
// ============================================================================

/**
 * Returns ComboboxOption[] for positions, translated via i18n.
 * Presets (and their «manages people» flag) live in the domain leaf
 * `relationship-positions.ts` (ADR-372 §8.3). Users can also type a custom one.
 * @param t - translation function
 */
export function getPositionOptions(t: (key: string) => string): ComboboxOption[] {
  return POSITION_PRESETS.map(({ value, labelKey }) => ({
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

/**
 * ADR-372 §Β3 — «preset key OR free text» (Salesforce/HubSpot «Title», LinkedIn):
 * a chosen preset is stored as a stable, locale-independent KEY and translated at
 * display time; anything the user typed is user data and is shown verbatim.
 * ONE resolver for every preset-backed free-text field (department, position).
 */
function resolvePresetOrFreeText(
  value: string,
  presets: ReadonlyArray<{ value: string; labelKey: string }>,
  t: (key: string) => string
): string {
  const preset = presets.find(p => p.value === value);
  return preset ? t(preset.labelKey) : value;
}

/** Display a stored department; blank / `UNASSIGNED_DEPARTMENT_KEY` → «Χωρίς τμήμα». */
export function resolveDepartmentLabel(
  value: string | null | undefined,
  t: (key: string) => string
): string {
  const key = departmentGroupKey(value);
  if (key === UNASSIGNED_DEPARTMENT_KEY) return t('relationships.organizationTree.noDepartment');
  return resolvePresetOrFreeText(key, DEPARTMENT_PRESET_KEYS, t);
}

/** Display a stored position (preset key → i18n, free text verbatim); `''` when absent. */
export function resolvePositionLabel(
  value: string | null | undefined,
  t: (key: string) => string
): string {
  const trimmed = value?.trim();
  return trimmed ? resolvePresetOrFreeText(trimmed, POSITION_PRESETS, t) : '';
}
