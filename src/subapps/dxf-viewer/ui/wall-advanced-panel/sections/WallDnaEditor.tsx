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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialSwatch } from '../../components/shared/MaterialSwatch';
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
  /**
   * ADR-414 — bidirectional layer highlight (live preview). The layer id whose
   * row should read as active, and a setter to broadcast hover/focus to the
   * preview. Both optional → instance panel (no preview) keeps prior behaviour.
   */
  readonly highlightLayerId?: string | null;
  readonly onHighlightLayer?: (layerId: string | null) => void;
}

export function WallDnaEditor({
  dna,
  category,
  fallbackThickness,
  onChange,
  libraryMaterials = [],
  libraryLoading = false,
  highlightLayerId = null,
  onHighlightLayer,
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
          highlightLayerId={highlightLayerId}
          onHighlightLayer={onHighlightLayer}
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
  readonly highlightLayerId: string | null;
  readonly onHighlightLayer?: (layerId: string | null) => void;
}

function DnaLayerList({
  dna,
  materialOptions,
  libraryMaterials,
  libraryLoading,
  onChange,
  highlightLayerId,
  onHighlightLayer,
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
            isHighlighted={highlightLayerId === layer.id}
            onHighlight={onHighlightLayer}
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
  /** ADR-414 — this row matches the active preview band. */
  readonly isHighlighted: boolean;
  /** ADR-414 — broadcast hover/focus to the preview (no-op when absent). */
  readonly onHighlight?: (layerId: string | null) => void;
  readonly onRemove: () => void;
  readonly onUpdate: (patch: Partial<Omit<WallDnaLayer, 'id'>>) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}

function DnaLayerRow(props: DnaLayerRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const {
    layer, index, count, materialOptions, libraryMaterials, libraryLoading,
    isHighlighted, onHighlight, onRemove, onUpdate, onMoveUp, onMoveDown,
  } = props;
  const highlightClass = isHighlighted
    ? 'border-[hsl(var(--ring))] ring-1 ring-[hsl(var(--ring))]'
    : 'border-border';
  return (
    <div
      onPointerEnter={() => onHighlight?.(layer.id)}
      onPointerLeave={() => onHighlight?.(null)}
      onFocusCapture={() => onHighlight?.(layer.id)}
      className={`flex flex-col gap-1 rounded border bg-card/40 p-2 ${highlightClass}`}
    >
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
  // Empty (unset) is treated as custom-like: the custom option stays selected and
  // the free-form input shows (Radix forbids an empty SelectItem value anyway).
  const isCustomLike = kind === 'custom' || kind === 'empty';
  const selectValue = isCustomLike ? WALL_MATERIAL_CUSTOM_ID : value;
  const presetOptions = options.filter((opt) => opt.id !== WALL_MATERIAL_CUSTOM_ID);
  const customOption = options.find((opt) => opt.id === WALL_MATERIAL_CUSTOM_ID);
  const hasLibrary = libraryMaterials.length > 0;
  const selectedLibraryMat = isBmatId
    ? libraryMaterials.find((m) => m.id === value)
    : undefined;

  const onSelectValue = useCallback(
    (next: string): void => {
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
      <Select value={selectValue} onValueChange={onSelectValue}>
        <SelectTrigger
          size="sm"
          aria-label={t('wallAdvancedPanel.sections.dna.fields.material')}
          className="flex-1 min-w-[8rem]"
        >
          {isCustomLike ? (
            <SelectValue />
          ) : isBmatId ? (
            selectedLibraryMat ? (
              <span className="flex items-center gap-2">
                <MaterialSwatch
                  category={selectedLibraryMat.category}
                  thumbnailUrl={selectedLibraryMat.thumbnailUrl}
                  albedoUrl={selectedLibraryMat.pbrTextures?.albedoUrl}
                />
                <span className="truncate">{selectedLibraryMat.nameEl}</span>
              </span>
            ) : (
              <SelectValue />
            )
          ) : (
            <span className="flex items-center gap-2">
              <MaterialSwatch materialId={value} />
              <span className="truncate">
                {t(`wallAdvancedPanel.materials.preset.${value}`)}
              </span>
            </span>
          )}
        </SelectTrigger>
        <SelectContent className="w-auto min-w-[8rem] max-w-[20rem]">
          {libraryLoading && !hasLibrary && (
            <SelectItem value="__loading__" disabled>
              {t('wallAdvancedPanel.sections.dna.fields.libraryLoading')}
            </SelectItem>
          )}
          {hasLibrary && (
            <SelectGroup>
              <SelectLabel>{t('wallAdvancedPanel.sections.dna.fields.libraryGroup')}</SelectLabel>
              {libraryMaterials.map((m) => (
                <SelectItem key={m.id} value={m.id} className="whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    <MaterialSwatch
                      category={m.category}
                      thumbnailUrl={m.thumbnailUrl}
                      albedoUrl={m.pbrTextures?.albedoUrl}
                    />
                    <span>{m.nameEl}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          <SelectGroup>
            {hasLibrary && (
              <SelectLabel>{t('wallAdvancedPanel.sections.dna.fields.presetsGroup')}</SelectLabel>
            )}
            {presetOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id} className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <MaterialSwatch materialId={opt.id} />
                  <span>{t(`wallAdvancedPanel.materials.preset.${opt.labelKeySuffix}`)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
          {customOption && (
            <SelectItem value={customOption.id} className="whitespace-nowrap">
              {t(`wallAdvancedPanel.materials.preset.${customOption.labelKeySuffix}`)}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {isCustomLike && (
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
