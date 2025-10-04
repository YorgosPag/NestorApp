/**
 * DxfCanvas Overlay Integration
 * Προσθήκη overlay system στο DxfCanvas.tsx
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { OverlayRenderer } from './overlay-renderer';
import { dlog, dhotlog } from '../utils/devlog';

interface Entity {
  id: string;
  type: string;
  [key: string]: any;
}

// ═══ OVERLAY HOOK ═══

export const useOverlaySystem = (
  mainCanvasRef: React.RefObject<HTMLCanvasElement>,
  rendererRef: React.RefObject<any>,
  currentScene: any
) => {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRendererRef = useRef<OverlayRenderer | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [dragPreviewEntity, setDragPreviewEntity] = useState<Entity | null>(null);

  // ═══ INITIALIZATION ═══
  useEffect(() => {
    if (!overlayCanvasRef.current) return;

    if (!overlayRendererRef.current) {
      overlayRendererRef.current = new OverlayRenderer(overlayCanvasRef.current);
      dlog('🎨 Overlay system initialized');
    }

    return () => {
      if (overlayRendererRef.current) {
        overlayRendererRef.current.dispose();
        overlayRendererRef.current = null;
      }
    };
  }, []);

  // ═══ SYNC TRANSFORM ═══
  useEffect(() => {
    if (overlayRendererRef.current && rendererRef.current) {
      const transform = rendererRef.current.getTransform?.();
      if (transform) {
        overlayRendererRef.current.updateTransform(transform);
      }
    }
  }, [rendererRef.current?.getTransform?.()]);

  // ═══ RESIZE HANDLER ═══
  useEffect(() => {
    const handleResize = () => {
      if (overlayCanvasRef.current && overlayRendererRef.current && mainCanvasRef.current) {
        const rect = mainCanvasRef.current.getBoundingClientRect();
        overlayRendererRef.current.resize(rect.width, rect.height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mainCanvasRef]);

  // ═══ HOVER METHODS ═══

  const showHover = useCallback((entityId: string) => {
    if (!overlayRendererRef.current || !currentScene) return;

    const entity = currentScene.entities?.find((e: Entity) => e.id === entityId);
    if (!entity) return;

    overlayRendererRef.current.drawHoverOverlay(entityId, entity);
    setHoveredEntityId(entityId);
    
    dhotlog('Showing hover for', entityId);
  }, [currentScene]);

  const clearHover = useCallback(() => {
    if (!overlayRendererRef.current) return;

    overlayRendererRef.current.clearHover();
    setHoveredEntityId(null);
    
    dhotlog('Cleared hover');
  }, []);

  // ═══ DRAG PREVIEW METHODS ═══

  const showDragPreview = useCallback((updatedEntity: Entity, originalEntity?: Entity) => {
    if (!overlayRendererRef.current || !rendererRef.current) return;

    const transform = rendererRef.current.getTransform?.() || { scale: 1, offsetX: 0, offsetY: 0 };
    overlayRendererRef.current.drawDragPreview(updatedEntity, transform);
    setDragPreviewEntity(updatedEntity);
    
    dhotlog('Showing drag preview for', updatedEntity.id);
  }, []);

  const clearDragPreview = useCallback(() => {
    if (!overlayRendererRef.current) return;

    overlayRendererRef.current.clearDragPreview();
    setDragPreviewEntity(null);
    
    dhotlog('Cleared drag preview');
  }, []);

  const clearAll = useCallback(() => {
    if (!overlayRendererRef.current) return;

    overlayRendererRef.current.clearAll();
    setHoveredEntityId(null);
    setDragPreviewEntity(null);
    
    dlog('Cleared all overlays');
  }, []);

  // ═══ ENTITY FINDING HELPER ═══
  const findEntityById = useCallback((entityId: string): Entity | null => {
    return currentScene?.entities?.find((e: Entity) => e.id === entityId) || null;
  }, [currentScene]);

  return {
    overlayCanvasRef,
    overlayRenderer: overlayRendererRef.current,
    hoveredEntityId,
    dragPreviewEntity,
    showHover,
    clearHover,
    showDragPreview,
    clearDragPreview,
    clearAll,
    findEntityById
  };
};

// ═══ OVERLAY CANVAS COMPONENT ═══

interface OverlayCanvasProps {
  mainCanvasRef: React.RefObject<HTMLCanvasElement>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement>;
  className?: string;
}

export const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  mainCanvasRef,
  overlayCanvasRef,
  className = ''
}) => {
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Sync dimensions με το main canvas
  useEffect(() => {
    const updateDimensions = () => {
      if (mainCanvasRef.current) {
        const rect = mainCanvasRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (mainCanvasRef.current) {
      resizeObserver.observe(mainCanvasRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [mainCanvasRef]);

  return (
    <canvas
      ref={overlayCanvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // ← ΚΡΙΣΙΜΟ: Δεν παρεμβαίνει στα mouse events
        zIndex: 100
      }}
      width={dimensions.width}
      height={dimensions.height}
    />
  );
};

// ═══ USAGE EXAMPLE ═══

