'use client';

import React from 'react';
import { Home } from 'lucide-react';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';
import { useUnitFloorplans } from '@/hooks/useUnitFloorplans';

interface FloorPlanTabProps {
    selectedUnit: Property | null;
    currentFloor: FloorData | null;
    safeFloors: FloorData[];
    safeViewerProps: any;
    safeViewerPropsWithFloors: any;
    setShowHistoryPanel: (show: boolean) => void;
    units: Property[];
}

export function FloorPlanTab({
    selectedUnit,
}: FloorPlanTabProps) {
    
    // Load unit floorplan from Firestore
    const {
        unitFloorplan,
        loading: floorplanLoading,
        error: floorplanError,
        refetch: refetchFloorplan
    } = useUnitFloorplans(selectedUnit?.id || 0);

    // Debug logging
    console.log('🏠 FloorPlanTab Debug:', {
        selectedUnit: selectedUnit,
        unitId: selectedUnit?.id,
        unitIdType: typeof selectedUnit?.id,
        hasUnitFloorplan: !!unitFloorplan,
        floorplanLoading,
        floorplanError,
        unitFloorplan,
        expectedUnitId: '6M9uqiAZjBmxf80tY5uC' // The one we know has floorplan
    });
    
    if (!selectedUnit) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
              <Home className="h-16 w-16 mb-4 opacity-50" />
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
