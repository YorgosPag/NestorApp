/**
 * COPY-PASTE PATCH 4: Quick Fit-to-View Fix
 * Αντικατάστησε τα fitToView calls
 */

import { useRef } from 'react';

// ═══ COPY-PASTE: Smart Fit-to-View ═══

const lastBoundsHash = useRef<string>('');
const fitToViewPending = useRef(false);

function calculateBoundsHash(scene: any): string {
  if (!scene?.entities?.length) return 'empty';
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  for (const entity of scene.entities) {
    if (entity.type === 'line' && entity.start && entity.end) {
      minX = Math.min(minX, entity.start.x, entity.end.x);
      minY = Math.min(minY, entity.start.y, entity.end.y);
      maxX = Math.max(maxX, entity.start.x, entity.end.x);
      maxY = Math.max(maxY, entity.start.y, entity.end.y);
    }
    // Add other entity types...
  }
  
  if (minX === Infinity) return 'no-bounds';
  
  return `${minX.toFixed(0)}_${minY.toFixed(0)}_${maxX.toFixed(0)}_${maxY.toFixed(0)}`;
}

function smartFitToView(scene: any, force = false): void {
  const currentHash = calculateBoundsHash(scene);
  
  // Skip αν τα bounds δεν άλλαξαν
  if (!force && currentHash === lastBoundsHash.current) {
    console.log('🎯 Skipping fit-to-view - bounds unchanged');
    return;
  }
  
  if (fitToViewPending.current) {
    console.log('🎯 Fit-to-view already pending');
    return;
  }
  
  lastBoundsHash.current = currentHash;
  fitToViewPending.current = true;
  
  // RAF timing για σωστό paint order
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (rendererRef.current?.fitToView) {
          rendererRef.current.fitToView();
          console.log('🎯 Fit-to-view executed for bounds:', currentHash);
        }
      } catch (error) {
        console.warn('Fit-to-view error:', error);
      } finally {
        fitToViewPending.current = false;
      }
    });
  });
}

// ═══ USAGE ═══

// Αντικατάστησε:
// rendererRef.current.fitToView();

// Με:
// smartFitToView(currentScene);

// Για import (force):
// smartFitToView(importedScene, true);

// ═══ EXPORT ═══
export { smartFitToView, calculateBoundsHash };
