/**
 * Barrel for the centralized policy error system (ADR-284 infrastructure).
 *
 * @module lib/policy
 */

export { POLICY_ERROR_CODES, type PolicyErrorCode } from './policy-error-codes';
export {
  EntityPolicyError,
  type PolicyEntity,
  type PolicyErrorParams,
} from './entity-policy-error';
export {
  translatePolicyError,
  isKnownPolicyErrorCode,
  type TranslatorFn,
} from './policy-error-translator';
export {
  registerPolicyRecovery,
  getPolicyRecovery,
  type PolicyRecoveryContext,
  type PolicyRecoveryComponent,
} from './policy-recovery-registry';
