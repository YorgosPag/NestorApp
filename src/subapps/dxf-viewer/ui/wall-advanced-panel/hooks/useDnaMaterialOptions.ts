'use client';

import { useMemo } from 'react';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useAuth } from '@/auth/hooks/useAuth';
import { useMaterialLibrary } from '../../panels/materials/hooks/useMaterialLibrary';
import type { BimMaterial, BimMaterialCategory } from '../../../bim/types/bim-material-types';

const WALL_RELEVANT_CATEGORIES: ReadonlySet<BimMaterialCategory> = new Set<BimMaterialCategory>([
  'plaster', 'masonry', 'concrete', 'insulation',
]);

export interface UseDnaMaterialOptionsResult {
  readonly libraryMaterials: readonly BimMaterial[];
  readonly libraryLoading: boolean;
}

export function useDnaMaterialOptions(
  { projectId }: { projectId?: string },
): UseDnaMaterialOptionsResult {
  const { user } = useAuth();
  const companyResult = useCompanyId();
  const { materials, loading } = useMaterialLibrary({
    companyId: companyResult?.companyId,
    userId: user?.uid,
    projectId,
  });
  const libraryMaterials = useMemo(
    () => materials.filter((m) => WALL_RELEVANT_CATEGORIES.has(m.category)),
    [materials],
  );
  return { libraryMaterials, libraryLoading: loading };
}
