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
  complexToLayers,
  singleLayer,
  dashPatternToSegments,
  hasComplexSegments,
  isCompound,
  describeLayers,
  validateLinePatternLayers,
  suggestCopyName,
} from '../../../config/line-pattern-segments';
import {
  listSelectableLinetypeNames,
  registerUserLinetype,
  upsertUserLinetype,
} from '../../../stores/LinetypeRegistry';
import { resolveLinetypeDef } from '../../../rendering/linetype-dash-resolver';
import { isSimpleExpressible } from '../../../config/complex-linetype-adapters';
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
  /**
   * ADR-642 Edit-in-place — when set, the dialog edits this EXISTING user-created
   * linetype in place (name locked, pre-loaded layers, `save()` → upsert) instead of
   * creating a new one. Big-player parity (Revit/AutoCAD): a named user pattern is
   * edited in place and every line that references it updates (same-name upsert).
   */
  editName?: string;
  /**
   * ADR-642 Duplicate & edit — when set (and `editName` is not), the dialog seeds its
   * layers from this SOURCE type (an ISO/built-in/imported read-only type) but with an
   * EDITABLE, pre-suggested new name → `save()` REGISTERS a new user-created type
   * (Revit/ArchiCAD «Duplicate»). The caller's `onCreated` then assigns it to the line.
   */
  duplicateFrom?: string;
}

export function LinePatternEditorDialog({
  open,
  onOpenChange,
  onCreated,
  editName,
  duplicateFrom,
}: LinePatternEditorDialogProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const e = (key: string) => t(`panels.dimensions.linePatternEditor.${key}`);

  const [name, setName] = React.useState('');
  const [layers, setLayers] = React.useState<LinePatternLayer[]>(initialLayers);

  // Pre-load / reset on every open. Edit AND duplicate seed the SOURCE def's layers (compound →
  // `complexToLayers`, simple → the geometry fallback via `singleLayer`); edit locks the name to the
  // source, duplicate pre-fills a free unique copy name (editable); plain create starts fresh.
  React.useEffect(() => {
    if (!open) return;
    const source = editName ?? duplicateFrom;
    if (source) {
      const def = resolveLinetypeDef(source);
      const complex = def?.complex;
      setLayers(
        complex && !isSimpleExpressible(complex)
          ? complexToLayers(complex)
          : singleLayer(dashPatternToSegments(def?.pattern ?? [])),
      );
      setName(editName ?? suggestCopyName(source, listSelectableLinetypeNames()));
    } else {
      setName('');
      setLayers(initialLayers());
    }
  }, [open, editName, duplicateFrom]);

  // Geometry-only fallback pattern = the base (first) layer — what a simple picker/renderer reads.
  const pattern = React.useMemo(
    () => segmentsToDashPattern(layers[0]?.segments ?? []),
    [layers],
  );
  // Edit mode: exclude the edited name from the taken-names set (an in-place edit keeps its own name).
  // Duplicate mode: the new name MUST be unique, so nothing is excluded (`editName` is undefined).
  const existingNames = listSelectableLinetypeNames().filter((n) => n !== editName);
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
    // Edit-in-place → upsert the locked name (all referencing lines update); else register a new type.
    const saved = editName
      ? upsertUserLinetype(editName, pattern, description, complex)
      : registerUserLinetype(trimmed, pattern, description, complex);
    if (saved) onCreated?.(saved.name);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle>{editName ? e('editTitle') : duplicateFrom ? e('duplicateTitle') : e('title')}</DialogTitle>
          <DialogDescription>{e('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <NameRow
            label={e('nameLabel')}
            placeholder={e('namePlaceholder')}
            value={name}
            onChange={setName}
            readOnly={Boolean(editName)}
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
  label, placeholder, value, onChange, error, readOnly = false,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; error: string | null;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="line-pattern-name" className="text-xs">{label}</Label>
      <Input
        id="line-pattern-name"
        value={value}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        readOnly={readOnly}
        className="h-7 text-xs"
      />
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
