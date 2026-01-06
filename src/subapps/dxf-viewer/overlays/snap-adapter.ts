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
      
      // 🏢 ENTERPRISE: Use polyline with closed=true instead of polygon
      // Polygons are represented as closed polylines in CAD systems
      const entity: Entity = {
        id: `overlay-${region.id}`,
        type: 'polyline',          // 🏢 ENTERPRISE: Use polyline type from centralized EntityType
        vertices: points,          // 🏢 ENTERPRISE: PolylineEntity uses vertices, not points
        closed: true,              // 🏢 ENTERPRISE: Mark as closed polygon
        visible: region.visible !== false,
        layer: region.layer || 'overlay',
        // Store original region data for reference
        metadata: {                // 🏢 ENTERPRISE: Use metadata instead of data
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