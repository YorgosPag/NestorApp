'use client';

const DEBUG_SNAP_MANAGER = false;

import { useEffect, useRef, useMemo } from 'react';
import { ProSnapEngineV2 as SnapManager } from '../ProSnapEngineV2';
import { useSnapContext } from '../context/SnapContext';
import { ExtendedSnapType } from '../extended-types';
import type { SceneModel } from '../../types/scene';

interface UseSnapManagerOptions {
  scene?: SceneModel | null;
  overlayEntities?: any[]; // 🎯 NEW: Include overlay entities for unified snapping
  onSnapPoint?: (point: {x: number, y: number} | null) => void;
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
    
    if (DEBUG_SNAP_MANAGER) console.log('🎯 SnapManager initialized');

    return () => {
      if (snapManagerRef.current) {
        snapManagerRef.current.dispose();
        snapManagerRef.current = null;
        if (DEBUG_SNAP_MANAGER) console.log('🎯 SnapManager destroyed');
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
      if (DEBUG_SNAP_MANAGER) console.log('🎯 Updating snap engine with modes:', Array.from(enabledTypes));
      
      // 1) Enable/disable snapping
      snapManagerRef.current.setEnabled(snapEnabled);
      
      // 2) ΠΕΡΑΣΕ ΑΚΡΙΒΩΣ τα ενεργά modes (χωρίς leftovers)
      snapManagerRef.current.updateSettings({ enabledTypes });
    }
  }, [snapEnabled, enabledTypes, scene?.entities?.length]);

  // Update scene when it changes (including overlay entities)
  useEffect(() => {
    if (DEBUG_SNAP_MANAGER) console.log('🎯 useSnapManager: Scene changed, snapManager exists:', !!snapManagerRef.current, 'Scene:', !!scene, 'Scene entities count:', scene?.entities?.length, 'Overlay entities count:', overlayEntities?.length);
    
    if (snapManagerRef.current) {
      const dxfEntities = scene?.entities || [];
      const overlayEnts = overlayEntities || [];
      
      // 🎯 UNIFIED: Combine DXF and overlay entities for unified snapping
      const allEntities = [...dxfEntities, ...overlayEnts];
      
      if (DEBUG_SNAP_MANAGER) console.log('🎯 useSnapManager: Combined entities:', {
        dxfCount: dxfEntities.length,
        overlayCount: overlayEnts.length,
        totalCount: allEntities.length
      });
      
      // Only initialize if we have entities - avoid spam with empty scenes
      if (allEntities.length === 0) {
        if (DEBUG_SNAP_MANAGER) console.log('🎯 No entities in unified scene!');
        return;
      }
      
      if (DEBUG_SNAP_MANAGER) console.log('🎯 Initializing snap manager with', allEntities.length, 'unified entities');
      
      // Create viewport from canvas (with proper HTMLCanvasElement access)
      if (canvasRef.current) {
        try {
          const canvasElement = canvasRef.current.getCanvas ? canvasRef.current.getCanvas() : canvasRef.current;
          
          if (canvasElement && typeof canvasElement.getContext === 'function') {
            const transform = canvasElement.getContext('2d')?.getTransform();
            
            if (transform) {
              const viewport = {
                scale: transform.a || 1,
                worldPerPixelAt: () => 1 / (transform.a || 1),
                worldToScreen: (p: any) => ({
                  x: p.x * transform.a + transform.e,
                  y: p.y * transform.d + transform.f
                })
              };
              
              snapManagerRef.current.setViewport(viewport);
              if (DEBUG_SNAP_MANAGER) console.log('🎯 Viewport set with scale:', viewport.scale);
            }
          }
        } catch (error) {
          if (DEBUG_SNAP_MANAGER) console.warn('🎯 Could not set viewport:', error);
          // Continue without viewport - better than crashing
        }
      }
      
      snapManagerRef.current.initialize(allEntities);
      
      if (allEntities.length > 0) {
        // Debug: Log entity types to understand what we're working with
        if (DEBUG_SNAP_MANAGER) console.log('🎯 Unified entities loaded for snapping:', allEntities.length);
        const entityTypes = allEntities.reduce((types, entity) => {
          types[entity.type] = (types[entity.type] || 0) + 1;
          return types;
        }, {} as Record<string, number>);
        if (DEBUG_SNAP_MANAGER) console.log('🎯 Unified entity types:', entityTypes);
        
        // Sample first few entities to see their structure
        allEntities.slice(0, 3).forEach((entity, i) => {
          if (DEBUG_SNAP_MANAGER) console.log(`🎯 Entity ${i}:`, {
            type: entity.type,
            id: entity.id,
            points: (entity as any).points?.length || 0,
            center: (entity as any).center,
            radius: (entity as any).radius,
            start: (entity as any).start,
            end: (entity as any).end,
            fullEntity: entity
          });
        });
      } else {
        if (DEBUG_SNAP_MANAGER) console.log('🎯 No unified entities in scene!');
      }
    } else {
      if (DEBUG_SNAP_MANAGER) console.log('🎯 SnapManager not ready yet');
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
