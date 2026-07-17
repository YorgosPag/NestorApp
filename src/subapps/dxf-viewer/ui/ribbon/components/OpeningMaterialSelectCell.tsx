'use client';

/**
 * OpeningMaterialSelectCell — per-part material picker for the opening TYPE
 * edit dialog (frame / leaf / glass / hardware surfaces — Revit/ArchiCAD
 * "family surfaces" model).
 *
 * Mirrors `StairMaterialSelectCell` (ADR-358 Q19 Φ5/Φ7) 1:1: a preset
 * `<select>` + free-form custom `<input>`, emitting `string | undefined`
 * (`undefined` = cleared → the part falls back to `resolveOpeningMaterial`'s
 * default). Unlike stairs, opening parts persist ids from the shared `mat-*`
 * DNA catalog (`material-catalog-defs.ts`) or a user library `bmat_*` id
 * (`OpeningMaterials`, opening-types.ts) — so this cell also renders a
 * `MaterialSwatch` chip (ADR-413 §2D) next to the select, reusing the SAME
 * swatch primitive the wall DNA / slab / roof / materials-library pickers use,
 * instead of Stair's plain text-only combobox.
 *
 * No dedicated opening-material catalog SSoT exists yet (mirrors the pattern
 * of `wall-material-catalog.ts` / `stair-material-catalog.ts`, one per domain).
 * The preset list here is intentionally small and local to this file — just
 * the 3 base `mat-*` ids already registered in `material-catalog-defs.ts`
 * that apply to opening surfaces (wood / metal / glass). A `bmat_*` library id
 * or any other free-form id still round-trips correctly through the custom
 * text input (the resolver treats every part as an opaque material id string).
 *
 * @see ../../../bim/family-types/resolve-opening-material.ts — the resolver this feeds
 * @see ./EditOpeningTypeDialog.tsx — sole consumer (4 rows: frame/leaf/glass/hardware)
 * @see ../../stair-advanced-panel/sections/StairMaterialSelectCell.tsx — 1:1 precedent
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MaterialSwatch } from '../../components/shared/MaterialSwatch';

/** The base opening-surface `mat-*` ids already registered in `MATERIAL_DEFS`. */
const OPENING_MATERIAL_PRESET_IDS = ['mat-wood', 'mat-metal', 'mat-glass'] as const;
type OpeningMaterialPresetId = (typeof OPENING_MATERIAL_PRESET_IDS)[number];

/** Sentinel selected while the free-form custom input is showing. */
const OPENING_MATERIAL_CUSTOM_ID = 'custom' as const;

/** i18n key suffix (under `ribbon.commands.bimFamilyType.`) per preset id. */
const PRESET_LABEL_KEY: Readonly<Record<OpeningMaterialPresetId, string>> = {
  'mat-wood': 'materialPresetWood',
  'mat-metal': 'materialPresetMetal',
  'mat-glass': 'materialPresetGlass',
};

type OpeningMaterialKind = 'preset' | 'custom' | 'empty';

function classifyOpeningMaterial(id: string | undefined): OpeningMaterialKind {
  if (id === undefined || id === '') return 'empty';
  return (OPENING_MATERIAL_PRESET_IDS as readonly string[]).includes(id) ? 'preset' : 'custom';
}

export interface OpeningMaterialSelectCellProps {
  readonly label: string;
  readonly material: string | undefined;
  readonly onChange: (material: string | undefined) => void;
}

export function OpeningMaterialSelectCell({
  label,
  material,
  onChange,
}: OpeningMaterialSelectCellProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const kind = classifyOpeningMaterial(material);
  const selectValue =
    kind === 'custom' ? OPENING_MATERIAL_CUSTOM_ID : kind === 'empty' ? '' : (material ?? '');

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
      {kind === 'preset' && material && <MaterialSwatch materialId={material} />}
      <select
        aria-label={label}
        value={selectValue}
        onChange={onSelect}
        className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
      >
        <option value="">{t('ribbon.commands.bimFamilyType.materialNone')}</option>
        {OPENING_MATERIAL_PRESET_IDS.map((id) => (
          <option key={id} value={id}>
            {t(`ribbon.commands.bimFamilyType.${PRESET_LABEL_KEY[id]}`)}
          </option>
        ))}
        <option value={OPENING_MATERIAL_CUSTOM_ID}>
          {t('ribbon.commands.bimFamilyType.materialPresetCustom')}
        </option>
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
