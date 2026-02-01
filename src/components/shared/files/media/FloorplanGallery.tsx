/**
 * =============================================================================
 * 🏢 ENTERPRISE: FloorplanGallery Component
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
 * - Navigation arrows (← →) for multiple files
 * - File indicator (1/3)
 * - Zoom/Download/Delete actions
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
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Map,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
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

/** Zoom levels */
const ZOOM_LEVELS = {
  MIN: 0.25,
  MAX: 4,
  STEP: 0.25,
  DEFAULT: 1,
} as const;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Filter files to only include floorplan-compatible formats
 */
function filterFloorplanFiles(files: FileRecord[]): FileRecord[] {
  return files.filter(file => {
    const ext = file.ext?.toLowerCase() || '';
    return FLOORPLAN_EXTENSIONS.includes(ext);
  });
}

/**
 * Get file type icon based on extension
 */
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
// COMPONENT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Floorplan Gallery Component
 *
 * Full-width viewer for technical drawings with navigation.
 * Follows Bentley/Autodesk patterns for CAD viewing.
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Filter to only floorplan files
  const floorplanFiles = useMemo(() => filterFloorplanFiles(files), [files]);

  // State
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(initialIndex, Math.max(0, floorplanFiles.length - 1))
  );
  const [zoom, setZoom] = useState<number>(ZOOM_LEVELS.DEFAULT);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedScene, setLoadedScene] = useState<DxfSceneData | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

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

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
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
  }, [goToPrevious, goToNext, floorplanFiles.length]);

  // =========================================================================
  // ZOOM CONTROLS
  // =========================================================================

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + ZOOM_LEVELS.STEP, ZOOM_LEVELS.MAX));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - ZOOM_LEVELS.STEP, ZOOM_LEVELS.MIN));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(ZOOM_LEVELS.DEFAULT);
  }, []);

  // =========================================================================
  // DXF AUTO-PROCESSING (Enterprise Pattern - ADR-033)
  // =========================================================================

  /**
   * 🏢 ENTERPRISE: Auto-process DXF files that don't have processedData
   * Calls /api/floorplans/process to trigger server-side DXF parsing
   */
  useEffect(() => {
    if (!currentFile || !isDxf) return;
    if (currentFile.processedData) return; // Already processed
    if (!currentFile.downloadUrl) return; // No file to process
    if (currentFile.status !== 'ready') return; // Not ready yet
    if (!auth.currentUser) return; // Need auth

    const triggerProcessing = async () => {
      console.log('🏭 [FloorplanGallery] Triggering DXF processing for:', currentFile.displayName);
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
        console.log('✅ [FloorplanGallery] DXF processing completed:', result);

        // 🏢 ENTERPRISE: Trigger refetch to get updated FileRecord with processedData
        if (onRefresh) {
          console.log('🔄 [FloorplanGallery] Triggering refetch after processing...');
          // Small delay to ensure Firestore has propagated the update
          setTimeout(() => {
            onRefresh();
          }, 500);
        }
      } catch (err) {
        console.error('❌ [FloorplanGallery] DXF processing failed:', err);
        setSceneError(err instanceof Error ? err.message : 'Processing failed');
      } finally {
        setIsLoading(false);
      }
    };

    triggerProcessing();
  }, [currentFile?.id, currentFile?.processedData, currentFile?.downloadUrl, currentFile?.status, isDxf, t, onRefresh]);

  // =========================================================================
  // DXF SCENE LOADING (V3 API Pattern)
  // =========================================================================

  useEffect(() => {
    // 🔍 DEBUG: Log what we're receiving
    console.log('🖼️ [FloorplanGallery] Scene loading effect:', {
      hasCurrentFile: !!currentFile,
      fileId: currentFile?.id,
      hasProcessedData: !!currentFile?.processedData,
      hasScene: !!currentFile?.processedData?.scene,
      sceneEntitiesCount: currentFile?.processedData?.scene?.entities?.length || 0,
      sceneLayersType: currentFile?.processedData?.scene?.layers ? (Array.isArray(currentFile.processedData.scene.layers) ? 'array' : 'object') : 'none',
    });

    if (!currentFile?.processedData) {
      setLoadedScene(null);
      return;
    }

    const processedData = currentFile.processedData;

    // V3: Load via authenticated API (processedDataPath exists)
    if (processedData.processedDataPath && currentFile.id && auth.currentUser) {
      setIsLoading(true);
      setSceneError(null);

      const loadSceneFromAPI = async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
            throw new Error('User not authenticated');
          }
          const idToken = await currentUser.getIdToken();

          const response = await fetch(`/api/floorplans/scene?fileId=${currentFile.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
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
          console.error('[FloorplanGallery] Failed to load scene:', err);
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
  // DXF CANVAS RENDERING
  // =========================================================================

  useEffect(() => {
    // 🔍 DEBUG: Log rendering conditions
    console.log('🎨 [FloorplanGallery] Canvas render effect:', {
      hasLoadedScene: !!loadedScene,
      hasCanvasRef: !!canvasRef.current,
      isDxf,
      entitiesCount: loadedScene?.entities?.length || 0,
      boundsPresent: !!loadedScene?.bounds,
    });

    if (!loadedScene || !canvasRef.current || !isDxf) return;
    if (!loadedScene.entities || loadedScene.entities.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const container = canvas.parentElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    // Detect dark mode
    const isDarkMode = document.documentElement.classList.contains('dark');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = isDarkMode ? '#111827' : '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds and scale with zoom
    const bounds = loadedScene.bounds || { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
    const drawingWidth = bounds.max.x - bounds.min.x;
    const drawingHeight = bounds.max.y - bounds.min.y;

    const scaleX = canvas.width / drawingWidth;
    const scaleY = canvas.height / drawingHeight;
    const baseScale = Math.min(scaleX, scaleY);
    const scale = baseScale * zoom;

    const offsetX = (canvas.width - drawingWidth * scale) / 2;
    const offsetY = (canvas.height - drawingHeight * scale) / 2;

    // 🔍 DEBUG: Log rendering parameters
    console.log('🎨 [FloorplanGallery] Rendering:', {
      canvasSize: { width: canvas.width, height: canvas.height },
      bounds,
      drawingSize: { width: drawingWidth, height: drawingHeight },
      scale,
      offset: { x: offsetX, y: offsetY },
      entitiesToRender: loadedScene.entities.length,
    });

    // Layer color helper
    const getLayerColor = (layerName: string): string => {
      return loadedScene.layers?.[layerName]?.color || '#e2e8f0';
    };

    ctx.lineWidth = 1;

    // Render entities
    loadedScene.entities.forEach((entity) => {
      if (loadedScene.layers?.[entity.layer]?.visible === false) return;

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
              (bounds.max.y - start.y) * scale + offsetY
            );
            ctx.lineTo(
              (end.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - end.y) * scale + offsetY
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
            const firstVertex = vertices[0];
            ctx.moveTo(
              (firstVertex.x - bounds.min.x) * scale + offsetX,
              (bounds.max.y - firstVertex.y) * scale + offsetY
            );

            vertices.slice(1).forEach((vertex) => {
              ctx.lineTo(
                (vertex.x - bounds.min.x) * scale + offsetX,
                (bounds.max.y - vertex.y) * scale + offsetY
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
              2 * Math.PI
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
              false
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
              (bounds.max.y - position.y) * scale + offsetY
            );
          }
          break;
        }
      }
    });
  }, [loadedScene, isDxf, zoom]);

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
    // Move to previous if at end, or stay at same index
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
        <Map className={cn(iconSizes.xl, colors.text.muted, 'mb-4')} aria-hidden="true" />
        <p className={cn('text-sm', colors.text.muted)}>
          {emptyMessage || t('floorplan.noFloorplans')}
        </p>
      </section>
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
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
          {/* Zoom Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= ZOOM_LEVELS.MIN}
                aria-label={t('floorplan.zoomOut')}
              >
                <ZoomOut className={iconSizes.sm} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('floorplan.zoomOut')}</TooltipContent>
          </Tooltip>
          <span className={cn('text-xs min-w-[40px] text-center', colors.text.muted)}>
            {Math.round(zoom * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= ZOOM_LEVELS.MAX}
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
                onClick={handleResetZoom}
                aria-label={t('floorplan.resetZoom')}
              >
                <Maximize2 className={iconSizes.sm} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('floorplan.resetZoom')}</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

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

      {/* Floorplan Preview Area - min-h-[500px] ensures visibility when parent has no fixed height */}
      <figure className="flex-1 min-h-[500px] relative overflow-hidden bg-muted/30">
        {/* Loading State */}
        {isLoading && (
          <section className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
            <AnimatedSpinner size="large" />
            <span className="mt-3 text-sm">{t('floorplan.loading')}</span>
          </section>
        )}

        {/* Error State */}
        {sceneError && !isLoading && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <Map className={cn(iconSizes.xl, 'text-destructive mb-2')} aria-hidden="true" />
            <span className="text-sm text-destructive">{sceneError}</span>
          </section>
        )}

        {/* DXF Canvas - Only render when loadedScene exists */}
        {isDxf && !isLoading && !sceneError && loadedScene && (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={canvasUtilities.geoInteractive.canvasFullDisplay()}
            aria-label={t('floorplan.canvasAlt', { fileName: currentFile?.displayName })}
          />
        )}

        {/* DXF file but no scene loaded - show message */}
        {isDxf && !isLoading && !sceneError && !loadedScene && currentFile?.processedData && (
          <section className="absolute inset-0 flex flex-col items-center justify-center">
            <Map className={cn(iconSizes.xl, 'text-warning mb-2')} aria-hidden="true" />
            <span className="text-sm text-muted-foreground">Δεν φορτώθηκαν δεδομένα κάτοψης</span>
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

        {/* Image Display */}
        {isImage && currentFile?.downloadUrl && (
          <img
            src={currentFile.downloadUrl}
            alt={currentFile.displayName}
            className="w-full h-full object-contain"
            style={{ transform: `scale(${zoom})` }}
          />
        )}

        {/* No processedData - Processing in progress */}
        {isDxf && !currentFile?.processedData && !isLoading && !sceneError && (
          <section className="flex flex-col items-center justify-center h-full">
            <AnimatedSpinner size="large" />
            <span className="mt-3 text-sm">{t('floorplan.processing')}</span>
          </section>
        )}
      </figure>
    </article>
  );
}

export default FloorplanGallery;
