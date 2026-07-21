'use client';

/**
 * ADR-505 — Export dialog (Revit-grade «Εξαγωγή»).
 *
 * Controlled Radix Dialog. Owns the form via `useExportDialogState` and
 * delegates the job to `onSubmit(request)` (wired by ExportHost → `runExport`).
 * Three axes: format (DXF/IFC/PDF/TEK/OBJ/glTF), content (DXF/BIM/both), floors
 * (active/zip/single) + per-format fields (DXF version & unit, TEK modes, OBJ unit).
 *
 * ADR-040: N/A (zero canvas, zero useSyncExternalStore).
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { createModuleLogger } from '@/lib/telemetry';
import { DXF_VERSION_NAMES, type DxfVersion } from '../../../types/dxf-export.types';
import type { ExportRequest, ExportLengthUnit } from '../../../export/types';
import { useExportDialogState } from './useExportDialogState';

const logger = createModuleLogger('DXF_EXPORT_DIALOG');

// ADR-668/678 — 'obj'/'gltf'/'dae' = 3Δ mesh εξαγωγή. OBJ ανοίγει σε C4D R15 αλλά άχρωμο· glTF
// για Blender / C4D 2024+· COLLADA (.dae) = το ΜΟΝΟ που το R15 διαβάζει ΜΕ χρώματα (per-face).
const FORMAT_OPTIONS = ['dxf', 'ifc', 'pdf', 'tek', 'obj', 'gltf', 'dae'] as const;
const ENTITY_SCOPE_OPTIONS = ['both', 'dxf-only', 'bim-only'] as const;
const FLOOR_SCOPE_OPTIONS = ['active', 'all-zip', 'all-single'] as const;
const UNIT_OPTIONS = ['millimeters', 'centimeters', 'meters'] as const;
const LINE_MODE_OPTIONS = ['polyline', 'lines'] as const;
// ADR-643 Φ5b — image-fill hatch export: 'solid' (Ελαφρύ, μέσο χρώμα, single-file) / 'image'
// (Πιστό, tiled IMAGE + raster bundled σε ZIP). Default 'solid' (πάντα ανοίγει).
const IMAGE_FILL_MODE_OPTIONS = ['solid', 'image'] as const;
const TEK_SYMBOL_MODE_OPTIONS = ['native', 'geometry'] as const;
/** ADR-648 Στάδιο Ε — native μοτίβο Τέκτονα (ελαφρύ) vs αποδομημένες γραμμές (πλήρης ταύτιση). */
const TEK_HATCH_MODE_OPTIONS = ['native', 'exploded'] as const;
const VERSION_OPTIONS = Object.keys(DXF_VERSION_NAMES) as DxfVersion[];

export interface ExportDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** Executes the export job (ExportHost → runExport). */
  readonly onSubmit: (request: ExportRequest) => Promise<void>;
}

export function ExportDialog({ open, onOpenChange, onSubmit }: ExportDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const state = useExportDialogState();
  const [busy, setBusy] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
    setBusy(true);
    setHasError(false);
    try {
      await onSubmit(state.buildRequest());
      onOpenChange(false);
    } catch (error) {
      setHasError(true);
      logger.error('Export job failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setBusy(false);
    }
  }, [onSubmit, state, onOpenChange]);

  const isDxf = state.format === 'dxf';
  const isTek = state.format === 'tek';
  // ADR-668/678 — μονάδα για OBJ & COLLADA (κουβαλούν ρητή μονάδα)· το glTF είναι spec-locked σε
  // μέτρα, οπότε ένα πεδίο εκεί θα υποσχόταν επιλογή που ο exporter αγνοεί by design.
  const isObj = state.format === 'obj';
  const isDae = state.format === 'dae';
  const showMeshUnit = isObj || isDae;
  const blocked = state.scopeConflictsWithFormat;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('export.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('export.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('export.format')}>
            <Select value={state.format} onValueChange={(v) => state.setFormat(v as ExportRequest['format'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{t(`export.formats.${o}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('export.content')}>
            <Select value={state.entityScope} onValueChange={(v) => state.setEntityScope(v as ExportRequest['entityScope'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_SCOPE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{t(`export.contentScopes.${o}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('export.floors')}>
            <Select value={state.floorScope} onValueChange={(v) => state.setFloorScope(v as ExportRequest['floorScope'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FLOOR_SCOPE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{t(`export.floorScopes.${o}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isDxf && (
            <Field label={t('export.dxfVersion')}>
              <Select value={state.dxfVersion} onValueChange={(v) => state.setDxfVersion(v as DxfVersion)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VERSION_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>{DXF_VERSION_NAMES[v]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {isDxf && (
            <UnitField label={t('export.dxfUnit')} value={state.dxfUnit} onChange={state.setDxfUnit} />
          )}

          {isDxf && (
            <Field label={t('export.dxfLineMode')}>
              <Select value={state.dxfLineMode} onValueChange={(v) => state.setDxfLineMode(v as NonNullable<ExportRequest['dxfLineMode']>)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LINE_MODE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{t(`export.lineModes.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {isDxf && (
            <Field label={t('export.dxfImageFillMode')}>
              <Select value={state.dxfImageFillMode} onValueChange={(v) => state.setDxfImageFillMode(v as NonNullable<ExportRequest['dxfImageFillMode']>)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMAGE_FILL_MODE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{t(`export.imageFillModes.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {isTek && (
            <Field label={t('export.tekSymbolMode')}>
              <Select value={state.tekSymbolMode} onValueChange={(v) => state.setTekSymbolMode(v as NonNullable<ExportRequest['tekSymbolMode']>)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEK_SYMBOL_MODE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{t(`export.tekSymbolModes.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* ADR-648 Στάδιο Ε — «Μοτίβο Τέκτονα» (ελαφρύ, κατά προσέγγιση) vs «Ακριβείς γραμμές»
              (πλήρης ταύτιση με AutoCAD, βαρύ αρχείο). */}
          {isTek && (
            <Field label={t('export.tekHatchMode')}>
              <Select value={state.tekHatchMode} onValueChange={(v) => state.setTekHatchMode(v as NonNullable<ExportRequest['tekHatchMode']>)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEK_HATCH_MODE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{t(`export.tekHatchModes.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* ADR-668/678 — OBJ & COLLADA χρειάζονται ρητή μονάδα· default εκατοστά ⇒ ανοίγει σωστά
              στο C4D με Scale 1. Ίδιο picker με το DXF — μία μονάδα-ένωση, ένα SSoT. */}
          {showMeshUnit && (
            <UnitField label={t('export.mesh3dUnit')} value={state.mesh3dUnit} onChange={state.setMesh3dUnit} />
          )}
        </section>

        {isObj && (
          <p className="text-sm text-muted-foreground">{t('export.mesh3dUnitHint')}</p>
        )}
        {isDae && (
          <p className="text-sm text-muted-foreground">{t('export.mesh3dDaeNote')}</p>
        )}
        {state.format === 'gltf' && (
          <p className="text-sm text-muted-foreground">{t('export.mesh3dGltfUnitNote')}</p>
        )}

        {blocked && (
          <p role="alert" className="text-sm text-destructive">
            {t('export.scopeConflict')}
          </p>
        )}
        {hasError && !blocked && (
          <p role="alert" className="text-sm text-destructive">
            {t('export.error')}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('export.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={busy || blocked}>
            {busy ? t('export.exporting') : t('export.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Length-unit picker — ONE component, two consumers (DXF `dxfUnit`, ADR-668 OBJ `mesh3dUnit`).
 * Both pick from the same `ExportLengthUnit` union and the same `export.units.*` keys, so
 * shipping them as parallel twins would mean two places to fix every future unit (N.18).
 */
function UnitField({ label, value, onChange }: {
  readonly label: string;
  readonly value: ExportLengthUnit;
  readonly onChange: (unit: ExportLengthUnit) => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as ExportLengthUnit)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {UNIT_OPTIONS.map((u) => (
            <SelectItem key={u} value={u}>{t(`export.units.${u}`)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
