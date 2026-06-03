'use client';

/**
 * useBimFamilyTypes — load adapter for the company's BIM family types (ADR-412).
 *
 * Owns:
 *   - `BimFamilyTypeService` instance lifecycle (memoized per
 *     `companyId|userId|projectId`, mirroring `useStairPresets`).
 *   - One-shot load on mount / id change: `listTypes()` → `setTypes()` populates
 *     the resolution store (`bim-family-type-store`).
 *   - `reload()` for explicit re-fetch after an external write (the writing UI
 *     also calls `service.invalidateCache()` so the next `listTypes()` is fresh).
 *
 * The store is the SSoT for resolution ("type always wins"): `getType` is the
 * stable store lookup and `types` is the reactive snapshot. Consumers re-resolve
 * by subscribing to the store's `version` counter (see `bim-family-type-store`).
 *
 * When `companyId`/`userId` are not yet ready, the hook is a no-op (no service,
 * no fetch) — entities without a `typeId` never need this store anyway.
 *
 * @see ./bim-family-type-service.ts
 * @see ./bim-family-type-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  createBimFamilyTypeService,
  type BimFamilyTypeService,
} from './bim-family-type-service';
import { useBimFamilyTypeStore } from './bim-family-type-store';
import { getAllBuiltInTypes } from './built-in-types';
import type { BimFamilyType } from '../types/bim-family-type';

export interface UseBimFamilyTypesProps {
  readonly companyId: string | null | undefined;
  readonly userId: string | null | undefined;
  readonly projectId?: string;
}

export interface UseBimFamilyTypesResult {
  /** Reactive snapshot of the loaded catalog (re-renders on content change). */
  readonly types: readonly BimFamilyType[];
  /** Stable resolution lookup. Returns `null` for an unknown id. */
  readonly getType: (id: string) => BimFamilyType | null;
  /** Re-fetch from Firestore and repopulate the store. */
  readonly reload: () => Promise<void>;
}

export function useBimFamilyTypes(
  props: UseBimFamilyTypesProps,
): UseBimFamilyTypesResult {
  const { companyId, userId, projectId } = props;

  const setTypes = useBimFamilyTypeStore((s) => s.setTypes);
  const getType = useBimFamilyTypeStore((s) => s.getType);
  // Reactive: re-renders when the catalog content changes (version bump).
  const byId = useBimFamilyTypeStore((s) => s.byId);
  const types = useMemo(() => Array.from(byId.values()), [byId]);

  const service: BimFamilyTypeService | null = useMemo(
    () =>
      companyId && userId
        ? createBimFamilyTypeService({ companyId, userId, projectId })
        : null,
    [companyId, userId, projectId],
  );

  // Held in a ref so `reload` stays referentially stable across the service's
  // own cache mutations while always invoking the current instance.
  const serviceRef = useRef<BimFamilyTypeService | null>(service);
  serviceRef.current = service;

  // Merge helper: built-ins first (lower priority overridden by user/company/project
  // types that share the same id — in practice ids never collide because built-ins
  // use the fixed 'bimftype-builtin-*' synthetic ids). A Map with duplicate keys
  // keeps the last write, so iterating built-ins then fetched gives fetched the win.
  const mergeWithBuiltIns = useCallback(
    (fetched: readonly BimFamilyType[]): readonly BimFamilyType[] => {
      if (!companyId) return fetched;
      const builtIns = getAllBuiltInTypes(companyId);
      // Deduplicate by id: built-ins first, fetched types overwrite on collision.
      const byId = new Map<string, BimFamilyType>();
      for (const t of builtIns) byId.set(t.id, t);
      for (const t of fetched) byId.set(t.id, t);
      return Array.from(byId.values());
    },
    [companyId],
  );

  const reload = useCallback(async () => {
    const svc = serviceRef.current;
    if (!svc) return;
    const fetched = await svc.listTypes();
    setTypes(mergeWithBuiltIns(fetched));
  }, [setTypes, mergeWithBuiltIns]);

  // Seed built-ins immediately when companyId is known (no network round-trip).
  // The subsequent fetch will re-merge, which is idempotent thanks to the store's
  // dequal guard — no extra version bump if built-ins are unchanged.
  useEffect(() => {
    if (!companyId) return;
    setTypes(getAllBuiltInTypes(companyId));
  }, [companyId, setTypes]);

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    void (async () => {
      const fetched = await service.listTypes();
      if (!cancelled) setTypes(mergeWithBuiltIns(fetched));
    })();
    return () => {
      cancelled = true;
    };
  }, [service, setTypes, mergeWithBuiltIns]);

  return { types, getType, reload };
}
