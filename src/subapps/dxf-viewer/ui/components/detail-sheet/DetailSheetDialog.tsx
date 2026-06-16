'use client';

/**
 * ADR-457 / ADR-463 — Reinforcement Detail Sheet dialog (Revit/Tekla-grade, SSoT).
 *
 * Generic, fully-presentational controlled Radix Dialog that renders a
 * {@link DetailSheetModel} into a `<canvas>` (scale-to-fit) for a WYSIWYG preview
 * and exports/prints the SAME model via jsPDF → **preview === PDF**. Backend-
 * agnostic: every label is host-injected (N.11-safe), so BOTH the column detail
 * (ADR-457) and the footing detail (ADR-463) reuse this one dialog — zero
 * duplicate (N.0.2). Πρώην ζούσε στο `ColumnDetailDialog` (column-specific)·
 * εξήχθη εδώ ως κοινό SSoT, με τον `ColumnDetailDialog` thin wrapper πλέον.
 *
 * Sizing: canvas intrinsic size from the VIEWPORT (independent of DOM measure,
 * which reads 0 during the open-animation commit). Preview zoom/pan via the
 * centralized {@link useZoomPan}; the canvas is re-rendered at `fitPxPerMm ·
 * renderScale` (capped at {@link CRISP_CAP}) so the vector stays crisp, residual
 * zoom applied as cheap CSS scale. Raster regions (3D capture) decode async →
 * progressive paint. Zoom/pan affect the PREVIEW only.
 *
 * ADR-040: dialog-local canvas — zero `useSyncExternalStore`, never touches the
 * live DxfRenderer pipeline (CHECK 6B/6C/6D safe).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import * as React from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useZoomPan } from '@/hooks/useZoomPan';
import { triggerExportDownload, openBlobInNewTab } from '@/lib/exports/trigger-export-download';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { renderDetailSheet } from '../../../bim/structural/detail-sheet/render/detail-canvas-renderer';
import { decodeModelRasters } from '../../../bim/structural/detail-sheet/render/detail-raster-decode';
import { buildDetailSheetPdf } from '../../../bim/structural/detail-sheet/render/detail-pdf-renderer';

/** Fraction of the viewport the preview occupies (at zoom = 1, i.e. fit). */
const PREVIEW_WIDTH_FRACTION = 0.9;
const PREVIEW_HEIGHT_FRACTION = 0.74;

/** Preview zoom envelope (1 = fit-to-viewport). Export is unaffected. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.5;
/** Highest multiple at which the canvas bitmap is actually re-rendered (perf). */
const CRISP_CAP = 3;

/** Pre-resolved chrome labels (N.11-safe — host injects via i18n). */
export interface DetailSheetDialogLabels {
  readonly title: string;
  readonly description: string;
  readonly previewAlt: string;
  readonly close: string;
  readonly exportPdf: string;
  readonly print: string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  readonly zoomReset: string;
  readonly zoomToolbar: string;
}

export interface DetailSheetDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** The detail-sheet drawing model (null while no entity resolved). */
  readonly model: DetailSheetModel | null;
  /** Export file name for the PDF (data, not i18n). */
  readonly pdfFilename: string;
  /** Pre-resolved chrome labels. */
  readonly labels: DetailSheetDialogLabels;
}

export function DetailSheetDialog({
  open,
  onOpenChange,
  model,
  pdfFilename,
  labels,
}: DetailSheetDialogProps): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rasterImagesRef = React.useRef<ReadonlyMap<string, CanvasImageSource>>(new Map());

  const zp = useZoomPan({ minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomStep: ZOOM_STEP, defaultZoom: 1 });
  const renderScale = Math.min(zp.zoom, CRISP_CAP);

  const draw = React.useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const availW = window.innerWidth * PREVIEW_WIDTH_FRACTION;
    const availH = window.innerHeight * PREVIEW_HEIGHT_FRACTION;
    const fitPxPerMm = Math.min(availW / model.sheetWidthMm, availH / model.sheetHeightMm);
    const pxPerMm = fitPxPerMm * renderScale;
    canvas.width = Math.round(model.sheetWidthMm * pxPerMm);
    canvas.height = Math.round(model.sheetHeightMm * pxPerMm);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderDetailSheet(ctx, model, { pxPerMm, rasterImages: rasterImagesRef.current });
  }, [model, renderScale]);

  const drawRef = React.useRef(draw);
  drawRef.current = draw;

  // Reset zoom/pan + decode raster (3D) images whenever a new sheet opens.
  React.useEffect(() => {
    if (!open || !model) return;
    let cancelled = false;
    zp.resetAll();
    rasterImagesRef.current = new Map();
    void decodeModelRasters(model).then((images) => {
      if (cancelled) return;
      rasterImagesRef.current = images;
      drawRef.current();
    });
    return () => {
      cancelled = true;
    };
  }, [open, model, zp.resetAll]);

  // Paint on open / model / render-scale change and on window resize.
  React.useLayoutEffect(() => {
    if (!open || !model) return;
    const raf = requestAnimationFrame(draw);
    draw();
    window.addEventListener('resize', draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', draw);
    };
  }, [open, model, draw]);

  const cssScale = zp.zoom / renderScale;
  const previewStyle: React.CSSProperties = {
    transform: `translate(${zp.panOffset.x}px, ${zp.panOffset.y}px) scale(${cssScale})`,
    transformOrigin: 'center center',
  };

  const handleExportPdf = React.useCallback(async (): Promise<void> => {
    if (!model) return;
    const pdf = await buildDetailSheetPdf(model);
    triggerExportDownload({ blob: pdf.output('blob'), filename: pdfFilename });
  }, [model, pdfFilename]);

  const handlePrint = React.useCallback(async (): Promise<void> => {
    if (!model) return;
    const pdf = await buildDetailSheetPdf(model);
    openBlobInNewTab(pdf.output('blob'), { onLoad: (w) => w.print() });
  }, [model]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="fullscreen" className="grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        <section className="relative flex min-h-0 flex-col rounded border border-border bg-muted/20">
          <div
            ref={zp.containerRef}
            {...zp.handlers}
            className={`flex flex-1 items-center justify-center overflow-hidden p-2 ${zp.cursorClass}`}
          >
            <canvas ref={canvasRef} className="block" style={previewStyle} aria-label={labels.previewAlt} />
          </div>
          <div
            role="toolbar"
            aria-label={labels.zoomToolbar}
            className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-border bg-background/90 px-1 py-1 shadow-sm backdrop-blur"
          >
            <Button variant="ghost" size="icon-sm" onClick={zp.zoomOut} disabled={zp.zoom <= MIN_ZOOM} aria-label={labels.zoomOut} title={labels.zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <output className="min-w-[3rem] text-center text-xs font-medium tabular-nums">
              {Math.round(zp.zoom * 100)}%
            </output>
            <Button variant="ghost" size="icon-sm" onClick={zp.zoomIn} disabled={zp.zoom >= MAX_ZOOM} aria-label={labels.zoomIn} title={labels.zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={zp.resetAll} disabled={zp.zoom === MIN_ZOOM} aria-label={labels.zoomReset} title={labels.zoomReset}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{labels.close}</Button>
          <Button disabled={!model} onClick={handleExportPdf}>{labels.exportPdf}</Button>
          <Button disabled={!model} onClick={handlePrint}>{labels.print}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
