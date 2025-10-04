/**
 * Polyline Hover Renderer
 * Handles hover rendering for polyline entities with measurements and angles
 */

import { HOVER_CONFIG } from './config';
import { calculatePolygonArea, calculatePolygonCentroid } from '../../rendering/entities/shared/geometry-utils';
import { renderAreaLabel } from './render-utils';
import { renderHoverEdgeWithDistance } from './edge-utils';
import { renderHoverAngleAtVertex } from './angle-utils';
import type { Point2D } from '../../rendering/types/Types';

export function renderPolylineHover({ entity, ctx, worldToScreen, options }: HoverRenderContext): void {
  const vertices = entity.vertices as Point2D[];
  const isClosed = ('closed' in entity && entity.closed) || false;
  
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
  
  // Draw angle arcs and labels at interior vertices
  if (vertices.length >= 3) {
    if (isClosed) {
      // For closed polylines, all vertices have angles
      for (let i = 0; i < vertices.length; i++) {
        const prevVertex = vertices[(i - 1 + vertices.length) % vertices.length];
        const currentVertex = vertices[i];
        const nextVertex = vertices[(i + 1) % vertices.length];
        
        const prevScreen = screenVertices[(i - 1 + screenVertices.length) % screenVertices.length];
        const currentScreen = screenVertices[i];
        const nextScreen = screenVertices[(i + 1) % screenVertices.length];
        
        renderHoverAngleAtVertex(ctx, prevVertex, currentVertex, nextVertex, prevScreen, currentScreen, nextScreen);
      }
    } else {
      // For open polylines, only interior vertices have angles (skip first and last)
      for (let i = 1; i < vertices.length - 1; i++) {
        renderHoverAngleAtVertex(
          ctx,
          vertices[i - 1], 
          vertices[i], 
          vertices[i + 1],
          screenVertices[i - 1], 
          screenVertices[i], 
          screenVertices[i + 1]
        );
      }
    }
  }
  
  // For closed polylines, show area measurement
  if (isClosed && vertices.length >= 3) {
    const area = calculatePolygonArea(vertices);
    const centroid = calculatePolygonCentroid(screenVertices);
    renderAreaLabel(ctx, centroid.x, centroid.y, area);
  }
  
  ctx.restore();
}