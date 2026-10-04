/**
 * =============================================================================
 * ENTERPRISE: Policy Error Translator (Client-Side)
 * =============================================================================
 *
 * Single source of truth for turning server-side policy error codes into
 * localized user-facing messages. Uses the `policyErrors` namespace from
 * the `building` translations (the shared i18n home for cross-entity
 * policy strings — see i18n/locales/{el,en}/building.json).
 *
 * Usage:
 * ```ts
 * const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
 * const message = translatePolicyError(errorCode, t, rawFallback, { code: 'Κτήριο Α' });
 * ```
 *
 * @module lib/policy/policy-error-translator
 * @see lib/policy/policy-error-codes.ts
 */

import { POLICY_ERROR_CODES, type PolicyErrorCode } from './policy-error-codes';

export type TranslatorFn = (
  key: string,
  params?: Record<string, string>,
) => string;

/** Reverse map: stable code → i18n sub-key under `policyErrors.*`. */
const CODE_TO_I18N_KEY: Record<PolicyErrorCode, string> = {
  [POLICY_ERROR_CODES.NAME_REQUIRED]: 'policyErrors.nameRequired',
  [POLICY_ERROR_CODES.TYPE_REQUIRED]: 'policyErrors.typeRequired',
  [POLICY_ERROR_CODES.PROJECT_REQUIRED]: 'policyErrors.projectRequired',
  [POLICY_ERROR_CODES.PROJECT_NOT_FOUND]: 'policyErrors.projectNotFound',
  [POLICY_ERROR_CODES.PROJECT_ORPHAN_NO_COMPANY]: 'policyErrors.projectOrphanNoCompany',
  [POLICY_ERROR_CODES.COMPANY_REQUIRED]: 'policyErrors.companyRequired',
  [POLICY_ERROR_CODES.COMPANY_NOT_FOUND]: 'policyErrors.companyNotFound',
  [POLICY_ERROR_CODES.COMPANY_INVALID_TYPE]: 'policyErrors.companyInvalidType',
  [POLICY_ERROR_CODES.BUILDING_REQUIRED]: 'policyErrors.buildingRequired',
  [POLICY_ERROR_CODES.BUILDING_NOT_FOUND]: 'policyErrors.buildingNotFound',
  [POLICY_ERROR_CODES.BUILDING_PROJECT_MISMATCH]: 'policyErrors.buildingProjectMismatch',
  [POLICY_ERROR_CODES.FLOOR_REQUIRED]: 'policyErrors.floorRequired',
  [POLICY_ERROR_CODES.FLOOR_NOT_FOUND]: 'policyErrors.floorNotFound',
  [POLICY_ERROR_CODES.FLOOR_BUILDING_MISMATCH]: 'policyErrors.floorBuildingMismatch',
  [POLICY_ERROR_CODES.MULTILEVEL_MIN_FLOORS]: 'policyErrors.multilevelMinFloors',
  [POLICY_ERROR_CODES.MULTILEVEL_SINGLE_PRIMARY]: 'policyErrors.multilevelSinglePrimary',
  [POLICY_ERROR_CODES.MULTILEVEL_FLOOR_REQUIRED]: 'policyErrors.multilevelFloorRequired',
  [POLICY_ERROR_CODES.MULTILEVEL_FLOOR_MISMATCH]: 'policyErrors.multilevelFloorMismatch',
  [POLICY_ERROR_CODES.STANDALONE_WITH_BUILDING]: 'policyErrors.standaloneWithBuilding',
  [POLICY_ERROR_CODES.DUPLICATE_CODE]: 'policyErrors.duplicateCode',
  [POLICY_ERROR_CODES.SPACE_LINKED_TO_UNIT]: 'policyErrors.spaceLinkedToUnit',
};

/**
 * Τα namespaces που χρειάζεται ένα μήνυμα πολιτικής: τα ίδια τα μηνύματα (`building`) **και** οι ετικέτες UI που
 * αναφέρουν ({@link CODE_TO_LABEL_KEYS}). Πρώτο το `building` — το `t` δένεται στο πρώτο namespace.
 */
export const POLICY_ERROR_NAMESPACES = ['building', 'properties'] as const;

/**
 * Ονόματα του UI που **αναφέρει** ένα μήνυμα («πήγαινε στην ενότητα Χ») — παράμετρος ICU → το κλειδί της ΙΔΙΑΣ της
 * ετικέτας. Το μήνυμα διαβάζει το όνομα, δεν το αντιγράφει: μετονομασία της ενότητας = ένα σημείο (ADR-898 §21.6 Ε4 —
 * το 409 έστελνε τον άνθρωπο σε «Παρακολουθήματα», ενώ η ενότητα λέγεται «Συνδεδεμένοι Χώροι»).
 */
const CODE_TO_LABEL_KEYS: Partial<Record<PolicyErrorCode, Readonly<Record<string, string>>>> = {
  [POLICY_ERROR_CODES.SPACE_LINKED_TO_UNIT]: { section: 'properties:linkedSpaces.title' },
};

function labelParamsOf(code: PolicyErrorCode, t: TranslatorFn): Record<string, string> | undefined {
  const labelKeys = CODE_TO_LABEL_KEYS[code];
  if (!labelKeys) return undefined;
  return Object.fromEntries(Object.entries(labelKeys).map(([param, key]) => [param, t(key)]));
}

/**
 * Translates a server-side policy error code to a localized message.
 *
 * @param errorCode - Stable code from server (may be undefined for non-policy errors)
 * @param t - Translation function (should resolve `policyErrors.*` keys)
 * @param fallback - Raw server message when the code is unknown/missing
 * @param params - Optional interpolation params (e.g. `{ code: "Κτήριο Α" }`)
 * @returns Localized, user-friendly message
 */
export function translatePolicyError(
  errorCode: string | undefined,
  t: TranslatorFn,
  fallback: string,
  params?: Record<string, string>,
): string {
  if (!errorCode) return fallback;
  const key = CODE_TO_I18N_KEY[errorCode as PolicyErrorCode];
  if (!key) return fallback;
  const translated = t(key, params);
  // i18n libraries sometimes return the key itself when missing — treat that
  // as "missing" and fall back to the raw server message.
  return translated && translated !== key ? translated : fallback;
}

/**
 * Το μήνυμα ενός σφάλματος mutation **όταν** είναι γνωστή άρνηση πολιτικής (ο server έστειλε `errorCode` του μητρώου) —
 * αλλιώς `null`, και ο καλών δείχνει το δικό του γενικό μήνυμα. Duck-typed στο `errorCode` ώστε το αρχείο να μένει
 * ουδέτερο (κανένα import του HTTP client).
 */
export function policyErrorMessageOf(error: unknown, t: TranslatorFn): string | null {
  const code = policyErrorCodeOf(error);
  if (code === null) return null;
  const message = translatePolicyError(code, t, '', labelParamsOf(code, t));
  return message === '' ? null : message;
}

/** Ο κωδικός πολιτικής ενός σφάλματος mutation, ή `null` όταν **δεν** είναι γνωστή άρνηση πολιτικής. */
export function policyErrorCodeOf(error: unknown): PolicyErrorCode | null {
  const code = typeof error === 'object' && error !== null && 'errorCode' in error ? error.errorCode : undefined;
  return typeof code === 'string' && isKnownPolicyErrorCode(code) ? code : null;
}

/** Type guard: is this a known policy error code? */
export function isKnownPolicyErrorCode(
  code: string | undefined,
): code is PolicyErrorCode {
  return !!code && code in CODE_TO_I18N_KEY;
}
