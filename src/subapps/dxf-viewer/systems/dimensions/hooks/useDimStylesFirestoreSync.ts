'use client';

import { useEffect } from 'react';
import { type DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { QueryResult } from '@/services/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { getDimStyleRegistry } from '../dim-style-registry';
import type { DimStyle } from '../../../types/dimension';

const logger = createModuleLogger('DxfDimStylesSync');

interface UseDimStylesFirestoreSyncParams {
  enableFirestore: boolean;
  /** companyId from Firebase custom claims — required for tenant-scoped read */
  companyId: string | null | undefined;
  /** true when user has globalRole == 'super_admin' in their JWT */
  isSuperAdmin: boolean;
}

/** Persisted document shape (see `dxf-dimension-styles.handlers.ts`). */
interface DimStyleSyncDoc {
  id: string;
  name: string;
  isDefault?: boolean;
  isBuiltInRef?: boolean;
  style?: Record<string, unknown> | null;
}

/**
 * ADR-362 Phase F4 — real-time Firestore sync for the per-company DIMSTYLE
 * collection. Mirrors `useLevelsFirestoreSync` (ADR-355 SSOT):
 *   - Tenant filter (where companyId == effectiveCompanyId) auto-applied
 *   - Super-admin switcher re-subscription auto-handled (ADR-354)
 *   - Same-content snapshot suppression enforced in the service (ADR-361)
 *
 * From every delivery this hook:
 *   (a) hydrates the CUSTOM styles (isBuiltInRef !== true) into the in-memory
 *       registry keyed by their DB id (`hydrateCustomStyles`), and
 *   (b) resolves the company default: the single doc with `isDefault === true`
 *       drives `setActiveStyleId(doc.id)` — for a built-in-ref doc the stored
 *       `id` field is the built-in slug (already in the registry); for a custom
 *       doc it is the just-hydrated style id. When NO doc is default the active
 *       style is left untouched → the Nestor green code default stands.
 *
 * ADR-040: writes only to the registry singleton (zero React state), so it never
 * drives orchestrator re-renders.
 */
export function useDimStylesFirestoreSync({
  enableFirestore,
  companyId,
  isSuperAdmin,
}: UseDimStylesFirestoreSyncParams): void {
  useEffect(() => {
    if (!enableFirestore) return;
    if (!isSuperAdmin && !companyId) return;

    const unsubscribe = firestoreQueryService.subscribe<DocumentData>(
      'DXF_DIMENSION_STYLES',
      (result: QueryResult<DocumentData>) => {
        try {
          const docs = result.documents as unknown as DimStyleSyncDoc[];
          const registry = getDimStyleRegistry();

          // (a) Hydrate custom styles (skip thin built-in-ref pointer docs).
          const customStyles: DimStyle[] = docs
            .filter((d) => d.isBuiltInRef !== true)
            .map((d) => ({
              ...(d.style ?? {}),
              id: d.id,
              name: d.name,
              isBuiltIn: false,
            }) as DimStyle);
          registry.hydrateCustomStyles(customStyles);

          // (b) Resolve the per-company default pointer.
          const defaultDoc = docs.find((d) => d.isDefault === true);
          if (defaultDoc && registry.getStyle(defaultDoc.id)) {
            registry.setActiveStyleId(defaultDoc.id);
          }
          // No default doc → leave the active style (Nestor code default) as-is.
        } catch (err) {
          logger.error('[DxfDimStyles/Sync] Failed to apply snapshot', { error: err });
        }
      },
      (err) => {
        logger.error('[DxfDimStyles/Sync] Firestore error', { error: err.message });
      },
    );

    return () => unsubscribe();
  }, [enableFirestore, companyId, isSuperAdmin]);
}
