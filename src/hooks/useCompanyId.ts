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

import { useMemo, useSyncExternalStore } from 'react';

import { useAuth } from '@/auth/hooks/useAuth';
import { tryResolveCompanyId, type CompanyIdResult } from '@/services/company-id-resolver';
import { useSuperAdminCompany } from '@/contexts/SuperAdminCompanyContext';
import {
  getClientWorkspaceScope,
  onSuperAdminActiveCompanyChange,
  requestedWorkspace,
} from '@/services/firestore/super-admin-active-company';

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
  const { isSuperAdmin } = useSuperAdminCompany();
  const scope = useSyncExternalStore(
    onSuperAdminActiveCompanyChange,
    getClientWorkspaceScope,
    getClientWorkspaceScope,
  );

  // 🔑 ADR-849 Β1 — ΙΔΙΑ απάντηση με το Firestore (`resolveEffectiveCompanyId`) και την
  //    κεφαλίδα HTTP: αλλιώς οι 67 καταναλωτές αυτού του hook θα έγραφαν σε άλλη εταιρεία
  //    από αυτήν που διάβασαν. Ο επιλογέας μετρά μόνο για super-admin.
  const requested = requestedWorkspace(isSuperAdmin ? scope : { ...scope, switcher: null });
  const requestedKind = requested.kind;
  const requestedCompany = requested.kind === 'org' ? requested.companyId : null;

  // Πρωτογενείς εξαρτήσεις: τα αντικείμενα `building`/`user` ξαναχτίζονται σε κάθε απόδοση.
  const buildingCompanyId = options?.building?.companyId;
  const userCompanyId = user?.companyId ?? undefined;
  const selectedCompanyId = options?.selectedCompanyId;

  return useMemo(() => {
    const building = buildingCompanyId ? { companyId: buildingCompanyId } : null;
    switch (requestedKind) {
      // Ο χώρος (διεύθυνση, ή επιλογέας εκτός `/o/`) στη βαθμίδα του claim: το έγγραφο
      // (building) νικά, η τοπική επιλογή UI όχι — ίδια σειρά με τον απλό χρήστη.
      case 'org':
        return tryResolveCompanyId({ building, user: null, selectedCompanyId: requestedCompany ?? undefined });
      // Ιδιωτικός χώρος: **καμία** εταιρεία — μόνο αυτή που φέρει το ίδιο το έγγραφο.
      case 'personal':
        return tryResolveCompanyId({ building, user: null });
      case 'default':
        return tryResolveCompanyId({
          building,
          user: userCompanyId ? { companyId: userCompanyId } : null,
          selectedCompanyId,
        });
    }
  }, [buildingCompanyId, userCompanyId, selectedCompanyId, requestedKind, requestedCompany]);
}
