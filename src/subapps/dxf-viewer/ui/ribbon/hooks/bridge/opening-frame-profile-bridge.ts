'use client';

/**
 * ADR-611 — Frame Profile (διατομή κάσας) ribbon bridge resolvers.
 *
 * Pure combobox resolvers for the opening «frame profile» editor: a
 * manufacturer Select (cascading filter, not itself persisted) + a
 * profile/series Select (writes `params.frameProfileId`) + two editable
 * numeric fields (`faceWidth` / `depth`, mm — writing
 * `params.frameProfileOverrides`). Extracted out of `useRibbonOpeningBridge`
 * so the hook stays under the 500-line GOL limit (N.7.1) — mirrors
 * `column-bridge-combobox-resolvers.ts` + `column-bridge-catalog-helpers.ts`
 * (catalog-profile-ID + `CATALOG_CUSTOM_SENTINEL` convention, ADR-611 §mirror).
 *
 * Manufacturer is a DERIVED UI concept (read from the resolved profile), not a
 * stored field — picking one immediately assigns that brand's first `frame`
 * profile (or its first entry), so both selects stay 100% computed from
 * `params` with zero extra client-only state to fall out of sync.
 *
 * Hand-editing `faceWidth`/`depth` flips `frameProfileId` to the shared
 * `CATALOG_CUSTOM_SENTINEL` (Revit «manual dim → section becomes Custom»),
 * seeding the overrides from the CURRENTLY resolved dims so only the edited
 * field actually changes.
 *
 * @see ../../../../bim/family-types/resolve-opening-frame-profile.ts — SSoT resolver
 * @see ../../../../bim/family-types/opening-frame-profile-catalog.ts — SSoT catalog
 * @see docs/centralized-systems/reference/adrs/ADR-611-opening-frame-profile.md
 */

import type { OpeningEntity, OpeningParams } from '../../../../bim/types/opening-types';
import { CATALOG_CUSTOM_SENTINEL } from '../../../../bim/types/opening-frame-profile';
import {
  listFrameProfiles,
  listFrameProfileManufacturers,
} from '../../../../bim/family-types/opening-frame-profile-catalog';
import { resolveOpeningFrameProfile } from '../../../../bim/family-types/resolve-opening-frame-profile';
import { OPENING_RIBBON_KEYS } from './opening-command-keys';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';

/** i18n key for the profile-select's «Custom» sentinel row. */
const CUSTOM_LABEL_KEY = 'ribbon.commands.openingEditor.frameProfile.custom';

/**
 * Resolve the combobox state for one of the 4 frame-profile keys. Returns
 * `null` for keys this resolver doesn't own (caller checks
 * `isOpeningFrameProfileKey` first).
 */
export function resolveOpeningFrameProfileComboboxState(
  commandKey: string,
  opening: OpeningEntity,
): RibbonComboboxState | null {
  // Params-only resolution (typeParams not available to a bridge that only
  // holds the entity) — the documented fallback, mirrors the pure geometry
  // function (`computeOpeningGeometry`) which resolves the same way.
  const resolved = resolveOpeningFrameProfile(opening.params);

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.manufacturer) {
    const options = listFrameProfileManufacturers().map((m) => ({
      value: m,
      labelKey: m,
      isLiteralLabel: true as const,
    }));
    return { value: resolved.manufacturer, options };
  }

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.profile) {
    const catalogOptions = listFrameProfiles(resolved.manufacturer).map((p) => ({
      value: p.id,
      labelKey: p.label ?? `${p.series} · ${p.role}`,
      isLiteralLabel: true as const,
    }));
    const customOption = {
      value: CATALOG_CUSTOM_SENTINEL,
      labelKey: CUSTOM_LABEL_KEY,
      isLiteralLabel: false as const,
    };
    return { value: resolved.id, options: [customOption, ...catalogOptions] };
  }

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.faceWidth) {
    return { value: String(Math.round(resolved.faceWidth)), options: [] };
  }

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.depth) {
    return { value: String(Math.round(resolved.depth)), options: [] };
  }

  return null;
}

/** Pick the manufacturer's default profile: prefer role `frame`, else its first entry. */
function firstProfileForManufacturer(manufacturer: string): string | null {
  const profiles = listFrameProfiles(manufacturer);
  const preferred = profiles.find((p) => p.role === 'frame') ?? profiles[0];
  return preferred?.id ?? null;
}

/**
 * Hand-edit one of the two CONSTANT cross-section dims (`faceWidth`/`depth`):
 * flips `frameProfileId` to the shared `CATALOG_CUSTOM_SENTINEL` (Revit
 * «manual dim → section becomes Custom») and patches only the edited field
 * into `frameProfileOverrides`, keeping any other override untouched.
 * Rejects non-finite / non-positive input (caller skips the dispatch).
 */
function applyDimensionOverride(
  opening: OpeningEntity,
  dim: 'faceWidth' | 'depth',
  value: string,
): OpeningParams | null {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return {
    ...opening.params,
    frameProfileId: CATALOG_CUSTOM_SENTINEL,
    frameProfileOverrides: { ...opening.params.frameProfileOverrides, [dim]: n },
  };
}

/**
 * Apply a frame-profile combobox change. Builds the next `OpeningParams`
 * patch, or `null` for an invalid/no-op edit (caller skips the dispatch).
 */
export function buildOpeningFrameProfileParamsPatch(
  commandKey: string,
  value: string,
  opening: OpeningEntity,
): OpeningParams | null {
  const resolved = resolveOpeningFrameProfile(opening.params);

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.manufacturer) {
    const nextProfileId = firstProfileForManufacturer(value);
    if (!nextProfileId) return null;
    return { ...opening.params, frameProfileId: nextProfileId, frameProfileOverrides: undefined };
  }

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.profile) {
    if (value === CATALOG_CUSTOM_SENTINEL) {
      // Seed the custom overrides from the currently resolved dims so
      // switching to «Custom» alone changes nothing visually yet.
      return {
        ...opening.params,
        frameProfileId: CATALOG_CUSTOM_SENTINEL,
        frameProfileOverrides: { faceWidth: resolved.faceWidth, depth: resolved.depth },
      };
    }
    return { ...opening.params, frameProfileId: value, frameProfileOverrides: undefined };
  }

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.faceWidth) {
    return applyDimensionOverride(opening, 'faceWidth', value);
  }

  if (commandKey === OPENING_RIBBON_KEYS.frameProfile.depth) {
    return applyDimensionOverride(opening, 'depth', value);
  }

  return null;
}
