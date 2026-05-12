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
// BOUNDS COMPUTATION
// ============================================================================

type BoundsPoint = { x: number; y: number };
type SceneBounds = { min: BoundsPoint; max: BoundsPoint };

/**
 * Compute the actual bounding box from all entities in the scene.
 * Always returns bounds that include every entity, regardless of scene.bounds.
 * Adds 5% padding so entities at the edge are not clipped.
 *
 * WHY: scene.bounds comes from the original DXF parsing and is never updated
 * when the user adds entities outside the original drawing bounds in the DXF
 * Viewer. This function derives the true viewport from the live entity data.
 */
export function computeActualBounds(entities: DxfSceneData['entities']): SceneBounds {
  if (!entities || entities.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const entity of entities) {
    const e = entity as Record<string, unknown>;
    switch (entity.type) {
      case 'line': {
        const s = e.start as BoundsPoint | undefined;
        const en = e.end as BoundsPoint | undefined;
        if (s) expand(s.x, s.y);
        if (en) expand(en.x, en.y);
        break;
      }
      case 'polyline':
      case 'lwpolyline': {
        const verts = e.vertices as BoundsPoint[] | undefined;
        if (verts) for (const v of verts) expand(v.x, v.y);
        break;
      }
      case 'rectangle': {
        const c1 = e.corner1 as BoundsPoint | undefined;
        const c2 = e.corner2 as BoundsPoint | undefined;
        if (c1) expand(c1.x, c1.y);
        if (c2) expand(c2.x, c2.y);
        break;
      }
      case 'circle': {
        const c = e.center as BoundsPoint | undefined;
        const r = e.radius as number | undefined;
        if (c && r != null) {
          expand(c.x - r, c.y - r);
          expand(c.x + r, c.y + r);
        }
        break;
      }
      case 'arc': {
        const c = e.center as BoundsPoint | undefined;
        const r = e.radius as number | undefined;
        // Conservative: full circle AABB (avoids angle-sweep math for a simple viewer)
        if (c && r != null) {
          expand(c.x - r, c.y - r);
          expand(c.x + r, c.y + r);
        }
        break;
      }
      case 'text':
      case 'mtext': {
        const pos = e.position as BoundsPoint | undefined;
        if (!pos) break;
        expand(pos.x, pos.y);
        // T-tool entities (textNode) use TL attachment: text body extends DOWNWARD
        // in DXF space (smaller Y). Expand to include the full glyph so stems don't
        // get clipped at canvas bottom. Use same height fallback as renderDxfToCanvas.
        type TN = { paragraphs?: unknown[] };
        if ((e.textNode as TN | undefined)?.paragraphs) {
          const eH = e.height as number | undefined;
          expand(pos.x, pos.y - (eH || 10));
        }
        break;
      }
    }
  }

  if (!isFinite(minX)) return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract the explicit run-level color from a textNode AST (ADR-344).
 * Mirrors useDxfSceneConversion.extractFirstRunStyle — reads only the TrueColor
 * from the first run so the gallery matches the DXF-viewer canvas color exactly.
 * Returns undefined for ByLayer / ByBlock (inherit from entity/layer color chain).
 */
function extractTextNodeColor(e: Record<string, unknown>): string | undefined {
  type TrueColor = { kind: string; r: number; g: number; b: number };
  type TextRun = { style?: { color?: TrueColor } };
  type TextParagraph = { runs?: TextRun[] };
  type TextNodeShape = { paragraphs?: TextParagraph[] };
  const textNode = e.textNode as TextNodeShape | undefined;
  const run = textNode?.paragraphs?.[0]?.runs?.[0];
  const color = run?.style?.color;
  if (!color || color.kind !== 'TrueColor') return undefined;
  return `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
}

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

  // Compute bounds from ALL entities — never trust scene.bounds (stale after DXF Viewer edits).
  const bounds = computeActualBounds(scene.entities);
  const drawingWidth = bounds.max.x - bounds.min.x;
  const drawingHeight = bounds.max.y - bounds.min.y;
  const baseScale = Math.min(canvas.width / drawingWidth, canvas.height / drawingHeight);
  const scale = baseScale * zoom;
  const offsetX = (canvas.width - drawingWidth * scale) / 2 + panOffset.x;
  const offsetY = (canvas.height - drawingHeight * scale) / 2 + panOffset.y;

  // Entity color helper — resolution order: mode override → entity.color → layer.color → fallback.
  // Light mode forces '#1a1a1a' for all entities (print readability).
  // Dark mode uses entity.color when set (preserves user-chosen colors from DXF Viewer),
  // then falls back to layer color.
  const getEntityColor = (layerName: string, entityColor?: string): string =>
    modeConfig.entityColor || entityColor || scene.layers?.[layerName]?.color || '#e2e8f0';

  ctx.lineWidth = 1;

  // Render entities
  scene.entities.forEach((entity) => {
    if (scene.layers?.[entity.layer]?.visible === false) return;

    const e = entity as Record<string, unknown>;
    const resolvedColor = getEntityColor(entity.layer, e.color as string | undefined);
    ctx.strokeStyle = resolvedColor;

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

      case 'text':
      case 'mtext': {
        const position = e.position as { x: number; y: number } | undefined;
        // Support flat `text` field (DXF-imported) and `textNode` AST (CreateTextCommand).
        let text = e.text as string | undefined;
        type TextNodeShape = { paragraphs?: Array<{ runs?: Array<{ text?: string; style?: { height?: number } }> }> };
        const textNode = e.textNode as TextNodeShape | undefined;
        if (!text && textNode?.paragraphs) {
          text = textNode.paragraphs
            .map(p => (p.runs ?? []).map(r => r.text ?? '').join(''))
            .join('\n')
            .trim() || undefined;
        }
        const height = e.height as number | undefined;
        if (position && text) {
          // Text color priority: mode override → textNode TrueColor → entity.color → layer → fallback
          const textRunColor = extractTextNodeColor(e);
          ctx.fillStyle = modeConfig.entityColor || textRunColor || resolvedColor;
          if (textNode) {
            // T-tool entity: position = TL (top of text, TL attachment from DXF viewer).
            // Use 'top' baseline so canvas renders text BELOW canvasY, matching DXF viewer.
            // Font size uses same formula as DXF-imported path — runHeight (2.5mm default)
            // is too small to be legible at gallery scale (~1.35 px/mm for A4).
            ctx.textBaseline = 'top';
            ctx.font = `${Math.max(8, (height || 10) * scale)}px Arial`;
          } else {
            // DXF-imported entity: position = BL (baseline, standard DXF TEXT anchor).
            // 'alphabetic' matches the baseline rendering in the DXF viewer.
            ctx.textBaseline = 'alphabetic';
            ctx.font = `${Math.max(8, (height || 10) * scale)}px Arial`;
          }
          ctx.fillText(
            text,
            (position.x - bounds.min.x) * scale + offsetX,
            (bounds.max.y - position.y) * scale + offsetY,
          );
          ctx.textBaseline = 'alphabetic';
        }
        break;
      }
    }
  });
}
