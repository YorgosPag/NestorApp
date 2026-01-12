'use client';

import React from 'react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';
import { useUnitFloorplans } from '@/hooks/useUnitFloorplans';
import { useIconSizes } from '@/hooks/useIconSizes';

/** Viewer props structure */
interface ViewerProps {
  onSelectFloor?: (floorId: string) => void;
  properties?: Property[];
  [key: string]: unknown;
}

interface FloorPlanTabProps {
    selectedUnit: Property | null;
    currentFloor: FloorData | null;
    safeFloors: FloorData[];
    safeViewerProps: ViewerProps;
    safeViewerPropsWithFloors: ViewerProps & { floors?: FloorData[] };
    setShowHistoryPanel: (show: boolean) => void;
    units: Property[];
}

export function FloorPlanTab({
    selectedUnit,
}: FloorPlanTabProps) {
    const iconSizes = useIconSizes();

    // Load unit floorplan from Firestore
    const {
        unitFloorplan,
        loading: floorplanLoading,
        error: floorplanError,
        refetch: refetchFloorplan
    } = useUnitFloorplans(selectedUnit?.id || 0);

    
    if (!selectedUnit) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
              <UnitIcon className={`${iconSizes['2xl']} ${unitColor} mb-4 opacity-50`} />
              <h3 className="text-xl font-semibold mb-2">Επιλέξτε μια μονάδα</h3>
              <p className="text-sm max-w-sm">
                Επιλέξτε μια μονάδα από τη λίστα αριστερά για να δείτε την κάτοψή της και να αλληλεπιδράσετε με αυτή.
              </p>
            </div>
        );
    }
    
    return (
        <FloorplanViewerTab 
            title="Κάτοψη Μονάδας"
            floorplanData={unitFloorplan?.scene}
            onAddFloorplan={() => {
                console.log('Add unit floorplan for unit:', selectedUnit.id);
                // TODO: Implement add unit floorplan functionality
            }}
            onEditFloorplan={() => {
                console.log('Edit unit floorplan for unit:', selectedUnit.id);
                // TODO: Implement edit unit floorplan functionality
            }}
        />
    );
}
