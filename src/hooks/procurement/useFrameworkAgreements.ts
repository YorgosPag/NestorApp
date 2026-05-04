'use client';

/**
 * useFrameworkAgreements — Framework Agreements hook (ADR-330 Phase 5)
 *
 * Reads via Firestore onSnapshot (live updates, ADR-300 stale cache).
 * Writes via API routes (`/api/procurement/agreements`) — Firestore rules
 * block direct client writes; mutations go through Admin SDK with audit trail.
 *
 * @module hooks/procurement/useFrameworkAgreements
 * @see ADR-330 §3 Phase 5
 * @see ADR-300 — Stale-while-revalidate
 */

import { useState, useEffect, useCallback } from 'react';
import { where } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import type {
  FrameworkAgreement,
  CreateFrameworkAgreementDTO,
  UpdateFrameworkAgreementDTO,
} from '@/subapps/procurement/types/framework-agreement';

const logger = createModuleLogger('useFrameworkAgreements');

const agreementsCache = createStaleCache<FrameworkAgreement[]>('framework-agreements-list');

interface UseFrameworkAgreementsReturn {
  agreements: FrameworkAgreement[];
  loading: boolean;
  error: string | null;
  createAgreement: (dto: CreateFrameworkAgreementDTO) => Promise<FrameworkAgreement>;
  updateAgreement: (id: string, dto: UpdateFrameworkAgreementDTO) => Promise<FrameworkAgreement>;
  deleteAgreement: (id: string) => Promise<void>;
}

export function useFrameworkAgreements(): UseFrameworkAgreementsReturn {
  const { user, loading: authLoading } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;

  const [agreements, setAgreements] = useState<FrameworkAgreement[]>(
    agreementsCache.get() ?? [],
  );
  const [loading, setLoading] = useState(!agreementsCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError('AUTH_REQUIRED');
      return;
    }
    if (!companyId) {
      setLoading(false);
      setError('COMPANY_ID_UNAVAILABLE');
      return;
    }

    setLoading(!agreementsCache.hasLoaded());

    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown>>(
      'FRAMEWORK_AGREEMENTS',
      (result) => {
        const items = result.documents
          .map((d) => d as unknown as FrameworkAgreement)
          .filter((a) => a.isDeleted === false)
          .sort((a, b) => {
            const ta = (a.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
            const tb = (b.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
            return tb - ta;
          });

        agreementsCache.set(items);
        setAgreements(items);
        setLoading(false);
        setError(null);
        logger.info('Framework agreements loaded', { count: items.length });
      },
      (err) => {
        logger.error('Framework agreements subscription error', { error: err.message });
        setError('SUBSCRIPTION_ERROR');
        setLoading(false);
      },
      {
        // companyId auto-injected by firestoreQueryService (tenant-config default)
        constraints: [where('isDeleted', '==', false)],
      },
    );

    return unsubscribe;
  }, [authLoading, user, companyId]);

  const createAgreement = useCallback(
    async (dto: CreateFrameworkAgreementDTO): Promise<FrameworkAgreement> => {
      const res = await fetch('/api/procurement/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      return json.data as FrameworkAgreement;
    },
    [],
  );

  const updateAgreement = useCallback(
    async (id: string, dto: UpdateFrameworkAgreementDTO): Promise<FrameworkAgreement> => {
      const res = await fetch(`/api/procurement/agreements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      return json.data as FrameworkAgreement;
    },
    [],
  );

  const deleteAgreement = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/procurement/agreements/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
  }, []);

  return {
    agreements,
    loading,
    error,
    createAgreement,
    updateAgreement,
    deleteAgreement,
  };
}
