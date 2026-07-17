'use client';

/**
 * OpeningMaterialSelectCell — per-part material picker for the opening TYPE
 * edit dialog (frame / leaf / glass / hardware surfaces — Revit/ArchiCAD
 * "family surfaces" model).
 *
 * Mirrors `StairMaterialSelectCell` (ADR-358 Q19 Φ5/Φ7): a preset `<select>` +
 * free-form custom `<input>`, emitting `string | undefined` (`undefined` =
 * cleared → the part falls back to `resolveOpeningMaterial`'s default). Unlike
 * stairs, opening parts persist ids from the shared `mat-*` DNA catalog
 * (`material-catalog-defs.ts`) OR a company/project user-library `bmat_*` id
 * (`OpeningMaterials`, opening-types.ts) — so this cell renders a `MaterialSwatch`
 * chip (ADR-413 §2D) next to the select, reusing the SAME swatch primitive the
 * wall DNA / slab / roof / materials-library pickers use.
 *
 * The selectable options come from an `OpeningMaterialCatalogProvider`
 * (`opening-material-catalog.ts`): `defaultOpeningMaterialCatalog` lists presets
 * only, while the dialog passes the library-backed provider from
 * `useOpeningMaterialCatalog` — grouping presets, the company/project `bmat_*`
 * library, and the custom sentinel under `<optgroup>`s (ADR-672 §8 Β). An id that
 * is neither a preset nor in the current library still round-trips through the
 * custom text input (the resolver treats every part as an opaque id string).
 *
 * @see ../../../bim/family-types/opening-material-catalog.ts — the option SSoT + seam
 * @see ../hooks/useOpeningMaterialCatalog.ts — the library-backed provider
 * @see ./EditOpeningTypeDialog.tsx — sole consumer (4 rows: frame/leaf/glass/hardware)
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MaterialSwatch } from '../../components/shared/MaterialSwatch';
import {
  OPENING_MATERIAL_CUSTOM_ID,
  classifyOpeningMaterial,
  defaultOpeningMaterialCatalog,
  findOpeningMaterialOption,
  type OpeningMaterialCatalogProvider,
  type OpeningMaterialOption,
} from '../../../bim/family-types/opening-material-catalog';

export interface OpeningMaterialSelectCellProps {
  readonly label: string;
  readonly material: string | undefined;
  readonly onChange: (material: string | undefined) => void;
  /** Option source — defaults to presets only; the dialog injects the library-backed provider. */
  readonly catalog?: OpeningMaterialCatalogProvider;
}

export function OpeningMaterialSelectCell({
  label,
  material,
  onChange,
  catalog = defaultOpeningMaterialCatalog,
}: OpeningMaterialSelectCellProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const kind = classifyOpeningMaterial(material, catalog);
  const selectValue =
    kind === 'custom' ? OPENING_MATERIAL_CUSTOM_ID : kind === 'empty' ? '' : (material ?? '');

  const options = catalog.listMaterialIds();
  const presetOptions = options.filter((o) => o.group === 'preset');
  const libraryOptions = options.filter((o) => o.group === 'library');
  const customOption = options.find((o) => o.group === 'custom');
  const selectedOption = kind === 'listed' ? findOpeningMaterialOption(material, catalog) : undefined;

  const optionLabel = useCallback(
    (opt: OpeningMaterialOption): string =>
      opt.label ?? t(`ribbon.commands.bimFamilyType.${opt.labelKeySuffix}`),
    [t],
  );

  const onSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (next === '') return onChange(undefined);
      if (next === OPENING_MATERIAL_CUSTOM_ID) return onChange('');
      onChange(next);
    },
    [onChange],
  );

  const onCustom = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  );

  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <span className="w-28 shrink-0">{label}</span>
      {kind === 'listed' && material && (
        <MaterialSwatch
          materialId={material}
          category={selectedOption?.swatch?.category}
          thumbnailUrl={selectedOption?.swatch?.thumbnailUrl}
          albedoUrl={selectedOption?.swatch?.albedoUrl}
        />
      )}
      <select
        aria-label={label}
        value={selectValue}
        onChange={onSelect}
        className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
      >
        <option value="">{t('ribbon.commands.bimFamilyType.materialNone')}</option>
        <optgroup label={t('ribbon.commands.bimFamilyType.materialGroupPresets')}>
          {presetOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {optionLabel(opt)}
            </option>
          ))}
        </optgroup>
        {libraryOptions.length > 0 && (
          <optgroup label={t('ribbon.commands.bimFamilyType.materialGroupLibrary')}>
            {libraryOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {optionLabel(opt)}
              </option>
            ))}
          </optgroup>
        )}
        {customOption && (
          <option value={customOption.id}>{optionLabel(customOption)}</option>
        )}
      </select>
      {kind === 'custom' && (
        <input
          type="text"
          value={material ?? ''}
          onChange={onCustom}
          aria-label={label}
          className="w-24 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
        />
      )}
    </label>
  );
}
