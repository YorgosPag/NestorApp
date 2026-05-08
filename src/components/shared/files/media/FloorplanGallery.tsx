/* eslint-disable design-system/no-hardcoded-colors */
/**
 * ENTERPRISE: FloorplanGallery — Full-width floorplan viewer for DXF/PDF/Image files.
 * @module components/shared/files/media/FloorplanGallery
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Trash2, Map, Sun, Moon, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useFullscreen } from '@/hooks/useFullscreen';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useZoomPan } from '@/hooks/useZoomPan';
import { canvasUtilities } from '@/styles/design-tokens';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import type { FloorplanGalleryProps, DxfDrawingMode } from '@/components/shared/files/media/floorplan-gallery-config';
import { ZOOM_CONFIG, filterFloorplanFiles, getFileIcon } from '@/components/shared/files/media/floorplan-gallery-config';
import { computeOverlayAABBs, screenToWorld, hitTestOverlays } from '@/components/shared/files/media/floorplan-overlay-system';
import { hitTestPdfOverlays } from '@/components/shared/files/media/floorplan-pdf-overlay-renderer';
import { useFloorplanSceneLoader } from '@/components/shared/files/media/useFloorplanSceneLoader';
import { useFloorplanPdfLoader } from '@/components/shared/files/media/useFloorplanPdfLoader';
import { useFloorplanImageLoader } from '@/components/shared/files/media/useFloorplanImageLoader';
import { useFloorplanCanvasRender } from '@/components/shared/files/media/useFloorplanCanvasRender';
import { useFileDownload } from '@/components/shared/files/hooks/useFileDownload';
import { FloorplanGalleryZoomControls } from '@/components/shared/files/media/FloorplanGalleryZoomControls';
import { MeasureToolbar, type MeasureMode } from '@/components/shared/files/media/MeasureToolbar';
import { MeasureToolOverlay } from '@/components/shared/files/media/MeasureToolOverlay';
import { CalibrateScaleDialog } from '@/components/shared/files/media/CalibrateScaleDialog';

// Re-exports for backward compatibility
export type { FloorplanGalleryProps, DxfDrawingMode };
export { ZOOM_CONFIG, filterFloorplanFiles, getFileIcon };
export function FloorplanGallery({
  files,
  onDelete,
  onDownload,
  onRefresh: _onRefresh,
  emptyMessage,
  className,
  initialIndex = 0,
  overlays,
  highlightedOverlayUnitId,
  onHoverOverlay,
  onClickOverlay,
  propertyLabels,
  unitsPerMeter,
  backgroundId,
}: FloorplanGalleryProps) {
  const { t } = useTranslation(['files', 'files-media']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Canvas refs for DXF/PDF rendering (inline + fullscreen)
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  // Filter to only floorplan files
  const floorplanFiles = useMemo(() => filterFloorplanFiles(files), [files]);
  // Navigation state
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(initialIndex, Math.max(0, floorplanFiles.length - 1)),
  );
  // Current file
  const currentFile = floorplanFiles[currentIndex] || null;
  const fileExt = currentFile?.ext?.toLowerCase() || '';
  // JSON scene files (saved by FloorplanSaveOrchestrator) are treated as DXF scenes
  const isDxf = fileExt === 'dxf' || fileExt === 'json';
  const isPdf = fileExt === 'pdf';
  const isImage = currentFile && !isDxf && !isPdf;
  // DXF scene loading (extracted hook)
  const { loadedScene, isLoading, sceneError } = useFloorplanSceneLoader(currentFile, isDxf, fileExt);
  // PDF loading — for SPEC-237D overlay support on PDF backgrounds
  const { pdfImage, pdfDimensions, isPdfLoading, pdfError } = useFloorplanPdfLoader(currentFile, isPdf);
  // Raw image loading (PNG/JPEG/WEBP/TIFF) — same canvas+overlay path as PDF.
  const { imageElement, imageDimensions, isImageLoading, imageError } = useFloorplanImageLoader(currentFile, !!isImage);
  // Unified raster source — PDF page-1 image OR raw image. Renderer is format-agnostic.
  const isRaster = isPdf || !!isImage;
  const rasterImage = pdfImage ?? imageElement;
  const rasterBounds = pdfDimensions ?? imageDimensions;
  // DXF bounds (only used for DXF — raster uses editor-exact transform inside the renderer)
  const currentBounds = useMemo(() => {
    if (isDxf) return loadedScene?.bounds ?? null;
    return null;
  }, [isDxf, loadedScene?.bounds]);
  // Fullscreen modal state (ADR-241 centralized)
  const fullscreen = useFullscreen();
  // DXF drawing mode — dark (colored) or light (black & white)
  const [drawingMode, setDrawingMode] = useState<DxfDrawingMode>('dark');
  // Zoom + Pan — inline view
  const inlineZP = useZoomPan(ZOOM_CONFIG);
  // Zoom + Pan — fullscreen modal (independent instance)
  const modalZP = useZoomPan(ZOOM_CONFIG);
  // SPEC-237C: AABB cache for DXF hit-testing (PDF uses dedicated hitTestPdfOverlays)
  const overlayAABBs = useMemo(
    () => isDxf && overlays ? computeOverlayAABBs(overlays) : [],
    [isDxf, overlays],
  );
  // SPEC-237C: Local hover state for cursor + visual feedback
  const [hoveredOverlayUnitId, setHoveredOverlayUnitId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);
  // ADR-340 Phase 9 STEP H: transient measure tool mode (distance/area/angle/off)
  const [measureMode, setMeasureMode] = useState<MeasureMode | null>(null);
  // ADR-340 Phase 9 STEP I: calibration dialog open state (raster only)
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const calibrationImageSrc = isRaster ? (rasterImage?.src ?? currentFile?.downloadUrl ?? null) : null;
  const canCalibrate = isRaster && !!backgroundId && !!calibrationImageSrc;
  // SPEC-237C: Effective highlight = external (list hover) OR local (canvas hover)
  const effectiveHighlightId = highlightedOverlayUnitId || hoveredOverlayUnitId;

  // SPEC-237C: Canvas Mouse Handlers (Hit-Testing, Hover, Click)

  const resolveHit = useCallback((screenX: number, screenY: number, canvas: HTMLCanvasElement) => {
    if (!overlays?.length) return null;
    if (isDxf && currentBounds) {
      const worldPt = screenToWorld(screenX, screenY, canvas, currentBounds, inlineZP.zoom, inlineZP.panOffset);
      return hitTestOverlays(worldPt, overlays, overlayAABBs);
    }
    if (isRaster && rasterBounds) {
      return hitTestPdfOverlays(
        screenX, screenY, canvas.width, canvas.height, rasterBounds, overlays,
        inlineZP.zoom, inlineZP.panOffset,
      );
    }
    return null;
  }, [isDxf, isRaster, currentBounds, rasterBounds, overlays, overlayAABBs, inlineZP.zoom, inlineZP.panOffset]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlays?.length || !inlineCanvasRef.current) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = inlineCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const screenY = (e.clientY - rect.top) * (canvas.height / rect.height);
      const hit = resolveHit(screenX, screenY, canvas);
      const propertyId = hit?.linked?.propertyId ?? null;
      setHoveredOverlayUnitId(propertyId);
      onHoverOverlay?.(propertyId);
    });
  }, [overlays, resolveHit, onHoverOverlay]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlays?.length || !inlineCanvasRef.current) return;
    const canvas = inlineCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const screenY = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = resolveHit(screenX, screenY, canvas);
    if (hit?.linked?.propertyId) onClickOverlay?.(hit.linked.propertyId);
  }, [overlays, resolveHit, onClickOverlay]);

  const handleCanvasMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setHoveredOverlayUnitId(null);
    onHoverOverlay?.(null);
  }, [onHoverOverlay]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // NAVIGATION

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : floorplanFiles.length - 1));
  }, [floorplanFiles.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < floorplanFiles.length - 1 ? prev + 1 : 0));
  }, [floorplanFiles.length]);

  // Reset zoom/pan when switching files
  useEffect(() => {
    inlineZP.resetAll();
    // intentional: only reset on index change, not on inlineZP reference changes
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && fullscreen.isFullscreen) {
        event.preventDefault();
        fullscreen.exit();
        return;
      }
      if (floorplanFiles.length <= 1) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNext();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, floorplanFiles.length, fullscreen.isFullscreen, fullscreen.exit]);

  // FULLSCREEN

  const handleOpenFullscreen = useCallback(() => {
    modalZP.resetAll();
    fullscreen.enter();
  }, [modalZP, fullscreen]);

  const handleCloseFullscreen = useCallback(() => {
    fullscreen.exit();
  }, [fullscreen]);

  // CANVAS RENDERING — inline + modal (DXF or PDF, overlays unified)

  // Resolver: propertyLabels Map → OverlayLabel for the highlighted polygon.
  const getOverlayLabel = useCallback(
    (overlay: { linked?: { propertyId?: string } }) => {
      const pid = overlay.linked?.propertyId;
      if (!pid || !propertyLabels) return null;
      return propertyLabels.get(pid) ?? null;
    },
    [propertyLabels],
  );

  useFloorplanCanvasRender({
    canvasRef: inlineCanvasRef, enabled: true, isDxf, isRaster, loadedScene, rasterImage, rasterBounds,
    currentBounds, zoom: inlineZP.zoom, panOffset: inlineZP.panOffset, drawingMode,
    overlays, highlightedUnitId: effectiveHighlightId, getOverlayLabel,
  });

  useFloorplanCanvasRender({
    canvasRef: modalCanvasRef, enabled: fullscreen.isFullscreen, isDxf, isRaster, loadedScene,
    rasterImage, rasterBounds, currentBounds, zoom: modalZP.zoom, panOffset: modalZP.panOffset,
    drawingMode, overlays, highlightedUnitId: effectiveHighlightId, getOverlayLabel,
    firstRenderDelay: 280,
  });

  // ACTIONS

  const { handleDownload: enterpriseDownload } = useFileDownload();
  const handleDownload = useCallback(() => {
    if (!currentFile) return;
    if (onDownload) {
      onDownload(currentFile);
    } else {
      enterpriseDownload(currentFile);
    }
  }, [currentFile, onDownload, enterpriseDownload]);

  const handleDelete = useCallback(async () => {
    if (!currentFile || !onDelete) return;
    await onDelete(currentFile);
    if (currentIndex >= floorplanFiles.length - 1) {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  }, [currentFile, onDelete, currentIndex, floorplanFiles.length]);

  // EMPTY STATE

  if (floorplanFiles.length === 0) {
    return (
      <section
        className={cn('flex flex-col items-center justify-center h-64', className)}
        role="status"
        aria-label={emptyMessage || t('floorplan.noFloorplans')}
      >
        <Map className={cn(iconSizes.xl, colors.text.muted, 'mb-2')} aria-hidden="true" />
        <p className={cn('text-sm', colors.text.muted)}>
          {emptyMessage || t('floorplan.noFloorplans')}
        </p>
      </section>
    );
  }

  // VIEWER CONTENT — reusable for inline + fullscreen

  const anyLoading = isLoading || isPdfLoading || isImageLoading;
  const anyError = sceneError || pdfError || imageError;
  const showCanvas = (isDxf && loadedScene) || (isRaster && rasterImage && rasterBounds);

  function renderViewerContent(
    zp: ReturnType<typeof useZoomPan>,
    canvasRef: React.Ref<HTMLCanvasElement>,
    viewClassName?: string,
    enableHitTesting?: boolean,
  ) {
    return (
      <figure
        ref={zp.containerRef}
        {...zp.handlers}
        className={cn('flex-1 min-h-0 relative overflow-hidden bg-muted/30 select-none', zp.cursorClass, viewClassName)}
      >
        {anyLoading && (
          <section className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
            <AnimatedSpinner size="large" />
            <span className="mt-2 text-sm">{t('floorplan.loading')}</span>
          </section>
        )}
        {anyError && !anyLoading && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <Map className={cn(iconSizes.xl, 'text-destructive mb-2')} aria-hidden="true" />
            <span className="text-sm text-destructive">{anyError}</span>
          </section>
        )}
        {showCanvas && !anyLoading && !anyError && (
          <canvas
            ref={canvasRef}
            className={cn('w-full h-full', enableHitTesting && effectiveHighlightId ? 'cursor-pointer' : '')}
            style={canvasUtilities.geoInteractive.canvasFullDisplay()}
            aria-label={t('floorplan.canvasAlt', { fileName: currentFile?.displayName })}
            onMouseMove={enableHitTesting && !measureMode ? handleCanvasMouseMove : undefined}
            onClick={enableHitTesting && !measureMode ? handleCanvasClick : undefined}
            onMouseLeave={enableHitTesting && !measureMode ? handleCanvasMouseLeave : undefined}
          />
        )}
        {showCanvas && !anyLoading && !anyError && measureMode && (
          <MeasureToolOverlay
            mode={measureMode}
            sceneBounds={isDxf ? currentBounds : null}
            rasterSize={isRaster ? rasterBounds : null}
            zoom={zp.zoom}
            panOffset={zp.panOffset}
            unitsPerMeter={unitsPerMeter ?? null}
          />
        )}
        {isDxf && !anyLoading && !anyError && !loadedScene && currentFile?.processedData && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <Map className={cn(iconSizes.xl, 'text-warning mb-2')} aria-hidden="true" />
            <span className={cn("text-sm", colors.text.muted)}>{t('floorplan.noSceneData')}</span>
          </section>
        )}
        {isDxf && !currentFile?.processedData && !loadedScene && !anyLoading && !anyError && (
          <section className="flex flex-col items-center justify-center h-full">
            <AnimatedSpinner size="large" />
            <span className="mt-2 text-sm">{t('floorplan.processing')}</span>
          </section>
        )}
      </figure>
    );
  }

  // RENDER

  return (
    <>
      <article className={cn('flex flex-col h-full', className)} role="region" aria-label={t('floorplan.galleryLabel')}>
        <header className="flex items-center justify-between p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <nav className="flex items-center gap-2" aria-label={t('floorplan.navigation')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={goToPrevious} disabled={floorplanFiles.length <= 1} aria-label={t('floorplan.previous')}>
                  <ChevronLeft className={iconSizes.md} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('floorplan.previous')}</TooltipContent>
            </Tooltip>
            <span className="flex items-center gap-2 min-w-[200px] justify-center">
              {getFileIcon(currentFile?.ext || '')}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium truncate max-w-[150px]">{currentFile?.displayName || t('floorplan.untitled')}</span>
                </TooltipTrigger>
                <TooltipContent>{currentFile?.displayName}</TooltipContent>
              </Tooltip>
              <span className={cn('text-sm', colors.text.muted)}>({currentIndex + 1}/{floorplanFiles.length})</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={goToNext} disabled={floorplanFiles.length <= 1} aria-label={t('floorplan.next')}>
                  <ChevronRight className={iconSizes.md} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('floorplan.next')}</TooltipContent>
            </Tooltip>
          </nav>
          <nav className="flex items-center gap-1" aria-label={t('floorplan.actions')}>
            {isDxf && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDrawingMode(prev => prev === 'dark' ? 'light' : 'dark')}
                      aria-label={drawingMode === 'dark' ? t('floorplan.lightMode') : t('floorplan.darkMode')}
                      aria-pressed={drawingMode === 'light'}
                    >
                      {drawingMode === 'dark'
                        ? <Sun className={iconSizes.sm} aria-hidden="true" />
                        : <Moon className={iconSizes.sm} aria-hidden="true" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{drawingMode === 'dark' ? t('floorplan.lightMode') : t('floorplan.darkMode')}</TooltipContent>
                </Tooltip>
                <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />
              </>
            )}
            <MeasureToolbar mode={measureMode} onModeChange={setMeasureMode} />
            {canCalibrate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalibrateOpen(true)}
                    aria-label={t('floorplan.calibrate.openButton', { ns: 'files-media' })}
                  >
                    <Compass className={iconSizes.sm} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('floorplan.calibrate.openButton', { ns: 'files-media' })}</TooltipContent>
              </Tooltip>
            )}
            <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />
            <FloorplanGalleryZoomControls zp={inlineZP} showFullscreen onOpenFullscreen={handleOpenFullscreen} />
            <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!currentFile?.downloadUrl} aria-label={t('floorplan.download')}>
                  <Download className={iconSizes.sm} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('floorplan.download')}</TooltipContent>
            </Tooltip>
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive" aria-label={t('floorplan.delete')}>
                    <Trash2 className={iconSizes.sm} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('floorplan.delete')}</TooltipContent>
              </Tooltip>
            )}
          </nav>
        </header>
        {renderViewerContent(inlineZP, inlineCanvasRef, 'min-h-[500px]', true)}
      </article>

      {/* FULLSCREEN MODAL (ADR-241 — direct Dialog composition) */}
      <Dialog open={fullscreen.isFullscreen} onOpenChange={(open) => { if (!open) fullscreen.exit(); }}>
        <DialogContent size="fullscreen" hideCloseButton className="flex flex-col p-0 gap-0">
          <DialogTitle className="sr-only">{t('floorplan.gallery')}</DialogTitle>
          <header className="flex items-center justify-between shrink-0 border-b px-4 py-2">
            <span className="flex items-center gap-2 px-2">
              {getFileIcon(currentFile?.ext || '')}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium truncate max-w-[300px]">{currentFile?.displayName || t('floorplan.untitled')}</span>
                </TooltipTrigger>
                <TooltipContent>{currentFile?.displayName}</TooltipContent>
              </Tooltip>
            </span>
            <nav className="flex items-center gap-1 ml-auto" aria-label={t('floorplan.actions')}>
              <FloorplanGalleryZoomControls zp={modalZP} showClose onCloseFullscreen={handleCloseFullscreen} />
            </nav>
          </header>
          <section className="flex-1 min-h-0 flex flex-col overflow-auto">
            {renderViewerContent(modalZP, modalCanvasRef)}
          </section>
        </DialogContent>
      </Dialog>

      {/* ADR-340 Phase 9 STEP I — calibration dialog (raster only) */}
      {canCalibrate && backgroundId && calibrationImageSrc && (
        <CalibrateScaleDialog
          open={calibrateOpen}
          onOpenChange={setCalibrateOpen}
          backgroundId={backgroundId}
          imageSrc={calibrationImageSrc}
        />
      )}
    </>
  );
}

export default FloorplanGallery;
