'use client';

/**
 * ADR-412 — slab build-up (DNA) layer editor for the «Edit Slab Type» dialog.
 *
 * Slab analogue of `WallDnaEditor`. Self-contained (no slab-dna-mutations module):
 * the mutations are trivial array ops that recompute `totalThickness` via the
 * entity-agnostic SSoT `computeSlabTotalThickness` — keeping the SSoT invariant
 * `thickness === dna.totalThickness` (the consumer derives `thickness` from the
 * returned dna). Layers read top→bottom; each carries a zone (top|core|bottom,
 * Revit Core Boundary).
 *
 * Bidirectional highlight (ADR-414): row hover/focus broadcasts to the preview;
 * the preview pick lights the row.
 *
 * @see ../../wall-advanced-panel/sections/WallDnaEditor.tsx — the wall sibling
 * @see ../../../bim/types/slab-dna-types.ts
 */

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SlabKind } from '../../../bim/types/slab-types';
import {
  computeSlabTotalThickness,
  getDefaultSlabBuildupForKind,
  type SlabDna,
  type SlabDnaLayer,
  type SlabLayerZone,
} from '../../../bim/types/slab-dna-types';

const LAYER_ZONES: readonly SlabLayerZone[] = ['top', 'core', 'bottom'];

/** Common slab material ids (preset picker). Custom ids stay typeable. */
const SLAB_MATERIAL_IDS: readonly string[] = [
  'mat-concrete',
  'mat-screed',
  'mat-insulation',
  'mat-tile',
  'mat-plaster',
  'mat-membrane',
  'mat-gravel',
  'mat-finish',
  'mat-wood',
];

// ─── Pure mutations (recompute totalThickness via SSoT) ──────────────────────

function withTotal(layers: readonly SlabDnaLayer[]): SlabDna {
  return { layers, totalThickness: computeSlabTotalThickness(layers) };
}

function updateLayer(dna: SlabDna, id: string, patch: Partial<Omit<SlabDnaLayer, 'id'>>): SlabDna {
  return withTotal(dna.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
}

function removeLayer(dna: SlabDna, id: string): SlabDna {
  return withTotal(dna.layers.filter((l) => l.id !== id));
}

function reorderLayer(dna: SlabDna, index: number, dir: -1 | 1): SlabDna {
  const next = index + dir;
  if (next < 0 || next >= dna.layers.length) return dna;
  const layers = [...dna.layers];
  [layers[index], layers[next]] = [layers[next], layers[index]];
  return withTotal(layers);
}

function addLayer(dna: SlabDna): SlabDna {
  let n = dna.layers.length;
  let id = `slab-layer-${n}`;
  const ids = new Set(dna.layers.map((l) => l.id));
  while (ids.has(id)) id = `slab-layer-${++n}`;
  const layer: SlabDnaLayer = {
    id,
    name: 'Layer',
    thickness: 50,
    materialId: 'mat-concrete',
    zone: 'core',
  };
  return withTotal([...dna.layers, layer]);
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface SlabDnaEditorProps {
  readonly dna: SlabDna | undefined;
  /** Kind drives the «Load preset» default. */
  readonly kind: SlabKind;
  /** Total-thickness readout when there is no DNA (the manual thickness). */
  readonly fallbackThickness: number;
  /** Mutation sink. `undefined` = detach DNA (caller keeps manual thickness). */
  readonly onChange: (next: SlabDna | undefined) => void;
  readonly highlightLayerId?: string | null;
  readonly onHighlightLayer?: (layerId: string | null) => void;
}

export function SlabDnaEditor({
  dna,
  kind,
  fallbackThickness,
  onChange,
  highlightLayerId = null,
  onHighlightLayer,
}: SlabDnaEditorProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');

  const onLoadPreset = useCallback(() => onChange(getDefaultSlabBuildupForKind(kind)), [kind, onChange]);
  const onAdd = useCallback(() => { if (dna) onChange(addLayer(dna)); }, [dna, onChange]);
  const onDetach = useCallback(() => onChange(undefined), [onChange]);

  return (
    <section aria-label={t('ribbon.commands.slabFamilyType.dna.title')} className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          {t('ribbon.commands.slabFamilyType.dna.title')}
        </h4>
        <span className="text-xs text-muted-foreground">
          {t('ribbon.commands.slabFamilyType.dna.totalThickness', {
            value: Math.round(dna?.totalThickness ?? fallbackThickness),
          })}
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onLoadPreset}
          className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground hover:bg-accent"
        >
          {t('ribbon.commands.slabFamilyType.dna.loadPreset')}
        </button>
        {dna && (
          <>
            <button
              type="button"
              onClick={onAdd}
              className="rounded border border-[hsl(var(--text-success))] bg-[hsl(var(--status-success))] px-2 py-1 text-xs text-white hover:bg-[hsl(var(--status-success))]/90"
            >
              {t('ribbon.commands.slabFamilyType.dna.addLayer')}
            </button>
            <button
              type="button"
              onClick={onDetach}
              className="rounded border border-[hsl(var(--text-warning))] bg-[hsl(var(--bg-warning))]/70 px-2 py-1 text-xs text-white hover:bg-[hsl(var(--bg-warning))]/90"
            >
              {t('ribbon.commands.slabFamilyType.dna.detach')}
            </button>
          </>
        )}
      </div>

      {!dna && (
        <p className="rounded border border-border bg-card/50 p-2 text-xs text-foreground">
          {t('ribbon.commands.slabFamilyType.dna.detachedHint')}
        </p>
      )}

      {dna && (
        <ol className="flex flex-col gap-2">
          {dna.layers.map((layer, index) => (
            <li key={layer.id}>
              <SlabLayerRow
                layer={layer}
                index={index}
                count={dna.layers.length}
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
      )}
    </section>
  );
}

// ─── Single layer row ────────────────────────────────────────────────────────

interface SlabLayerRowProps {
  readonly layer: SlabDnaLayer;
  readonly index: number;
  readonly count: number;
  readonly isHighlighted: boolean;
  readonly onHighlight?: (layerId: string | null) => void;
  readonly onRemove: () => void;
  readonly onUpdate: (patch: Partial<Omit<SlabDnaLayer, 'id'>>) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}

function SlabLayerRow(props: SlabLayerRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const {
    layer, index, count, isHighlighted, onHighlight,
    onRemove, onUpdate, onMoveUp, onMoveDown,
  } = props;
  const isPreset = SLAB_MATERIAL_IDS.includes(layer.materialId);
  const highlightClass = isHighlighted
    ? 'border-[hsl(var(--ring))] ring-1 ring-[hsl(var(--ring))]'
    : 'border-border';
  const btn = 'rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-accent disabled:opacity-40';
  return (
    <div
      onPointerEnter={() => onHighlight?.(layer.id)}
      onPointerLeave={() => onHighlight?.(null)}
      onFocusCapture={() => onHighlight?.(layer.id)}
      className={`flex flex-col gap-1 rounded border bg-card/40 p-2 ${highlightClass}`}
    >
      <div className="flex items-center gap-2">
        <select
          aria-label={t('ribbon.commands.slabFamilyType.dna.fields.zone')}
          value={layer.zone}
          onChange={(e) => onUpdate({ zone: e.target.value as SlabLayerZone })}
          className="rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
        >
          {LAYER_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {t(`ribbon.commands.layeredBuildup.zone.${zone}`)}
            </option>
          ))}
        </select>
        <input
          type="text"
          aria-label={t('ribbon.commands.slabFamilyType.dna.fields.name')}
          value={layer.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
        />
        <span className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={index === 0} className={btn}
            aria-label={t('ribbon.commands.slabFamilyType.dna.moveUp')}>↑</button>
          <button type="button" onClick={onMoveDown} disabled={index === count - 1} className={btn}
            aria-label={t('ribbon.commands.slabFamilyType.dna.moveDown')}>↓</button>
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('ribbon.commands.slabFamilyType.dna.removeLayer')}
          className="rounded border border-destructive bg-destructive/70 px-2 py-0.5 text-xs text-destructive-foreground hover:bg-destructive/90"
        >
          ×
        </button>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-foreground">
          <span className="w-16 shrink-0">{t('ribbon.commands.slabFamilyType.dna.fields.thickness')}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={layer.thickness}
            onChange={(e) => onUpdate({ thickness: parseFloat(e.target.value) || 0 })}
            className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
          />
        </label>
        <span className="flex flex-1 items-center gap-1">
          <select
            aria-label={t('ribbon.commands.slabFamilyType.dna.fields.material')}
            value={isPreset ? layer.materialId : '__custom__'}
            onChange={(e) => onUpdate({ materialId: e.target.value === '__custom__' ? '' : e.target.value })}
            className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
          >
            {SLAB_MATERIAL_IDS.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
            <option value="__custom__">{t('ribbon.commands.slabFamilyType.dna.fields.materialCustom')}</option>
          </select>
          {!isPreset && (
            <input
              type="text"
              value={layer.materialId}
              onChange={(e) => onUpdate({ materialId: e.target.value })}
              placeholder={t('ribbon.commands.slabFamilyType.dna.fields.materialCustom')}
              className="w-24 rounded border border-border bg-background px-1 py-0.5 text-xs text-foreground"
            />
          )}
        </span>
      </div>
    </div>
  );
}
