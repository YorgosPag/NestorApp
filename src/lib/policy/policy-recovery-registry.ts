'use client';

/**
 * =============================================================================
 * ENTERPRISE: Policy Error Recovery Registry
 * =============================================================================
 *
 * Centralized registry that maps a policy error code to an inline "recovery"
 * React component (self-healing error pattern). When a domain UI surfaces a
 * policy error, it asks the registry for a matching recovery component and
 * renders it directly next to the error banner.
 *
 * Benefits:
 *   - Zero duplication: one recovery component serves every entity that
 *     can emit the same code (e.g. PROJECT_ORPHAN_NO_COMPANY can fire
 *     while creating a building, property, floor, ...).
 *   - Decoupled: domain UIs don't need to know which recovery exists —
 *     they just render `<PolicyErrorBanner>` and the registry does the rest.
 *
 * @module lib/policy/policy-recovery-registry
 * @see components/shared/PolicyErrorBanner
 */

import type { ComponentType } from 'react';
import type { PolicyErrorCode } from './policy-error-codes';

/** Context passed to every recovery component by the banner. */
export interface PolicyRecoveryContext {
  /** Free-form payload the domain UI provides (e.g. `{ projectId, buildingId }`). */
  readonly context: Readonly<Record<string, unknown>>;
  /** Called after a successful recovery — parent should dismiss the error. */
  readonly onRecovered: () => void;
}

export type PolicyRecoveryComponent = ComponentType<PolicyRecoveryContext>;

const REGISTRY = new Map<PolicyErrorCode, PolicyRecoveryComponent>();

/**
 * Registers a recovery component for a given policy error code. Idempotent —
 * re-registering overrides the previous entry (useful for tests).
 */
export function registerPolicyRecovery(
  code: PolicyErrorCode,
  component: PolicyRecoveryComponent,
): void {
  REGISTRY.set(code, component);
}

/** Returns the registered recovery component for a code, or `undefined`. */
export function getPolicyRecovery(
  code: string | undefined,
): PolicyRecoveryComponent | undefined {
  if (!code) return undefined;
  return REGISTRY.get(code as PolicyErrorCode);
}
