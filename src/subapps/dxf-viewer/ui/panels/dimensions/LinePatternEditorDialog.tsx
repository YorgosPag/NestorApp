'use client';

/**
 * ADR-362 (Path B) — Line Pattern editor (Revit-style «Line Patterns»).
 *
 * A small reusable-pattern authoring dialog: the user builds an explicit segment
 * list (Dash length / Gap length / Dot) → registered as a USER-CREATED linetype
 * in the runtime `LinetypeRegistry` (persisted, ADR-362). It then appears by NAME
 * in every linetype picker (dimension `LinetypeField`, line ribbon) — reusable,
 * exactly like AutoCAD LTYPE / Revit Line Patterns (no per-object dash editing).
 *
 * FULL SSoT: segment↔pattern math = `config/line-pattern-segments.ts`; live
 * preview dash = the SAME `buildLinetypeThumbnailFromPattern` + `dashMmToScreenPx`
 * the renderer uses; registration = the ONE `registerUserLinetype` mutation.
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  describeSegments,
  validateLinePattern,
} from '../../../config/line-pattern-segments';
import {
  listSelectableLinetypeNames,
  registerUserLinetype,
} from '../../../stores/LinetypeRegistry';
import { buildLinetypeThumbnailFromPattern } from '../../../rendering/linetype-thumbnail';

const SEGMENT_KINDS: readonly LinePatternSegmentKind[] = ['dash', 'gap', 'dot'];

/** A sensible starting point: one dash + one gap (a plain dashed pattern). */
function initialSegments(): LinePatternSegment[] {
  return [
    { kind: 'dash', lengthMm: 5 },
    { kind: 'gap', lengthMm: DEFAULT_SEGMENT_LENGTH_MM },
  ];
}

interface LinePatternEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new linetype name after a successful registration. */
  onCreated?: (name: string) => void;
}

export function LinePatternEditorDialog({
  open,
  onOpenChange,
  onCreated,
}: LinePatternEditorDialogProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const e = (key: string) => t(`panels.dimensions.linePatternEditor.${key}`);

  const [name, setName] = React.useState('');
  const [segments, setSegments] = React.useState<LinePatternSegment[]>(initialSegments);

  const pattern = React.useMemo(() => segmentsToDashPattern(segments), [segments]);
  const existingNames = listSelectableLinetypeNames();
  const validation = validateLinePattern(name, segments, existingNames);

  const reset = React.useCallback(() => {
    setName('');
    setSegments(initialSegments());
  }, []);

  const close = React.useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const addSegment = (kind: LinePatternSegmentKind) =>
    setSegments((prev) => [...prev, { kind, lengthMm: kind === 'dot' ? 0 : DEFAULT_SEGMENT_LENGTH_MM }]);

  const patchSegment = (index: number, patch: Partial<LinePatternSegment>) =>
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const removeSegment = (index: number) =>
    setSegments((prev) => prev.filter((_, i) => i !== index));

  const save = () => {
    if (!validation.ok) return;
    const created = registerUserLinetype(name.trim(), pattern, describeSegments(segments));
    if (created) onCreated?.(created.name);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{e('title')}</DialogTitle>
          <DialogDescription>{e('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <NameRow
            label={e('nameLabel')}
            placeholder={e('namePlaceholder')}
            value={name}
            onChange={setName}
            error={validation.nameError ? e(`errors.${validation.nameError}`) : null}
          />

          <PatternPreview label={e('previewLabel')} pattern={pattern} />

          <fieldset className="flex flex-col gap-1.5 border-0 p-0 m-0">
            <legend className="text-xs font-medium mb-1">{e('segmentsLabel')}</legend>
            {segments.map((seg, i) => (
              <SegmentRow
                key={i}
                seg={seg}
                kindLabel={(k) => e(`kinds.${k}`)}
                lengthUnit={e('mm')}
                removeLabel={e('removeSegment')}
                onKind={(k) => patchSegment(i, { kind: k, lengthMm: k === 'dot' ? 0 : seg.lengthMm || DEFAULT_SEGMENT_LENGTH_MM })}
                onLength={(v) => patchSegment(i, { lengthMm: v })}
                onRemove={() => removeSegment(i)}
              />
            ))}
            <AddSegmentBar
              addLabel={(k) => e(`add.${k}`)}
              onAdd={addSegment}
            />
            {validation.patternError && (
              <p className="text-xs text-destructive mt-1" role="alert">
                {e(`errors.${validation.patternError}`)}
              </p>
            )}
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={close}>{e('cancel')}</Button>
          <Button size="sm" onClick={save} disabled={!validation.ok}>{e('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function NameRow({
  label, placeholder, value, onChange, error,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; error: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="line-pattern-name" className="text-xs">{label}</Label>
      <Input
        id="line-pattern-name"
        value={value}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        className="h-7 text-xs"
      />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}

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
