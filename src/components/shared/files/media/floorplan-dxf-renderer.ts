/* eslint-disable design-system/no-hardcoded-colors */
/**
 * =============================================================================
 * ENTERPRISE: FloorplanGallery DXF Canvas Renderer
 * =============================================================================
 *
 * Renders DXF scene data to an HTML canvas element.
 * Supports zoom, pan offset, and dark/light drawing modes.
 * Extracted from FloorplanGallery.tsx for SRP compliance (ADR-033).
 *
 * @module components/shared/files/media/floorplan-dxf-renderer
 */

import type { DxfSceneData } from '@/types/file-record';
import type { PanOffset } from '@/hooks/useZoomPan';
import type { DxfDrawingMode } from '@/components/shared/files/media/floorplan-gallery-config';

// ============================================================================
// DRAWING MODE CONFIG
// ============================================================================

/** Visual config per drawing mode */
export const DRAWING_MODE_CONFIG = {
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
// CANVAS RENDERING
// ============================================================================

/**
 * Render DXF scene data to a canvas element.
 * Accepts zoom, panOffset, and drawing mode for interactive viewing.
 */
export function renderDxfToCanvas(
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
