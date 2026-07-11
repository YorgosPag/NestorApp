'use client';

/**
 * StairMaterialSelectCell — shared per-sub-element material picker (ADR-358 Q19 Φ5/Φ7).
 *
 * The preset `<select>` (+ free-form custom `<input>`) used by BOTH the per-tread
 * and per-riser override rows. Extracted so the two tables share ONE material
 * picker instead of cloning it (N.18). Emits `string | undefined`:
 *   - `undefined` → cleared (no override) · `''` → custom mode (awaiting text) ·
 *   - a preset id / free-form string otherwise.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  classifyStairMaterial,
  STAIR_MATERIAL_CUSTOM_ID,
  type StairMaterialOption,
} from '../../../bim/stairs/stair-material-catalog';

export interface StairMaterialSelectCellProps {
  readonly material: string | undefined;
  readonly options: readonly StairMaterialOption[];
  readonly onChange: (material: string | undefined) => void;
}

export function StairMaterialSelectCell({
  material,
  options,
  onChange,
}: StairMaterialSelectCellProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const materialKind = classifyStairMaterial(material);
  const selectValue =
    materialKind === 'custom'
      ? STAIR_MATERIAL_CUSTOM_ID
      : materialKind === 'empty'
        ? ''
        : material ?? '';

  const onSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (next === '') return onChange(undefined);
      if (next === STAIR_MATERIAL_CUSTOM_ID) return onChange('');
      onChange(next);
    },
    [onChange],
  );

  const onCustom = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  );

  return (
    <div className="flex items-center gap-1">
      <select
        value={selectValue}
        onChange={onSelect}
        className="flex-1 rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {t(`stairAdvancedPanel.materials.preset.${opt.labelKeySuffix}`)}
          </option>
        ))}
      </select>
      {materialKind === 'custom' ? (
        <input
          type="text"
          value={material ?? ''}
          onChange={onCustom}
          className="w-24 rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground"
        />
      ) : null}
    </div>
  );
}
