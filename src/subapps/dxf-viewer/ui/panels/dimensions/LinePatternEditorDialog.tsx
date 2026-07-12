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
  type LinePatternLayer,
  DEFAULT_SEGMENT_LENGTH_MM,
  segmentsToDashPattern,
  layersToComplex,
  hasComplexSegments,
  isCompound,
  describeLayers,
  validateLinePatternLayers,
} from '../../../config/line-pattern-segments';
import {
  listSelectableLinetypeNames,
  registerUserLinetype,
} from '../../../stores/LinetypeRegistry';
// ADR-510 Φ2E #4 / ADR-642 Φ5 — the segment UI is the shared editor; compound (multi-layer)
// patterns wrap it via `LinePatternLayersEditor`. The dialog keeps only the name field +
// registration; the layer/segment rows + preview live in one SSoT.
import {
  LinePatternLayersEditor,
  buildLinePatternLayersLabels,
} from './LinePatternLayersEditor';

/** A sensible starting point: one centre layer with one dash + one gap (a plain dashed pattern). */
function initialLayers(): LinePatternLayer[] {
  return [
    {
      segments: [
        { kind: 'dash', lengthMm: 5 },
        { kind: 'gap', lengthMm: DEFAULT_SEGMENT_LENGTH_MM },
      ],
      offsetMm: 0,
    },
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
  const [layers, setLayers] = React.useState<LinePatternLayer[]>(initialLayers);

  // Geometry-only fallback pattern = the base (first) layer — what a simple picker/renderer reads.
  const pattern = React.useMemo(
    () => segmentsToDashPattern(layers[0]?.segments ?? []),
    [layers],
  );
  const existingNames = listSelectableLinetypeNames();
  const validation = validateLinePatternLayers(name, layers, existingNames);

  const reset = React.useCallback(() => {
    setName('');
    setLayers(initialLayers());
  }, []);

  const close = React.useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const save = () => {
    if (!validation.ok) return;
    const trimmed = name.trim();
    const description = describeLayers(layers);
    // ADR-642 Φ2/Φ3/Φ5 — a compound (multi-layer / offset) OR text/symbol-carrying pattern is
    // stored as a full `complex` def (the `pattern` keeps the base-layer geometry-only fallback);
    // a plain single-layer dash pattern passes `undefined`.
    const needsComplex = isCompound(layers) || layers.some((l) => hasComplexSegments(l.segments));
    const complex = needsComplex ? layersToComplex(trimmed, layers, description) : undefined;
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

          <LinePatternLayersEditor
            layers={layers}
            onChange={setLayers}
            labels={buildLinePatternLayersLabels(e)}
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
