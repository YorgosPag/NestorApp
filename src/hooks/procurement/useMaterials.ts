'use client';

/**
 * useMaterials — Material Catalog hook (ADR-330 Phase 4)
 *
 * Reads via `useProcurementCatalogList` (ADR-355 SSoT, ADR-361 equality-guarded; ADR-300 stale cache).
 * Writes via API routes (`/api/procurement/materials`) — Firestore rules
 * block direct client writes; mutations go through Admin SDK with audit trail.
 *
 * @module hooks/procurement/useMaterials
 * @see ADR-330 §3 Phase 4
 * @see ADR-300 — Stale-while-revalidate
 */

import { API_ROUTES } from '@/config/domain-constants';
import { procurementCatalogApi } from './procurement-catalog-api';
import { useProcurementCatalogList, type ProcurementCatalogListConfig } from './useProcurementCatalogList';
import { createModuleLogger } from '@/lib/telemetry';
import { createStaleCache } from '@/lib/stale-cache';
import type {
  Material,
  CreateMaterialDTO,
  UpdateMaterialDTO,
} from '@/subapps/procurement/types/material';

function createdSeconds(material: Material): number {
  return (material.createdAt as unknown as { seconds?: number })?.seconds ?? 0;
}

const materialsList: ProcurementCatalogListConfig<Material> = {
  collection: 'MATERIALS',
  cache: createStaleCache<Material[]>('materials-list'),
  compare: (a, b) => createdSeconds(b) - createdSeconds(a),
  logger: createModuleLogger('useMaterials'),
  label: 'Materials',
};

const materialsApi = procurementCatalogApi<Material, CreateMaterialDTO, UpdateMaterialDTO>(
  API_ROUTES.PROCUREMENT.MATERIALS,
  API_ROUTES.PROCUREMENT.MATERIAL_BY_ID,
);

interface UseMaterialsReturn {
  materials: Material[];
  loading: boolean;
  error: string | null;
  createMaterial: (dto: CreateMaterialDTO) => Promise<Material>;
  updateMaterial: (id: string, dto: UpdateMaterialDTO) => Promise<Material>;
  deleteMaterial: (id: string) => Promise<void>;
}

export function useMaterials(): UseMaterialsReturn {
  const { items, loading, error } = useProcurementCatalogList(materialsList);
  return {
    materials: items,
    loading,
    error,
    createMaterial: materialsApi.create,
    updateMaterial: materialsApi.update,
    deleteMaterial: materialsApi.remove,
  };
}
