'use client';

/**
 * ADR-363 Phase 1D / ADR-412 Φ5 — entity-agnostic WallDna layer editor.
 *
 * Boy-Scout extraction (N.0.2): the layer-editing UI was coupled to a
 * `WallEntity` + `dispatchPatch` inside `WallDnaSection`. The internal rows were
 * already DNA-only (`dna` + `onChange`), so this file owns the editor core
 * (header + presets + add/remove/reorder + per-layer side/name/thickness/material)
 * parameterised purely on `{ dna, category, onChange }`. Two consumers share it:
 *   - `WallDnaSection` — edits a placed wall INSTANCE (writes via UpdateWallParamsCommand).
 *   - `EditWallTypeDialog` (ADR-412 Φ5) — edits a TYPE's `dna` draft (re-flows to all instances).
 *
 * SSoT invariant `thickness === dna.totalThickness` is enforced by the consumer's
 * `onChange` (every mutation goes through `wall-dna-mutations.ts`). Reuses the
 * existing `wallAdvancedPanel.sections.dna.*` + `wallAdvancedPanel.materials.*`
 * i18n keys — zero new DNA keys.
 *
 * @see WallDnaSection.tsx — instance consumer (thin wrapper)
 * @see ../../ribbon/components/EditWallTypeDialog.tsx — type consumer
 * @see ../../../bim/walls/wall-dna-mutations.ts — pure mutation math
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BimMaterial } from '../../../bim/types/bim-material-types';
import type { WallCategory } from '../../../bim/types/wall-types';
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

const LAYER_SIDES: readonly WallLayerSide[] = ['exterior', 'core', 'interior'];

export interface WallDnaEditorProps {
  /** Current composition (undefined = manual-thickness wall, no DNA). */
  readonly dna: WallDna | undefined;
  /** Category drives the "Load preset" default. */
  readonly category: WallCategory;
  /** Total-thickness readout when there is no DNA (the manual thickness). */
  readonly fallbackThickness: number;
  /** Mutation sink. `undefined` = detach DNA (caller keeps manual thickness). */
  readonly onChange: (next: WallDna | undefined) => void;
  readonly libraryMaterials?: readonly BimMaterial[];
  readonly libraryLoading?: boolean;
}

export function WallDnaEditor({
  dna,
  category,
  fallbackThickness,
  onChange,
  libraryMaterials = [],
  libraryLoading = false,
}: WallDnaEditorProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const materialOptions = defaultWallMaterialCatalog.listMaterialIds();

  const onAdd = useCallback((): void => {
    if (!dna) return;
    onChange(addLayer(dna));
  }, [dna, onChange]);

  const onLoadPreset = useCallback((): void => {
    onChange(getDefaultDnaForCategory(category));
  }, [category, onChange]);

  const onDetach = useCallback((): void => {
    onChange(undefined);
  }, [onChange]);

  return (
    <section
      aria-label={t('wallAdvancedPanel.sections.dna.title')}
      className="flex flex-col gap-2"
    >
      <DnaHeader
        hasDna={!!dna}
        totalThickness={dna?.totalThickness ?? fallbackThickness}
        onAdd={onAdd}
        onLoadPreset={onLoadPreset}
        onDetach={onDetach}
      />
      {!dna && <DnaEmptyState onLoadPreset={onLoadPreset} />}
      {dna && (
        <DnaLayerList
          dna={dna}
          materialOptions={materialOptions}
          libraryMaterials={libraryMaterials}
          libraryLoading={libraryLoading}
          onChange={onChange}
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
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('wallAdvancedPanel.sections.dna.title')}
        </h4>
        <span className="text-xs text-muted-foreground">
          {t('wallAdvancedPanel.sections.dna.totalThickness', {
            value: Math.round(totalThickness),
          })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onLoadPreset}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent"
        >
          {t('wallAdvancedPanel.sections.dna.loadPreset')}
        </button>
        {hasDna && (
          <>
            <button
              type="button"
              onClick={onAdd}
              className="rounded border border-[hsl(var(--text-success))] bg-[hsl(var(--status-success))] px-2 py-1 text-xs text-white hover:bg-[hsl(var(--status-success))]/90"
            >
              {t('wallAdvancedPanel.sections.dna.addLayer')}
            </button>
            <button
              type="button"
              onClick={onDetach}
              className="rounded border border-[hsl(var(--text-warning))] bg-[hsl(var(--bg-warning))]/70 px-2 py-1 text-xs text-white hover:bg-[hsl(var(--bg-warning))]/90"
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
    <div className="rounded border border-border bg-card/50 p-2 text-xs text-foreground">
      <p className="mb-2">{t('wallAdvancedPanel.sections.dna.detachedHint')}</p>
      <button
        type="button"
        onClick={onLoadPreset}
        className="rounded border border-border bg-muted px-2 py-1 text-xs text-foreground hover:bg-accent"
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
  readonly libraryMaterials: readonly BimMaterial[];
  readonly libraryLoading: boolean;
  readonly onChange: (next: WallDna) => void;
}

function DnaLayerList({
  dna,
  materialOptions,
  libraryMaterials,
  libraryLoading,
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
            libraryMaterials={libraryMaterials}
            libraryLoading={libraryLoading}
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
  readonly libraryMaterials: readonly BimMaterial[];
  readonly libraryLoading: boolean;
  readonly onRemove: () => void;
  readonly onUpdate: (patch: Partial<Omit<WallDnaLayer, 'id'>>) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}

function DnaLayerRow(props: DnaLayerRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const {
    layer, index, count, materialOptions, libraryMaterials, libraryLoading,
    onRemove, onUpdate, onMoveUp, onMoveDown,
  } = props;
  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-card/40 p-2">
      <div className="flex items-center gap-2">
        <select
          aria-label={t('wallAdvancedPanel.sections.dna.fields.side')}
          value={layer.side}
          onChange={(e) => onUpdate({ side: e.target.value as WallLayerSide })}
          className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
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
          className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
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
          className="rounded border border-destructive bg-destructive/70 px-2 py-0.5 text-xs text-destructive-foreground hover:bg-destructive/90"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-foreground">
          <span className="w-16 shrink-0">
            {t('wallAdvancedPanel.sections.dna.fields.thickness')}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={layer.thickness}
            onChange={(e) => onUpdate({ thickness: parseFloat(e.target.value) || 0 })}
            className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
          />
        </label>
        <MaterialPicker
          value={layer.materialId}
          options={materialOptions}
          libraryMaterials={libraryMaterials}
          libraryLoading={libraryLoading}
          onChange={(materialId, name) =>
            onUpdate({ materialId, ...(name !== undefined ? { name } : {}) })
          }
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
    'rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-accent disabled:opacity-40';
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
  readonly libraryMaterials: readonly BimMaterial[];
  readonly libraryLoading: boolean;
  readonly onChange: (value: string, name?: string) => void;
}

function MaterialPicker({
  value, options, libraryMaterials, libraryLoading, onChange,
}: MaterialPickerProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const isBmatId = value.startsWith('bmat_');
  const kind = isBmatId ? 'library' : classifyWallMaterial(value);
  const selectValue = kind === 'custom' ? WALL_MATERIAL_CUSTOM_ID : value;
  const presetOptions = options.filter((opt) => opt.id !== WALL_MATERIAL_CUSTOM_ID);
  const customOption = options.find((opt) => opt.id === WALL_MATERIAL_CUSTOM_ID);
  const hasLibrary = libraryMaterials.length > 0;

  const onSelectChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>): void => {
      const next = event.target.value;
      if (next === WALL_MATERIAL_CUSTOM_ID) { onChange(''); return; }
      if (next.startsWith('bmat_')) {
        const mat = libraryMaterials.find((m) => m.id === next);
        onChange(next, mat?.nameEl);
        return;
      }
      onChange(next);
    },
    [onChange, libraryMaterials],
  );

  return (
    <span className="flex flex-1 items-center gap-1">
      <select
        aria-label={t('wallAdvancedPanel.sections.dna.fields.material')}
        value={selectValue}
        onChange={onSelectChange}
        className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
      >
        {libraryLoading && !hasLibrary && (
          <option value="" disabled>
            {t('wallAdvancedPanel.sections.dna.fields.libraryLoading')}
          </option>
        )}
        {hasLibrary && (
          <optgroup label={t('wallAdvancedPanel.sections.dna.fields.libraryGroup')}>
            {libraryMaterials.map((m) => (
              <option key={m.id} value={m.id}>{m.nameEl}</option>
            ))}
          </optgroup>
        )}
        {hasLibrary ? (
          <optgroup label={t('wallAdvancedPanel.sections.dna.fields.presetsGroup')}>
            {presetOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {t(`wallAdvancedPanel.materials.preset.${opt.labelKeySuffix}`)}
              </option>
            ))}
          </optgroup>
        ) : (
          presetOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {t(`wallAdvancedPanel.materials.preset.${opt.labelKeySuffix}`)}
            </option>
          ))
        )}
        {customOption && (
          <option value={customOption.id}>
            {t(`wallAdvancedPanel.materials.preset.${customOption.labelKeySuffix}`)}
          </option>
        )}
      </select>
      {kind === 'custom' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('wallAdvancedPanel.sections.dna.customPlaceholder')}
          className="w-24 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
        />
      )}
    </span>
  );
}
