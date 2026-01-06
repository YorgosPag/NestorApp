'use client';

const DEBUG_SNAP_MANAGER = false; // 🔍 DISABLED - set to true only for debugging

import { useEffect, useRef, useMemo } from 'react';
import { ProSnapEngineV2 as SnapManager } from '../ProSnapEngineV2';
import { useSnapContext } from '../context/SnapContext';
import { ExtendedSnapType } from '../extended-types';
import type { SceneModel } from '../../types/scene';
import type { Entity } from '../extended-types';
import type { Point2D } from '../../rendering/types/Types';

// Debug interface for entity inspection
interface EntityDebugInfo {
  type: string;
  id: string;
  points?: number;
  center?: Point2D;
  radius?: number;
  start?: Point2D;
  end?: Point2D;
  fullEntity: Entity;
}

/**
 * 🏢 ENTERPRISE: Canvas wrapper interface for components that wrap HTMLCanvasElement
 * Some canvas components expose getCanvas() method to access the underlying element
 */
interface CanvasWrapper {
  getCanvas?: () => HTMLCanvasElement;
}

/**
 * 🏢 ENTERPRISE: Type guard for canvas wrapper detection
 */
function isCanvasWrapper(element: unknown): element is CanvasWrapper {
  return (
    element !== null &&
    typeof element === 'object' &&
    'getCanvas' in element &&
    typeof (element as CanvasWrapper).getCanvas === 'function'
  );
}

interface UseSnapManagerOptions {
  scene?: SceneModel | null;
  overlayEntities?: Entity[]; // 🔺 NEW: Include overlay entities for unified snapping
  onSnapPoint?: (point: Point2D | null) => void;
  gridStep?: number; // 🔲 GRID SNAP: Grid step in world units for grid snapping
}

export const useSnapManager = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseSnapManagerOptions = {}
) => {
  const { snapEnabled, enabledModes } = useSnapContext();
  const snapManagerRef = useRef<SnapManager | null>(null);
  const { scene, overlayEntities, onSnapPoint, gridStep } = options;

  // Initialize SnapManager
  useEffect(() => {
    if (DEBUG_SNAP_MANAGER) console.log('🔍 [useSnapManager] Initialize effect, canvasRef.current:', !!canvasRef.current);
    if (!canvasRef.current) return;

    snapManagerRef.current = new SnapManager();
    if (DEBUG_SNAP_MANAGER) console.log('✅ [useSnapManager] SnapManager created:', snapManagerRef.current);

    return () => {
      if (snapManagerRef.current) {
        snapManagerRef.current.dispose();
        snapManagerRef.current = null;
        if (DEBUG_SNAP_MANAGER) console.log('🗑️ [useSnapManager] SnapManager disposed');
      }
    };
  }, [canvasRef]);

  // Create stable enabledTypes Set για τον engine
  const enabledTypes = useMemo(() => {
    return new Set<ExtendedSnapType>(enabledModes);
  }, [enabledModes]);

  // Update snap modes when snap settings change
  useEffect(() => {
    // 🏢 ENTERPRISE: Safe null check for entities array
    const entityCount = scene?.entities?.length ?? 0;
    if (snapManagerRef.current && entityCount > 0) {

      // 1) Enable/disable snapping
      snapManagerRef.current.setEnabled(snapEnabled);

      // 2) ΠΕΡΑΣΕ ΑΚΡΙΒΩΣ τα ενεργά modes (χωρίς leftovers)
      snapManagerRef.current.updateSettings({ enabledTypes });
    }
  }, [snapEnabled, enabledTypes, scene?.entities?.length]);

  // 🔲 GRID SNAP: Update gridStep when it changes
  useEffect(() => {
    if (snapManagerRef.current && gridStep !== undefined && gridStep > 0) {
      snapManagerRef.current.updateSettings({ gridStep });
    }
  }, [gridStep]);

  // Update scene when it changes (including overlay entities)
  useEffect(() => {
    if (DEBUG_SNAP_MANAGER) {
      console.log('🔍 [useSnapManager] Scene effect triggered:', {
        hasSnapManager: !!snapManagerRef.current,
        hasScene: !!scene,
        sceneEntities: scene?.entities?.length ?? 0,
        overlayEntities: overlayEntities?.length ?? 0
      });
    }

    if (snapManagerRef.current) {
      const dxfEntities = scene?.entities || [];
      const overlayEnts = overlayEntities || [];

      // 🔺 UNIFIED: Combine DXF and overlay entities for unified snapping
      const allEntities = [...dxfEntities, ...overlayEnts];

      if (DEBUG_SNAP_MANAGER) {
        console.log('🔍 [useSnapManager] Combined entities:', allEntities.length);
      }

      // Only initialize if we have entities - avoid spam with empty scenes
      if (allEntities.length === 0) {
        if (DEBUG_SNAP_MANAGER) {
          console.log('🔍 [useSnapManager] No entities to initialize - skipping');
        }
        return;
      }

      // Create viewport from canvas (with proper HTMLCanvasElement access)
      if (canvasRef.current) {
        try {
          // 🏢 ENTERPRISE: Use type guard instead of 'as any'
          const canvasElement = isCanvasWrapper(canvasRef.current) && canvasRef.current.getCanvas
            ? canvasRef.current.getCanvas()
            : canvasRef.current;
          
          if (canvasElement && typeof canvasElement.getContext === 'function') {
            const transform = canvasElement.getContext('2d')?.getTransform();
            
            if (transform) {
              const viewport = {
                scale: transform.a || 1,
                worldPerPixelAt: () => 1 / (transform.a || 1),
                worldToScreen: (p: Point2D) => ({
                  x: p.x * transform.a + transform.e,
                  y: p.y * transform.d + transform.f
                })
              };
              
              snapManagerRef.current.setViewport(viewport);

            }
          }
        } catch (error) {
          if (DEBUG_SNAP_MANAGER) console.warn('🔺 Could not set viewport:', error);
          // Continue without viewport - better than crashing
        }
      }
      
      if (DEBUG_SNAP_MANAGER) {
        console.log('🔍 [useSnapManager] Calling initialize with', allEntities.length, 'entities');
      }

      snapManagerRef.current.initialize(allEntities);

      if (DEBUG_SNAP_MANAGER) {
        console.log('🔍 [useSnapManager] initialize() completed');
      }

      if (allEntities.length > 0) {
        // Debug: Log entity types to understand what we're working with
        const entityTypes = allEntities.reduce((types, entity) => {
          types[entity.type] = (types[entity.type] || 0) + 1;
          return types;
        }, {} as Record<string, number>);

        if (DEBUG_SNAP_MANAGER) {
          console.log('🔍 [useSnapManager] Entity types:', entityTypes);
        }

        // Sample first few entities to see their structure
        allEntities.slice(0, 3).forEach((entity, i) => {
          if (DEBUG_SNAP_MANAGER) {
            const debugInfo: EntityDebugInfo = {
              type: entity.type,
              id: entity.id,
              fullEntity: entity
            };

            // Type-safe property extraction based on entity type
            if ('points' in entity && Array.isArray(entity.points)) {
              debugInfo.points = entity.points.length;
            }
            if ('center' in entity && entity.center) {
              debugInfo.center = entity.center as Point2D;
            }
            if ('radius' in entity && typeof entity.radius === 'number') {
              debugInfo.radius = entity.radius;
            }
            if ('start' in entity && entity.start) {
              debugInfo.start = entity.start as Point2D;
            }
            if ('end' in entity && entity.end) {
              debugInfo.end = entity.end as Point2D;
            }

          }
        });
      } else {

      }
    } else {

    }
  }, [scene, overlayEntities]);

  // Return the snap manager instance for external use
  return {
    snapManager: snapManagerRef.current,
    findSnapPoint: (worldX: number, worldY: number) => {
      if (DEBUG_SNAP_MANAGER) {
        console.log('🔍 [useSnapManager.findSnapPoint] Called with:', { worldX, worldY });
        console.log('🔍 [useSnapManager.findSnapPoint] snapManagerRef.current:', !!snapManagerRef.current);
      }
      const result = snapManagerRef.current?.findSnapPoint({ x: worldX, y: worldY }) || null;
      if (DEBUG_SNAP_MANAGER) {
        console.log('🔍 [useSnapManager.findSnapPoint] Result:', result);
      }
      return result;
    }
  };
};
