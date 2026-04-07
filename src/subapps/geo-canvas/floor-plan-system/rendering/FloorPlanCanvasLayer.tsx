/** Floor Plan Canvas Layer — canvas-based GeoJSON rendering over MapLibre map. */

'use client';

import { createModuleLogger } from '@/lib/telemetry';
import React, { useRef, useEffect, useState, useCallback } from 'react';

const logger = createModuleLogger('FloorPlanCanvasLayer');
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { ParserResult } from '../types';
import type { UseSnapEngineReturn } from '../snapping/hooks/useSnapEngine';
import { canvasUtilities } from '@/styles/design-tokens';
import { GEO_COLORS } from '../../config/color-config';
import { renderFeature, renderSnapIndicator } from './floor-plan-render-utils';

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

    console.debug('🖼️ FloorPlanCanvasLayer: Canvas resized', { width, height });
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
      logger.warn('No GeoJSON data to render');
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

    console.debug('🎨 Rendering floor plan features:', floorPlan.geoJSON.features.length);

    // NOTE: For now, we're rendering in LOCAL COORDINATES (not geo-projected)
    // This is a placeholder - Phase 2.2-2.3 will add proper transformation

    // Render each feature
    let renderedCount = 0;
    floorPlan.geoJSON.features.forEach((feature, index) => {
      try {
        renderFeature(ctx, feature, map, floorPlan.bounds!, transformMatrix);
        renderedCount++;
      } catch (error) {
        logger.warn(`Failed to render feature ${index}`, { error });
      }
    });

    console.debug(`✅ Rendered ${renderedCount}/${floorPlan.geoJSON.features.length} features`);

    // 🎯 RENDER SNAP INDICATOR (if active)
    if (snapEngine && snapEngine.snapResult && floorPlan.bounds) {
      renderSnapIndicator(
        ctx,
        snapEngine.snapResult.point,
        canvas,
        map,
        floorPlan.bounds,
        transformMatrix
      );
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
      logger.warn('handleMouseMove: Inverse affine transformation not implemented yet');

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

    console.debug('🔄 Cursor transformation:', {
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

      console.debug('🎯 Snap used:', {
        local: { x: localPoint.x.toFixed(2), y: localPoint.y.toFixed(2) },
        canvas: { x: canvasX.toFixed(2), y: canvasY.toFixed(2) }
      });
    }

    console.debug('🖱️ Canvas clicked:', { canvasX, canvasY });

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

export default FloorPlanCanvasLayer;

