/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery Component
 * =============================================================================
 *
 * Full-width floorplan viewer for DXF/PDF/Image files.
 * Same pattern as MediaGallery but optimized for technical drawings.
 *
 * @module components/shared/files/media/FloorplanGallery
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Features:
 * - Full-width DXF canvas rendering
 * - PDF display with native browser support
 * - Image preview for jpg/png floorplans
 * - Navigation arrows for multiple files
 * - Mouse wheel zoom + drag pan (useZoomPan hook)
 * - Pinch-to-zoom + touch pan (mobile)
 * - Fullscreen modal with independent zoom/pan
 * - Keyboard navigation (Arrow keys)
 * - Full accessibility (ARIA)
 *
 * @example
 * ```tsx
 * <FloorplanGallery
 *   files={floorplanFiles}
 *   onDelete={handleDelete}
 *   emptyMessage={t('floorplan.noFiles')}
 * />
 * ```
 */

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Expand,
  X,
  Map,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useZoomPan } from '@/hooks/useZoomPan';
import type { PanOffset } from '@/hooks/useZoomPan';
import { canvasUtilities } from '@/styles/design-tokens';
import { auth } from '@/lib/firebase';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import type { FileRecord, DxfSceneData } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

export interface FloorplanGalleryProps {
  /** Floorplan files to display */
  files: FileRecord[];
  /** Callback for delete action */
  onDelete?: (file: FileRecord) => Promise<void>;
  /** Callback for download action */
  onDownload?: (file: FileRecord) => void;
  /** Callback to refresh files after processing */
  onRefresh?: () => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Custom className */
  className?: string;
  /** Initial file index */
  initialIndex?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Supported floorplan file extensions */
const FLOORPLAN_EXTENSIONS = ['dxf', 'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];

/** Zoom configuration for the useZoomPan hook */
const ZOOM_CONFIG = {
  minZoom: 0.25,
  maxZoom: 4,
  zoomStep: 0.25,
  defaultZoom: 1,
} as const;

// ============================================================================
// UTILITIES
// ============================================================================

/** Filter files to only include floorplan-compatible formats */
function filterFloorplanFiles(files: FileRecord[]): FileRecord[] {
  return files.filter(file => {
    const ext = file.ext?.toLowerCase() || '';
    return FLOORPLAN_EXTENSIONS.includes(ext);
  });
}

/** Get file type icon based on extension */
function getFileIcon(ext: string): React.ReactNode {
  const iconClass = 'w-5 h-5';
  switch (ext?.toLowerCase()) {
    case 'dxf':
      return <Map className={iconClass} aria-hidden="true" />;
    case 'pdf':
      return <FileText className={iconClass} aria-hidden="true" />;
    default:
      return <ImageIcon className={iconClass} aria-hidden="true" />;
  }
}

// ============================================================================
// DXF CANVAS RENDERING (extracted for inline + fullscreen reuse)
// ============================================================================

/**
 * Render DXF scene data to a canvas element.
 * Accepts zoom and panOffset for interactive viewing.
 */
function renderDxfToCanvas(
  canvas: HTMLCanvasElement,
  scene: DxfSceneData,
  zoom: number,
  panOffset: PanOffset,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (!scene.entities || scene.entities.length === 0) return;

  // Size canvas to container
  const container = canvas.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  // Dark mode detection
  const isDarkMode = document.documentElement.classList.contains('dark');

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isDarkMode ? '#111827' : '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate bounds, scale, and offset (including pan)
  const bounds = scene.bounds || { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  // Layer color helper
  const getLayerColor = (layerName: string): string =>
    scene.layers?.[layerName]?.color || '#e2e8f0';

  ctx.lineWidth = 1;

  // Render entities
  scene.entities.forEach((entity) => {
    if (scene.layers?.[entity.layer]?.visible === false) return;

    const layerColor = getLayerColor(entity.layer);
    ctx.strokeStyle = layerColor;

    const e = entity as Record<string, unknown>;

    switch (entity.type) {
      case 'line': {
        const start = e.start as { x: number; y: number } | undefined;
        const end = e.end as { x: number; y: number } | undefined;
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(
            (start.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - start.y) * scale + offsetY,
          );
          ctx.lineTo(
            (end.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - end.y) * scale + offsetY,
          );
          ctx.stroke();
        }
        break;
      }

      case 'polyline': {
        const vertices = e.vertices as Array<{ x: number; y: number }> | undefined;
        const closed = e.closed as boolean | undefined;
        if (vertices && Array.isArray(vertices) && vertices.length > 1) {
          ctx.beginPath();
          const first = vertices[0];
          ctx.moveTo(
            (first.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - first.y) * scale + offsetY,
          );
          vertices.slice(1).forEach((v) => {
            ctx.lineTo(
              (v.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - v.y) * scale + offsetY,
            );
          });
          if (closed) ctx.closePath();
          ctx.stroke();
        }
        break;
      }

      case 'circle': {
        const center = e.center as { x: number; y: number } | undefined;
        const radius = e.radius as number | undefined;
        if (center && radius) {
          ctx.beginPath();
          ctx.arc(
            (center.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - center.y) * scale + offsetY,
            radius * scale,
            0,
            2 * Math.PI,
          );
          ctx.stroke();
        }
        break;
      }

      case 'arc': {
        const arcCenter = e.center as { x: number; y: number } | undefined;
        const arcRadius = e.radius as number | undefined;
        const startAngle = e.startAngle as number | undefined;
        const endAngle = e.endAngle as number | undefined;
        if (arcCenter && arcRadius && startAngle !== undefined && endAngle !== undefined) {
          ctx.beginPath();
          ctx.arc(
            (arcCenter.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - arcCenter.y) * scale + offsetY,
            arcRadius * scale,
            endAngle,
            startAngle,
            false,
          );
          ctx.stroke();
        }
        break;
      }

      case 'text': {
        const position = e.position as { x: number; y: number } | undefined;
        const text = e.text as string | undefined;
        const height = e.height as number | undefined;
        if (position && text) {
          ctx.fillStyle = layerColor;
          ctx.font = `${Math.max(8, (height || 10) * scale)}px Arial`;
          ctx.fillText(
            text,
            (position.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - position.y) * scale + offsetY,
          );
        }
        break;
      }
    }
  });
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('FloorplanGallery');

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ENTERPRISE: Floorplan Gallery Component
 *
 * Full-width viewer for technical drawings with navigation.
 * Uses centralized useZoomPan hook for wheel zoom, drag pan,
 * pinch-to-zoom, and touch pan support.
 */
export function FloorplanGallery({
  files,
  onDelete,
  onDownload,
  onRefresh,
  emptyMessage,
  className,
  initialIndex = 0,
}: FloorplanGalleryProps) {
  const { t } = useTranslation('files');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Canvas refs for DXF rendering (inline + fullscreen)
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  // Filter to only floorplan files
  const floorplanFiles = useMemo(() => filterFloorplanFiles(files), [files]);

  // Navigation state
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(initialIndex, Math.max(0, floorplanFiles.length - 1)),
  );

  // DXF loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadedScene, setLoadedScene] = useState<DxfSceneData | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

  // Fullscreen modal state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Zoom + Pan — inline view
  const inlineZP = useZoomPan(ZOOM_CONFIG);

  // Zoom + Pan — fullscreen modal (independent instance)
  const modalZP = useZoomPan(ZOOM_CONFIG);

  // Current file
  const currentFile = floorplanFiles[currentIndex] || null;
  const isDxf = currentFile?.ext?.toLowerCase() === 'dxf';
  const isPdf = currentFile?.ext?.toLowerCase() === 'pdf';
  const isImage = currentFile && !isDxf && !isPdf;

  // =========================================================================
  // NAVIGATION
  // =========================================================================

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : floorplanFiles.length - 1));
  }, [floorplanFiles.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < floorplanFiles.length - 1 ? prev + 1 : 0));
  }, [floorplanFiles.length]);

  // Reset zoom/pan when switching files
  useEffect(() => {
    inlineZP.resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Escape closes fullscreen modal
      if (event.key === 'Escape' && isFullscreen) {
        event.preventDefault();
        setIsFullscreen(false);
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
  }, [goToPrevious, goToNext, floorplanFiles.length, isFullscreen]);

  // =========================================================================
  // FULLSCREEN
  // =========================================================================

  const handleOpenFullscreen = useCallback(() => {
    modalZP.resetAll();
    setIsFullscreen(true);
  }, [modalZP]);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // =========================================================================
  // DXF AUTO-PROCESSING (Enterprise Pattern - ADR-033)
  // =========================================================================

  useEffect(() => {
    if (!currentFile || !isDxf) return;
    if (currentFile.processedData) return;
    if (!currentFile.downloadUrl) return;
    if (currentFile.status !== 'ready') return;
    if (!auth.currentUser) return;

    const triggerProcessing = async () => {
      logger.info('Triggering DXF processing', { displayName: currentFile.displayName });
      setIsLoading(true);

      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('No auth token');

        const response = await fetch('/api/floorplans/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            fileId: currentFile.id,
            forceReprocess: false,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        logger.info('DXF processing completed', { result });

        if (onRefresh) {
          setTimeout(() => onRefresh(), 500);
        }
      } catch (err) {
        logger.error('DXF processing failed', { error: err });
        setSceneError(err instanceof Error ? err.message : 'Processing failed');
      } finally {
        setIsLoading(false);
      }
    };

    triggerProcessing();
  }, [currentFile?.id, currentFile?.processedData, currentFile?.downloadUrl, currentFile?.status, isDxf, t, onRefresh]);

  // =========================================================================
  // DXF SCENE LOADING
  // =========================================================================

  useEffect(() => {
    if (!currentFile?.processedData) {
      setLoadedScene(null);
      return;
    }

    const processedData = currentFile.processedData;

    // V3: Load via authenticated API
    if (processedData.processedDataPath && currentFile.id && auth.currentUser) {
      setIsLoading(true);
      setSceneError(null);

      const loadSceneFromAPI = async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) throw new Error('User not authenticated');
          const idToken = await currentUser.getIdToken();

          const response = await fetch(`/api/floorplans/scene?fileId=${currentFile.id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${idToken}` },
          });

          if (response.status === 202) {
            setSceneError(t('floorplan.processingInProgress'));
            setIsLoading(false);
            return;
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }

          const sceneData: DxfSceneData = await response.json();
          setLoadedScene(sceneData);
          setIsLoading(false);
        } catch (err) {
          logger.error('Failed to load scene', { error: err });
          setSceneError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      };

      loadSceneFromAPI();
      return;
    }

    // V1 Legacy: Use embedded scene
    if (processedData.scene) {
      setLoadedScene(processedData.scene);
      setIsLoading(false);
      return;
    }

    setLoadedScene(null);
  }, [currentFile?.processedData, currentFile?.id, t]);

  // =========================================================================
  // DXF CANVAS RENDERING — INLINE
  // =========================================================================

  useEffect(() => {
    if (!loadedScene || !inlineCanvasRef.current || !isDxf) return;
    renderDxfToCanvas(inlineCanvasRef.current, loadedScene, inlineZP.zoom, inlineZP.panOffset);
  }, [loadedScene, isDxf, inlineZP.zoom, inlineZP.panOffset]);

  // =========================================================================
  // DXF CANVAS RENDERING — FULLSCREEN MODAL
  // =========================================================================

  useEffect(() => {
    if (!isFullscreen || !loadedScene || !modalCanvasRef.current || !isDxf) return;
    renderDxfToCanvas(modalCanvasRef.current, loadedScene, modalZP.zoom, modalZP.panOffset);
  }, [isFullscreen, loadedScene, isDxf, modalZP.zoom, modalZP.panOffset]);

  // =========================================================================
  // ACTIONS
  // =========================================================================

  const handleDownload = useCallback(() => {
    if (!currentFile) return;
    if (onDownload) {
      onDownload(currentFile);
    } else if (currentFile.downloadUrl) {
      window.open(currentFile.downloadUrl, '_blank');
    }
  }, [currentFile, onDownload]);

  const handleDelete = useCallback(async () => {
    if (!currentFile || !onDelete) return;
    await onDelete(currentFile);
    if (currentIndex >= floorplanFiles.length - 1) {
      setCurrentIndex(Math.max(0, currentIndex - 1));
    }
  }, [currentFile, onDelete, currentIndex, floorplanFiles.length]);

  // =========================================================================
  // EMPTY STATE
  // =========================================================================

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

  // =========================================================================
  // ZOOM CONTROLS — reusable toolbar builder
  // =========================================================================

  function renderZoomControls(
    zp: ReturnType<typeof useZoomPan>,
    options?: { showFullscreen?: boolean; showClose?: boolean },
  ) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={zp.zoomOut}
              disabled={zp.zoom <= ZOOM_CONFIG.minZoom}
              aria-label={t('floorplan.zoomOut')}
            >
              <ZoomOut className={iconSizes.sm} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('floorplan.zoomOut')}</TooltipContent>
        </Tooltip>

        <span className={cn('text-xs min-w-[40px] text-center', colors.text.muted)}>
          {Math.round(zp.zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={zp.zoomIn}
              disabled={zp.zoom >= ZOOM_CONFIG.maxZoom}
              aria-label={t('floorplan.zoomIn')}
            >
              <ZoomIn className={iconSizes.sm} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('floorplan.zoomIn')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={zp.resetAll}
              aria-label={t('floorplan.resetZoom')}
            >
              <Maximize2 className={iconSizes.sm} aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('floorplan.resetZoom')}</TooltipContent>
        </Tooltip>

        {options?.showFullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenFullscreen}
                aria-label={t('floorplan.fullscreen')}
              >
                <Expand className={iconSizes.sm} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('floorplan.fullscreen')}</TooltipContent>
          </Tooltip>
        )}

        {options?.showClose && (
          <>
            <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseFullscreen}
                  aria-label={t('floorplan.close')}
                >
                  <X className={iconSizes.sm} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('floorplan.close')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </>
    );
  }

  // =========================================================================
  // VIEWER CONTENT — reusable for inline + fullscreen
  // =========================================================================

  function renderViewerContent(
    zp: ReturnType<typeof useZoomPan>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    viewClassName?: string,
  ) {
    return (
      <figure
        ref={zp.containerRef}
        {...zp.handlers}
        className={cn(
          'flex-1 relative overflow-hidden bg-muted/30 select-none',
          zp.cursorClass,
          viewClassName,
        )}
      >
        {/* Loading State */}
        {isLoading && (
          <section className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
            <AnimatedSpinner size="large" />
            <span className="mt-2 text-sm">{t('floorplan.loading')}</span>
          </section>
        )}

        {/* Error State */}
        {sceneError && !isLoading && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <Map className={cn(iconSizes.xl, 'text-destructive mb-2')} aria-hidden="true" />
            <span className="text-sm text-destructive">{sceneError}</span>
          </section>
        )}

        {/* DXF Canvas */}
        {isDxf && !isLoading && !sceneError && loadedScene && (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={canvasUtilities.geoInteractive.canvasFullDisplay()}
            aria-label={t('floorplan.canvasAlt', { fileName: currentFile?.displayName })}
          />
        )}

        {/* DXF — no scene loaded */}
        {isDxf && !isLoading && !sceneError && !loadedScene && currentFile?.processedData && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <Map className={cn(iconSizes.xl, 'text-warning mb-2')} aria-hidden="true" />
            <span className="text-sm text-muted-foreground">
              {t('floorplan.noSceneData')}
            </span>
          </section>
        )}

        {/* PDF Display */}
        {isPdf && currentFile?.downloadUrl && (
          <iframe
            src={currentFile.downloadUrl}
            title={currentFile.displayName}
            className="absolute inset-0 w-full h-full border-0"
          />
        )}

        {/* Image Display — uses contentStyle from useZoomPan */}
        {isImage && currentFile?.downloadUrl && (
          <img
            src={currentFile.downloadUrl}
            alt={currentFile.displayName}
            className="w-full h-full object-contain"
            style={zp.contentStyle}
            draggable={false}
          />
        )}

        {/* DXF — processing in progress */}
        {isDxf && !currentFile?.processedData && !isLoading && !sceneError && (
          <section className="flex flex-col items-center justify-center h-full">
            <AnimatedSpinner size="large" />
            <span className="mt-2 text-sm">{t('floorplan.processing')}</span>
          </section>
        )}
      </figure>
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <>
      <article
        className={cn('flex flex-col h-full', className)}
        role="region"
        aria-label={t('floorplan.galleryLabel')}
      >
        {/* Navigation Header */}
        <header className="flex items-center justify-between p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Navigation Arrows + File Info */}
          <nav className="flex items-center gap-2" aria-label={t('floorplan.navigation')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevious}
                  disabled={floorplanFiles.length <= 1}
                  aria-label={t('floorplan.previous')}
                >
                  <ChevronLeft className={iconSizes.md} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('floorplan.previous')}</TooltipContent>
            </Tooltip>

            <span className="flex items-center gap-2 min-w-[200px] justify-center">
              {getFileIcon(currentFile?.ext || '')}
              <span className="font-medium truncate max-w-[150px]" title={currentFile?.displayName}>
                {currentFile?.displayName || t('floorplan.untitled')}
              </span>
              <span className={cn('text-sm', colors.text.muted)}>
                ({currentIndex + 1}/{floorplanFiles.length})
              </span>
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToNext}
                  disabled={floorplanFiles.length <= 1}
                  aria-label={t('floorplan.next')}
                >
                  <ChevronRight className={iconSizes.md} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('floorplan.next')}</TooltipContent>
            </Tooltip>
          </nav>

          {/* Action Buttons */}
          <nav className="flex items-center gap-1" aria-label={t('floorplan.actions')}>
            {/* Zoom Controls + Fullscreen */}
            {renderZoomControls(inlineZP, { showFullscreen: true })}

            <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />

            {/* Download */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!currentFile?.downloadUrl}
                  aria-label={t('floorplan.download')}
                >
                  <Download className={iconSizes.sm} aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('floorplan.download')}</TooltipContent>
            </Tooltip>

            {/* Delete */}
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="text-destructive hover:text-destructive"
                    aria-label={t('floorplan.delete')}
                  >
                    <Trash2 className={iconSizes.sm} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('floorplan.delete')}</TooltipContent>
              </Tooltip>
            )}
          </nav>
        </header>

        {/* Inline Floorplan Viewer */}
        {renderViewerContent(inlineZP, inlineCanvasRef, 'min-h-[500px]')}
      </article>

      {/* =============================================================== */}
      {/* FULLSCREEN MODAL                                                */}
      {/* =============================================================== */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent
          className="sm:max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0"
          hideCloseButton
        >
          {/* Fullscreen Header */}
          <header className="flex items-center justify-between p-2 border-b bg-background/95 shrink-0">
            {/* File Info */}
            <span className="flex items-center gap-2 px-2">
              {getFileIcon(currentFile?.ext || '')}
              <span className="font-medium truncate max-w-[300px]" title={currentFile?.displayName}>
                {currentFile?.displayName || t('floorplan.untitled')}
              </span>
            </span>

            {/* Zoom Controls + Close */}
            <nav className="flex items-center gap-1" aria-label={t('floorplan.actions')}>
              {renderZoomControls(modalZP, { showClose: true })}
            </nav>
          </header>

          {/* Fullscreen Viewer */}
          {renderViewerContent(modalZP, modalCanvasRef)}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FloorplanGallery;
