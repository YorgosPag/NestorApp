'use client';

/**
 * Super Admin Company Context — ADR-340
 *
 * Provides active companyId for super admin users who operate across
 * multiple tenants. Regular users never interact with this context.
 *
 * Pattern: Procore/Salesforce — persistent global context switcher,
 * not per-dialog selection.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/auth/contexts/AuthContext';
import { isRoleBypass } from '@/lib/auth/roles';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type { CompanyDocument } from '@/types/company';

const logger = createModuleLogger('SuperAdminCompanyContext');

const STORAGE_KEY = 'super_admin_active_company_id';

// ============================================================================
// TYPES
// ============================================================================

interface SuperAdminCompanyContextValue {
  isSuperAdmin: boolean;
  activeCompanyId: string | null;
  companies: Pick<CompanyDocument, 'id' | 'name'>[];
  loading: boolean;
  setActiveCompanyId: (id: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const SuperAdminCompanyContext = createContext<SuperAdminCompanyContextValue>({
  isSuperAdmin: false,
  activeCompanyId: null,
  companies: [],
  loading: false,
  setActiveCompanyId: () => undefined,
});

// ============================================================================
// PROVIDER
// ============================================================================

export function SuperAdminCompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.globalRole && isRoleBypass(user.globalRole));

  const [companies, setCompanies] = useState<Pick<CompanyDocument, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    if (!isSuperAdmin || !db) return;
    setLoading(true);
    const q = query(collection(db, 'companies'), orderBy('name'));
    getDocs(q)
      .then(snap => {
        const list = snap.docs.map(d => ({
          id: d.id,
          name: (d.data() as { name?: string }).name ?? d.id,
        }));
        setCompanies(list);
        // Auto-select first company if nothing persisted
        if (!activeCompanyId && list.length > 0) {
          setActiveCompanyIdState(list[0].id);
          localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      })
      .catch(err => logger.error('Failed to load companies', { error: err }))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const setActiveCompanyId = useCallback((id: string) => {
    // eslint-disable-next-line no-console
    console.log('[SACtx] setActiveCompanyId called', { newId: id });
    setActiveCompanyIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  // Propagate selection to apiClient singleton so every authenticated API call
  // sends X-Super-Admin-Company-Id header. Server's buildRequestContext reads it
  // and overrides ctx.companyId for bypass roles (ADR-354).
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[SACtx] propagate effect', { isSuperAdmin, activeCompanyId });
    apiClient.setSuperAdminCompanyId(isSuperAdmin ? activeCompanyId : null);
  }, [isSuperAdmin, activeCompanyId]);

  return (
    <SuperAdminCompanyContext.Provider value={{ isSuperAdmin, activeCompanyId, companies, loading, setActiveCompanyId }}>
      {children}
    </SuperAdminCompanyContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSuperAdminCompany(): SuperAdminCompanyContextValue {
  return useContext(SuperAdminCompanyContext);
}
