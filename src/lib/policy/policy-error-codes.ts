/**
 * =============================================================================
 * ENTERPRISE: Entity Policy Error Codes (SSoT)
 * =============================================================================
 *
 * Stable, entity-agnostic error codes for creation/mutation policies across
 * the application (ADR-284). Every server-side policy error emits one of
 * these codes; the client translates it via the shared policy-error-translator.
 *
 * Adding a new code requires:
 *   1. Adding the code here (SSoT)
 *   2. Adding the i18n key `policyErrors.<CODE>` to locales (el + en)
 *   3. (Optional) Registering a recovery component in policy-recovery-registry
 *
 * @module lib/policy/policy-error-codes
 */

export const POLICY_ERROR_CODES = {
  // ----- Name / Type -----
  NAME_REQUIRED: 'POLICY_NAME_REQUIRED',
  TYPE_REQUIRED: 'POLICY_TYPE_REQUIRED',

  // ----- Project chain -----
  PROJECT_REQUIRED: 'POLICY_PROJECT_REQUIRED',
  PROJECT_NOT_FOUND: 'POLICY_PROJECT_NOT_FOUND',
  PROJECT_ORPHAN_NO_COMPANY: 'POLICY_PROJECT_ORPHAN_NO_COMPANY',

  // ----- Company chain -----
  COMPANY_REQUIRED: 'POLICY_COMPANY_REQUIRED',
  COMPANY_NOT_FOUND: 'POLICY_COMPANY_NOT_FOUND',
  COMPANY_INVALID_TYPE: 'POLICY_COMPANY_INVALID_TYPE',

  // ----- Building chain -----
  BUILDING_REQUIRED: 'POLICY_BUILDING_REQUIRED',
  BUILDING_NOT_FOUND: 'POLICY_BUILDING_NOT_FOUND',
  BUILDING_PROJECT_MISMATCH: 'POLICY_BUILDING_PROJECT_MISMATCH',

  // ----- Floor chain -----
  FLOOR_REQUIRED: 'POLICY_FLOOR_REQUIRED',
  FLOOR_NOT_FOUND: 'POLICY_FLOOR_NOT_FOUND',
  FLOOR_BUILDING_MISMATCH: 'POLICY_FLOOR_BUILDING_MISMATCH',

  // ----- Multi-level (ADR-236) -----
  MULTILEVEL_MIN_FLOORS: 'POLICY_MULTILEVEL_MIN_FLOORS',
  MULTILEVEL_SINGLE_PRIMARY: 'POLICY_MULTILEVEL_SINGLE_PRIMARY',
  MULTILEVEL_FLOOR_REQUIRED: 'POLICY_MULTILEVEL_FLOOR_REQUIRED',
  MULTILEVEL_FLOOR_MISMATCH: 'POLICY_MULTILEVEL_FLOOR_MISMATCH',

  // ----- Family A / B discrimination (standalone vs in-building units) -----
  STANDALONE_WITH_BUILDING: 'POLICY_STANDALONE_WITH_BUILDING',

  // ----- Uniqueness -----
  DUPLICATE_CODE: 'POLICY_DUPLICATE_CODE',
} as const;

export type PolicyErrorCode =
  (typeof POLICY_ERROR_CODES)[keyof typeof POLICY_ERROR_CODES];
