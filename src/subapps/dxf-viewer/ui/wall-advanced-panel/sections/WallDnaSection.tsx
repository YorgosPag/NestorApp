'use client';

/**
 * ADR-363 Phase 1D — WallDna Editor section ("Σύνθεση Στρώσεων").
 *
 * Layered cross-section editor for the selected wall. Industry-aligned with
 * Revit "Edit Type → Structure" and ArchiCAD Composite Settings:
 *   - Ordered layer list (exterior → core → interior).
 *   - Per-layer: side selector, name, thickness (mm), material combobox.
 *   - Reorder via up/down buttons; add/remove via toolbar.
 *   - Live total thickness readout (SSoT invariant `thickness === totalThickness`).
 *   - "Φόρτωση προεπιλογής" reloads `getDefaultDnaForCategory(category)`.
 *   - "Χωρίς σύνθεση" detaches DNA → manual thickness wall (Revit Generic Wall).
 *
 * All mutations route through `dispatchPatch({ dna, thickness })` so the
 * SSoT contract holds across ribbon/panel/grip drag write paths. Pure
 * presentational + side-effect-free at the section level — mutation math
 * lives in `wall-dna-mutations.ts`.
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { WallEntity } from '../../../bim/types/wall-types';
import type {
  WallDna,
  WallDnaLayer,
  WallLayerSide,
} from '../../../bim/types/wall-dna-types';
import { getDefaultDnaForCategory } from '../../../bim/types/wall-dna-types';
import {
  addLayer,
  removeLayer,
  reorderLayer,
  updateLayer,
} from '../../../bim/walls/wall-dna-mutations';
import {
  classifyWallMaterial,
  defaultWallMaterialCatalog,
  WALL_MATERIAL_CUSTOM_ID,
  type WallMaterialOption,
} from '../../../bim/walls/wall-material-catalog';
import type { DispatchWallParamPatch } from '../commands/dispatchWallParamPatch';

const LAYER_SIDES: readonly WallLayerSide[] = ['exterior', 'core', 'interior'];

export interface WallDnaSectionProps {
  readonly wall: WallEntity;
  readonly dispatchPatch: DispatchWallParamPatch;
}

export function WallDnaSection({
  wall,
  dispatchPatch,
}: WallDnaSectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const dna = wall.params.dna;
  const materialOptions = defaultWallMaterialCatalog.listMaterialIds();

  const applyDna = useCallback(
    (next: WallDna): void => {
      dispatchPatch(wall, { dna: next, thickness: next.totalThickness });
    },
    [wall, dispatchPatch],
  );

  const onAdd = useCallback((): void => {
    if (!dna) return;
    applyDna(addLayer(dna));
  }, [dna, applyDna]);

  const onLoadPreset = useCallback((): void => {
    const preset = getDefaultDnaForCategory(wall.params.category);
    applyDna(preset);
  }, [wall.params.category, applyDna]);

  const onDetach = useCallback((): void => {
    dispatchPatch(wall, { dna: undefined });
  }, [wall, dispatchPatch]);

  return (
    <section
      aria-label={t('wallAdvancedPanel.sections.dna.title')}
      className="flex flex-col gap-2"
    >
      <DnaHeader
        hasDna={!!dna}
        totalThickness={dna?.totalThickness ?? wall.params.thickness}
        onAdd={onAdd}
        onLoadPreset={onLoadPreset}
        onDetach={onDetach}
      />
      {!dna && <DnaEmptyState onLoadPreset={onLoadPreset} />}
      {dna && (
        <DnaLayerList
          dna={dna}
          materialOptions={materialOptions}
          onChange={applyDna}
        />
      )}
    </section>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

interface DnaHeaderProps {
  readonly hasDna: boolean;
  readonly totalThickness: number;
  readonly onAdd: () => void;
  readonly onLoadPreset: () => void;
  readonly onDetach: () => void;
}

function DnaHeader({
  hasDna,
  totalThickness,
  onAdd,
  onLoadPreset,
  onDetach,
}: DnaHeaderProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          {t('wallAdvancedPanel.sections.dna.title')}
        </h4>
        <span className="text-xs text-slate-400">
          {t('wallAdvancedPanel.sections.dna.totalThickness', {
            value: Math.round(totalThickness),
          })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onLoadPreset}
          className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700"
        >
          {t('wallAdvancedPanel.sections.dna.loadPreset')}
        </button>
        {hasDna && (
          <>
            <button
              type="button"
              onClick={onAdd}
              className="rounded border border-emerald-600 bg-emerald-700 px-2 py-1 text-xs text-emerald-50 hover:bg-emerald-600"
            >
              {t('wallAdvancedPanel.sections.dna.addLayer')}
            </button>
            <button
              type="button"
              onClick={onDetach}
              className="rounded border border-amber-600 bg-amber-700/70 px-2 py-1 text-xs text-amber-50 hover:bg-amber-600"
            >
              {t('wallAdvancedPanel.sections.dna.detach')}
            </button>
          </>
        )}
      </div>
    </header>
  );
}

// ─── Empty state (no DNA — manual wall) ──────────────────────────────────────

function DnaEmptyState({
  onLoadPreset,
}: {
  onLoadPreset: () => void;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <div className="rounded border border-slate-700 bg-slate-800/50 p-2 text-xs text-slate-300">
      <p className="mb-2">{t('wallAdvancedPanel.sections.dna.detachedHint')}</p>
      <button
        type="button"
        onClick={onLoadPreset}
        className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
      >
        {t('wallAdvancedPanel.sections.dna.loadPreset')}
      </button>
    </div>
  );
}

// ─── Layer list ──────────────────────────────────────────────────────────────

interface DnaLayerListProps {
  readonly dna: WallDna;
  readonly materialOptions: readonly WallMaterialOption[];
  readonly onChange: (next: WallDna) => void;
}

function DnaLayerList({
  dna,
  materialOptions,
  onChange,
}: DnaLayerListProps): React.ReactElement {
  return (
    <ol className="flex flex-col gap-2">
      {dna.layers.map((layer, index) => (
        <li key={layer.id}>
          <DnaLayerRow
            layer={layer}
            index={index}
            count={dna.layers.length}
            materialOptions={materialOptions}
            onRemove={() => onChange(removeLayer(dna, layer.id))}
            onUpdate={(patch) => onChange(updateLayer(dna, layer.id, patch))}
            onMoveUp={() => onChange(reorderLayer(dna, index, -1))}
            onMoveDown={() => onChange(reorderLayer(dna, index, 1))}
          />
        </li>
      ))}
    </ol>
  );
}

// ─── Single layer row ────────────────────────────────────────────────────────

interface DnaLayerRowProps {
  readonly layer: WallDnaLayer;
  readonly index: number;
  readonly count: number;
  readonly materialOptions: readonly WallMaterialOption[];
  readonly onRemove: () => void;
  readonly onUpdate: (patch: Partial<Omit<WallDnaLayer, 'id'>>) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}

function DnaLayerRow(props: DnaLayerRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const { layer, index, count, materialOptions, onRemove, onUpdate, onMoveUp, onMoveDown } = props;
  return (
    <div className="flex flex-col gap-1 rounded border border-slate-700 bg-slate-800/40 p-2">
      <div className="flex items-center gap-2">
        <select
          aria-label={t('wallAdvancedPanel.sections.dna.fields.side')}
          value={layer.side}
          onChange={(e) => onUpdate({ side: e.target.value as WallLayerSide })}
          className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
        >
          {LAYER_SIDES.map((side) => (
            <option key={side} value={side}>
              {t(`wallAdvancedPanel.sections.dna.side.${side}`)}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label={t('wallAdvancedPanel.sections.dna.fields.name')}
          value={layer.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-slate-100"
        />
        <ReorderButtons
          canUp={index > 0}
          canDown={index < count - 1}
          onUp={onMoveUp}
          onDown={onMoveDown}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('wallAdvancedPanel.sections.dna.removeLayer')}
          className="rounded border border-rose-600 bg-rose-700/70 px-2 py-0.5 text-xs text-rose-50 hover:bg-rose-600"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-200">
          <span className="w-16 shrink-0">
            {t('wallAdvancedPanel.sections.dna.fields.thickness')}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={layer.thickness}
            onChange={(e) => onUpdate({ thickness: parseFloat(e.target.value) || 0 })}
            className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-slate-100"
          />
        </label>
        <MaterialPicker
          value={layer.materialId}
          options={materialOptions}
          onChange={(materialId) => onUpdate({ materialId })}
        />
      </div>
    </div>
  );
}

// ─── Reorder buttons ─────────────────────────────────────────────────────────

interface ReorderButtonsProps {
  readonly canUp: boolean;
  readonly canDown: boolean;
  readonly onUp: () => void;
  readonly onDown: () => void;
}

function ReorderButtons({ canUp, canDown, onUp, onDown }: ReorderButtonsProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const base =
    'rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-slate-100 hover:bg-slate-700 disabled:opacity-40';
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        aria-label={t('wallAdvancedPanel.sections.dna.moveUp')}
        className={base}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        aria-label={t('wallAdvancedPanel.sections.dna.moveDown')}
        className={base}
      >
        ↓
      </button>
    </span>
  );
}

// ─── Material picker (preset combobox + custom input) ────────────────────────

interface MaterialPickerProps {
  readonly value: string;
  readonly options: readonly WallMaterialOption[];
  readonly onChange: (value: string) => void;
}

function MaterialPicker({ value, options, onChange }: MaterialPickerProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const kind = classifyWallMaterial(value);
  const selectValue = kind === 'custom' ? WALL_MATERIAL_CUSTOM_ID : value;

  const onSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      const next = event.target.value;
      if (next === WALL_MATERIAL_CUSTOM_ID) {
        onChange('');
        return;
      }
      onChange(next);
    },
    [onChange],
  );

  return (
    <span className="flex flex-1 items-center gap-1">
      <select
        aria-label={t('wallAdvancedPanel.sections.dna.fields.material')}
        value={selectValue}
        onChange={onSelectChange}
        className="flex-1 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {t(`wallAdvancedPanel.materials.preset.${opt.labelKeySuffix}`)}
          </option>
        ))}
      </select>
      {kind === 'custom' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('wallAdvancedPanel.sections.dna.customPlaceholder')}
          className="w-24 rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
        />
      )}
    </span>
  );
}
