'use client';

/**
 * ADR-358 §5.9 Q12 Phase 13B.2 — Cross-project Layer State Templates hook.
 *
 * Orchestrates the lifecycle of `DxfLayerStateTemplateService`:
 *   1. On mount (when `companyId` + `userId` are non-empty), constructs the
 *      service and injects it into `LayerStateStore` via
 *      `setLayerStateTemplateService(svc)` so the store's template mutations
 *      (`saveCurrentAsTemplate`, `importTemplateAsState`,
 *      `searchTemplateSummaries`) become available.
 *   2. On unmount — or when `companyId` / `userId` change — clears the
 *      injection (`setLayerStateTemplateService(null)`) and rebuilds.
 *
 * Categories list state: fetched lazily on `refreshCategories()` and on the
 * initial service mount. Hash-compared before `setState` to avoid re-render
 * loops on identical Firestore re-fetches (ADR-040 §XV pattern,
 * [[feedback_firestore_subscribe_equality_guard]]).
 *
 * Phase 13B.3 (next) — `LayerStateTemplateBrowser` modal + dropdown wiring
 * consume this hook only; the store + service are NOT touched outside this
 * orchestrator.
 *
 * Pre-commit ratchet `layer-state-system` allowlists this file + its test.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  saveCurrentAsTemplate as storeSaveCurrentAsTemplate,
  importTemplateAsState as storeImportTemplateAsState,
  searchTemplateSummaries as storeSearchTemplateSummaries,
  setLayerStateTemplateService,
} from '@/subapps/dxf-viewer/stores/LayerStateStore';
import {
  createDxfLayerStateTemplateService,
  type DxfLayerStateTemplateService,
  type SearchTemplatesQuery,
} from '@/services/dxf-layer-state-template.service';
import type {
  DxfTemplateCategory,
  LayerStateTemplate,
  LayerStateTemplateSummary,
} from '@/subapps/dxf-viewer/types/layer-state-template';

export interface UseLayerStateTemplatesInput {
  /** Tenant scope. Empty string → hook stays `isReady: false`. */
  readonly companyId: string;
  /** Author user id. Empty string → hook stays `isReady: false`. */
  readonly userId: string;
}

export interface UseLayerStateTemplatesResult {
  readonly isReady: boolean;
  readonly categories: ReadonlyArray<DxfTemplateCategory>;
  saveCurrentAsTemplate(input: {
    name: string;
    description?: string;
    category?: string;
    tags?: ReadonlyArray<string>;
    sourceStateId?: string;
  }): Promise<LayerStateTemplate>;
  importTemplateAsState(templateId: string): Promise<unknown>;
  searchTemplateSummaries(
    q?: SearchTemplatesQuery,
  ): Promise<readonly LayerStateTemplateSummary[]>;
  refreshCategories(): Promise<void>;
}

/**
 * Build a stable equality fingerprint for a category list. Order + value are
 * the only fields users observe via the dropdown, so the hash is intentionally
 * narrow — extra writes to `createdAt` from concurrent mutations do not
 * trigger re-render.
 */
function hashCategories(list: ReadonlyArray<DxfTemplateCategory>): string {
  return list.map((c) => `${c.id}:${c.value}`).join('|');
}

const EMPTY_CATEGORIES: ReadonlyArray<DxfTemplateCategory> = Object.freeze([]);

/**
 * Hook factory parameter — overridable in tests via `__opts.serviceFactory`
 * so unit tests inject a stub without touching the Firestore SDK.
 *
 * @internal Production callers omit `__opts`.
 */
export function useLayerStateTemplates(
  input: UseLayerStateTemplatesInput,
  __opts?: {
    readonly serviceFactory?: (cfg: {
      companyId: string;
      userId: string;
    }) => DxfLayerStateTemplateService;
  },
): UseLayerStateTemplatesResult {
  const { companyId, userId } = input;
  const factory = __opts?.serviceFactory ?? createDxfLayerStateTemplateService;
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  const serviceRef = useRef<DxfLayerStateTemplateService | null>(null);
  const categoriesHashRef = useRef<string>('');

  const [isReady, setIsReady] = useState(false);
  const [categories, setCategories] = useState<ReadonlyArray<DxfTemplateCategory>>(
    EMPTY_CATEGORIES,
  );

  // ─── Service lifecycle ─────────────────────────────────────────────────────
  // `factory` is intentionally excluded from deps — callers commonly pass
  // inline arrows; a new identity per render would tear down + rebuild the
  // service on every parent re-render. The ref captures the latest factory
  // for the next companyId/userId change.
  useEffect(() => {
    if (!companyId || !userId) {
      setIsReady(false);
      return;
    }
    const svc = factoryRef.current({ companyId, userId });
    serviceRef.current = svc;
    setLayerStateTemplateService(svc);
    setIsReady(true);
    return () => {
      setLayerStateTemplateService(null);
      serviceRef.current = null;
      categoriesHashRef.current = '';
      setIsReady(false);
      setCategories(EMPTY_CATEGORIES);
    };
  }, [companyId, userId]);

  // ─── Categories: equality-guarded setState ─────────────────────────────────
  const refreshCategories = useCallback(async (): Promise<void> => {
    const svc = serviceRef.current;
    if (!svc) return;
    const next = await svc.listCategories();
    const nextHash = hashCategories(next);
    if (nextHash === categoriesHashRef.current) return;
    categoriesHashRef.current = nextHash;
    setCategories(next);
  }, []);

  // Initial fetch once the service is wired up.
  useEffect(() => {
    if (!isReady) return;
    void refreshCategories();
  }, [isReady, refreshCategories]);

  // ─── Stable callbacks proxied to the store ────────────────────────────────
  const saveCurrentAsTemplate = useCallback<
    UseLayerStateTemplatesResult['saveCurrentAsTemplate']
  >(
    async (params) => {
      const created = await storeSaveCurrentAsTemplate(params);
      // Refresh categories so a newly-auto-created category surfaces in the UI.
      await refreshCategories();
      return created;
    },
    [refreshCategories],
  );

  const importTemplateAsState = useCallback<
    UseLayerStateTemplatesResult['importTemplateAsState']
  >((templateId) => storeImportTemplateAsState(templateId), []);

  const searchTemplateSummaries = useCallback<
    UseLayerStateTemplatesResult['searchTemplateSummaries']
  >((q) => storeSearchTemplateSummaries(q), []);

  return useMemo<UseLayerStateTemplatesResult>(
    () => ({
      isReady,
      categories,
      saveCurrentAsTemplate,
      importTemplateAsState,
      searchTemplateSummaries,
      refreshCategories,
    }),
    [
      isReady,
      categories,
      saveCurrentAsTemplate,
      importTemplateAsState,
      searchTemplateSummaries,
      refreshCategories,
    ],
  );
}
