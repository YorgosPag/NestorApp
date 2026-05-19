'use client';

/**
 * ADR-358 Phase 7b2a — Stream G item 1: Materials section.
 *
 * Four material slots (tread / riser / stringer / landing) per Q19.
 * Each slot = preset combobox + free-form text input when `'custom'`
 * is selected. Persisted value is the resolved material ID (preset slug
 * or custom typed string). Industry-aligned with Revit/ArchiCAD/Vectorworks
 * Asset Manager pattern; the catalog provider is swappable for Phase 9.
 *
 * Mutations route through `dispatchPatch({ materials: { ...prev, [slot]: value } })`
 * to keep the panel a strict SSoT writer (see `dispatchStairParamPatch`).
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairMaterials } from '../../../bim/types/stair-types';
import {
  classifyStairMaterial,
  defaultStairMaterialCatalog,
  STAIR_MATERIAL_CUSTOM_ID,
  type StairMaterialOption,
} from '../../../bim/stairs/stair-material-catalog';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';

type MaterialSlot = 'tread' | 'riser' | 'stringer' | 'landing';

const MATERIAL_SLOTS: readonly MaterialSlot[] = ['tread', 'riser', 'stringer', 'landing'];

export interface StairMaterialsSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairMaterialsSection({
  stair,
  dispatchPatch,
}: StairMaterialsSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const materials = stair.params.materials ?? {};
  const options = defaultStairMaterialCatalog.listMaterialIds();

  const onSlotChange = useCallback(
    (slot: MaterialSlot, nextValue: string | undefined): void => {
      const nextMaterials: StairMaterials = {
        ...materials,
        [slot]: nextValue,
      };
      dispatchPatch(stair, { materials: nextMaterials });
    },
    [stair, materials, dispatchPatch],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.materials.title')}
      className="flex flex-col gap-2"
    >
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t('stairAdvancedPanel.sections.materials.title')}
        </h4>
      </header>
      <fieldset className="flex flex-col gap-2 border-0 p-0">
        {MATERIAL_SLOTS.map((slot) => (
          <MaterialSlotRow
            key={slot}
            slot={slot}
            value={materials[slot]}
            options={options}
            onChange={onSlotChange}
          />
        ))}
      </fieldset>
    </section>
  );
}

interface MaterialSlotRowProps {
  readonly slot: MaterialSlot;
  readonly value: string | undefined;
  readonly options: readonly StairMaterialOption[];
  readonly onChange: (slot: MaterialSlot, nextValue: string | undefined) => void;
}

function MaterialSlotRow({
  slot,
  value,
  options,
  onChange,
}: MaterialSlotRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const kind = classifyStairMaterial(value);
  const selectValue =
    kind === 'custom' ? STAIR_MATERIAL_CUSTOM_ID : kind === 'empty' ? '' : value ?? '';

  const onSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      const next = event.target.value;
      if (next === '') {
        onChange(slot, undefined);
        return;
      }
      if (next === STAIR_MATERIAL_CUSTOM_ID) {
        onChange(slot, '');
        return;
      }
      onChange(slot, next);
    },
    [slot, onChange],
  );

  const onCustomInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      onChange(slot, event.target.value);
    },
    [slot, onChange],
  );

  return (
    <label className="flex items-center gap-2 text-xs text-slate-200">
      <span className="w-20 shrink-0">
        {t(`stairAdvancedPanel.sections.materials.${slot}`)}
      </span>
      <select
        value={selectValue}
        onChange={onSelectChange}
        className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {t(`stairAdvancedPanel.materials.preset.${opt.labelKeySuffix}`)}
          </option>
        ))}
      </select>
      {kind === 'custom' ? (
        <input
          type="text"
          value={value ?? ''}
          onChange={onCustomInput}
          placeholder={t('stairAdvancedPanel.sections.materials.customPlaceholder')}
          className="w-32 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
        />
      ) : null}
    </label>
  );
}
