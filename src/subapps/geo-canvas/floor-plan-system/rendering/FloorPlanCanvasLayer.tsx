/**
 * 🗺️ FLOOR PLAN CANVAS LAYER
 *
 * Renders floor plan on canvas overlay over MapLibre map
 *
 * @module floor-plan-system/rendering/FloorPlanCanvasLayer
 *
 * Features:
 * - Canvas-based rendering (better performance than SVG)
 * - GeoJSON feature rendering (LineString, Polygon, Point)
 * - Opacity control (0-100%)
 * - Show/hide toggle
 * - Responsive to map pan/zoom
 * - Layer styling options
 *
 * Technical:
 * - Uses HTML5 Canvas API
 * - MapLibre GL JS integration
 * - RequestAnimationFrame for smooth rendering
 * - Adaptive line width based on zoom
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { ParserResult } from '../types';
import type { UseSnapEngineReturn } from '../snapping/hooks/useSnapEngine';
import { canvasUtilities } from '@/styles/design-tokens';
import { GEO_COLORS } from '../../config/color-config';

/**
 * Layer styling options
 */
export interface FloorPlanLayerStyle {
  /** Stroke color (default: GEO_COLORS.CAD.FLOOR_PLAN_STROKE) */
  strokeColor?: string;
  /** Stroke width in pixels (default: 2) */
  strokeWidth?: number;
  /** Fill color for polygons (default: transparent) */
  fillColor?: string;
  /** Fill opacity 0-1 (default: 0) */
  fillOpacity?: number;
  /** Layer opacity 0-1 (default: 0.8) */
  opacity?: number;
  /** Line dash pattern (default: solid) */
  lineDash?: number[];
}

/**
 * Component props
 */
export interface FloorPlanCanvasLayerProps {
  /** MapLibre map instance */
  map: MaplibreMap | null;
  /** Parsed floor plan data */
  floorPlan: ParserResult | null;
  /** Layer visibility */
  visible?: boolean;
  /** Layer styling */
  style?: FloorPlanLayerStyle;
  /** Z-index (default: 100) */
  zIndex?: number;
  /** Container className */
  className?: string;
  /** Click handler - returns local floor plan coordinates */
  onClick?: (x: number, y: number, event: React.MouseEvent) => void;
  /** Disable all interactions (pointer-events: none) - useful when waiting for map click */
  disableInteractions?: boolean;
  /** Transformation matrix (STEP 2.3) - για geo-positioning */
  transformMatrix?: import('../types').AffineTransformMatrix | null;
  /** Snap engine (STEP 3: Snap-to-Point) */
  snapEngine?: UseSnapEngineReturn;
}

/**
 * Default layer style
 */
const DEFAULT_STYLE: Required<FloorPlanLayerStyle> = {
  strokeColor: GEO_COLORS.CAD.SELECTED_ENTITY,
  strokeWidth: 2,
  fillColor: GEO_COLORS.CAD.SELECTED_ENTITY,
  fillOpacity: 0.1,
  opacity: 0.8,
  lineDash: []
};

/**
 * FloorPlanCanvasLayer Component
 *
 * Renders floor plan GeoJSON features on canvas overlay
 *
 * @example
 * ```tsx
 * <FloorPlanCanvasLayer
 *   map={mapInstance}
 *   floorPlan={parserResult}
 *   visible={isVisible}
 *   style={{ strokeColor: GEO_COLORS.CAD.FLOOR_PLAN_STROKE, opacity: 0.8 }}
 * />
 * ```
 */
export function FloorPlanCanvasLayer({
  map,
  floorPlan,
  visible = true,
  style = {},
  zIndex = 100,
  className = '',
  onClick,
  disableInteractions = false,
  transformMatrix,
  snapEngine
}: FloorPlanCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Merge styles
  const layerStyle = { ...DEFAULT_STYLE, ...style };

  // ===================================================================
  // CANVAS SETUP & RESIZE
  // ===================================================================

  /**
   * Update canvas size to match map container
   */
  const updateCanvasSize = useCallback(() => {
    if (!map || !canvasRef.current) return;

    const container = map.getContainer();
    const { width, height } = container.getBoundingClientRect();

    canvasRef.current.width = width;
    canvasRef.current.height = height;
    setCanvasSize({ width, height });

    console.log('🖼️ FloorPlanCanvasLayer: Canvas resized', { width, height });
  }, [map]);

  /**
   * Initialize canvas on mount
   */
  useEffect(() => {
    if (!map) return;

    updateCanvasSize();

    // Listen to map resize events
    const handleResize = () => updateCanvasSize();
    map.on('resize', handleResize);

    return () => {
      map.off('resize', handleResize);
    };
  }, [map, updateCanvasSize]);

  // ===================================================================
  // RENDERING
  // ===================================================================

  /**
   * Render floor plan features to canvas
   */
  const renderFloorPlan = useCallback(() => {
    if (!map || !canvasRef.current || !floorPlan || !visible) {
      // Clear canvas if not visible
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        }
      }
      return;
    }

    if (!floorPlan.success || !floorPlan.geoJSON) {
      console.warn('⚠️ FloorPlanCanvasLayer: No GeoJSON data to render');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    // Set global opacity
    ctx.globalAlpha = layerStyle.opacity;

    // Set stroke style
    ctx.strokeStyle = layerStyle.strokeColor;
    ctx.lineWidth = layerStyle.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (layerStyle.lineDash.length > 0) {
      ctx.setLineDash(layerStyle.lineDash);
    }

    // Set fill style
    ctx.fillStyle = layerStyle.fillColor;

    console.log('🎨 Rendering floor plan features:', floorPlan.geoJSON.features.length);

    // NOTE: For now, we're rendering in LOCAL COORDINATES (not geo-projected)
    // This is a placeholder - Phase 2.2-2.3 will add proper transformation

    // Render each feature
    let renderedCount = 0;
    floorPlan.geoJSON.features.forEach((feature, index) => {
      try {
        renderFeature(ctx, feature, map, floorPlan.bounds!, transformMatrix);
        renderedCount++;
      } catch (error) {
        console.warn(`⚠️ Failed to render feature ${index}:`, error);
      }
    });

    console.log(`✅ Rendered ${renderedCount}/${floorPlan.geoJSON.features.length} features`);

    // 🎯 RENDER SNAP INDICATOR (if active)
    if (snapEngine && snapEngine.snapResult && floorPlan.bounds) {
      const { point } = snapEngine.snapResult;
      const bounds = floorPlan.bounds;
      const indicatorColor = GEO_COLORS.CAD.CROSSHAIR_INDICATOR; // Cyan - AutoCAD standard
      const indicatorSize = 8;

      // 🔄 FIX: Transform DXF local coordinates → canvas pixels
      // Same transformation logic as renderFeature()
      let canvasSnapX: number;
      let canvasSnapY: number;

      if (transformMatrix) {
        // ✅ CASE 1: Transformation matrix exists (geo-referenced)
        const lng = transformMatrix.a * point.x + transformMatrix.b * point.y + transformMatrix.c;
        const lat = transformMatrix.d * point.x + transformMatrix.e * point.y + transformMatrix.f;
        const mapPoint = map.project([lng, lat]);
        canvasSnapX = mapPoint.x;
        canvasSnapY = mapPoint.y;
      } else {
        // ✅ CASE 2: Fallback scaling
        const scale = Math.min(
          canvas.width / (bounds.maxX - bounds.minX),
          canvas.height / (bounds.maxY - bounds.minY)
        ) * 0.8;
        const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2;
        const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2;

        canvasSnapX = (point.x - bounds.minX) * scale + offsetX;
        canvasSnapY = canvas.height - ((point.y - bounds.minY) * scale + offsetY);
      }

      console.log('🎯 Rendering snap indicator:', {
        local: { x: point.x.toFixed(2), y: point.y.toFixed(2) },
        canvas: { x: canvasSnapX.toFixed(2), y: canvasSnapY.toFixed(2) }
      });

      ctx.save();

      // Outer circle (glow effect)
      ctx.beginPath();
      ctx.arc(canvasSnapX, canvasSnapY, indicatorSize + 2, 0, 2 * Math.PI);
      ctx.strokeStyle = indicatorColor;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5;
      ctx.stroke();

      // Inner circle (solid)
      ctx.beginPath();
      ctx.arc(canvasSnapX, canvasSnapY, indicatorSize, 0, 2 * Math.PI);
      ctx.strokeStyle = indicatorColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1.0;
      ctx.stroke();

      // Crosshair lines
      const crosshairSize = indicatorSize + 5;
      ctx.beginPath();
      ctx.moveTo(canvasSnapX - crosshairSize, canvasSnapY);
      ctx.lineTo(canvasSnapX + crosshairSize, canvasSnapY);
      ctx.moveTo(canvasSnapX, canvasSnapY - crosshairSize);
      ctx.lineTo(canvasSnapX, canvasSnapY + crosshairSize);
      ctx.strokeStyle = indicatorColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    // Reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.setLineDash([]);
  }, [map, floorPlan, visible, layerStyle, canvasSize, transformMatrix, snapEngine]);

  /**
   * Re-render when dependencies change
   */
  useEffect(() => {
    renderFloorPlan();
  }, [renderFloorPlan]);

  /**
   * Re-render when map moves/zooms
   */
  useEffect(() => {
    if (!map) return;

    const handleMapUpdate = () => {
      renderFloorPlan();
    };

    map.on('move', handleMapUpdate);
    map.on('zoom', handleMapUpdate);
    map.on('rotate', handleMapUpdate);
    map.on('pitch', handleMapUpdate);

    return () => {
      map.off('move', handleMapUpdate);
      map.off('zoom', handleMapUpdate);
      map.off('rotate', handleMapUpdate);
      map.off('pitch', handleMapUpdate);
    };
  }, [map, renderFloorPlan]);

  /**
   * Re-render when snap result changes
   */
  useEffect(() => {
    if (snapEngine?.snapResult) {
      renderFloorPlan();
    }
  }, [snapEngine?.snapResult, renderFloorPlan]);

  // ===================================================================
  // EVENT HANDLERS
  // ===================================================================

  /**
   * Handle mouse move - calculate snap
   */
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!snapEngine || !canvasRef.current || !map || !floorPlan) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    setMousePos({ x: canvasX, y: canvasY });

    // 🎯 FIX: Convert canvas pixels → DXF local coordinates
    // This way snap calculations happen in the same space as snap points!
    const bounds = floorPlan.bounds!;

    let localX: number;
    let localY: number;
    let radiusLocal: number;

    if (transformMatrix) {
      // ✅ CASE 1: Transformation matrix exists (geo-referenced)
      // Canvas → Map geo coords → DXF local coords (inverse transformation)
      const mapPoint = map.unproject([canvasX, canvasY]);
      const lng = mapPoint.lng;
      const lat = mapPoint.lat;

      // Inverse affine transformation: [lng, lat] → [x, y]
      // This requires solving the linear system (not trivial)
      // For now, fallback to simple scaling (same as rendering fallback)
      // TODO: Implement proper inverse affine transformation
      console.warn('⚠️ handleMouseMove: Inverse affine transformation not implemented yet');

      // Fallback: Use simple scaling
      const scale = Math.min(
        canvas.width / (bounds.maxX - bounds.minX),
        canvas.height / (bounds.maxY - bounds.minY)
      ) * 0.8;
      const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2;
      const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2;

      localX = (canvasX - offsetX) / scale + bounds.minX;
      localY = bounds.minY + (bounds.maxY - bounds.minY) - (canvasY - offsetY) / scale;
      radiusLocal = 10 / scale;
    } else {
      // ✅ CASE 2: No transformation matrix (fallback scaling)
      const scale = Math.min(
        canvas.width / (bounds.maxX - bounds.minX),
        canvas.height / (bounds.maxY - bounds.minY)
      ) * 0.8;
      const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2;
      const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2;

      // Inverse transformation: canvas pixels → DXF local coords
      localX = (canvasX - offsetX) / scale + bounds.minX;
      localY = bounds.minY + (bounds.maxY - bounds.minY) - (canvasY - offsetY) / scale;

      // Convert snap radius from pixels to DXF units
      radiusLocal = 10 / scale;
    }

    console.log('🔄 Cursor transformation:', {
      canvas: { x: canvasX, y: canvasY },
      local: { x: localX.toFixed(2), y: localY.toFixed(2) },
      radius: radiusLocal.toFixed(2)
    });

    // Calculate snap in DXF local coordinates
    snapEngine.calculateSnap(localX, localY);
  }, [snapEngine, map, floorPlan, transformMatrix]);

  /**
   * Handle canvas click - convert canvas coords to floor plan coords
   */
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick || !canvasRef.current || !floorPlan || !map) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const bounds = floorPlan.bounds!;

    // Canvas click coordinates (relative to canvas)
    let canvasX = event.clientX - rect.left;
    let canvasY = event.clientY - rect.top;

    // 🎯 SNAP: Use snapped coordinates if available (in DXF local space)
    if (snapEngine?.snapResult) {
      const localPoint = snapEngine.snapResult.point;

      // 🔄 FIX: Transform DXF local coordinates → canvas pixels
      if (transformMatrix) {
        // ✅ CASE 1: Transformation matrix exists
        const lng = transformMatrix.a * localPoint.x + transformMatrix.b * localPoint.y + transformMatrix.c;
        const lat = transformMatrix.d * localPoint.x + transformMatrix.e * localPoint.y + transformMatrix.f;
        const mapPoint = map.project([lng, lat]);
        canvasX = mapPoint.x;
        canvasY = mapPoint.y;
      } else {
        // ✅ CASE 2: Fallback scaling
        const scale = Math.min(
          canvas.width / (bounds.maxX - bounds.minX),
          canvas.height / (bounds.maxY - bounds.minY)
        ) * 0.8;
        const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2;
        const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2;

        canvasX = (localPoint.x - bounds.minX) * scale + offsetX;
        canvasY = canvas.height - ((localPoint.y - bounds.minY) * scale + offsetY);
      }

      console.log('🎯 Snap used:', {
        local: { x: localPoint.x.toFixed(2), y: localPoint.y.toFixed(2) },
        canvas: { x: canvasX.toFixed(2), y: canvasY.toFixed(2) }
      });
    }

    console.log('🖱️ Canvas clicked:', { canvasX, canvasY });

    // Pass coordinates to parent
    onClick(canvasX, canvasY, event);
  }, [onClick, floorPlan, snapEngine, map, transformMatrix]);

  // ===================================================================
  // RENDER
  // ===================================================================

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`floor-plan-canvas-layer ${className}`}
      style={canvasUtilities.geoInteractive.floorPlanCanvasLayer.container(disableInteractions, !!onClick, zIndex)}
    >
      <canvas
        ref={canvasRef}
        onClick={onClick ? handleCanvasClick : undefined}
        onMouseMove={snapEngine ? handleMouseMove : undefined}
        style={{
          ...canvasUtilities.geoInteractive.floorPlanCanvasLayer.canvas,
          cursor: onClick && !disableInteractions ? 'crosshair' : 'default'
        }}
      />
    </div>
  );
}

// ===================================================================
// RENDERING UTILITIES
// ===================================================================

/**
 * Render single GeoJSON feature
 *
 * STEP 2.3: Now supports proper geo-transformation!
 */
function renderFeature(
  ctx: CanvasRenderingContext2D,
  feature: GeoJSON.Feature,
  map: MaplibreMap,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  transformMatrix?: import('../types').AffineTransformMatrix | null
): void {
  const geometry = feature.geometry;

  // Transform function: local coords → geo coords → map pixels
  const transform = (x: number, y: number): [number, number] => {
    if (transformMatrix) {
      // ✅ STEP 2.3: Use affine transformation matrix
      // local (x, y) → geo (lng, lat) → map pixels
      const lng = transformMatrix.a * x + transformMatrix.b * y + transformMatrix.c;
      const lat = transformMatrix.d * x + transformMatrix.e * y + transformMatrix.f;

      // Convert geo coords to screen pixels using MapLibre
      const point = map.project([lng, lat]);
      return [point.x, point.y];
    } else {
      // ⚠️ FALLBACK: Simple local scaling (no transformation matrix)
      const canvas = ctx.canvas;
      const scale = Math.min(
        canvas.width / (bounds.maxX - bounds.minX),
        canvas.height / (bounds.maxY - bounds.minY)
      ) * 0.8;

      const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2;
      const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2;

      return [
        (x - bounds.minX) * scale + offsetX,
        canvas.height - ((y - bounds.minY) * scale + offsetY) // Flip Y
      ];
    }
  };

  switch (geometry.type) {
    case 'LineString':
      renderLineString(ctx, geometry, transform);
      break;

    case 'Polygon':
      renderPolygon(ctx, geometry, transform);
      break;

    case 'Point':
      // Skip points (TEXT entities) for now
      break;

    default:
      console.warn(`⚠️ Unsupported geometry type: ${geometry.type}`);
  }
}

/**
 * Render LineString
 */
function renderLineString(
  ctx: CanvasRenderingContext2D,
  geometry: GeoJSON.LineString,
  transform: (x: number, y: number) => [number, number]
): void {
  if (geometry.coordinates.length < 2) return;

  ctx.beginPath();

  const [startX, startY] = transform(
    geometry.coordinates[0][0],
    geometry.coordinates[0][1]
  );
  ctx.moveTo(startX, startY);

  for (let i = 1; i < geometry.coordinates.length; i++) {
    const [x, y] = transform(
      geometry.coordinates[i][0],
      geometry.coordinates[i][1]
    );
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

/**
 * Render Polygon
 */
function renderPolygon(
  ctx: CanvasRenderingContext2D,
  geometry: GeoJSON.Polygon,
  transform: (x: number, y: number) => [number, number]
): void {
  if (geometry.coordinates.length === 0 || geometry.coordinates[0].length < 3) {
    return;
  }

  ctx.beginPath();

  // Exterior ring
  const exteriorRing = geometry.coordinates[0];
  const [startX, startY] = transform(exteriorRing[0][0], exteriorRing[0][1]);
  ctx.moveTo(startX, startY);

  for (let i = 1; i < exteriorRing.length; i++) {
    const [x, y] = transform(exteriorRing[i][0], exteriorRing[i][1]);
    ctx.lineTo(x, y);
  }

  ctx.closePath();

  // Fill and stroke
  if (ctx.fillStyle !== GEO_COLORS.TRANSPARENT && ctx.globalAlpha > 0) {
    ctx.fill();
  }
  ctx.stroke();
}

/**
 * Export for convenience
 */
export default FloorPlanCanvasLayer;

