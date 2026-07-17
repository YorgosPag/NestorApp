/**
 * Opening Material Catalog SSoT (κάσα/φύλλο/υαλοστάσιο/χειρολαβή surfaces).
 *
 * Mirrors `wall-material-catalog.ts` (ADR-363) / `stair-material-catalog.ts`
 * (ADR-358): one categorized material-library picker per domain + custom
 * override — the Revit/ArchiCAD material-browser pattern. Centralizes the
 * opening-surface preset list that previously lived hardcoded inside
 * `OpeningMaterialSelectCell.tsx` (N.0.2 Boy Scout — SSoT gap closed).
 *
 * Opening surfaces persist REAL ids: the shared `MATERIAL_DEFS` catalog presets
 * (`material-catalog-defs.ts`) — `mat-wood` (κάσα/φύλλο), `mat-metal`
 * (χειρολαβή/αλουμίνιο), `mat-glass` (υαλοστάσιο) — **or** a company/project
 * user-library id (`bmat_*`) from the `BimMaterial` registry (ADR-363 §Q8).
 *
 * The `OpeningMaterialCatalogProvider` is the Asset-Manager swap seam (ADR-672
 * §8): `defaultOpeningMaterialCatalog` lists presets only (SSR/test-safe, no
 * data source), while `createOpeningMaterialCatalog(library)` builds the real
 * provider that lists the `companyId`-scoped `bmat_*` materials alongside the
 * presets. Both share ONE option model + ONE classifier — no duplication.
 *
 * IDs persist on `OpeningMaterials.{frame,leaf,glass,hardware}` (opening-types.ts)
 * and are resolved by `resolveOpeningMaterial`, which treats every part as an
 * opaque id string — so a library id round-trips untouched through the whole
 * pipeline (2Δ/3Δ/export). Preset labels resolve via
 * `t('ribbon.commands.bimFamilyType.<labelKeySuffix>')`; library labels are the
 * material's own name (raw string).
 *
 * `'custom'` is the sentinel that triggers the free-form text input; the value
 * persisted is the typed string (NOT `'custom'`), so an id that is neither a
 * preset nor in the current library (legacy / cross-company) still round-trips.
 *
 * @see bim/family-types/resolve-opening-material.ts — the resolver these ids feed
 * @see ui/ribbon/hooks/useOpeningMaterialCatalog.ts — builds the library-backed provider
 * @see bim/walls/wall-material-catalog.ts — sibling catalog idiom
 */

import type { BimMaterialCategory } from '../types/bim-material-types';

/** Opening-surface `mat-*` ids already registered in `MATERIAL_DEFS`. */
export const OPENING_MATERIAL_PRESET_IDS = ['mat-wood', 'mat-metal', 'mat-glass'] as const;

export type OpeningMaterialPresetId = (typeof OPENING_MATERIAL_PRESET_IDS)[number];

export const OPENING_MATERIAL_CUSTOM_ID = 'custom' as const;
export type OpeningMaterialCustomId = typeof OPENING_MATERIAL_CUSTOM_ID;

/** i18n key suffix (under `ribbon.commands.bimFamilyType.`) per preset id. */
const PRESET_LABEL_KEY: Readonly<Record<OpeningMaterialPresetId, string>> = {
  'mat-wood': 'materialPresetWood',
  'mat-metal': 'materialPresetMetal',
  'mat-glass': 'materialPresetGlass',
};

/**
 * Which `<optgroup>` an option belongs to. `preset`/`custom` render an i18n
 * label (`labelKeySuffix`); `library` renders the material's raw `label`.
 */
export type OpeningMaterialOptionGroup = 'preset' | 'library' | 'custom';

/** Appearance fields forwarded to `MaterialSwatch` for a library option. */
export interface OpeningMaterialSwatchInfo {
  readonly category?: BimMaterialCategory;
  readonly thumbnailUrl?: string | null;
  readonly albedoUrl?: string | null;
}

export interface OpeningMaterialOption {
  /** Stable persisted id (`mat-*` / `bmat_*`) or the `'custom'` sentinel. */
  readonly id: string;
  /** Which optgroup the option renders under. */
  readonly group: OpeningMaterialOptionGroup;
  /** i18n key suffix under `ribbon.commands.bimFamilyType.<suffix>` (preset/custom). */
  readonly labelKeySuffix?: string;
  /** Raw display name (library options — the material's own name). */
  readonly label?: string;
  /** Swatch appearance for library options (thumbnail/albedo/category). */
  readonly swatch?: OpeningMaterialSwatchInfo;
}

/**
 * A user-library material reduced to what the picker needs — the decoupling
 * boundary between the material registry (`BimMaterial`) and this catalog. The
 * `useOpeningMaterialCatalog` hook maps `BimMaterial` → this shape.
 */
export interface OpeningMaterialLibraryEntry {
  readonly id: string;
  readonly label: string;
  readonly category?: BimMaterialCategory;
  readonly thumbnailUrl?: string | null;
  readonly albedoUrl?: string | null;
}

/**
 * Provider abstraction — the Asset-Manager swap seam (mirrors wall/stair).
 * `defaultOpeningMaterialCatalog` lists presets only; a library-backed provider
 * from `createOpeningMaterialCatalog` also lists `bmat_*` user-library ids.
 */
export interface OpeningMaterialCatalogProvider {
  /** All selectable options in display order (presets → library → custom sentinel). */
  readonly listMaterialIds: () => readonly OpeningMaterialOption[];
  /** Resolve a persisted id to its preset, or `null` when free-form (library/custom). */
  readonly resolvePreset: (id: string | undefined) => OpeningMaterialPresetId | null;
}

const PRESET_OPTIONS: readonly OpeningMaterialOption[] = OPENING_MATERIAL_PRESET_IDS.map((id) => ({
  id,
  group: 'preset',
  labelKeySuffix: PRESET_LABEL_KEY[id],
}));

const CUSTOM_OPTION: OpeningMaterialOption = {
  id: OPENING_MATERIAL_CUSTOM_ID,
  group: 'custom',
  labelKeySuffix: 'materialPresetCustom',
};

const PRESET_SET: ReadonlySet<string> = new Set<string>(OPENING_MATERIAL_PRESET_IDS);

function resolvePresetId(id: string | undefined): OpeningMaterialPresetId | null {
  if (!id) return null;
  return PRESET_SET.has(id) ? (id as OpeningMaterialPresetId) : null;
}

/** Presets-only provider — SSR/test-safe fallback (no data source). */
export const defaultOpeningMaterialCatalog: OpeningMaterialCatalogProvider = {
  listMaterialIds: () => [...PRESET_OPTIONS, CUSTOM_OPTION],
  resolvePreset: resolvePresetId,
};

/**
 * Builds the real library-backed provider (ADR-672 §8): presets → user-library
 * `bmat_*` materials → custom sentinel. A library id that collides with a preset
 * is skipped (preset wins — the shared DNA catalog is canonical for `mat-*`).
 */
export function createOpeningMaterialCatalog(
  library: readonly OpeningMaterialLibraryEntry[],
): OpeningMaterialCatalogProvider {
  const libraryOptions: readonly OpeningMaterialOption[] = library
    .filter((m) => !PRESET_SET.has(m.id))
    .map((m) => ({
      id: m.id,
      group: 'library' as const,
      label: m.label,
      swatch: { category: m.category, thumbnailUrl: m.thumbnailUrl, albedoUrl: m.albedoUrl },
    }));
  const options: readonly OpeningMaterialOption[] = [
    ...PRESET_OPTIONS,
    ...libraryOptions,
    CUSTOM_OPTION,
  ];
  return {
    listMaterialIds: () => options,
    resolvePreset: resolvePresetId,
  };
}

/** Finds the listed option for a persisted id (preset or library), else `undefined`. */
export function findOpeningMaterialOption(
  id: string | undefined,
  catalog: OpeningMaterialCatalogProvider = defaultOpeningMaterialCatalog,
): OpeningMaterialOption | undefined {
  if (!id) return undefined;
  return catalog.listMaterialIds().find((o) => o.group !== 'custom' && o.id === id);
}

/**
 * Classifies a persisted opening-material id for UI rendering:
 * - `listed` — id is a preset OR a current library material → render the select
 *   value slot with its label + a `MaterialSwatch` chip
 * - `custom` — id set but not in the catalog (legacy / cross-company / free-form)
 *   → render the free-form text input pre-filled with the raw string
 * - `empty`  — no material set (cleared → part falls back to resolver default)
 */
export type OpeningMaterialKind = 'listed' | 'custom' | 'empty';

export function classifyOpeningMaterial(
  id: string | undefined,
  catalog: OpeningMaterialCatalogProvider = defaultOpeningMaterialCatalog,
): OpeningMaterialKind {
  if (id === undefined || id === '') return 'empty';
  return findOpeningMaterialOption(id, catalog) ? 'listed' : 'custom';
}
