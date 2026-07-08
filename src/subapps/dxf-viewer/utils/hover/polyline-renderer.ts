/**
 * Polyline Hover Renderer
 * Handles hover rendering for polyline entities with measurements and angles
 */

import { HOVER_CONFIG } from './config';
import { renderHoverEdgeWithDistance } from './edge-utils';
import type { HoverRenderContext } from './types';
import { isPolylineEntity } from '../../types/entities';
// 🏢 ADR-557 follow-up: closed-polygon area label SSoT (committed/preview/hover parity)
import { computePolygonAreaMetrics, paintPolygonAreaLabel } from '../../rendering/entities/shared/measurement-label';

export function renderPolylineHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  // ✅ ENTERPRISE FIX: Use type guard to ensure entity is PolylineEntity
  if (!isPolylineEntity(entity)) return;

  const vertices = entity.vertices;
  const isClosed = entity.closed || false;
  
  if (!vertices || vertices.length < 2) return;

  const screenVertices = vertices.map(v => worldToScreen(v));
  
  ctx.save();
  
  // Draw each edge with dashed lines and distance labels
  ctx.save();
  ctx.setLineDash(HOVER_CONFIG.lineStyle.dashPattern);
  
  // Draw edges with distances
  for (let i = 0; i < vertices.length - 1; i++) {
    renderHoverEdgeWithDistance(ctx, vertices[i], vertices[i + 1], screenVertices[i], screenVertices[i + 1]);
  }
  
  // For closed polylines, draw the closing edge
  if (isClosed && vertices.length > 2) {
    renderHoverEdgeWithDistance(
      ctx, 
      vertices[vertices.length - 1], 
      vertices[0], 
      screenVertices[screenVertices.length - 1], 
      screenVertices[0]
    );
  }
  
  ctx.restore(); // Restore line dash

  // Giorgio 2026-07-08: το πολύγωνο κατά τη σχεδίαση/επιλογή ΔΕΝ δείχνει πλέον τόξα +
  // μοίρες στις κορυφές («θέλω μόνον τις γραμμές του πολυγώνου»). Η ένδειξη εσωτερικής
  // γωνίας ανά κορυφή (renderHoverAngleAtVertex) αφαιρέθηκε από το hover/selection overlay.

  // For closed polylines, show area measurement (AREA-ONLY — no perimeter line in hover)
  if (isClosed && vertices.length >= 3) {
    const metrics = computePolygonAreaMetrics(vertices, true);
    paintPolygonAreaLabel(ctx, worldToScreen(metrics.centroid), metrics, { includePerimeter: false });
  }
  
  ctx.restore();
}