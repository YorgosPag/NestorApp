
'use client';

import { useCallback } from 'react';
import type { Region, Point2D } from '../types/overlay';
import type { ViewTransform } from '../systems/rulers-grid/config';
import { UnifiedEntitySelection as OverlayHitTesting } from '../utils/unified-entity-selection';

interface UseOverlayMouseHandlerProps {
  renderer: any; // Simplified for now
  transform: ViewTransform;
  visibleRegions: Region[];
  selectedRegionIds: string[];
  showHandles: boolean;
  onHandleEdit: (region: Region, handle: { type: 'vertex' | 'edge'; index: number }, mousePos: Point2D, event: React.MouseEvent) => void;
  onRegionSelect: (regionIds: string[], startDrag?: boolean) => void;
  updateRegion: (regionId: string, updates: Partial<Region>) => void;
}

export function useOverlayMouseHandler({
  renderer,
  transform,
  visibleRegions,
  selectedRegionIds,
  showHandles,
  onHandleEdit,
  onRegionSelect,
  updateRegion,
}: UseOverlayMouseHandlerProps) {

  const handleEditingInteraction = useCallback((mousePos: Point2D, event: React.MouseEvent): boolean => {
    if (!renderer || selectedRegionIds.length !== 1 || !showHandles) return false;

    const selectedRegion = visibleRegions.find(r => r.id === selectedRegionIds[0]);
    if (!selectedRegion) return false;

    const handle = OverlayHitTesting.findHandleAt(
      mousePos, 
      selectedRegion, 
      transform,
      renderer.getCanvas()?.getBoundingClientRect()
    );

    if (handle) {
      onHandleEdit(selectedRegion, handle, mousePos, event);
      return true; // Interaction handled
    }

    return false;
  }, [renderer, selectedRegionIds, showHandles, visibleRegions, transform, onHandleEdit]);

  const handleRegionInteraction = useCallback((mousePos: Point2D, event: React.MouseEvent) => {
    if (!renderer) return;

    const hitRegion = OverlayHitTesting.findRegionAt(
      mousePos,
      visibleRegions,
      transform,
      renderer.getCanvas()?.getBoundingClientRect()
    );

    if (event.shiftKey) {
      if (hitRegion) {
        const newSelection = selectedRegionIds.includes(hitRegion.id)
          ? selectedRegionIds.filter(id => id !== hitRegion.id)
          : [...selectedRegionIds, hitRegion.id];
        onRegionSelect(newSelection);
      }
    } else {
      if (hitRegion) {
        if (!selectedRegionIds.includes(hitRegion.id)) {
          onRegionSelect([hitRegion.id], true);
        } else {
          onRegionSelect([hitRegion.id], true); // Allow starting drag on already selected
        }
      } else {
        onRegionSelect([]);
      }
    }
  }, [renderer, visibleRegions, transform, selectedRegionIds, onRegionSelect]);

  return {
    handleEditingInteraction,
    handleRegionInteraction
  };
}
