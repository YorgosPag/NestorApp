/**
 * OpeningFrameProfileStore — Zustand store for the actor's loaded user/company/
 * project frame-profile presets (ADR-676 Phase 3 PILOT). Mirrors
 * `bim-family-type-store.ts` exactly: holds the resolution cache consumed by
 * `resolve-opening-frame-profile.ts` (via the merge-lookup SSoT,
 * `opening-frame-profile-lookup.ts`) so a saved preset resolves onto placed
 * κουφώματα the same way a builtin catalog entry does — "library always
 * available" (same idiom as the family-type "type always wins" pattern).
 *
 * `useOpeningFrameProfileLibrary` (the ribbon hook) is the sole writer
 * (load → `setProfiles`). Non-React readers (resolver, bridge) use the sync
 * accessors below instead of subscribing to the store directly.
 *
 * @see ./opening-frame-profile-library-service.ts
 * @see ../../ui/ribbon/hooks/useOpeningFrameProfileLibrary.ts
 * @see ./opening-frame-profile-lookup.ts
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library.md
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { dequal } from 'dequal';
import type { OpeningFrameProfile } from '../types/opening-frame-profile';

export interface OpeningFrameProfileStoreState {
  /** All loaded user-library profiles, keyed by id. The resolution lookup table. */
  readonly byId: ReadonlyMap<string, OpeningFrameProfile>;
  /**
   * Monotonic counter bumped on every content change. Consumers subscribe to
   * this to re-run resolution (re-flow saved-preset edits onto placed
   * instances) without diffing the whole map.
   */
  readonly version: number;
  /** Replaces the entire loaded set. Idempotent: identical content = no notify. */
  setProfiles(profiles: readonly OpeningFrameProfile[]): void;
  /** Resolution lookup. Returns `null` when the id is unknown. */
  getProfile(id: string): OpeningFrameProfile | null;
  /** Snapshot of the current set as a flat list. */
  getProfiles(): readonly OpeningFrameProfile[];
}

function buildById(
  profiles: readonly OpeningFrameProfile[],
): ReadonlyMap<string, OpeningFrameProfile> {
  const map = new Map<string, OpeningFrameProfile>();
  for (const profile of profiles) map.set(profile.id, profile);
  return map;
}

export const useOpeningFrameProfileStore = create<OpeningFrameProfileStoreState>()(
  subscribeWithSelector((set, get) => ({
    byId: new Map<string, OpeningFrameProfile>(),
    version: 0,
    setProfiles: (profiles) =>
      set((s) => {
        // Idempotent bail: a re-load maps the same docs to fresh references, so
        // compare by value — skip the notify (and the version bump) so
        // resolution subscribers don't re-run on identical data.
        const nextById = buildById(profiles);
        if (dequal(Array.from(s.byId.values()), Array.from(nextById.values()))) {
          return s;
        }
        return { byId: nextById, version: s.version + 1 };
      }),
    getProfile: (id) => get().byId.get(id) ?? null,
    getProfiles: () => Array.from(get().byId.values()),
  })),
);

/**
 * Sync resolution lookup for non-React readers (resolver / bridge). Returns
 * `null` when the id is unknown — callers fold this into the builtin catalog
 * via `opening-frame-profile-lookup.ts`, never re-implementing the merge here.
 */
export function getUserFrameProfileById(id: string): OpeningFrameProfile | null {
  return useOpeningFrameProfileStore.getState().getProfile(id);
}

/** Sync flat-list snapshot of the loaded user-library profiles. */
export function listUserFrameProfiles(): readonly OpeningFrameProfile[] {
  return useOpeningFrameProfileStore.getState().getProfiles();
}
