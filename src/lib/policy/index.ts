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
  policyErrorMessageOf,
  policyErrorCodeOf,
  POLICY_ERROR_NAMESPACES,
  type TranslatorFn,
} from './policy-error-translator';
export {
  reportMutationFailure,
  type MutationFailureLogger,
  type MutationFailureSinks,
} from './mutation-failure-feedback';
export {
  registerPolicyRecovery,
  getPolicyRecovery,
  type PolicyRecoveryContext,
  type PolicyRecoveryComponent,
} from './policy-recovery-registry';
