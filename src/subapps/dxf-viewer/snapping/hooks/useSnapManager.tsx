'use client';

const DEBUG_SNAP_MANAGER = false;

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

interface UseSnapManagerOptions {
  scene?: SceneModel | null;
  overlayEntities?: Entity[]; // 🔺 NEW: Include overlay entities for unified snapping
  onSnapPoint?: (point: Point2D | null) => void;
}

export const useSnapManager = (
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseSnapManagerOptions = {}
) => {
  const { snapEnabled, enabledModes } = useSnapContext();
  const snapManagerRef = useRef<SnapManager | null>(null);
  const { scene, overlayEntities, onSnapPoint } = options;

  // Initialize SnapManager
  useEffect(() => {
    if (!canvasRef.current) return;

    snapManagerRef.current = new SnapManager();

    return () => {
      if (snapManagerRef.current) {
        snapManagerRef.current.dispose();
        snapManagerRef.current = null;

      }
    };
  }, [canvasRef]);

  // Create stable enabledTypes Set για τον engine
  const enabledTypes = useMemo(() => {
    return new Set<ExtendedSnapType>(enabledModes);
  }, [enabledModes]);

  // Update snap modes when snap settings change
  useEffect(() => {
    if (snapManagerRef.current && scene?.entities?.length > 0) {

      // 1) Enable/disable snapping
      snapManagerRef.current.setEnabled(snapEnabled);
      
      // 2) ΠΕΡΑΣΕ ΑΚΡΙΒΩΣ τα ενεργά modes (χωρίς leftovers)
      snapManagerRef.current.updateSettings({ enabledTypes });
    }
  }, [snapEnabled, enabledTypes, scene?.entities?.length]);

  // Update scene when it changes (including overlay entities)
  useEffect(() => {

    if (snapManagerRef.current) {
      const dxfEntities = scene?.entities || [];
      const overlayEnts = overlayEntities || [];
      
      // 🔺 UNIFIED: Combine DXF and overlay entities for unified snapping
      const allEntities = [...dxfEntities, ...overlayEnts];

      // Only initialize if we have entities - avoid spam with empty scenes
      if (allEntities.length === 0) {

        return;
      }

      // Create viewport from canvas (with proper HTMLCanvasElement access)
      if (canvasRef.current) {
        try {
          const canvasElement = (canvasRef.current as any)?.getCanvas?.() || canvasRef.current;
          
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
      
      snapManagerRef.current.initialize(allEntities);
      
      if (allEntities.length > 0) {
        // Debug: Log entity types to understand what we're working with

        const entityTypes = allEntities.reduce((types, entity) => {
          types[entity.type] = (types[entity.type] || 0) + 1;
          return types;
        }, {} as Record<string, number>);

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
      return snapManagerRef.current?.findSnapPoint({ x: worldX, y: worldY }) || null;
    }
  };
};
