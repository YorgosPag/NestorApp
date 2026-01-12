/**
 * DxfCanvas Overlay Integration
 * ⚠️ DEPRECATED: Αυτό το αρχείο είναι deprecated και δεν χρησιμοποιείται πλέον
 * Χρησιμοποιήστε το νέο CanvasOverlays system αντί αυτού
 * TODO: Διαγραφή στην επόμενη major version
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { isFeatureEnabled } from '../config/experimental-features';
// DEPRECATED: Missing modules - creating mocks
// import { OverlayRenderer } from './overlay-renderer';
// import { dlog, dhotlog } from '../utils/devlog';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions (ADR-compliant - NO any)
// ============================================================================

/** Transform data for canvas rendering */
interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Log argument type */
type LogArg = unknown;

// Mock implementations for missing modules
class OverlayRenderer {
  constructor() {}
  updateTransform(_transform: CanvasTransform) {}
  resize(_width: number, _height: number) {}
  drawDragPreview(_entity: Entity, _transform: CanvasTransform) {}
  clearDragPreview() {}
  dispose() {}
  drawHoverOverlay(_entityId: string, _entity: Entity) {}
  clearHover() {}
  clearAll() {}
}

// Mock devlog functions
const dlog = (..._args: LogArg[]) => {};
const dhotlog = (..._args: LogArg[]) => {};
import type { Entity } from '../types/entities';
import type { EntityRenderer } from '../utils/entity-renderer';
import type { SceneModel } from '../types/scene';

// Entity interface is now imported from types/entities

// ═══ OVERLAY HOOK ═══

export const useOverlaySystem = (
  mainCanvasRef: React.RefObject<HTMLCanvasElement>,
  rendererRef: React.RefObject<EntityRenderer>,
  currentScene: SceneModel | null
) => {
  // 🚩 Feature flag check - return mock implementation if disabled
  if (!isFeatureEnabled('DXF_CANVAS_OVERLAY_INTEGRATION')) {
    console.warn('🚫 DxfCanvasOverlayIntegration is deprecated. Use CanvasOverlays instead.');
    return {
      overlayCanvasRef: { current: null },
      overlayRenderer: null,
      hoveredEntityId: null,
      dragPreviewEntity: null,
      showHover: () => {},
      clearHover: () => {},
      showDragPreview: () => {},
      clearDragPreview: () => {},
      clearAll: () => {},
      findEntityById: () => null
    };
  }
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRendererRef = useRef<OverlayRenderer | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [dragPreviewEntity, setDragPreviewEntity] = useState<Entity | null>(null);

  // ═══ INITIALIZATION ═══
  useEffect(() => {
    if (!overlayCanvasRef.current) return;

    if (!overlayRendererRef.current) {
      overlayRendererRef.current = new OverlayRenderer();
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
      // DEPRECATED FIX: EntityRenderer doesn't have getTransform, use fallback
      const transform = { scale: 1, offsetX: 0, offsetY: 0 };
      overlayRendererRef.current.updateTransform(transform);
    }
  }, [rendererRef.current]);

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

    // DEPRECATED FIX: EntityRenderer doesn't have getTransform, use fallback
    const transform = { scale: 1, offsetX: 0, offsetY: 0 };
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
    const entity = currentScene?.entities?.find((e: Entity) => e.id === entityId);
    // ✅ ENTERPRISE: Proper type conversion from AnySceneEntity to Entity
    return entity ?? null;
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

