'use client';

/**
 * ADR-358 Phase 7b2a — Stream G item 2: Per-tread overrides (table editor).
 *
 * Q19 hybrid: table editor here, click-on-canvas Phase 8+ (carryover).
 * Each row maps `treadIndex → { material?, nosing? }`. Rows added/removed
 * via `+ / −` buttons. Index input is bounded `[1, stepCount]`; out-of-range
 * entries are silently dropped on next render (defensive — geometry compute
 * also ignores out-of-range keys).
 *
 * Patch shape:
 *   add/update: { perTreadOverrides: { ...prev, [index]: { material, nosing } } }
 *   remove:     { perTreadOverrides: omit(prev, index) }
 *
 * Material picker mirrors `StairMaterialsSection` (preset + custom).
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairPerTreadOverride } from '../../../types/stair';
import {
  classifyStairMaterial,
  defaultStairMaterialCatalog,
  STAIR_MATERIAL_CUSTOM_ID,
  type StairMaterialOption,
} from '../../../bim/stairs/stair-material-catalog';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';

export interface StairPerTreadOverrideSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

type OverrideRecord = Readonly<Record<number, StairPerTreadOverride>>;

export function StairPerTreadOverrideSection({
  stair,
  dispatchPatch,
}: StairPerTreadOverrideSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const overrides = stair.params.perTreadOverrides ?? {};
  const stepCount = stair.params.stepCount;
  const options = defaultStairMaterialCatalog.listMaterialIds();
  const rows = useMemo(() => sortedIndices(overrides), [overrides]);

  const onAdd = useCallback(() => {
    const nextIndex = pickNextFreeIndex(overrides, stepCount);
    if (nextIndex === null) return;
    const next: OverrideRecord = { ...overrides, [nextIndex]: {} };
    dispatchPatch(stair, { perTreadOverrides: next });
  }, [stair, overrides, stepCount, dispatchPatch]);

  const onRemove = useCallback(
    (index: number) => {
      const next = omitIndex(overrides, index);
      dispatchPatch(stair, { perTreadOverrides: next });
    },
    [stair, overrides, dispatchPatch],
  );

  const onUpdate = useCallback(
    (index: number, patch: Partial<StairPerTreadOverride>) => {
      const prev = overrides[index] ?? {};
      const merged: StairPerTreadOverride = { ...prev, ...patch };
      const next: OverrideRecord = { ...overrides, [index]: merged };
      dispatchPatch(stair, { perTreadOverrides: next });
    },
    [stair, overrides, dispatchPatch],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.perTread.title')}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t('stairAdvancedPanel.sections.perTread.title')}
        </h4>
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-100 hover:bg-slate-700"
        >
          {t('stairAdvancedPanel.sections.perTread.addOverride')}
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="text-xs italic text-slate-500">
          {t('stairAdvancedPanel.sections.perTread.empty')}
        </p>
      ) : (
        <OverrideTable
          rows={rows}
          overrides={overrides}
          stepCount={stepCount}
          materialOptions={options}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />
      )}
    </section>
  );
}

interface OverrideTableProps {
  readonly rows: readonly number[];
  readonly overrides: OverrideRecord;
  readonly stepCount: number;
  readonly materialOptions: readonly StairMaterialOption[];
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (index: number, patch: Partial<StairPerTreadOverride>) => void;
}

function OverrideTable({
  rows,
  overrides,
  stepCount,
  materialOptions,
  onRemove,
  onUpdate,
}: OverrideTableProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <table className="w-full text-xs text-slate-200">
      <thead className="text-slate-400">
        <tr>
          <th className="w-10 text-left font-medium">
            {t('stairAdvancedPanel.sections.perTread.columns.index')}
          </th>
          <th className="text-left font-medium">
            {t('stairAdvancedPanel.sections.perTread.columns.material')}
          </th>
          <th className="w-20 text-left font-medium">
            {t('stairAdvancedPanel.sections.perTread.columns.nosing')}
          </th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {rows.map((index) => (
          <OverrideRow
            key={index}
            index={index}
            override={overrides[index] ?? {}}
            stepCount={stepCount}
            materialOptions={materialOptions}
            onRemove={onRemove}
            onUpdate={onUpdate}
          />
        ))}
      </tbody>
    </table>
  );
}

interface OverrideRowProps {
  readonly index: number;
  readonly override: StairPerTreadOverride;
  readonly stepCount: number;
  readonly materialOptions: readonly StairMaterialOption[];
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (index: number, patch: Partial<StairPerTreadOverride>) => void;
}

function OverrideRow({
  index,
  override,
  stepCount,
  materialOptions,
  onRemove,
  onUpdate,
}: OverrideRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const materialKind = classifyStairMaterial(override.material);
  const selectValue =
    materialKind === 'custom'
      ? STAIR_MATERIAL_CUSTOM_ID
      : materialKind === 'empty'
        ? ''
        : override.material ?? '';

  const onMaterialSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const next = event.target.value;
      if (next === '') {
        onUpdate(index, { material: undefined });
        return;
      }
      if (next === STAIR_MATERIAL_CUSTOM_ID) {
        onUpdate(index, { material: '' });
        return;
      }
      onUpdate(index, { material: next });
    },
    [index, onUpdate],
  );

  const onCustomMaterial = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(index, { material: event.target.value });
    },
    [index, onUpdate],
  );

  const onNosing = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw === '') {
        onUpdate(index, { nosing: undefined });
        return;
      }
      const num = Number.parseFloat(raw);
      if (Number.isNaN(num)) return;
      onUpdate(index, { nosing: num });
    },
    [index, onUpdate],
  );

  return (
    <tr aria-label={t('stairAdvancedPanel.sections.perTread.rowAriaLabel', { index })}>
      <td className="py-1 align-middle">{index}</td>
      <td className="py-1 align-middle">
        <div className="flex items-center gap-1">
          <select
            value={selectValue}
            onChange={onMaterialSelect}
            className="flex-1 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-100"
          >
            <option value="">—</option>
            {materialOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {t(`stairAdvancedPanel.materials.preset.${opt.labelKeySuffix}`)}
              </option>
            ))}
          </select>
          {materialKind === 'custom' ? (
            <input
              type="text"
              value={override.material ?? ''}
              onChange={onCustomMaterial}
              className="w-24 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-100"
            />
          ) : null}
        </div>
      </td>
      <td className="py-1 align-middle">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={override.nosing ?? ''}
          onChange={onNosing}
          className="w-16 rounded border border-slate-600 bg-slate-800 px-1 py-0.5 text-xs text-slate-100"
        />
      </td>
      <td className="py-1 text-right align-middle">
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={t('stairAdvancedPanel.sections.perTread.removeOverride')}
          className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100 hover:bg-slate-700"
        >
          −
        </button>
      </td>
    </tr>
  );
}

function sortedIndices(overrides: OverrideRecord): readonly number[] {
  return Object.keys(overrides)
    .map((k) => Number.parseInt(k, 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function pickNextFreeIndex(overrides: OverrideRecord, stepCount: number): number | null {
  for (let i = 1; i <= stepCount; i += 1) {
    if (overrides[i] === undefined) return i;
  }
  return null;
}

function omitIndex(overrides: OverrideRecord, index: number): OverrideRecord {
  const next: Record<number, StairPerTreadOverride> = {};
  for (const key of Object.keys(overrides)) {
    const num = Number.parseInt(key, 10);
    if (num === index) continue;
    next[num] = overrides[num];
  }
  return next;
}
