/**
 * TARGETED PATCH 3: Fit-to-View - Μόνο όταν αλλάξουν bounds
 * Copy-paste στο DxfCanvas.tsx ή όπου καλείς fitToView
 */

import { useRef, useEffect, useMemo } from 'react';

// ═══ COPY-PASTE: Smart Bounds-Only Fit-to-View ═══

const prevBoundsKey = useRef<string>('');
const fitToViewPending = useRef(false);

// ═══ BOUNDS CALCULATION ═══
const sceneBounds = useMemo(() => {
  if (!currentScene?.entities?.length) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  let hasValidBounds = false;

  for (const entity of currentScene.entities) {
    try {
      let entityBounds = null;

      switch (entity.type) {
        case 'line':
          if (entity.start && entity.end) {
            entityBounds = {
              minX: Math.min(entity.start.x, entity.end.x),
              minY: Math.min(entity.start.y, entity.end.y),
              maxX: Math.max(entity.start.x, entity.end.x),
              maxY: Math.max(entity.start.y, entity.end.y)
            };
          }
          break;

        case 'circle':
          if (entity.center && entity.radius) {
            entityBounds = {
              minX: entity.center.x - entity.radius,
              minY: entity.center.y - entity.radius,
              maxX: entity.center.x + entity.radius,
              maxY: entity.center.y + entity.radius
            };
          }
          break;

        case 'polyline':
          if (entity.vertices?.length) {
            let pMinX = Infinity, pMinY = Infinity;
            let pMaxX = -Infinity, pMaxY = -Infinity;
            
            for (const vertex of entity.vertices) {
              if (vertex.x != null && vertex.y != null) {
                pMinX = Math.min(pMinX, vertex.x);
                pMinY = Math.min(pMinY, vertex.y);
                pMaxX = Math.max(pMaxX, vertex.x);
                pMaxY = Math.max(pMaxY, vertex.y);
              }
            }
            
            if (pMinX !== Infinity) {
              entityBounds = { minX: pMinX, minY: pMinY, maxX: pMaxX, maxY: pMaxY };
            }
          }
          break;
      }

      if (entityBounds) {
        minX = Math.min(minX, entityBounds.minX);
        minY = Math.min(minY, entityBounds.minY);
        maxX = Math.max(maxX, entityBounds.maxX);
        maxY = Math.max(maxY, entityBounds.maxY);
        hasValidBounds = true;
      }
    } catch (error) {
      console.warn('Error calculating bounds for entity:', entity.id, error);
    }
  }

  if (!hasValidBounds) {
    return { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
  }

  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY }
  };
}, [currentScene?.entities]); // ← Μόνο entities dependency

// ═══ BOUNDS KEY GENERATION ═══
const boundsKey = useMemo(() => {
  const precision = 10; // 1 decimal place precision
  return `${Math.round(sceneBounds.min.x * precision)},${Math.round(sceneBounds.min.y * precision)},${Math.round(sceneBounds.max.x * precision)},${Math.round(sceneBounds.max.y * precision)}`;
}, [sceneBounds]);

// ═══ FIT-TO-VIEW EFFECT (BOUNDS-ONLY) ═══
useEffect(() => {
  // 🎯 Skip αν τα bounds δεν άλλαξαν
  if (boundsKey === prevBoundsKey.current) {
    console.log('🎯 Skipping fit-to-view - bounds unchanged:', boundsKey);
    return;
  }

  // 🎯 Skip αν ήδη pending
  if (fitToViewPending.current) {
    console.log('🎯 Fit-to-view already pending');
    return;
  }

  // 🎯 Skip αν δεν έχουμε renderer
  if (!rendererRef.current?.fitToView) {
    console.warn('🎯 No renderer fitToView method available');
    return;
  }

  prevBoundsKey.current = boundsKey;
  fitToViewPending.current = true;

  console.log('🎯 Bounds changed - scheduling fit-to-view:', boundsKey);

  // 🎯 RAF timing για perfect paint order
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (rendererRef.current?.fitToView) {
          rendererRef.current.fitToView('fitFullAnchorBL');
          console.log('🎯 Fit-to-view executed for bounds:', boundsKey);
        }
      } catch (error) {
        console.error('🎯 Fit-to-view error:', error);
      } finally {
        fitToViewPending.current = false;
      }
    });
  });

}, [boundsKey]); // ← ΟΧΙ [currentScene, entities, hoveredId, selectedIds]

// ═══ MANUAL FIT-TO-VIEW (για import/reset) ═══
const forceFitToView = useCallback(() => {
  prevBoundsKey.current = ''; // Reset key για force
  fitToViewPending.current = false;
  
  if (rendererRef.current?.fitToView) {
    rendererRef.current.fitToView('fitFullAnchorBL');
    console.log('🎯 Manual fit-to-view executed');
  }
}, []);

// ═══ RETURN VALUES ═══
const fitToViewStats = useMemo(() => ({
  boundsKey,
  sceneBounds,
  pending: fitToViewPending.current,
  lastKey: prevBoundsKey.current
}), [boundsKey, sceneBounds]);

// ═══ USAGE EXAMPLE ═══
/*
// Αντικατάστησε:
rendererRef.current.fitToView();

// Με: 
// Τίποτα! Το effect τρέχει αυτόματα όταν αλλάζουν bounds

// Για manual fit (π.χ. import):
forceFitToView();

// Debug:
console.log('Fit-to-view stats:', fitToViewStats);
*/

// ═══ EXPORTS ═══
export {
  forceFitToView,
  fitToViewStats,
  sceneBounds,
  boundsKey
};
