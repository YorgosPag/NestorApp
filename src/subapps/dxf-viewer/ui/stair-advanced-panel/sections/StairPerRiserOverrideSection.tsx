'use client';

/**
 * ADR-358 Q19 Φ7 — Per-riser overrides (material-only table + click-into).
 *
 * Mirror of `StairPerTreadOverrideSection` for RISERS: each row maps
 * `riserIndex → { material? }`. A riser has no nosing / nosing-profile (those are
 * tread-face finishes), so the table carries the material column only. Rows open
 * via the `+` button OR by CLICKING a riser in 3D («click-into»): the shared
 * sub-element selection SSoT points at a riser of THIS stair → that row becomes
 * active (highlighted + scrolled into view), transient until the first edit.
 *
 * INDEX CONVENTION: 0-based global build-order, matching the 3D
 * `stairComponentIndex` tag and `resolveStairMaterial`'s `subIndex` (Φ7). Display
 * is `index + 1`. Writes through the shared `dispatchStairParamPatch`:
 *   add/update: { perRiserOverrides: { ...prev, [i]: { material } } }
 *   remove:     { perRiserOverrides: omit(prev, i) }
 *
 * Reuses the shared `StairMaterialSelectCell` + row-index helpers (SSoT with the
 * per-tread table — N.18).
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { StairEntity } from '../../../types/entities';
import type { StairPerRiserOverride } from '../../../bim/types/stair-types';
import { defaultStairMaterialCatalog, type StairMaterialOption } from '../../../bim/stairs/stair-material-catalog';
import { useStairSubElementSelectionStore } from '../../../bim/stairs/stair-sub-element-selection-store';
import type { DispatchStairParamPatch } from '../commands/dispatchStairParamPatch';
import { StairMaterialSelectCell } from './StairMaterialSelectCell';
import { StairOverrideRowShell } from './StairOverrideRowShell';
import {
  sortedOverrideIndices,
  withActiveIndex,
  pickNextFreeIndex,
  omitIndex,
  type OverrideMap,
} from './stair-override-row-helpers';

type RiserOverrides = OverrideMap<StairPerRiserOverride>;

export interface StairPerRiserOverrideSectionProps {
  readonly stair: StairEntity;
  readonly dispatchPatch: DispatchStairParamPatch;
}

export function StairPerRiserOverrideSection({
  stair,
  dispatchPatch,
}: StairPerRiserOverrideSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const overrides = stair.params.perRiserOverrides ?? {};
  const riserCount = stair.geometry?.risers?.length ?? stair.params.stepCount;
  const options = defaultStairMaterialCatalog.listMaterialIds();

  // The riser the user clicked-into (0-based), or null — only risers of THIS stair.
  const selectedSub = useStairSubElementSelectionStore((s) => s.selected);
  const activeIndex =
    selectedSub && selectedSub.stairId === stair.id && selectedSub.part === 'riser'
      ? selectedSub.index
      : null;

  const rows = useMemo(
    () => withActiveIndex(sortedOverrideIndices(overrides), activeIndex),
    [overrides, activeIndex],
  );

  const onAdd = useCallback(() => {
    const nextIndex = pickNextFreeIndex(overrides, riserCount);
    if (nextIndex === null) return;
    dispatchPatch(stair, { perRiserOverrides: { ...overrides, [nextIndex]: {} } });
  }, [stair, overrides, riserCount, dispatchPatch]);

  const onRemove = useCallback(
    (index: number) => {
      dispatchPatch(stair, { perRiserOverrides: omitIndex(overrides, index) });
    },
    [stair, overrides, dispatchPatch],
  );

  const onMaterial = useCallback(
    (index: number, material: string | undefined) => {
      const next: RiserOverrides = { ...overrides, [index]: { material } };
      dispatchPatch(stair, { perRiserOverrides: next });
    },
    [stair, overrides, dispatchPatch],
  );

  return (
    <section
      aria-label={t('stairAdvancedPanel.sections.perRiser.title')}
      className="flex flex-col gap-2"
    >
      <header className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('stairAdvancedPanel.sections.perRiser.title')}
        </h4>
        <button
          type="button"
          onClick={onAdd}
          className="rounded border border-border bg-card px-2 py-0.5 text-xs text-foreground hover:bg-accent"
        >
          {t('stairAdvancedPanel.sections.perRiser.addOverride')}
        </button>
      </header>
      {rows.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          {t('stairAdvancedPanel.sections.perRiser.empty')}
        </p>
      ) : (
        <RiserTable
          rows={rows}
          overrides={overrides}
          activeIndex={activeIndex}
          materialOptions={options}
          onRemove={onRemove}
          onMaterial={onMaterial}
        />
      )}
    </section>
  );
}

interface RiserTableProps {
  readonly rows: readonly number[];
  readonly overrides: RiserOverrides;
  readonly activeIndex: number | null;
  readonly materialOptions: readonly StairMaterialOption[];
  readonly onRemove: (index: number) => void;
  readonly onMaterial: (index: number, material: string | undefined) => void;
}

function RiserTable({
  rows,
  overrides,
  activeIndex,
  materialOptions,
  onRemove,
  onMaterial,
}: RiserTableProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <table className="w-full text-xs text-foreground">
      <thead className="text-muted-foreground">
        <tr>
          <th className="w-10 text-left font-medium">
            {t('stairAdvancedPanel.sections.perRiser.columns.index')}
          </th>
          <th className="text-left font-medium">
            {t('stairAdvancedPanel.sections.perRiser.columns.material')}
          </th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {rows.map((index) => (
          <RiserRow
            key={index}
            index={index}
            override={overrides[index] ?? {}}
            persisted={overrides[index] !== undefined}
            isActive={index === activeIndex}
            materialOptions={materialOptions}
            onRemove={onRemove}
            onMaterial={onMaterial}
          />
        ))}
      </tbody>
    </table>
  );
}

interface RiserRowProps {
  readonly index: number;
  readonly override: StairPerRiserOverride;
  readonly persisted: boolean;
  readonly isActive: boolean;
  readonly materialOptions: readonly StairMaterialOption[];
  readonly onRemove: (index: number) => void;
  readonly onMaterial: (index: number, material: string | undefined) => void;
}

function RiserRow({
  index,
  override,
  persisted,
  isActive,
  materialOptions,
  onRemove,
  onMaterial,
}: RiserRowProps): React.ReactElement {
  const onChange = useCallback(
    (material: string | undefined) => onMaterial(index, material),
    [index, onMaterial],
  );

  return (
    <StairOverrideRowShell
      index={index}
      persisted={persisted}
      isActive={isActive}
      labelKeyBase="stairAdvancedPanel.sections.perRiser"
      onRemove={onRemove}
    >
      <td className="py-1 align-middle">
        <StairMaterialSelectCell material={override.material} options={materialOptions} onChange={onChange} />
      </td>
    </StairOverrideRowShell>
  );
}
