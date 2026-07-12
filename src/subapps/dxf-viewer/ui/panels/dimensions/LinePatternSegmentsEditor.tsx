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
  DEFAULT_SEGMENT_LENGTH_MM,
  LINETYPE_TEXT_STYLE_OPTIONS,
  defaultTextSegment,
  hasTextSegments,
  segmentsToComplex,
  segmentsToDashPattern,
} from '../../../config/line-pattern-segments';
import { buildLinetypeThumbnailFromPattern } from '../../../rendering/linetype-thumbnail';
import { strokeStyledPolyline } from '../../../rendering/linetype/ComplexLineStroker';

/** The three geometry segment kinds shown in the in-row kind picker. */
export const SEGMENT_KINDS: readonly LinePatternGeometrySegment['kind'][] = ['dash', 'gap', 'dot'];

/** All segment kinds offered by the add bar (geometry + embedded text). */
const ADD_KINDS: readonly LinePatternSegmentKind[] = ['dash', 'gap', 'dot', 'text'];

/** Screen px per mm for the text preview canvas — makes a default (scale 1) glyph legible. */
const PREVIEW_PX_PER_MM = 4;

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
}

export function LinePatternSegmentsEditor({
  segments,
  onChange,
  labels,
  patternError,
  showPreview = true,
  allowText = true,
}: LinePatternSegmentsEditorProps): React.ReactElement {
  const pattern = React.useMemo(() => segmentsToDashPattern(segments), [segments]);
  const hasText = React.useMemo(() => hasTextSegments(segments), [segments]);

  const addSegment = (kind: LinePatternSegmentKind) =>
    onChange([
      ...segments,
      kind === 'text' ? defaultTextSegment() : { kind, lengthMm: kind === 'dot' ? 0 : DEFAULT_SEGMENT_LENGTH_MM },
    ]);

  const patchGeometry = (index: number, patch: Partial<LinePatternGeometrySegment>) =>
    onChange(segments.map((s, i) => (i === index && s.kind !== 'text' ? { ...s, ...patch } : s)));

  const patchText = (index: number, patch: Partial<LinePatternTextSegment>) =>
    onChange(segments.map((s, i) => (i === index && s.kind === 'text' ? { ...s, ...patch } : s)));

  const removeSegment = (index: number) => onChange(segments.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {showPreview && (hasText
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
        <AddSegmentBar kinds={allowText ? ADD_KINDS : SEGMENT_KINDS} addLabel={labels.add} onAdd={addSegment} />
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

function PatternPreview({ label, pattern }: { label: string; pattern: readonly number[] }) {
  const thumb = buildLinetypeThumbnailFromPattern(pattern, 220, 16);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <svg
        viewBox={`0 0 ${thumb.width} ${thumb.height}`}
        className="h-4 w-full rounded-sm border border-border"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={thumb.height / 2}
          x2={thumb.width}
          y2={thumb.height / 2}
          stroke="currentColor"
          strokeWidth={1.25}
          strokeDasharray={thumb.dash.length > 0 ? thumb.dash.join(' ') : undefined}
        />
      </svg>
    </div>
  );
}

/**
 * WYSIWYG preview for a text-carrying pattern — strokes a horizontal line through the
 * REAL `strokeStyledPolyline` SSoT, so `──GAS──` renders exactly as it will on canvas.
 */
function TextPatternPreview({ label, segments }: { label: string; segments: readonly LinePatternSegment[] }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = window.getComputedStyle(canvas).color || '#111';
    ctx.lineWidth = 1.25;
    const def = segmentsToComplex('__preview__', segments);
    const midY = h / 2;
    strokeStyledPolyline(ctx, [{ x: 6, y: midY }, { x: w - 6, y: midY }], def, {
      worldToScreenScale: PREVIEW_PX_PER_MM,
      ltscale: 1,
    });
  }, [segments]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
      <canvas ref={ref} className="h-9 w-full rounded-sm border border-border" aria-hidden="true" />
    </div>
  );
}

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

/** Embedded-text row (ADR-642 Φ2): value + style picker + scale/rotation/offset + follow-path. */
function TextSegmentRow({
  seg, labels, onPatch, onRemove,
}: {
  seg: LinePatternTextSegment;
  labels: LinePatternSegmentsLabels;
  onPatch: (patch: Partial<LinePatternTextSegment>) => void;
  onRemove: () => void;
}) {
  const iconSizes = useIconSizes();
  const t = labels.text;
  return (
    <div className="flex flex-col gap-1.5 rounded-sm border border-border/60 p-2">
      <div className="flex items-center gap-2">
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label={labels.removeSegment}>
          <Trash2 className={iconSizes.sm} />
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <NumField label={t.scale} value={seg.scale} step={0.1} onChange={(v) => onPatch({ scale: v })} />
        <NumField label={t.rotation} value={seg.rotationDeg} step={1} onChange={(v) => onPatch({ rotationDeg: v })} />
        <NumField label={t.offsetX} value={seg.offsetXMm} step={0.1} onChange={(v) => onPatch({ offsetXMm: v })} />
        <NumField label={t.offsetY} value={seg.offsetYMm} step={0.1} onChange={(v) => onPatch({ offsetYMm: v })} />
        <label className="flex items-center gap-1.5 pb-1 ml-auto">
          <Switch checked={seg.followPath} onCheckedChange={(v) => onPatch({ followPath: v })} />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t.followPath}</span>
        </label>
      </div>
    </div>
  );
}

/** Compact labelled numeric input used by the text row (scale / rotation / offsets). */
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
