// overlays/snap-adapter.ts - Convert overlay regions to snap entities
import type { Region } from '../types/overlay';
import type { Entity } from '../snapping/extended-types';
import type { Overlay } from './types';

// DEBUG FLAG - Set to false to disable performance-heavy logging
const DEBUG_SNAP_ADAPTER = false;

/**
 * Converts overlay regions to entities that the ProSnapEngineV2 can understand
 * This enables unified snapping between DXF entities and overlay regions
 */
export function regionsToSnapEntities(regions: Region[]): Entity[] {
  return regions.map((region) => {
    if (region.vertices && region.vertices.length >= 2) {
      // Convert vertices to Point2D format required by snap engine
      const points = region.vertices.map(v => ({ x: v.x, y: v.y }));
      
      // Create a polygon entity for snap engine
      const entity: Entity = {
        id: `overlay-${region.id}`,
        type: 'polygon',
        points: points,
        visible: region.visible !== false,
        layer: region.layer || 'overlay',
        // Store original region data for reference
        data: {
          originalRegion: region,
          isOverlay: true,
          status: region.status,
          levelId: region.levelId
        }
      };

      return entity;
    }
    
    // Skip regions without valid vertices
    console.warn('🔺 [snap-adapter] Skipping region with invalid vertices:', region.id);
    return null;
  }).filter(Boolean) as Entity[];
}

/**
 * Helper function to get overlay entities from current level
 */
export function getOverlayEntitiesForLevel(
  overlayStore: { overlays: Record<string, Overlay> },
  currentLevelId: string | null,
  overlaysToRegions: (overlays: Overlay[]) => Region[]
): Entity[] {
  const overlaysForLevel = Object.values(overlayStore.overlays)
    .filter((ov: Overlay) => !ov.levelId || ov.levelId === currentLevelId);
  
  const regions = overlaysToRegions(overlaysForLevel);
  return regionsToSnapEntities(regions);
}