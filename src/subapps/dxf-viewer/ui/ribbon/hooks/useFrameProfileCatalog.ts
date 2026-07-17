'use client';

/**
 * useFrameProfileCatalog — builds the grouped (builtin / library / custom)
 * frame-profile option list for the ADR-676 Phase 3 PILOT ribbon widget.
 *
 * Wires the same scope SSoT as `useOpeningMaterialCatalog` (`useAuth`
 * companyId/userId + the dxf-viewer `saveContext.projectId` idiom) into
 * `useOpeningFrameProfileLibrary`, whose sole job is to load the user's
 * saved presets into `useOpeningFrameProfileStore` — the non-React read path
 * the resolver/bridge already consume via `opening-frame-profile-lookup.ts`.
 *
 * This hook does NOT re-merge builtin + library itself: it delegates to
 * `listMergedFrameProfiles` (the merge-lookup SSoT, N.18) and only adds the
 * UI-only grouping (which optgroup an id renders under) + the trailing
 * `custom` sentinel row.
 *
 * @see ./useOpeningMaterialCatalog.ts — sibling scope-wiring idiom
 * @see ./useOpeningFrameProfileLibrary.ts — loads the user library into the store
 * @see ../../../bim/family-types/opening-frame-profile-lookup.ts — the merge SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-676-opening-component-library.md
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/hooks/useAuth';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useOpeningFrameProfileLibrary } from './useOpeningFrameProfileLibrary';
import { useOpeningFrameProfileStore } from '../../../bim/family-types/opening-frame-profile-store';
import { FRAME_PROFILE_CATALOG } from '../../../bim/family-types/opening-frame-profile-catalog';
import { listMergedFrameProfiles } from '../../../bim/family-types/opening-frame-profile-lookup';
import { CATALOG_CUSTOM_SENTINEL } from '../../../bim/types/opening-frame-profile';

/** i18n key for the profile-select's «Custom» sentinel row (mirrors the bridge). */
const CUSTOM_LABEL_KEY = 'ribbon.commands.openingEditor.frameProfile.custom';

export type FrameProfileOptionGroup = 'builtin' | 'library' | 'custom';

export interface FrameProfileOption {
  /** Persisted `frameProfileId` value, or the `CATALOG_CUSTOM_SENTINEL`. */
  readonly id: string;
  readonly group: FrameProfileOptionGroup;
  readonly label: string;
}

export interface FrameProfileCatalogProvider {
  /** All selectable options in display order (builtin → library → custom). */
  listFrameProfileOptions(): readonly FrameProfileOption[];
}

/** Builtin catalog ids — distinguishes `builtin` vs `library` in the merged list. */
const BUILTIN_IDS: ReadonlySet<string> = new Set(FRAME_PROFILE_CATALOG.map((p) => p.id));

export function useFrameProfileCatalog(): FrameProfileCatalogProvider {
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();
  const levels = useLevelsOptional();
  const companyId = user?.companyId ?? undefined;
  const userId = user?.uid ?? undefined;
  const projectId = levels?.saveContext?.projectId ?? undefined;

  // Ensures the user's saved presets are loaded into the store (the resolver
  // and bridge read them via the merge-lookup SSoT, not via this hook).
  useOpeningFrameProfileLibrary({ companyId, userId, projectId });
  const storeVersion = useOpeningFrameProfileStore((s) => s.version);

  return useMemo<FrameProfileCatalogProvider>(() => {
    const merged = listMergedFrameProfiles();
    const options: readonly FrameProfileOption[] = [
      ...merged.map((p) => ({
        id: p.id,
        group: (BUILTIN_IDS.has(p.id) ? 'builtin' : 'library') as FrameProfileOptionGroup,
        label: p.label ?? `${p.series} · ${p.role}`,
      })),
      { id: CATALOG_CUSTOM_SENTINEL, group: 'custom' as const, label: t(CUSTOM_LABEL_KEY) },
    ];
    return { listFrameProfileOptions: () => options };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storeVersion is the change signal for listMergedFrameProfiles' user-library half
  }, [storeVersion, t]);
}
