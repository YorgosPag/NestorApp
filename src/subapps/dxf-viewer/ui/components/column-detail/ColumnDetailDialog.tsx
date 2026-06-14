'use client';

/**
 * ADR-457 — Column Reinforcement Detail Sheet dialog (Revit/Tekla-grade).
 *
 * Controlled Radix Dialog that renders a {@link DetailSheetModel} into a
 * `<canvas>` (scale-to-fit) for a WYSIWYG preview of the column reinforcement
 * detail sheet. The same model drives the jsPDF export (Slice 5) → preview ===
 * PDF.
 *
 * Sizing: the canvas intrinsic size is computed from the VIEWPORT
 * (`window.innerWidth/innerHeight`) so the whole A3 sheet is shown at the
 * largest scale that fits — deliberately independent of DOM measurement, which
 * reads 0 during the dialog open-animation commit and would skip the paint.
 * Redraws on `open`/`model` change and on window resize.
 *
 * Raster regions (the 3D perspective capture, ADR-457 Slice 3) carry an async
 * data URL: the dialog paints the vector content immediately, then decodes the
 * raster images off the main path and repaints once they are ready, so the
 * `renderDetailSheet` call itself stays synchronous (progressive paint).
 *
 * State ownership:
 *   - Parent (`ColumnDetailHost`) owns `open` + builds the `model`.
 *   - This dialog owns only the canvas paint side-effect.
 *
 * Slice 0: renders the five-region shell (frames + headings). Export / print
 * buttons are wired in Slice 5 (disabled placeholders until then).
 *
 * ADR-040: dialog-local canvas — zero `useSyncExternalStore`, never touches the
 * live DxfRenderer pipeline (CHECK 6B/6C/6D safe).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
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
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { renderDetailSheet } from '../../../bim/structural/detail-sheet/render/detail-canvas-renderer';
import { decodeModelRasters } from '../../../bim/structural/detail-sheet/render/detail-raster-decode';

/** Fraction of the viewport the preview is allowed to occupy. */
const PREVIEW_WIDTH_FRACTION = 0.9;
const PREVIEW_HEIGHT_FRACTION = 0.74;

export interface ColumnDetailDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** The detail-sheet drawing model (null while no column resolved). */
  readonly model: DetailSheetModel | null;
}

export function ColumnDetailDialog({
  open,
  onOpenChange,
  model,
}: ColumnDetailDialogProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  // Decoded raster images (3D capture) for the current model — repaint uses them.
  const rasterImagesRef = React.useRef<ReadonlyMap<string, CanvasImageSource>>(new Map());

  const draw = React.useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fit the whole sheet inside a viewport-relative budget (contain).
    const availW = window.innerWidth * PREVIEW_WIDTH_FRACTION;
    const availH = window.innerHeight * PREVIEW_HEIGHT_FRACTION;
    const pxPerMm = Math.min(availW / model.sheetWidthMm, availH / model.sheetHeightMm);
    canvas.width = Math.round(model.sheetWidthMm * pxPerMm);
    canvas.height = Math.round(model.sheetHeightMm * pxPerMm);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderDetailSheet(ctx, model, { pxPerMm, rasterImages: rasterImagesRef.current });
  }, [model]);

  React.useEffect(() => {
    if (!open || !model) return;
    let cancelled = false;
    // Reset raster cache for the new model, then paint vector content immediately.
    rasterImagesRef.current = new Map();
    const raf = requestAnimationFrame(draw);
    draw();
    window.addEventListener('resize', draw);
    // Decode raster (3D) images off the main path, then repaint with them.
    void decodeModelRasters(model).then((images) => {
      if (cancelled) return;
      rasterImagesRef.current = images;
      draw();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', draw);
    };
  }, [open, model, draw]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="fullscreen">
        <DialogHeader>
          <DialogTitle>{t('columnDetail.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('columnDetail.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <section className="flex items-center justify-center overflow-auto rounded border border-border bg-muted/20 p-2">
          <canvas
            ref={canvasRef}
            className="block"
            aria-label={t('columnDetail.previewAlt')}
          />
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('columnDetail.close')}
          </Button>
          <Button disabled>{t('columnDetail.exportPdf')}</Button>
          <Button disabled>{t('columnDetail.print')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
