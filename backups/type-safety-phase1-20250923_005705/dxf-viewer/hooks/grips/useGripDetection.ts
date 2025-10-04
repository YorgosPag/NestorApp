/**
 * useGripDetection
 * Handles grip detection, hover, and selection logic
 */

'use client';

import { useState, useCallback } from 'react';
import type { Point2D, Region } from '../../types/overlay';
import type { GripState } from '../../types/gripSettings';

// === GRIP INTERACTION STATE ===
interface GripInteraction {
  hoveredGrip: GripState | null;
  selectedGrips: GripState[];
  isMultiSelect: boolean;
}

const initialGripInteraction: GripInteraction = {
  hoveredGrip: null,
  selectedGrips: [],
  isMultiSelect: false
};

export function useGripDetection(getGripSize: (state: 'cold' | 'warm' | 'hot') => number) {
  const [gripInteraction, setGripInteraction] = useState<GripInteraction>(initialGripInteraction);

  // Find grip at specific point
  const findGripAtPoint = useCallback((
    point: Point2D, 
    regions: Region[], 
    tolerance?: number
  ): GripState | null => {
    const gripTolerance = tolerance || getGripSize('warm') + 2;
    
    for (const region of regions) {
      // Vertex grips
      for (let i = 0; i < region.vertices.length; i++) {
        const vertex = region.vertices[i];
        const distance = Math.sqrt(
          Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2)
        );
        
        if (distance <= gripTolerance) {
          return {
            type: 'cold',
            entityId: region.id,
            gripIndex: i,
            position: vertex,
            gripType: 'vertex'
          };
        }
      }
    }
    
    return null;
  }, [getGripSize]);

  // Handle grip hover
  const handleGripHover = useCallback((point: Point2D, regions: Region[]) => {
    const hoveredGrip = findGripAtPoint(point, regions);
    
    setGripInteraction(prev => ({
      ...prev,
      hoveredGrip: hoveredGrip ? { ...hoveredGrip, type: 'warm' } : null
    }));
  }, [findGripAtPoint]);

  // Handle grip click/selection
  const handleGripClick = useCallback((grip: GripState, isMultiSelect: boolean) => {
    setGripInteraction(prev => {
      const isAlreadySelected = prev.selectedGrips.some(g => 
        g.entityId === grip.entityId && g.gripIndex === grip.gripIndex
      );
      
      let newSelectedGrips: GripState[];
      
      if (isMultiSelect) {
        if (isAlreadySelected) {
          newSelectedGrips = prev.selectedGrips.filter(g => 
            !(g.entityId === grip.entityId && g.gripIndex === grip.gripIndex)
          );
        } else {
          newSelectedGrips = [...prev.selectedGrips, { ...grip, type: 'hot' }];
        }
      } else {
        newSelectedGrips = isAlreadySelected ? [] : [{ ...grip, type: 'hot' }];
      }
      
      return {
        ...prev,
        selectedGrips: newSelectedGrips,
        isMultiSelect
      };
    });
  }, []);

  // Clear grip selection
  const clearGripSelection = useCallback(() => {
    setGripInteraction(prev => ({
      ...prev,
      selectedGrips: [],
      hoveredGrip: null,
      isMultiSelect: false
    }));
  }, []);

  return {
    gripInteraction,
    findGripAtPoint,
    handleGripHover,
    handleGripClick,
    clearGripSelection
  };
}