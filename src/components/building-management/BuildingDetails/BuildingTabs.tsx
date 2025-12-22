'use client';

import React from 'react';
import type { Building } from '../BuildingsPageContent';
import { useBuildingFloorplans } from '../../../hooks/useBuildingFloorplans';
import { UniversalTabsRenderer, BUILDING_COMPONENT_MAPPING, convertToUniversalConfig } from '@/components/generic';
import { getSortedBuildingTabs } from '@/config/building-tabs-config';

interface BuildingTabsProps {
    building: Building;
}

export function BuildingTabs({ building }: BuildingTabsProps) {
    // Load building floorplans from Firestore
    const {
        buildingFloorplan,
        storageFloorplan,
        loading: floorplansLoading,
        error: floorplansError,
        refetch: refetchFloorplans
    } = useBuildingFloorplans(building?.id || 0);


    // Get building tabs from centralized config
    const buildingTabs = getSortedBuildingTabs();

    return (
        <UniversalTabsRenderer
            tabs={buildingTabs.map(convertToUniversalConfig)}
            data={building}
            componentMapping={BUILDING_COMPONENT_MAPPING}
            defaultTab="general"
            theme="default"
            additionalData={{
                buildingFloorplan,
                storageFloorplan,
                floorplansLoading,
                floorplansError,
                refetchFloorplans
            }}
            globalProps={{
                buildingId: building.id
            }}
        />
    );
}
