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
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useFullscreen } from '@/hooks/useFullscreen';
import { FullscreenContainer } from '@/core/containers/FullscreenContainer';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useZoomPan } from '@/hooks/useZoomPan';
import type { PanOffset } from '@/hooks/useZoomPan';
import { canvasUtilities } from '@/styles/design-tokens';
import { auth } from '@/lib/firebase';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import type { FileRecord, DxfSceneData, DxfSceneEntity } from '@/types/file-record';
import type { FloorOverlayItem } from '@/hooks/useFloorOverlays';
import { getStatusColors } from '@/subapps/dxf-viewer/config/color-mapping';
import { UI_COLORS, withOpacity } from '@/subapps/dxf-viewer/config/color-config';
import { isPointInPolygon } from '@core/polygon-system/utils/polygon-utils';
import type { UniversalPolygon } from '@core/polygon-system/types';

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
  /** Polygon overlays to render on top of DXF floorplans (ADR-237 / SPEC-237B) */
  overlays?: ReadonlyArray<FloorOverlayItem>;
  /** ID of unit highlighted externally (from list hover) — bidirectional sync (SPEC-237C) */
  highlightedOverlayUnitId?: string | null;
  /** Callback: mouse hovers overlay → passes linked unitId (or null on leave) (SPEC-237C) */
  onHoverOverlay?: (unitId: string | null) => void;
  /** Callback: user clicks overlay → passes linked unitId (SPEC-237C) */
  onClickOverlay?: (unitId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Supported floorplan file extensions (includes 'json' for scene data saved by FloorplanSaveOrchestrator) */
const FLOORPLAN_EXTENSIONS = ['dxf', 'pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'json'];

/** Zoom configuration for the useZoomPan hook */
const ZOOM_CONFIG = {
  minZoom: 0.25,
  maxZoom: 4,
  zoomStep: 0.25,
  defaultZoom: 1,
} as const;

/**
 * Drawing mode for DXF rendering in floorplan tabs.
 * - dark: Dark background + colored lines (layer colors)
 * - light: White background + black lines (technical drawing)
 */
type DxfDrawingMode = 'dark' | 'light';

/** Visual config per drawing mode */
const DRAWING_MODE_CONFIG = {
  dark: {
    background: '#111827',
    entityColor: null, // Use layer colors
    textColor: null,   // Use layer colors
  },
  light: {
    background: '#ffffff',
    entityColor: '#1a1a1a', // Force black
    textColor: '#1a1a1a',   // Force black
  },
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
 * Accepts zoom, panOffset, and drawing mode for interactive viewing.
 */
function renderDxfToCanvas(
  canvas: HTMLCanvasElement,
  scene: DxfSceneData,
  zoom: number,
  panOffset: PanOffset,
  drawingMode: DxfDrawingMode = 'dark',
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

  // Drawing mode config
  const modeConfig = DRAWING_MODE_CONFIG[drawingMode];

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = modeConfig.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate bounds, scale, and offset (including pan)
  const bounds = scene.bounds || { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  // Layer color helper — respects drawing mode
  const getLayerColor = (layerName: string): string =>
    modeConfig.entityColor || scene.layers?.[layerName]?.color || '#e2e8f0';

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
        const startAngleDeg = e.startAngle as number | undefined;
        const endAngleDeg = e.endAngle as number | undefined;
        if (arcCenter && arcRadius && startAngleDeg !== undefined && endAngleDeg !== undefined) {
          // DXF arcs: angles in degrees, CCW from East, Y+ up
          // Canvas arcs: angles in radians, CW from East, Y+ down
          // Fix: deg→rad, negate angles, flip direction for Y-axis inversion
          const startRad = startAngleDeg * Math.PI / 180;
          const endRad = endAngleDeg * Math.PI / 180;
          ctx.beginPath();
          ctx.arc(
            (arcCenter.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - arcCenter.y) * scale + offsetY,
            arcRadius * scale,
            -startRad,
            -endRad,
            true,
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
// OVERLAY RENDERING (SPEC-237B — Overlay Bridge Core)
// ============================================================================

/** Fallback colors when no status is set */
const OVERLAY_FALLBACK = {
  stroke: UI_COLORS.DARK_GRAY,
  fill: withOpacity(UI_COLORS.DARK_GRAY, 0.375),
} as const;

/**
 * Draw polygon overlays on top of a DXF canvas.
 * Uses the SAME coordinate transform as renderDxfToCanvas (Y-flip, scale, offset).
 * Only for DXF floorplans — PDF/Image require calibration data (SPEC-237D).
 */
function drawOverlayPolygons(
  canvas: HTMLCanvasElement,
  overlays: ReadonlyArray<FloorOverlayItem>,
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
  zoom: number,
  panOffset: PanOffset,
  highlightedUnitId?: string | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || overlays.length === 0) return;

  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  ctx.save();

  for (const overlay of overlays) {
    if (overlay.polygon.length < 3) continue;

    const colors = getStatusColors(overlay.status ?? 'unavailable') ?? OVERLAY_FALLBACK;
    const isHighlighted = !!(highlightedUnitId && overlay.linked?.unitId === highlightedUnitId);

    ctx.fillStyle = isHighlighted
      ? withOpacity(colors.stroke, 0.7)
      : colors.fill;
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = isHighlighted ? 3 : 2;

    // Draw polygon
    ctx.beginPath();
    overlay.polygon.forEach((vertex, i) => {
      const sx = (vertex.x - bounds.min.x) * scale + offsetX;
      const sy = (bounds.max.y - vertex.y) * scale + offsetY;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw label if present
    if (overlay.label) {
      const centroid = overlay.polygon.reduce(
        (acc, v) => ({ x: acc.x + v.x, y: acc.y + v.y }),
        { x: 0, y: 0 },
      );
      centroid.x /= overlay.polygon.length;
      centroid.y /= overlay.polygon.length;

      const cx = (centroid.x - bounds.min.x) * scale + offsetX;
      const cy = (bounds.max.y - centroid.y) * scale + offsetY;

      const fontSize = Math.max(10, 14 * scale / baseScale);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(overlay.label, cx, cy);
    }
  }

  ctx.restore();
}

// ============================================================================
// HIT-TESTING UTILITIES (SPEC-237C — Interactive Overlays)
// ============================================================================

/** AABB (Axis-Aligned Bounding Box) for fast pre-filtering */
interface OverlayAABB {
  overlayIndex: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  unitId: string | undefined;
}

/** Compute AABBs for all overlays (memoized externally) */
function computeOverlayAABBs(overlays: ReadonlyArray<FloorOverlayItem>): OverlayAABB[] {
  return overlays.map((overlay, index) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of overlay.polygon) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
    return { overlayIndex: index, minX, minY, maxX, maxY, unitId: overlay.linked?.unitId };
  });
}

/**
 * Inverse coordinate transform: screen (canvas) pixels → DXF world coordinates.
 * Reverses the math in renderDxfToCanvas:
 *   screenX = (worldX - bounds.min.x) * scale + offsetX
 *   screenY = (bounds.max.y - worldY) * scale + offsetY
 */
function screenToWorld(
  screenX: number,
  screenY: number,
  canvas: HTMLCanvasElement,
  bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
  zoom: number,
  panOffset: PanOffset,
): { x: number; y: number } {
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  const worldX = (screenX - offsetX) / scale + bounds.min.x;
  const worldY = bounds.max.y - (screenY - offsetY) / scale;
  return { x: worldX, y: worldY };
}

/**
 * Hit-test overlays at a world-space point.
 * Uses AABB pre-filter + centralized isPointInPolygon (ray casting).
 * Returns the first overlay with a linked unitId, or null.
 */
function hitTestOverlays(
  worldPoint: { x: number; y: number },
  overlays: ReadonlyArray<FloorOverlayItem>,
  aabbs: OverlayAABB[],
): FloorOverlayItem | null {
  for (const aabb of aabbs) {
    // AABB pre-filter
    if (worldPoint.x < aabb.minX || worldPoint.x > aabb.maxX ||
        worldPoint.y < aabb.minY || worldPoint.y > aabb.maxY) {
      continue;
    }

    const overlay = overlays[aabb.overlayIndex];
    // Wrap in UniversalPolygon for isPointInPolygon (ZERO `as any`)
    const universalPolygon: UniversalPolygon = {
      id: overlay.id,
      type: 'simple',
      points: overlay.polygon,
      isClosed: true,
      style: { strokeColor: '', fillColor: '', strokeWidth: 0, fillOpacity: 0, strokeOpacity: 0 },
    };

    if (isPointInPolygon(worldPoint, universalPolygon)) {
      return overlay;
    }
  }
  return null;
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
  overlays,
  highlightedOverlayUnitId,
  onHoverOverlay,
  onClickOverlay,
}: FloorplanGalleryProps) {
  const { t } = useTranslation('files');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // Canvas refs for DXF rendering (inline + fullscreen)
  const inlineCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);
  const modalCanvasReadyRef = useRef(false);

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

  // Fullscreen modal state (ADR-241 centralized)
  const fullscreen = useFullscreen();

  // DXF drawing mode — dark (colored) or light (black & white)
  const [drawingMode, setDrawingMode] = useState<DxfDrawingMode>('dark');

  // Zoom + Pan — inline view
  const inlineZP = useZoomPan(ZOOM_CONFIG);

  // Zoom + Pan — fullscreen modal (independent instance)
  const modalZP = useZoomPan(ZOOM_CONFIG);

  // SPEC-237C: AABB cache for fast hit-testing
  const overlayAABBs = useMemo(
    () => overlays ? computeOverlayAABBs(overlays) : [],
    [overlays],
  );

  // SPEC-237C: Local hover state for cursor + visual feedback
  const [hoveredOverlayUnitId, setHoveredOverlayUnitId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  // SPEC-237C: Effective highlight = external (list hover) OR local (canvas hover)
  const effectiveHighlightId = highlightedOverlayUnitId || hoveredOverlayUnitId;

  // Current file
  const currentFile = floorplanFiles[currentIndex] || null;
  const fileExt = currentFile?.ext?.toLowerCase() || '';
  // JSON scene files (saved by FloorplanSaveOrchestrator) are treated as DXF scenes
  const isDxf = fileExt === 'dxf' || fileExt === 'json';
  const isPdf = fileExt === 'pdf';
  const isImage = currentFile && !isDxf && !isPdf;

  // =========================================================================
  // SPEC-237C: Canvas Mouse Handlers (Hit-Testing, Hover, Click)
  // =========================================================================

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!loadedScene?.bounds || !overlays?.length || !inlineCanvasRef.current) return;
    // rAF-throttle for 60fps performance
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = inlineCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Account for CSS scaling vs actual canvas pixels
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const screenX = (e.clientX - rect.left) * scaleX;
      const screenY = (e.clientY - rect.top) * scaleY;
      const worldPt = screenToWorld(screenX, screenY, canvas, loadedScene.bounds!, inlineZP.zoom, inlineZP.panOffset);
      const hit = hitTestOverlays(worldPt, overlays, overlayAABBs);
      const unitId = hit?.linked?.unitId ?? null;
      setHoveredOverlayUnitId(unitId);
      onHoverOverlay?.(unitId);
    });
  }, [loadedScene?.bounds, overlays, overlayAABBs, inlineZP.zoom, inlineZP.panOffset, onHoverOverlay]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!loadedScene?.bounds || !overlays?.length || !inlineCanvasRef.current) return;
    const canvas = inlineCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;
    const worldPt = screenToWorld(screenX, screenY, canvas, loadedScene.bounds!, inlineZP.zoom, inlineZP.panOffset);
    const hit = hitTestOverlays(worldPt, overlays, overlayAABBs);
    if (hit?.linked?.unitId) {
      onClickOverlay?.(hit.linked.unitId);
    }
  }, [loadedScene?.bounds, overlays, overlayAABBs, inlineZP.zoom, inlineZP.panOffset, onClickOverlay]);

  const handleCanvasMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setHoveredOverlayUnitId(null);
    onHoverOverlay?.(null);
  }, [onHoverOverlay]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

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
      // Escape closes fullscreen modal (handled by useFullscreen hook — ADR-241)
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

  // =========================================================================
  // FULLSCREEN
  // =========================================================================

  const handleOpenFullscreen = useCallback(() => {
    modalZP.resetAll();
    fullscreen.enter();
  }, [modalZP, fullscreen]);

  const handleCloseFullscreen = useCallback(() => {
    fullscreen.exit();
  }, [fullscreen]);

  // =========================================================================
  // DXF SCENE LOADING — Single unified effect (no race conditions)
  // Priority: V1 embedded → V3 API → JSON scene → Client-side DXF parse
  // =========================================================================

  useEffect(() => {
    // Guard: only DXF/JSON files
    if (!currentFile || !isDxf) {
      setLoadedScene(null);
      return;
    }

    let cancelled = false;

    const loadScene = async () => {
      // ── PATH A: V1 Legacy — embedded scene in processedData ──
      if (currentFile.processedData?.scene) {
        setLoadedScene(currentFile.processedData.scene);
        return;
      }

      // ── PATH B: V3 — processedDataPath via authenticated API ──
      if (currentFile.processedData?.processedDataPath && currentFile.id && auth.currentUser) {
        setIsLoading(true);
        setSceneError(null);
        try {
          const idToken = await auth.currentUser.getIdToken();
          const response = await fetch(`/api/floorplans/scene?fileId=${currentFile.id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${idToken}` },
          });
          if (cancelled) return;
          if (response.status === 202) {
            setSceneError(t('floorplan.processingInProgress'));
            return;
          }
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
          const sceneData: DxfSceneData = await response.json();
          if (!cancelled) setLoadedScene(sceneData);
        } catch (err) {
          if (!cancelled) {
            logger.error('Failed to load scene via API', { error: err });
            setSceneError(err instanceof Error ? err.message : 'Unknown error');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      // From here: NO processedData — need to fetch + parse from downloadUrl
      if (!currentFile.downloadUrl) return;

      // ── PATH C: JSON scene files (FloorplanSaveOrchestrator) ──
      if (fileExt === 'json') {
        setIsLoading(true);
        setSceneError(null);
        try {
          const response = await fetch(currentFile.downloadUrl);
          if (cancelled) return;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const sceneData: DxfSceneData = await response.json();
          if (!cancelled) setLoadedScene(sceneData);
        } catch (err) {
          if (!cancelled) {
            logger.error('Failed to load JSON scene', { error: err });
            setSceneError(err instanceof Error ? err.message : 'Unknown error');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      // ── PATH D: Client-side DXF parsing (same pipeline as DXF Viewer) ──
      if (currentFile.status !== 'ready') return;

      setIsLoading(true);
      setSceneError(null);
      try {
        logger.info('Client-side DXF parsing', { displayName: currentFile.displayName });
        const resp = await fetch(currentFile.downloadUrl);
        if (cancelled) return;
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const file = new File([blob], currentFile.originalFilename || 'plan.dxf');

        const { dxfImportService } = await import('@/subapps/dxf-viewer/io/dxf-import');
        const result = await dxfImportService.importDxfFile(file);
        if (cancelled) return;
        if (!result.success || !result.scene) throw new Error(result.error || 'Parse failed');

        const scene: DxfSceneData = {
          entities: result.scene.entities.map((entity) => {
            const { type, layer, ...rest } = entity;
            return { type, layer: layer || '0', ...rest } as DxfSceneEntity;
          }),
          layers: result.scene.layers,
          bounds: result.scene.bounds,
        };

        if (!cancelled) setLoadedScene(scene);
      } catch (err) {
        if (!cancelled) {
          logger.error('Client-side DXF parse failed', { error: err });
          setSceneError(err instanceof Error ? err.message : 'Parse failed');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadScene();
    return () => { cancelled = true; };
  }, [currentFile?.id, currentFile?.processedData, currentFile?.downloadUrl,
      currentFile?.status, currentFile?.originalFilename, isDxf, fileExt, t]);

  // =========================================================================
  // DXF CANVAS RENDERING — INLINE
  // =========================================================================

  useEffect(() => {
    if (!loadedScene || !inlineCanvasRef.current || !isDxf) return;
    renderDxfToCanvas(inlineCanvasRef.current, loadedScene, inlineZP.zoom, inlineZP.panOffset, drawingMode);
    // SPEC-237B/C: Draw overlay polygons with optional highlight
    if (overlays?.length && loadedScene.bounds) {
      drawOverlayPolygons(inlineCanvasRef.current, overlays, loadedScene.bounds, inlineZP.zoom, inlineZP.panOffset, effectiveHighlightId);
    }
  }, [loadedScene, isDxf, inlineZP.zoom, inlineZP.panOffset, drawingMode, overlays, effectiveHighlightId]);

  // =========================================================================
  // DXF CANVAS RENDERING — FULLSCREEN MODAL
  // =========================================================================

  // Reset modal canvas flag when fullscreen closes
  useEffect(() => {
    if (!fullscreen.isFullscreen) modalCanvasReadyRef.current = false;
  }, [fullscreen.isFullscreen]);

  useEffect(() => {
    if (!fullscreen.isFullscreen || !loadedScene || !isDxf) return;

    const doRender = () => {
      if (!modalCanvasRef.current) return;
      renderDxfToCanvas(modalCanvasRef.current, loadedScene, modalZP.zoom, modalZP.panOffset, drawingMode);
      // SPEC-237B/C: Draw overlay polygons on fullscreen canvas too
      if (overlays?.length && loadedScene.bounds) {
        drawOverlayPolygons(modalCanvasRef.current, overlays, loadedScene.bounds, modalZP.zoom, modalZP.panOffset, effectiveHighlightId);
      }
      modalCanvasReadyRef.current = true;
    };

    if (!modalCanvasReadyRef.current) {
      // First render: wait for Dialog open animation (duration-200) to finish
      const timerId = setTimeout(doRender, 280);
      return () => clearTimeout(timerId);
    }

    // Subsequent renders (zoom/pan changes): immediate
    doRender();
  }, [fullscreen.isFullscreen, loadedScene, isDxf, modalZP.zoom, modalZP.panOffset, drawingMode, overlays, effectiveHighlightId]);

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
    canvasRef: React.Ref<HTMLCanvasElement>,
    viewClassName?: string,
    enableHitTesting?: boolean,
  ) {
    return (
      <figure
        ref={zp.containerRef}
        {...zp.handlers}
        className={cn(
          'flex-1 min-h-0 relative overflow-hidden bg-muted/30 select-none',
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

        {/* DXF Canvas — SPEC-237C: mouse handlers for hit-testing */}
        {isDxf && !isLoading && !sceneError && loadedScene && (
          <canvas
            ref={canvasRef}
            className={cn('w-full h-full', enableHitTesting && effectiveHighlightId ? 'cursor-pointer' : '')}
            style={canvasUtilities.geoInteractive.canvasFullDisplay()}
            aria-label={t('floorplan.canvasAlt', { fileName: currentFile?.displayName })}
            onMouseMove={enableHitTesting ? handleCanvasMouseMove : undefined}
            onClick={enableHitTesting ? handleCanvasClick : undefined}
            onMouseLeave={enableHitTesting ? handleCanvasMouseLeave : undefined}
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

        {/* DXF — processing in progress (only if no client-side scene loaded) */}
        {isDxf && !currentFile?.processedData && !loadedScene && !isLoading && !sceneError && (
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium truncate max-w-[150px]">
                    {currentFile?.displayName || t('floorplan.untitled')}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{currentFile?.displayName}</TooltipContent>
              </Tooltip>
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
            {/* Drawing Mode Toggle (DXF only) */}
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
                      {drawingMode === 'dark' ? (
                        <Sun className={iconSizes.sm} aria-hidden="true" />
                      ) : (
                        <Moon className={iconSizes.sm} aria-hidden="true" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {drawingMode === 'dark' ? t('floorplan.lightMode') : t('floorplan.darkMode')}
                  </TooltipContent>
                </Tooltip>
                <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />
              </>
            )}

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

        {/* Inline Floorplan Viewer — SPEC-237C: enable hit-testing on inline canvas */}
        {renderViewerContent(inlineZP, inlineCanvasRef, 'min-h-[500px]', true)}
      </article>

      {/* =============================================================== */}
      {/* FULLSCREEN MODAL (ADR-241 centralized)                          */}
      {/* =============================================================== */}
      <FullscreenContainer
        isFullscreen={fullscreen.isFullscreen}
        onToggle={fullscreen.toggle}
        onExit={fullscreen.exit}
        mode="dialog"
        togglePosition="none"
        headerContent={
          <>
            <span className="flex items-center gap-2 px-2">
              {getFileIcon(currentFile?.ext || '')}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium truncate max-w-[300px]">
                    {currentFile?.displayName || t('floorplan.untitled')}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{currentFile?.displayName}</TooltipContent>
              </Tooltip>
            </span>
            <nav className="flex items-center gap-1 ml-auto" aria-label={t('floorplan.actions')}>
              {renderZoomControls(modalZP, { showClose: true })}
            </nav>
          </>
        }
        ariaLabel={t('floorplan.gallery')}
      >
        {/* Fullscreen Viewer */}
        {renderViewerContent(modalZP, modalCanvasRef)}
      </FullscreenContainer>
    </>
  );
}

export default FloorplanGallery;
