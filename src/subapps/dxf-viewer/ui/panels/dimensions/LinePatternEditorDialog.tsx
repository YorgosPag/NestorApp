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
  type LinePatternSegment,
  DEFAULT_SEGMENT_LENGTH_MM,
  segmentsToDashPattern,
  segmentsToComplex,
  hasTextSegments,
  describeSegments,
  validateLinePattern,
} from '../../../config/line-pattern-segments';
import {
  listSelectableLinetypeNames,
  registerUserLinetype,
} from '../../../stores/LinetypeRegistry';
// ADR-510 Φ2E #4 — the segment list UI is now the shared editor (reused by the
// inline left-Properties LinePropertiesTab too). The dialog keeps only the name
// field + registration; the segment rows/add-bar/preview live in one SSoT.
import {
  LinePatternSegmentsEditor,
  buildLinePatternSegmentsLabels,
} from './LinePatternSegmentsEditor';

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

  const save = () => {
    if (!validation.ok) return;
    const trimmed = name.trim();
    const description = describeSegments(segments);
    // ADR-642 Φ2 — a text-carrying pattern is stored as a full `complex` def (the
    // `pattern` keeps the geometry-only fallback); simple patterns pass `complex` undefined.
    const complex = hasTextSegments(segments)
      ? segmentsToComplex(trimmed, segments, description)
      : undefined;
    const created = registerUserLinetype(trimmed, pattern, description, complex);
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

          <LinePatternSegmentsEditor
            segments={segments}
            onChange={setSegments}
            labels={buildLinePatternSegmentsLabels(e)}
            patternError={validation.patternError ? e(`errors.${validation.patternError}`) : null}
          />
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
