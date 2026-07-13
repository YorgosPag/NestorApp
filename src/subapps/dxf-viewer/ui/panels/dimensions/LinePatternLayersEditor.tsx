'use client';

/**
 * LinePatternLayersEditor — compound (multi-layer) pattern editor (ADR-642 Φ5, #9).
 *
 * Wraps N single-layer `LinePatternSegmentsEditor` instances (one per compound layer) + a
 * perpendicular `offsetMm` field per layer + an "add layer" bar + a preset picker (road /
 * railway) + ONE compound WYSIWYG preview at the top. ONE SSoT (N.18): the per-layer segment
 * rows reuse the existing single-layer editor VERBATIM (their own preview off — the compound
 * preview owns the whole picture); the layer↔`ComplexLinetypeDef` math lives in
 * `config/line-pattern-segments.ts`; presets in `config/linetype-compound-presets.ts`.
 *
 * i18n-agnostic: labels arrive as a prop bag (`buildLinePatternLayersLabels`) so the host feeds
 * its own namespace — no hardcoded strings, no `useTranslation` coupling here.
 */

import React from 'react';
import { Plus, Trash2, AlignVerticalJustifyCenter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  type LinePatternLayer,
  type LinePatternSegment,
  defaultCompoundLayer,
  centerOffsetForLayer,
} from '../../../config/line-pattern-segments';
import { listCompoundPresets } from '../../../config/linetype-compound-presets';
import {
  LinePatternSegmentsEditor,
  NumField,
  type LinePatternSegmentsLabels,
  buildLinePatternSegmentsLabels,
} from './LinePatternSegmentsEditor';
import { CompoundPatternPreview } from './LinePatternPreviews';
import type { LinePatternGripLabels } from './LinePatternGripOverlay';

/** Perpendicular offset (mm) a freshly-added layer starts at (below the previous one). */
const NEW_LAYER_OFFSET_STEP_MM = 1;

/** i18n labels for the compound editor — the single-layer `base` bag + compound-specific keys. */
export interface LinePatternLayersLabels {
  readonly base: LinePatternSegmentsLabels;
  readonly previewLabel: string;
  readonly layersLabel: string;
  readonly offset: string;
  readonly addLayer: string;
  readonly removeLayer: string;
  readonly centerLayer: string;
  readonly layerName: (index: number) => string;
  readonly presetsLabel: string;
  readonly presetName: (id: string) => string;
  /** ADR-642 Φ6-A — aria labels for the 8-handle grip editor on the preview swatch. */
  readonly grips: LinePatternGripLabels;
}

/**
 * Build the compound editor's label bag from the namespace-scoped `t`-accessor — the SSoT the
 * dialog calls so the label→key mapping lives once (mirror `buildLinePatternSegmentsLabels`).
 */
export function buildLinePatternLayersLabels(
  e: (key: string) => string,
): LinePatternLayersLabels {
  return {
    base: buildLinePatternSegmentsLabels(e),
    previewLabel: e('previewLabel'),
    layersLabel: e('compound.layers'),
    offset: e('compound.offset'),
    addLayer: e('compound.addLayer'),
    removeLayer: e('compound.removeLayer'),
    centerLayer: e('compound.centerLayer'),
    layerName: (i) => `${e('compound.layer')} ${i + 1}`,
    presetsLabel: e('compound.presets'),
    presetName: (id) => e(`compound.presetNames.${id}`),
    grips: {
      title: e('grips.title'),
      spread: e('grips.spread'),
      length: e('grips.length'),
      corner: e('grips.corner'),
    },
  };
}

export interface LinePatternLayersEditorProps {
  readonly layers: readonly LinePatternLayer[];
  readonly onChange: (layers: LinePatternLayer[]) => void;
  readonly labels: LinePatternLayersLabels;
  /** i18n'd validation message shown under the list (host resolves the code). */
  readonly patternError?: string | null;
  /**
   * `'split'` → two columns (big preview + presets on the left, scrollable layers on the right) for the
   * roomy dialog· `'stacked'` (default) → the compact single-column flow for a narrow host.
   */
  readonly layout?: 'stacked' | 'split';
}

export function LinePatternLayersEditor({
  layers,
  onChange,
  labels,
  patternError,
  layout = 'stacked',
}: LinePatternLayersEditorProps): React.ReactElement {
  const patchLayer = (index: number, patch: Partial<LinePatternLayer>) =>
    onChange(layers.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const addLayer = () => {
    const maxOffset = layers.reduce((m, l) => Math.max(m, Math.abs(l.offsetMm)), 0);
    onChange([...layers, defaultCompoundLayer(maxOffset + NEW_LAYER_OFFSET_STEP_MM)]);
  };

  const removeLayer = (index: number) => onChange(layers.filter((_, i) => i !== index));

  const applyPreset = (id: string) => {
    const preset = listCompoundPresets().find((p) => p.id === id);
    if (preset) onChange(preset.build());
  };

  const split = layout === 'split';
  // Built once, arranged per layout → no duplicated JSX across the two column shapes (N.18).
  const preview = (
    <CompoundPatternPreview
      label={labels.previewLabel}
      layers={layers}
      onLayersChange={onChange}
      gripLabels={labels.grips}
      size={split ? 'lg' : 'sm'}
    />
  );
  const presets = <PresetBar label={labels.presetsLabel} presetName={labels.presetName} onApply={applyPreset} />;
  const layersList = (
    <LayersFieldset
      layers={layers}
      labels={labels}
      patternError={patternError}
      onPatch={patchLayer}
      onAdd={addLayer}
      onRemove={removeLayer}
    />
  );

  if (split) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <aside className="flex flex-col gap-3">
          {preview}
          {presets}
        </aside>
        <section className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">{layersList}</section>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {preview}
      {presets}
      {layersList}
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

/** The «Στρώματα» list — one `LayerCard` per compound layer + an «add layer» bar + the validation note. */
function LayersFieldset({
  layers, labels, patternError, onPatch, onAdd, onRemove,
}: {
  layers: readonly LinePatternLayer[];
  labels: LinePatternLayersLabels;
  patternError?: string | null;
  onPatch: (index: number, patch: Partial<LinePatternLayer>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0 m-0">
      <legend className="text-xs font-medium mb-1">{labels.layersLabel}</legend>
      {layers.map((layer, i) => (
        <LayerCard
          key={i}
          index={i}
          layer={layer}
          labels={labels}
          canRemove={layers.length > 1}
          canCenter={layers.length > 1}
          onOffset={(v) => onPatch(i, { offsetMm: v })}
          onCenter={() => onPatch(i, { offsetMm: centerOffsetForLayer(layers, i) })}
          onSegments={(segments) => onPatch(i, { segments })}
          onRemove={() => onRemove(i)}
        />
      ))}
      <div className="flex items-center gap-2 mt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onAdd}>
          <PlusIcon />
          {labels.addLayer}
        </Button>
      </div>
      {patternError && (
        <p className="text-xs text-destructive mt-1" role="alert">
          {patternError}
        </p>
      )}
    </fieldset>
  );
}

function PlusIcon() {
  const iconSizes = useIconSizes();
  return <Plus className={iconSizes.sm} />;
}

/** The ready-made compound picker (road / railway) — applying one replaces the layer list. */
function PresetBar({
  label, presetName, onApply,
}: {
  label: string;
  presetName: (id: string) => string;
  onApply: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <Select value="" onValueChange={onApply}>
        <SelectTrigger className="h-7 text-xs w-full" aria-label={label}><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {listCompoundPresets().map((p) => (
            <SelectItem key={p.id} value={p.id} className="text-xs">{presetName(p.id)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** One compound layer: header (name + offset field + centre + remove) + the nested single-layer editor. */
function LayerCard({
  index, layer, labels, canRemove, canCenter, onOffset, onCenter, onSegments, onRemove,
}: {
  index: number;
  layer: LinePatternLayer;
  labels: LinePatternLayersLabels;
  canRemove: boolean;
  canCenter: boolean;
  onOffset: (v: number) => void;
  onCenter: () => void;
  onSegments: (segments: LinePatternSegment[]) => void;
  onRemove: () => void;
}) {
  const iconSizes = useIconSizes();
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border/60 p-2">
      <div className="flex items-end gap-2">
        <span className="text-xs font-medium pb-1">{labels.layerName(index)}</span>
        <NumField label={labels.offset} value={layer.offsetMm} step={0.25} onChange={onOffset} />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto"
          onClick={onCenter}
          disabled={!canCenter}
          aria-label={labels.centerLayer}
        >
          <AlignVerticalJustifyCenter className={iconSizes.sm} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={labels.removeLayer}
        >
          <Trash2 className={iconSizes.sm} />
        </Button>
      </div>
      <LinePatternSegmentsEditor
        segments={layer.segments}
        onChange={onSegments}
        labels={labels.base}
        showPreview={false}
      />
    </div>
  );
}
