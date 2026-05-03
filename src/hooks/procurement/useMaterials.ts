'use client';

/**
 * useMaterials — Material Catalog hook (ADR-330 Phase 4)
 *
 * Reads via Firestore onSnapshot (live updates, ADR-300 stale cache).
 * Writes via API routes (`/api/procurement/materials`) — Firestore rules
 * block direct client writes; mutations go through Admin SDK with audit trail.
 *
 * @module hooks/procurement/useMaterials
 * @see ADR-330 §3 Phase 4
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
  Material,
  CreateMaterialDTO,
  UpdateMaterialDTO,
} from '@/subapps/procurement/types/material';

const logger = createModuleLogger('useMaterials');

const materialsCache = createStaleCache<Material[]>('materials-list');

interface UseMaterialsReturn {
  materials: Material[];
  loading: boolean;
  error: string | null;
  createMaterial: (dto: CreateMaterialDTO) => Promise<Material>;
  updateMaterial: (id: string, dto: UpdateMaterialDTO) => Promise<Material>;
  deleteMaterial: (id: string) => Promise<void>;
}

export function useMaterials(): UseMaterialsReturn {
  const { user, loading: authLoading } = useAuth();
  const companyResult = useCompanyId();
  const companyId = companyResult?.companyId;

  const [materials, setMaterials] = useState<Material[]>(materialsCache.get() ?? []);
  const [loading, setLoading] = useState(!materialsCache.hasLoaded());
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

    setLoading(!materialsCache.hasLoaded());

    const unsubscribe = firestoreQueryService.subscribe<Record<string, unknown>>(
      'MATERIALS',
      (result) => {
        const items = result.documents
          .map((d) => d as unknown as Material)
          .filter((m) => m.isDeleted === false)
          .sort((a, b) => {
            const ta = (a.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
            const tb = (b.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
            return tb - ta;
          });

        materialsCache.set(items);
        setMaterials(items);
        setLoading(false);
        setError(null);
        logger.info('Materials loaded', { count: items.length });
      },
      (err) => {
        logger.error('Materials subscription error', { error: err.message });
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

  const createMaterial = useCallback(async (dto: CreateMaterialDTO): Promise<Material> => {
    const res = await fetch('/api/procurement/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return json.data as Material;
  }, []);

  const updateMaterial = useCallback(
    async (id: string, dto: UpdateMaterialDTO): Promise<Material> => {
      const res = await fetch(`/api/procurement/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      return json.data as Material;
    },
    [],
  );

  const deleteMaterial = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/procurement/materials/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
  }, []);

  return {
    materials,
    loading,
    error,
    createMaterial,
    updateMaterial,
    deleteMaterial,
  };
}
