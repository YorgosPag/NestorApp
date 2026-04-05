/**
 * =============================================================================
 * ENTERPRISE: EntityPolicyError — Base class for all domain policy errors
 * =============================================================================
 *
 * Every server-side creation/mutation policy (building, property, project,
 * floor, ...) throws subclasses of this base. Each error carries a stable
 * `code` from POLICY_ERROR_CODES plus optional `params` for template
 * interpolation (e.g. the offending code/id/type).
 *
 * Downstream:
 *   - `ApiError` propagates the `code` to the HTTP response
 *   - `translatePolicyError` maps `code` → localized i18n message
 *   - `<PolicyErrorBanner>` renders the message and looks up an optional
 *     inline recovery action for the code
 *
 * @module lib/policy/entity-policy-error
 * @see lib/policy/policy-error-codes.ts
 * @see lib/policy/policy-error-translator.ts
 */

import type { PolicyErrorCode } from './policy-error-codes';

/** Domain the policy belongs to — used for diagnostics/logging only. */
export type PolicyEntity =
  | 'building'
  | 'property'
  | 'project'
  | 'floor'
  | 'parking'
  | 'storage';

/** Template parameters interpolated into the translated message (e.g. {code}). */
export type PolicyErrorParams = Record<string, string>;

/**
 * Base class for all entity policy errors. Concrete subclasses should be
 * lightweight wrappers that fix the `entity` property at construction time.
 */
export class EntityPolicyError extends Error {
  public readonly code: PolicyErrorCode;
  public readonly entity: PolicyEntity;
  public readonly params?: PolicyErrorParams;

  constructor(
    code: PolicyErrorCode,
    entity: PolicyEntity,
    message: string,
    params?: PolicyErrorParams,
  ) {
    super(message);
    this.name = 'EntityPolicyError';
    this.code = code;
    this.entity = entity;
    this.params = params;
  }

  /** Narrow type guard. */
  static is(error: unknown): error is EntityPolicyError {
    return error instanceof EntityPolicyError;
  }
}
