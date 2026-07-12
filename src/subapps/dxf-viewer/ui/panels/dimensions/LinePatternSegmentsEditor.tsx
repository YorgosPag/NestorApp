'use client';

/**
 * LinePatternSegmentsEditor — shared «Τμήματα Μοτίβου» editor (ADR-362 / ADR-510 Φ2E #4).
 *
 * The segment list UI (Dash length / Gap length / Dot rows + add bar + live dash
 * preview) extracted VERBATIM from `LinePatternEditorDialog` so it can be reused by
 * BOTH the modal pattern-authoring dialog AND the inline left-Properties
 * `LinePropertiesTab` — one editor, zero clone (N.18). Purely presentational +
 * controlled: it owns NO state, just maps `segments` ⇄ `onChange` and re-shapes the
 * segment list for the shared `config/line-pattern-segments.ts` math.
 *
 * ADR-642 Φ2 (#2) — a fourth row kind, **Text** (`──GAS──`), carries an embedded-text
 * element (value + style + scale/rotation/offset + follow-path). When a text row is
 * present the live preview switches to a real canvas stroke via `strokeStyledPolyline`
 * (the SAME render SSoT the canvas uses) so the preview is exact WYSIWYG, not a second
 * text-drawing mechanism.
 *
 * i18n-agnostic: every label arrives as a prop (`labels`) so each host feeds its own
 * namespace (dialog → `dxf-viewer-panels`, tab → `dxf-viewer-shell`) — no hardcoded
 * text, no `useTranslation` coupling here.
 *
 * FULL SSoT: geometry preview dash = the SAME `buildLinetypeThumbnailFromPattern` the
 * renderer uses; text preview = `strokeStyledPolyline`; segment↔pattern/complex math =
 * `config/line-pattern-segments.ts`.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  type LinePatternGeometrySegment,
  type LinePatternSegment,
  type LinePatternSegmentKind,
  type LinePatternTextSegment,
  type LinePatternSymbolSegment,
  DEFAULT_SEGMENT_LENGTH_MM,
  LINETYPE_TEXT_STYLE_OPTIONS,
  SYMBOL_ROLES,
  defaultTextSegment,
  defaultSymbolSegment,
  hasComplexSegments,
  segmentsToDashPattern,
} from '../../../config/line-pattern-segments';
import type { SymbolRole } from '../../../config/complex-linetype-types';
import { listLinetypeSymbols } from '../../../config/linetype-symbol-catalog';
import { PatternPreview, TextPatternPreview } from './LinePatternPreviews';

/** The three geometry segment kinds shown in the in-row kind picker. */
export const SEGMENT_KINDS: readonly LinePatternGeometrySegment['kind'][] = ['dash', 'gap', 'dot'];

/** Every builtin symbol glyph id (picker source) — resolved once at module load. */
const SYMBOL_GLYPH_IDS: readonly string[] = listLinetypeSymbols().map((g) => g.id);

/** i18n labels the host supplies (namespace-agnostic — no hardcoded strings here). */
export interface LinePatternSegmentsLabels {
  readonly segmentsLabel: string;
  readonly previewLabel: string;
  readonly mm: string;
  readonly removeSegment: string;
  readonly kind: (k: LinePatternSegmentKind) => string;
  readonly add: (k: LinePatternSegmentKind) => string;
  /** Embedded-text row field labels (ADR-642 Φ2). */
  readonly text: {
    readonly value: string;
    readonly valuePlaceholder: string;
    readonly style: string;
    readonly scale: string;
    readonly rotation: string;
    readonly offsetX: string;
    readonly offsetY: string;
    readonly followPath: string;
  };
  /** Embedded-symbol row field labels + per-glyph names + placement roles (ADR-642 Φ3/Φ4). */
  readonly symbol: {
    readonly glyph: string;
    readonly role: string;
    readonly scale: string;
    readonly rotation: string;
    readonly offsetX: string;
    readonly offsetY: string;
    readonly glyphName: (id: string) => string;
    readonly roleName: (r: SymbolRole) => string;
  };
}

/**
 * Build the editor's label bag from a namespace-scoped `t`-accessor — the SSoT
 * both the modal dialog and the inline tab call so the label→key mapping lives
 * once (no duplicated object literal across the two hosts).
 */
export function buildLinePatternSegmentsLabels(
  e: (key: string) => string,
): LinePatternSegmentsLabels {
  return {
    segmentsLabel: e('segmentsLabel'),
    previewLabel: e('previewLabel'),
    mm: e('mm'),
    removeSegment: e('removeSegment'),
    kind: (k) => e(`kinds.${k}`),
    add: (k) => e(`add.${k}`),
    text: {
      value: e('text.value'),
      valuePlaceholder: e('text.valuePlaceholder'),
      style: e('text.style'),
      scale: e('text.scale'),
      rotation: e('text.rotation'),
      offsetX: e('text.offsetX'),
      offsetY: e('text.offsetY'),
      followPath: e('text.followPath'),
    },
    symbol: {
      glyph: e('symbol.glyph'),
      role: e('symbol.role'),
      scale: e('symbol.scale'),
      rotation: e('symbol.rotation'),
      offsetX: e('symbol.offsetX'),
      offsetY: e('symbol.offsetY'),
      glyphName: (id) => e(`symbol.glyphs.${id}`),
      roleName: (r) => e(`symbol.roles.${r}`),
    },
  };
}

export interface LinePatternSegmentsEditorProps {
  readonly segments: readonly LinePatternSegment[];
  readonly onChange: (segments: LinePatternSegment[]) => void;
  readonly labels: LinePatternSegmentsLabels;
  /** i18n'd validation message shown under the list (host resolves the code). */
  readonly patternError?: string | null;
  /** Show the live dash preview above the list (default true). */
  readonly showPreview?: boolean;
  /**
   * Offer the embedded-text row (ADR-642 Φ2). Default true (the «New line type»
   * dialog). The inline per-line COW tab passes false: it reads/writes only the
   * geometry `pattern`, so a text row there would be silently dropped — embedded-text
   * linetypes are authored centrally in the dialog (AutoCAD/Revit convention).
   */
  readonly allowText?: boolean;
  /**
   * Offer the embedded-symbol row (ADR-642 Φ3, `──×──`). Default true (the «New line
   * type» dialog). Like text, the inline per-line COW tab passes false: it edits only the
   * geometry `pattern`, so a symbol row there would be silently dropped — symbol linetypes
   * are authored centrally in the dialog (AutoCAD/Revit convention).
   */
  readonly allowSymbol?: boolean;
}

export function LinePatternSegmentsEditor({
  segments,
  onChange,
  labels,
  patternError,
  showPreview = true,
  allowText = true,
  allowSymbol = true,
}: LinePatternSegmentsEditorProps): React.ReactElement {
  const pattern = React.useMemo(() => segmentsToDashPattern(segments), [segments]);
  // Text OR symbol → the SVG dash preview can't render it, switch to the real canvas stroke.
  const hasComplex = React.useMemo(() => hasComplexSegments(segments), [segments]);

  const addSegment = (kind: LinePatternSegmentKind) =>
    onChange([
      ...segments,
      kind === 'text'
        ? defaultTextSegment()
        : kind === 'symbol'
          ? defaultSymbolSegment()
          : { kind, lengthMm: kind === 'dot' ? 0 : DEFAULT_SEGMENT_LENGTH_MM },
    ]);

  const patchGeometry = (index: number, patch: Partial<LinePatternGeometrySegment>) =>
    onChange(
      segments.map((s, i) =>
        i === index && s.kind !== 'text' && s.kind !== 'symbol' ? { ...s, ...patch } : s,
      ),
    );

  const patchText = (index: number, patch: Partial<LinePatternTextSegment>) =>
    onChange(segments.map((s, i) => (i === index && s.kind === 'text' ? { ...s, ...patch } : s)));

  const patchSymbol = (index: number, patch: Partial<LinePatternSymbolSegment>) =>
    onChange(segments.map((s, i) => (i === index && s.kind === 'symbol' ? { ...s, ...patch } : s)));

  const removeSegment = (index: number) => onChange(segments.filter((_, i) => i !== index));

  const addKinds: readonly LinePatternSegmentKind[] = [
    ...SEGMENT_KINDS,
    ...(allowText ? (['text'] as const) : []),
    ...(allowSymbol ? (['symbol'] as const) : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      {showPreview && (hasComplex
        ? <TextPatternPreview label={labels.previewLabel} segments={segments} />
        : <PatternPreview label={labels.previewLabel} pattern={pattern} />)}

      <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
        <legend className="text-xs font-medium mb-1">{labels.segmentsLabel}</legend>
        {segments.map((seg, i) =>
          seg.kind === 'text' ? (
            <TextSegmentRow
              key={i}
              seg={seg}
              labels={labels}
              onPatch={(patch) => patchText(i, patch)}
              onRemove={() => removeSegment(i)}
            />
          ) : seg.kind === 'symbol' ? (
            <SymbolSegmentRow
              key={i}
              seg={seg}
              labels={labels}
              onPatch={(patch) => patchSymbol(i, patch)}
              onRemove={() => removeSegment(i)}
            />
          ) : (
            <SegmentRow
              key={i}
              seg={seg}
              kindLabel={labels.kind}
              lengthUnit={labels.mm}
              removeLabel={labels.removeSegment}
              onKind={(k) => patchGeometry(i, { kind: k, lengthMm: k === 'dot' ? 0 : seg.lengthMm || DEFAULT_SEGMENT_LENGTH_MM })}
              onLength={(v) => patchGeometry(i, { lengthMm: v })}
              onRemove={() => removeSegment(i)}
            />
          ),
        )}
        <AddSegmentBar kinds={addKinds} addLabel={labels.add} onAdd={addSegment} />
        {patternError && (
          <p className="text-xs text-destructive mt-1" role="alert">
            {patternError}
          </p>
        )}
      </fieldset>
    </div>
  );
}

// ── Subcomponents (shared by the dialog + the inline tab) ─────────────────────

function SegmentRow({
  seg, kindLabel, lengthUnit, removeLabel, onKind, onLength, onRemove,
}: {
  seg: LinePatternGeometrySegment;
  kindLabel: (k: LinePatternSegmentKind) => string;
  lengthUnit: string;
  removeLabel: string;
  onKind: (k: LinePatternGeometrySegment['kind']) => void;
  onLength: (v: number) => void;
  onRemove: () => void;
}) {
  const iconSizes = useIconSizes();
  const isDot = seg.kind === 'dot';
  return (
    <div className="flex items-center gap-2">
      <Select value={seg.kind} onValueChange={(v) => onKind(v as LinePatternGeometrySegment['kind'])}>
        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SEGMENT_KINDS.map((k) => (
            <SelectItem key={k} value={k} className="text-xs">{kindLabel(k)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        min={0}
        step={0.1}
        value={isDot ? '' : seg.lengthMm}
        disabled={isDot}
        onChange={(ev) => onLength(parseFloat(ev.target.value) || 0)}
        className="h-7 text-xs w-24 px-1.5"
      />
      <span className="text-xs text-muted-foreground w-6">{isDot ? '' : lengthUnit}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label={removeLabel}>
        <Trash2 className={iconSizes.sm} />
      </Button>
    </div>
  );
}

/**
 * Shared shell for the two «complex» rows (text `──GAS──` + symbol `──×──`): a bordered
 * card whose header is a `header` picker + a trash button, and whose footer is the
 * `PlacementFields` quartet (+ an optional `extra`, e.g. the text follow-path switch).
 * ONE SSoT (N.18) — both rows differ only in their leading picker + optional extra.
 */
function ComplexSegmentRowShell({
  header, placementLabels, placement, onPlacementChange, extra, onRemove, removeLabel,
}: {
  header: React.ReactNode;
  placementLabels: { readonly scale: string; readonly rotation: string; readonly offsetX: string; readonly offsetY: string };
  placement: { readonly scale: number; readonly rotationDeg: number; readonly offsetXMm: number; readonly offsetYMm: number };
  onPlacementChange: (patch: { scale?: number; rotationDeg?: number; offsetXMm?: number; offsetYMm?: number }) => void;
  extra?: React.ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  const iconSizes = useIconSizes();
  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-border/60 p-2">
      <div className="flex items-center gap-2">
        {header}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label={removeLabel}>
          <Trash2 className={iconSizes.sm} />
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <PlacementFields labels={placementLabels} value={placement} onChange={onPlacementChange} />
        {extra}
      </div>
    </div>
  );
}

/** Embedded-text row (ADR-642 Φ2): value + style picker + scale/rotation/offset + follow-path. */
function TextSegmentRow({
  seg, labels, onPatch, onRemove,
}: {
  seg: LinePatternTextSegment;
  labels: LinePatternSegmentsLabels;
  onPatch: (patch: Partial<LinePatternTextSegment>) => void;
  onRemove: () => void;
}) {
  const t = labels.text;
  return (
    <ComplexSegmentRowShell
      removeLabel={labels.removeSegment}
      onRemove={onRemove}
      placementLabels={t}
      placement={seg}
      onPlacementChange={onPatch}
      header={
        <>
          <Input
            value={seg.value}
            placeholder={t.valuePlaceholder}
            onChange={(ev) => onPatch({ value: ev.target.value })}
            aria-label={t.value}
            className="h-7 text-xs flex-1 px-1.5"
          />
          <Select value={seg.styleId} onValueChange={(v) => onPatch({ styleId: v })}>
            <SelectTrigger className="h-7 text-xs w-32" aria-label={t.style}><SelectValue /></SelectTrigger>
            <SelectContent>
              {LINETYPE_TEXT_STYLE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      extra={
        <label className="flex items-center gap-1.5 pb-1 ml-auto">
          <Switch checked={seg.followPath} onCheckedChange={(v) => onPatch({ followPath: v })} />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t.followPath}</span>
        </label>
      }
    />
  );
}

/** Embedded-symbol row (ADR-642 Φ3): glyph picker + scale/rotation/offset (`──×──`). */
function SymbolSegmentRow({
  seg, labels, onPatch, onRemove,
}: {
  seg: LinePatternSymbolSegment;
  labels: LinePatternSegmentsLabels;
  onPatch: (patch: Partial<LinePatternSymbolSegment>) => void;
  onRemove: () => void;
}) {
  const s = labels.symbol;
  return (
    <ComplexSegmentRowShell
      removeLabel={labels.removeSegment}
      onRemove={onRemove}
      placementLabels={s}
      placement={seg}
      onPlacementChange={onPatch}
      header={
        <>
          <Select value={seg.glyphId} onValueChange={(v) => onPatch({ glyphId: v })}>
            <SelectTrigger className="h-7 text-xs flex-1" aria-label={s.glyph}><SelectValue /></SelectTrigger>
            <SelectContent>
              {SYMBOL_GLYPH_IDS.map((id) => (
                <SelectItem key={id} value={id} className="text-xs">{s.glyphName(id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={seg.role} onValueChange={(v) => onPatch({ role: v as SymbolRole })}>
            <SelectTrigger className="h-7 text-xs w-32" aria-label={s.role}><SelectValue /></SelectTrigger>
            <SelectContent>
              {SYMBOL_ROLES.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{s.roleName(r)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
    />
  );
}

/**
 * The AutoCAD placement quartet (Scale / Rotation / X-offset / Y-offset) shared by the
 * text AND symbol rows — the `["…",STYLE,S,R,X,Y]` fields both element kinds carry. ONE
 * SSoT (N.18): text/symbol both feed their own label bag + patch, no duplicated field list.
 */
function PlacementFields({
  labels, value, onChange,
}: {
  labels: { readonly scale: string; readonly rotation: string; readonly offsetX: string; readonly offsetY: string };
  value: { readonly scale: number; readonly rotationDeg: number; readonly offsetXMm: number; readonly offsetYMm: number };
  onChange: (patch: { scale?: number; rotationDeg?: number; offsetXMm?: number; offsetYMm?: number }) => void;
}) {
  return (
    <>
      <NumField label={labels.scale} value={value.scale} step={0.1} onChange={(v) => onChange({ scale: v })} />
      <NumField label={labels.rotation} value={value.rotationDeg} step={1} onChange={(v) => onChange({ rotationDeg: v })} />
      <NumField label={labels.offsetX} value={value.offsetXMm} step={0.1} onChange={(v) => onChange({ offsetXMm: v })} />
      <NumField label={labels.offsetY} value={value.offsetYMm} step={0.1} onChange={(v) => onChange({ offsetYMm: v })} />
    </>
  );
}

/** Compact labelled numeric input used by the placement rows (scale / rotation / offsets). */
function NumField({
  label, value, step, onChange,
}: {
  label: string; value: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(ev) => onChange(parseFloat(ev.target.value) || 0)}
        className="h-7 text-xs w-16 px-1.5"
      />
    </label>
  );
}

function AddSegmentBar({
  kinds, addLabel, onAdd,
}: {
  kinds: readonly LinePatternSegmentKind[];
  addLabel: (k: LinePatternSegmentKind) => string;
  onAdd: (k: LinePatternSegmentKind) => void;
}) {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-2 mt-1">
      {kinds.map((k) => (
        <Button key={k} variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onAdd(k)}>
          <Plus className={iconSizes.sm} />
          {addLabel(k)}
        </Button>
      ))}
    </div>
  );
}
