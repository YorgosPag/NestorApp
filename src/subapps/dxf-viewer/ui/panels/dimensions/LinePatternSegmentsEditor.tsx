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
 * i18n-agnostic: every label arrives as a prop (`labels`) so each host feeds its own
 * namespace (dialog → `dxf-viewer-panels`, tab → `dxf-viewer-shell`) — no hardcoded
 * text, no `useTranslation` coupling here.
 *
 * FULL SSoT: preview dash = the SAME `buildLinetypeThumbnailFromPattern` the renderer
 * uses; segment↔pattern math = `config/line-pattern-segments.ts`.
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
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  type LinePatternSegment,
  type LinePatternSegmentKind,
  DEFAULT_SEGMENT_LENGTH_MM,
  segmentsToDashPattern,
} from '../../../config/line-pattern-segments';
import { buildLinetypeThumbnailFromPattern } from '../../../rendering/linetype-thumbnail';

/** The three authorable segment kinds, in picker order. */
export const SEGMENT_KINDS: readonly LinePatternSegmentKind[] = ['dash', 'gap', 'dot'];

/** i18n labels the host supplies (namespace-agnostic — no hardcoded strings here). */
export interface LinePatternSegmentsLabels {
  readonly segmentsLabel: string;
  readonly previewLabel: string;
  readonly mm: string;
  readonly removeSegment: string;
  readonly kind: (k: LinePatternSegmentKind) => string;
  readonly add: (k: LinePatternSegmentKind) => string;
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
}

export function LinePatternSegmentsEditor({
  segments,
  onChange,
  labels,
  patternError,
  showPreview = true,
}: LinePatternSegmentsEditorProps): React.ReactElement {
  const pattern = React.useMemo(() => segmentsToDashPattern(segments), [segments]);

  const addSegment = (kind: LinePatternSegmentKind) =>
    onChange([...segments, { kind, lengthMm: kind === 'dot' ? 0 : DEFAULT_SEGMENT_LENGTH_MM }]);

  const patchSegment = (index: number, patch: Partial<LinePatternSegment>) =>
    onChange(segments.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const removeSegment = (index: number) =>
    onChange(segments.filter((_, i) => i !== index));

  return (
    <div className="flex flex-col gap-3">
      {showPreview && <PatternPreview label={labels.previewLabel} pattern={pattern} />}

      <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
        <legend className="text-xs font-medium mb-1">{labels.segmentsLabel}</legend>
        {segments.map((seg, i) => (
          <SegmentRow
            key={i}
            seg={seg}
            kindLabel={labels.kind}
            lengthUnit={labels.mm}
            removeLabel={labels.removeSegment}
            onKind={(k) => patchSegment(i, { kind: k, lengthMm: k === 'dot' ? 0 : seg.lengthMm || DEFAULT_SEGMENT_LENGTH_MM })}
            onLength={(v) => patchSegment(i, { lengthMm: v })}
            onRemove={() => removeSegment(i)}
          />
        ))}
        <AddSegmentBar addLabel={labels.add} onAdd={addSegment} />
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

function SegmentRow({
  seg, kindLabel, lengthUnit, removeLabel, onKind, onLength, onRemove,
}: {
  seg: LinePatternSegment;
  kindLabel: (k: LinePatternSegmentKind) => string;
  lengthUnit: string;
  removeLabel: string;
  onKind: (k: LinePatternSegmentKind) => void;
  onLength: (v: number) => void;
  onRemove: () => void;
}) {
  const iconSizes = useIconSizes();
  const isDot = seg.kind === 'dot';
  return (
    <div className="flex items-center gap-2">
      <Select value={seg.kind} onValueChange={(v) => onKind(v as LinePatternSegmentKind)}>
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

function AddSegmentBar({
  addLabel, onAdd,
}: {
  addLabel: (k: LinePatternSegmentKind) => string;
  onAdd: (k: LinePatternSegmentKind) => void;
}) {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-2 mt-1">
      {SEGMENT_KINDS.map((k) => (
        <Button key={k} variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onAdd(k)}>
          <Plus className={iconSizes.sm} />
          {addLabel(k)}
        </Button>
      ))}
    </div>
  );
}
