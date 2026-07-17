'use client';

/**
 * useOpeningMaterialCatalog — builds the library-backed opening-material picker
 * provider (ADR-672 §8 follow-up Β).
 *
 * Wires the existing scope SSoT (`useAuth` companyId/userId + the dxf-viewer
 * `saveContext.projectId` idiom, mirror of stair/topography persistence) into
 * the existing `useMaterialLibrary` subscription, then maps the resulting
 * `BimMaterial[]` onto the catalog seam via `createOpeningMaterialCatalog`. The
 * `EditOpeningTypeDialog` cells thus list the company/project `bmat_*` materials
 * in a dropdown (with swatch) instead of accepting them only as free text.
 *
 * Falls back to the presets-only `defaultOpeningMaterialCatalog` while the scope
 * is not yet resolved (no company/user) — the dialog still works offline/SSR.
 *
 * @see ../../../bim/family-types/opening-material-catalog.ts — the provider seam
 * @see ../../panels/materials/hooks/useMaterialLibrary.ts — the library subscription
 */

import { useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useMaterialLibrary } from '../../panels/materials/hooks/useMaterialLibrary';
import {
  createOpeningMaterialCatalog,
  defaultOpeningMaterialCatalog,
  type OpeningMaterialCatalogProvider,
  type OpeningMaterialLibraryEntry,
} from '../../../bim/family-types/opening-material-catalog';

export function useOpeningMaterialCatalog(): OpeningMaterialCatalogProvider {
  const { user } = useAuth();
  const levels = useLevelsOptional();
  const companyId = user?.companyId ?? undefined;
  const userId = user?.uid ?? undefined;
  const projectId = levels?.saveContext?.projectId ?? undefined;

  const { materials } = useMaterialLibrary({ companyId, userId, projectId });

  return useMemo<OpeningMaterialCatalogProvider>(() => {
    if (materials.length === 0) return defaultOpeningMaterialCatalog;
    const entries: readonly OpeningMaterialLibraryEntry[] = materials.map((m) => ({
      id: m.id,
      label: m.nameEl || m.nameEn,
      category: m.category,
      thumbnailUrl: m.thumbnailUrl,
      albedoUrl: m.pbrTextures?.albedoUrl ?? null,
    }));
    return createOpeningMaterialCatalog(entries);
  }, [materials]);
}
