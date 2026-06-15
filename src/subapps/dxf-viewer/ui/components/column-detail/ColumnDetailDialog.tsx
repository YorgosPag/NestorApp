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
 * Preview zoom/pan (ADR-187): interaction (wheel zoom-to-cursor, drag-pan,
 * pinch, buttons, clamping) is delegated to the centralized {@link useZoomPan}
 * hook — the SAME SSoT the floorplan viewer uses. For a vector technical sheet
 * we keep it CRISP: the canvas is RE-RENDERED at `fitPxPerMm · renderScale`
 * (capped at {@link CRISP_CAP}) so lines/text/dimensions stay sharp at any zoom,
 * and only the residual factor beyond the cap is applied as a cheap CSS scale.
 * Zoom/pan affect the PREVIEW only — export/print read the model directly.
 *
 * Raster regions (the 3D perspective capture, ADR-457 Slice 3) carry an async
 * data URL: the dialog paints the vector content immediately, then decodes the
 * raster images off the main path and repaints once they are ready, so the
 * `renderDetailSheet` call itself stays synchronous (progressive paint).
 *
 * State ownership:
 *   - Parent (`ColumnDetailHost`) owns `open` + builds the `model`.
 *   - `useZoomPan` owns the zoom/pan interaction state.
 *   - This dialog owns only the canvas paint side-effect.
 *
 * ADR-040: dialog-local canvas — zero `useSyncExternalStore`, never touches the
 * live DxfRenderer pipeline (CHECK 6B/6C/6D safe).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 * @see docs/centralized-systems/reference/adrs/ADR-187 (useZoomPan SSoT)
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
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { triggerExportDownload, openBlobInNewTab } from '@/lib/exports/trigger-export-download';
import type { DetailSheetModel } from '../../../bim/structural/detail-sheet/detail-sheet-types';
import { renderDetailSheet } from '../../../bim/structural/detail-sheet/render/detail-canvas-renderer';
import { decodeModelRasters } from '../../../bim/structural/detail-sheet/render/detail-raster-decode';
import { buildColumnDetailPdf } from '../../../bim/structural/detail-sheet/render/detail-pdf-renderer';

/** Export file name for the reinforcement detail PDF (data, not i18n). */
const PDF_FILENAME = 'column-reinforcement-detail.pdf';

/** Fraction of the viewport the preview is allowed to occupy (at zoom = 1, i.e. fit). */
const PREVIEW_WIDTH_FRACTION = 0.9;
const PREVIEW_HEIGHT_FRACTION = 0.74;

/** Preview zoom envelope (1 = fit-to-viewport). Export is unaffected. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
/** Additive zoom step for the toolbar buttons (useZoomPan contract). */
const ZOOM_STEP = 0.5;
/**
 * Highest multiple at which the canvas bitmap is actually re-rendered. Below it
 * the vector is crisp at native resolution; above it we upscale the (already
 * very sharp) ×{@link CRISP_CAP} bitmap with CSS — keeps the canvas small enough
 * to re-render smoothly on a modest machine (N.17) while staying visually crisp.
 */
const CRISP_CAP = 3;

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

  // Centralized zoom + pan interaction (wheel-to-cursor, drag, pinch, buttons).
  const zp = useZoomPan({
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomStep: ZOOM_STEP,
    defaultZoom: 1,
  });

  // Resolution multiple we actually paint the canvas at (capped for perf).
  const renderScale = Math.min(zp.zoom, CRISP_CAP);

  const draw = React.useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fit the whole sheet inside a viewport-relative budget (contain), then
    // paint at the (capped) zoom resolution so the vector stays crisp.
    const availW = window.innerWidth * PREVIEW_WIDTH_FRACTION;
    const availH = window.innerHeight * PREVIEW_HEIGHT_FRACTION;
    const fitPxPerMm = Math.min(availW / model.sheetWidthMm, availH / model.sheetHeightMm);
    const pxPerMm = fitPxPerMm * renderScale;
    canvas.width = Math.round(model.sheetWidthMm * pxPerMm);
    canvas.height = Math.round(model.sheetHeightMm * pxPerMm);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderDetailSheet(ctx, model, { pxPerMm, rasterImages: rasterImagesRef.current });
  }, [model, renderScale]);

  // Keep the latest draw reachable from async callbacks without re-subscribing.
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

  // Residual zoom beyond the crisp cap → cheap CSS upscale; pan → translate.
  // Dynamic transform must be an inline style (same pattern as useZoomPan's
  // own contentStyle); intrinsic resize already supplies the crisp scaling.
  const cssScale = zp.zoom / renderScale;
  const previewStyle: React.CSSProperties = {
    transform: `translate(${zp.panOffset.x}px, ${zp.panOffset.y}px) scale(${cssScale})`,
    transformOrigin: 'center center',
  };

  // ── Export / print: SAME model → jsPDF (preview === PDF) ──
  const handleExportPdf = React.useCallback(async (): Promise<void> => {
    if (!model) return;
    const pdf = await buildColumnDetailPdf(model);
    triggerExportDownload({ blob: pdf.output('blob'), filename: PDF_FILENAME });
  }, [model]);

  const handlePrint = React.useCallback(async (): Promise<void> => {
    if (!model) return;
    const pdf = await buildColumnDetailPdf(model);
    openBlobInNewTab(pdf.output('blob'), { onLoad: (w) => w.print() });
  }, [model]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="fullscreen" className="grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{t('columnDetail.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('columnDetail.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <section className="relative flex min-h-0 flex-col rounded border border-border bg-muted/20">
          <div
            ref={zp.containerRef}
            {...zp.handlers}
            className={`flex flex-1 items-center justify-center overflow-hidden p-2 ${zp.cursorClass}`}
          >
            <canvas
              ref={canvasRef}
              className="block"
              style={previewStyle}
              aria-label={t('columnDetail.previewAlt')}
            />
          </div>
          <div
            role="toolbar"
            aria-label={t('columnDetail.zoomToolbar')}
            className="absolute bottom-3 right-3 flex items-center gap-1 rounded-md border border-border bg-background/90 px-1 py-1 shadow-sm backdrop-blur"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={zp.zoomOut}
              disabled={zp.zoom <= MIN_ZOOM}
              aria-label={t('columnDetail.zoomOut')}
              title={t('columnDetail.zoomOut')}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <output className="min-w-[3rem] text-center text-xs font-medium tabular-nums">
              {Math.round(zp.zoom * 100)}%
            </output>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={zp.zoomIn}
              disabled={zp.zoom >= MAX_ZOOM}
              aria-label={t('columnDetail.zoomIn')}
              title={t('columnDetail.zoomIn')}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={zp.resetAll}
              disabled={zp.zoom === MIN_ZOOM}
              aria-label={t('columnDetail.zoomReset')}
              title={t('columnDetail.zoomReset')}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('columnDetail.close')}
          </Button>
          <Button disabled={!model} onClick={handleExportPdf}>{t('columnDetail.exportPdf')}</Button>
          <Button disabled={!model} onClick={handlePrint}>{t('columnDetail.print')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
