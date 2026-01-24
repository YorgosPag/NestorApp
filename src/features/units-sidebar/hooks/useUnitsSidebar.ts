'use client';
import * as React from 'react';
import type { Property } from '@/types/property-viewer';
import type { FloorData, ViewerPassthroughProps } from '../types';
// 🏢 ENTERPRISE: Firestore persistence for unit updates
import { updateUnit } from '@/services/units.service';

export function useUnitsSidebar(floors: FloorData[]|undefined, viewerProps: ViewerPassthroughProps | null | undefined) {
  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeViewerProps = viewerProps || {};
  const safeSelectedFloorId = safeViewerProps.selectedFloorId as string | undefined;

  const currentFloor = React.useMemo(
    () => safeFloors.find(f => f.id === safeSelectedFloorId) || null,
    [safeFloors, safeSelectedFloorId]
  );

  // 🏢 ENTERPRISE: Firestore persistence handler for unit field updates
  const handleUpdateProperty = React.useCallback(async (propertyId: string, updates: Partial<Property>) => {
    try {
      await updateUnit(propertyId, updates);
      console.log(`✅ Unit ${propertyId} updated in Firestore:`, Object.keys(updates));
    } catch (error) {
      console.error('❌ Failed to persist unit update to Firestore:', error);
      throw error; // Re-throw so UI can handle error state
    }
  }, []);

  const safeViewerPropsWithFloors = React.useMemo(() => ({
    ...safeViewerProps,
    floors: safeFloors,
    currentFloor,
    handleUpdateProperty, // 🏢 ENTERPRISE: Include Firestore persistence handler
  }), [safeViewerProps, safeFloors, currentFloor, handleUpdateProperty]);

  return { safeFloors, currentFloor, safeViewerPropsWithFloors, safeViewerProps, handleUpdateProperty };
}
