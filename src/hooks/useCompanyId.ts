/**
 * =============================================================================
 * 🏢 ENTERPRISE: useCompanyId Hook
 * =============================================================================
 *
 * React hook wrapper around the centralized companyId resolver (ADR-201).
 * Provides memoized companyId resolution for React components.
 *
 * Priority order (inherited from resolver):
 * 1. building.companyId  — Firestore source of truth
 * 2. user.companyId      — Auth user's tenant
 * 3. selectedCompanyId   — UI selection (last resort)
 *
 * @module hooks/useCompanyId
 * @see services/company-id-resolver
 * @enterprise ADR-201 Phase 2
 */

import { useMemo } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { tryResolveCompanyId, type CompanyIdResult } from '@/services/company-id-resolver';

interface UseCompanyIdOptions {
  /** Building document — highest priority source */
  building?: { companyId?: string } | null;
  /** Explicit companyId selection — lowest priority */
  selectedCompanyId?: string;
}

/**
 * Resolve companyId using the centralized resolver with auth context.
 *
 * @returns CompanyIdResult with { companyId, source } or undefined if unavailable
 *
 * @example
 * ```tsx
 * // Simple — just user's tenant
 * const result = useCompanyId();
 * const companyId = result?.companyId;
 *
 * // With building context (e.g. building tabs)
 * const result = useCompanyId({ building });
 * const companyId = result?.companyId;
 *
 * // With explicit selection (e.g. file manager workspace)
 * const result = useCompanyId({ selectedCompanyId: workspace?.companyId });
 * ```
 */
export function useCompanyId(options?: UseCompanyIdOptions): CompanyIdResult | undefined {
  const { user } = useAuth();

  return useMemo(
    () => tryResolveCompanyId({
      building: options?.building,
      user,
      selectedCompanyId: options?.selectedCompanyId,
    }),
    [options?.building?.companyId, user?.companyId, options?.selectedCompanyId]
  );
}
