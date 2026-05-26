'use client';

/**
 * ADR-375 Phase C.1 — Company ↔ BIM Pen Table store sync.
 *
 * Reads companyId from `useAuth()`, subscribes to Firestore
 * `dxf_viewer_pen_tables/{companyId}`, and injects overrides into
 * `useBimPenTableStore` (which calls `setPenTableSource` so renderers
 * pick up overrides without any direct changes).
 *
 * Self-contained: mount once near the DXF viewer root. Unsubscribes
 * automatically on unmount or companyId change.
 */
import { useEffect } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useBimPenTableStore } from '../bim-pen-table-store';

export function useBimPenTableSync(): void {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  useEffect(() => {
    if (!companyId) return;
    const unsubscribe = useBimPenTableStore.getState().loadForCompany(companyId);
    return unsubscribe;
  }, [companyId]);
}
