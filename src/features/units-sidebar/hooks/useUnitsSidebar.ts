'use client';
import * as React from 'react';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';

export function useUnitsSidebar(floors: FloorData[]|undefined, viewerProps: any) {
  const safeFloors = Array.isArray(floors) ? floors : [];
  const safeViewerProps = viewerProps || {};
  const safeSelectedFloorId = safeViewerProps.selectedFloorId as string | undefined;

  const currentFloor = React.useMemo(
    () => safeFloors.find(f => f.id === safeSelectedFloorId) || null,
    [safeFloors, safeSelectedFloorId]
  );

  const safeViewerPropsWithFloors = React.useMemo(() => ({
    ...safeViewerProps,
    floors: safeFloors,
    currentFloor,
  }), [safeViewerProps, safeFloors, currentFloor]);

  return { safeFloors, currentFloor, safeViewerPropsWithFloors, safeViewerProps };
}
