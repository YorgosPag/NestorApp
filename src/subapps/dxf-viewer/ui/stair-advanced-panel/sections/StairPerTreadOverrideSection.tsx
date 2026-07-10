'use client';

/**
 * ADR-358 Phase 7b2a + Q19 Φ5 — Per-tread overrides (table editor + click-into).
 *
 * Each row maps `treadIndex → { material?, nosing? }`. Rows added/removed via the
 * `+ / −` buttons, OR opened by **clicking a tread in 2D/3D** (Q19 «click-into»):
 * the sub-element selection SSoT (`useStairSubElementSelectionStore`) points at a
 * tread of THIS stair → that tread's row becomes ACTIVE (highlighted + scrolled
 * into view). If it has no override yet the row renders TRANSIENTLY (no persisted
 * data, no command) and materialises on the first material/nosing edit — so Tab-
 * cycling through steps never spams empty rows.
 *
 * INDEX CONVENTION (Q19 Φ5 reconcile): keys are **0-based**, matching the 3D tag
 * (`userData.stairComponentIndex`), the sub-selection store, and `resolveStairMaterial`'s
 * `treadIndex`. The UI DISPLAYS `index + 1` (humans count treads from 1). The pre-Φ5 UI
 * stored 1-based keys — a genuine off-by-one that made tread #0 unreachable and shifted
 * every override by one step; unified here (no migration — test data wiped pre-production).
 *
 * Patch shape:
 *   add/update: { perTreadOverrides: { ...prev, [index]: { material, nosing } } }
 *   remove:     { perTreadOverrides: omit(prev, index) }
 *
 * Material picker mirrors `StairMaterialsSection` (preset + custom).
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairPerTreadOverride } from '../../../bim/types/stair-types';
import {
  classifyStairMaterial,
  defaultStairMaterialCatalog,
  STAIR_MATERIAL_CUSTOM_ID,
  type StairMaterialOption,
} from '../../../bim/stairs/stair-material-catalog';
// ADR-358 Q19 Φ5 — the click-into sub-element SSoT (shared 2D + 3D). Reactive read: low-freq
// (only on click / Tab / Esc), so subscribing here never causes hover-rate re-renders (ADR-040).
import { useStairSubElementSelectionStore } from '../../../bim/stairs/stair-sub-element-selection-store';
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

  // ADR-358 Q19 Φ5 — the tread the user clicked-into (0-based), or null. Only treads of THIS
  // stair open a row (risers are highlighted in 3D but have no per-riser override data model).
  const selectedSub = useStairSubElementSelectionStore((s) => s.selected);
  const activeIndex =
    selectedSub && selectedSub.stairId === stair.id && selectedSub.part === 'tread'
      ? selectedSub.index
      : null;

  // Persisted override rows PLUS the active tread (transient if not yet overridden).
  const rows = useMemo(
    () => withActiveIndex(sortedIndices(overrides), activeIndex),
    [overrides, activeIndex],
  );

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
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('stairAdvancedPanel.sections.perTread.title')}
        </h4>
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-border bg-card px-2 py-0.5 text-xs text-foreground hover:bg-accent"
        >
          {t('stairAdvancedPanel.sections.perTread.addOverride')}
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          {t('stairAdvancedPanel.sections.perTread.empty')}
        </p>
      ) : (
        <OverrideTable
          rows={rows}
          overrides={overrides}
          activeIndex={activeIndex}
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
  readonly activeIndex: number | null;
  readonly materialOptions: readonly StairMaterialOption[];
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (index: number, patch: Partial<StairPerTreadOverride>) => void;
}

function OverrideTable({
  rows,
  overrides,
  activeIndex,
  materialOptions,
  onRemove,
  onUpdate,
}: OverrideTableProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <table className="w-full text-xs text-foreground">
      <thead className="text-muted-foreground">
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
            persisted={overrides[index] !== undefined}
            isActive={index === activeIndex}
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
  /** True when this index is a real override in `perTreadOverrides` (vs a transient active row). */
  readonly persisted: boolean;
  /** ADR-358 Q19 Φ5 — the clicked-into tread: highlighted + scrolled into view. */
  readonly isActive: boolean;
  readonly materialOptions: readonly StairMaterialOption[];
  readonly onRemove: (index: number) => void;
  readonly onUpdate: (index: number, patch: Partial<StairPerTreadOverride>) => void;
}

function OverrideRow({
  index,
  override,
  persisted,
  isActive,
  materialOptions,
  onRemove,
  onUpdate,
}: OverrideRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const rowRef = useRef<HTMLTableRowElement>(null);
  // Bring the clicked-into tread's row into view (2D/3D click may target a row scrolled away).
  useEffect(() => {
    if (isActive) rowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [isActive]);

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

  // Display is 1-based (humans count from 1); the key stays 0-based (geometry/tag/resolver SSoT).
  const displayIndex = index + 1;
  return (
    <tr
      ref={rowRef}
      aria-current={isActive ? 'true' : undefined}
      aria-label={t(
        isActive
          ? 'stairAdvancedPanel.sections.perTread.selectedRowAriaLabel'
          : 'stairAdvancedPanel.sections.perTread.rowAriaLabel',
        { index: displayIndex },
      )}
      className={isActive ? 'bg-accent/60 ring-1 ring-primary' : undefined}
    >
      <td className="py-1 align-middle font-medium">{displayIndex}</td>
      <td className="py-1 align-middle">
        <div className="flex items-center gap-1">
          <select
            value={selectValue}
            onChange={onMaterialSelect}
            className="flex-1 rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground"
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
              className="w-24 rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground"
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
          className="w-16 rounded border border-border bg-card px-1 py-0.5 text-xs text-foreground"
        />
      </td>
      <td className="py-1 text-right align-middle">
        {/* Transient active rows (not yet persisted) have nothing to remove — the − appears
            once the override materialises on first edit. */}
        {persisted ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            aria-label={t('stairAdvancedPanel.sections.perTread.removeOverride')}
            className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground hover:bg-accent"
          >
            −
          </button>
        ) : null}
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

/** Merge the clicked-into tread into the row list (transient if not persisted), kept sorted. */
function withActiveIndex(
  indices: readonly number[],
  activeIndex: number | null,
): readonly number[] {
  if (activeIndex === null || indices.includes(activeIndex)) return indices;
  return [...indices, activeIndex].sort((a, b) => a - b);
}

function pickNextFreeIndex(overrides: OverrideRecord, stepCount: number): number | null {
  // 0-based keys (aligned with the 3D tag + resolver). `stepCount` treads → indices [0, stepCount-1].
  for (let i = 0; i < stepCount; i += 1) {
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
