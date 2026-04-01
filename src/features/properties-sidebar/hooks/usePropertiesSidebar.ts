'use client';
import * as React from 'react';
import type { Property } from '@/types/property-viewer';
import type { FloorData, ViewerPassthroughProps } from '../types';
// 🏢 ENTERPRISE: Firestore persistence for property updates
import { updateProperty } from '@/services/properties.service';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('usePropertiesSidebar');

export function usePropertiesSidebar(floors: FloorData[]|undefined, viewerProps: ViewerPassthroughProps | null | undefined) {
  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeViewerProps = viewerProps || {};
  const safeSelectedFloorId = safeViewerProps.selectedFloorId as string | undefined;

  const currentFloor = React.useMemo(
    () => safeFloors.find(f => f.id === safeSelectedFloorId) || null,
    [safeFloors, safeSelectedFloorId]
  );

  // 🏢 ENTERPRISE: Firestore persistence handler for property field updates
  const handleUpdateProperty = React.useCallback(async (propertyId: string, updates: Partial<Property>) => {
    try {
      logger.info(`[DEBUG ADR-232] handleUpdateProperty CALLED`, { propertyId, updateKeys: Object.keys(updates), hasFloorId: 'floorId' in updates });
      await updateProperty(propertyId, updates);
      logger.info(`Property ${propertyId} updated in Firestore:`, { data: Object.keys(updates) });
    } catch (error) {
      logger.error(`Failed to persist property update to Firestore: ${error instanceof Error ? error.message : String(error)}`);
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


