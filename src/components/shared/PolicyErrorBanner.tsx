'use client';

/**
 * =============================================================================
 * ENTERPRISE: PolicyErrorBanner — Shared UI for policy errors
 * =============================================================================
 *
 * Single component that renders:
 *   1. A translated error banner (via the policy-error-translator)
 *   2. An optional inline recovery action, looked up from the recovery
 *      registry by the server's errorCode
 *
 * Domain UIs (building creation, property creation, floor creation, ...)
 * all use the same banner — zero duplication, consistent UX, any new
 * recovery action lights up everywhere it applies automatically.
 *
 * @module components/shared/PolicyErrorBanner
 * @see lib/policy/policy-error-translator
 * @see lib/policy/policy-recovery-registry
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  translatePolicyError,
  getPolicyRecovery,
} from '@/lib/policy';
// Side-effect: registers all policy recovery components on first import.
import '@/components/shared/policy-recoveries/register';

export interface PolicyErrorBannerProps {
  /** Stable code from the server's `ApiError.errorCode` / ApiClientError.errorCode. */
  readonly errorCode?: string | null;
  /** Raw server message (used as fallback when the code is unknown). */
  readonly rawMessage: string | null;
  /**
   * Free-form context the registered recovery component needs
   * (e.g. `{ projectId: "proj_123" }` for PROJECT_ORPHAN_NO_COMPANY).
   */
  readonly context?: Readonly<Record<string, unknown>>;
  /** Optional params for i18n interpolation (e.g. `{ code: "Κτήριο Α" }`). */
  readonly params?: Record<string, string>;
  /** Fired by the recovery component after a successful fix. Optional payload
   *  carries newly-created entity IDs (e.g. `{ companyId }`) so the parent
   *  can auto-wire the result without extra user steps. */
  readonly onRecovered?: (payload?: Readonly<Record<string, unknown>>) => void;
  /** Translation namespace that owns the `policyErrors.*` keys (default: `building`). */
  readonly namespace?: string;
}

export function PolicyErrorBanner({
  errorCode,
  rawMessage,
  context = {},
  params,
  onRecovered,
  namespace = 'building',
}: PolicyErrorBannerProps) {
  const { t } = useTranslation(namespace);

  if (!rawMessage) return null;

  const message = translatePolicyError(
    errorCode ?? undefined,
    t,
    rawMessage,
    params,
  );
  const RecoveryComponent = getPolicyRecovery(errorCode ?? undefined);

  return (
    <>
      {/* eslint-disable-next-line design-system/enforce-semantic-colors */}
      <aside className="bg-red-100 border border-red-400 text-red-700 px-2 py-2 rounded relative dark:bg-red-900 dark:border-red-700 dark:text-red-300">
        <strong className="font-bold">{t('tabs.general.errorLabel')}</strong>
        <span>{message}</span>
      </aside>
      {RecoveryComponent && onRecovered && (
        <RecoveryComponent context={context} onRecovered={onRecovered} />
      )}
    </>
  );
}
