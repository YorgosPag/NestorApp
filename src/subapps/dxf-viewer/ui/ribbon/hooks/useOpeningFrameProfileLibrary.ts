'use client';

/**
 * ADR-676 Phase 3 PILOT — React hook for the Opening Frame Profile user
 * library. Mirrors `useMaterialLibrary.ts`, adapted for the subcollection
 * topology used by frame-profile presets: `ScopedLibraryService.subscribe()`
 * THROWS for `collectionRefFactory`-backed libraries (family-types /
 * stair-presets / this one), so loading is one-shot `list()` on service
 * change — same idiom as `useBimFamilyTypes.ts`.
 *
 * Every successful `listProfiles()` also pushes the merged, mapped set into
 * `useOpeningFrameProfileStore` (the resolver's non-React read path), so the
 * store and this hook's `profiles` never disagree.
 *
 * Service instance memoized per (companyId, userId, projectId).
 *
 * @see ../../../bim/family-types/opening-frame-profile-library-service.ts
 * @see ../../../bim/family-types/opening-frame-profile-store.ts
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createOpeningFrameProfileLibraryService,
  type OpeningFrameProfileLibraryService,
  type SaveFrameProfileInput,
  type UpdateFrameProfileInput,
} from '../../../bim/family-types/opening-frame-profile-library-service';
import { useOpeningFrameProfileStore } from '../../../bim/family-types/opening-frame-profile-store';
import {
  frameProfilePresetDocToProfile,
  type OpeningFrameProfilePresetDoc,
} from '../../../bim/types/opening-frame-profile';

export interface UseOpeningFrameProfileLibraryConfig {
  readonly companyId?: string;
  readonly userId?: string;
  readonly projectId?: string;
}

export interface UseOpeningFrameProfileLibraryResult {
  readonly profiles: readonly OpeningFrameProfilePresetDoc[];
  readonly loading: boolean;
  readonly error: Error | null;
  save(input: SaveFrameProfileInput): Promise<OpeningFrameProfilePresetDoc>;
  update(id: string, patch: UpdateFrameProfileInput): Promise<void>;
  remove(id: string): Promise<void>;
  refresh(): void;
}

export function useOpeningFrameProfileLibrary(
  cfg: UseOpeningFrameProfileLibraryConfig,
): UseOpeningFrameProfileLibraryResult {
  const { companyId, userId, projectId } = cfg;

  const [profiles, setProfilesState] = useState<readonly OpeningFrameProfilePresetDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const serviceRef = useRef<OpeningFrameProfileLibraryService | null>(null);
  const setStoreProfiles = useOpeningFrameProfileStore((s) => s.setProfiles);

  const service = useMemo(() => {
    if (!companyId || !userId) return null;
    const svc = createOpeningFrameProfileLibraryService({ companyId, userId, projectId });
    serviceRef.current = svc;
    return svc;
  }, [companyId, userId, projectId]);

  const load = useCallback(
    async (svc: OpeningFrameProfileLibraryService) => {
      setLoading(true);
      setError(null);
      try {
        const docs = await svc.listProfiles();
        setProfilesState(docs);
        setStoreProfiles(docs.map(frameProfilePresetDocToProfile));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [setStoreProfiles],
  );

  useEffect(() => {
    if (!service) {
      setProfilesState([]);
      setStoreProfiles([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      await load(service);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [service, load, setStoreProfiles]);

  const save = useCallback(
    async (input: SaveFrameProfileInput): Promise<OpeningFrameProfilePresetDoc> => {
      const svc = serviceRef.current;
      if (!svc) return Promise.reject(new Error('Service not ready'));
      const doc = await svc.saveProfile(input);
      await load(svc);
      return doc;
    },
    [load],
  );

  const update = useCallback(
    async (id: string, patch: UpdateFrameProfileInput): Promise<void> => {
      const svc = serviceRef.current;
      if (!svc) return Promise.reject(new Error('Service not ready'));
      await svc.updateProfile(id, patch);
      await load(svc);
    },
    [load],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const svc = serviceRef.current;
      if (!svc) return Promise.reject(new Error('Service not ready'));
      await svc.deleteProfile(id);
      await load(svc);
    },
    [load],
  );

  const refresh = useCallback(() => {
    const svc = serviceRef.current;
    if (!svc) return;
    svc.invalidateCache();
    void load(svc);
  }, [load]);

  return { profiles, loading, error, save, update, remove, refresh };
}
