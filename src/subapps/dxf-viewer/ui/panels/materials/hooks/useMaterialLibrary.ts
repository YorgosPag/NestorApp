'use client';

/**
 * ADR-363 Phase 6.5.B — React hook για Material Library.
 * Wraps MaterialLibraryService με live subscription + equality guard.
 * Service instance memoized per (companyId, userId, projectId).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  createMaterialLibraryService,
  type MaterialLibraryService,
} from '../../../../bim/services/MaterialLibraryService';
import type {
  BimMaterial,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../../bim/types/bim-material-types';

interface UseMaterialLibraryConfig {
  companyId: string | undefined;
  userId: string | undefined;
  projectId?: string;
}

export interface UseMaterialLibraryResult {
  materials: readonly BimMaterial[];
  loading: boolean;
  error: Error | null;
  save: (input: SaveBimMaterialInput) => Promise<BimMaterial>;
  update: (id: string, patch: UpdateBimMaterialPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => void;
}

export function useMaterialLibrary({
  companyId,
  userId,
  projectId,
}: UseMaterialLibraryConfig): UseMaterialLibraryResult {
  const [materials, setMaterials] = useState<readonly BimMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const serviceRef = useRef<MaterialLibraryService | null>(null);

  const service = useMemo(() => {
    if (!companyId || !userId) return null;
    const svc = createMaterialLibraryService({ companyId, userId, projectId });
    serviceRef.current = svc;
    return svc;
  }, [companyId, userId, projectId]);

  useEffect(() => {
    if (!service) {
      setMaterials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = service.subscribeMaterials((mats) => {
      setMaterials(mats);
      setLoading(false);
    });
    return unsub;
  }, [service]);

  const save = useCallback(
    (input: SaveBimMaterialInput): Promise<BimMaterial> => {
      if (!service) return Promise.reject(new Error('Service not ready'));
      return service.saveMaterial(input);
    },
    [service],
  );

  const update = useCallback(
    (id: string, patch: UpdateBimMaterialPatch): Promise<void> => {
      if (!service) return Promise.reject(new Error('Service not ready'));
      return service.updateMaterial(id, patch);
    },
    [service],
  );

  const remove = useCallback(
    (id: string): Promise<void> => {
      if (!service) return Promise.reject(new Error('Service not ready'));
      return service.deleteMaterial(id);
    },
    [service],
  );

  const refresh = useCallback(() => {
    serviceRef.current?.invalidateCache();
  }, []);

  return { materials, loading, error, save, update, remove, refresh };
}
