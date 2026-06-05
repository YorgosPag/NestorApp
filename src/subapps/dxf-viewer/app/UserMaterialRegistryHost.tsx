'use client';

/**
 * ADR-413 §2D Phase 3 — always-on feeder for the 3D user-material registry.
 *
 * The `MaterialCatalog3D` reads `userMaterialRegistry` to render `bmat_*` library
 * materials (flat-by-category + uploaded PBR textures) on walls in 3D. The
 * registry must be fed regardless of whether the «Υλικά» library panel is open —
 * a wall can use a library material with the panel closed. So this null-rendering
 * host subscribes to `bim_materials` for the whole viewer lifetime and pushes
 * every change into the registry (`setUserMaterials`), which diffs + bumps the
 * shared 3D resync.
 *
 * Mirrors `RoofPersistenceHost` (always-on, zero high-frequency subscriptions →
 * ADR-040 CHECK 6B/6C compliant). Mounted in `DxfViewerTopBar`.
 *
 * @see ../bim-3d/materials/user-material-registry.ts — the registry it feeds
 * @see ../bim/services/MaterialLibraryService.ts — the Firestore subscription
 * @see docs/centralized-systems/reference/adrs/ADR-413-pbr-textures-parametric-bim.md
 */

import React from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { createMaterialLibraryService } from '../bim/services/MaterialLibraryService';
import { setUserMaterials } from '../bim-3d/materials/user-material-registry';

export interface UserMaterialRegistryHostProps {
  readonly projectId?: string;
}

export function UserMaterialRegistryHost({
  projectId,
}: UserMaterialRegistryHostProps): React.ReactElement | null {
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId;
  const userId = user?.uid;

  React.useEffect(() => {
    if (!companyId || !userId) return;
    const service = createMaterialLibraryService({ companyId, userId, projectId });
    const unsub = service.subscribeMaterials(
      (materials) => setUserMaterials(materials),
      () => {
        // Subscription error → leave the last-known registry contents in place
        // (walls keep their current appearance; flat fallback never crashes 3D).
      },
    );
    return unsub;
  }, [companyId, userId, projectId]);

  return null;
}
