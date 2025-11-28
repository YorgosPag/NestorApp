'use client';

import React from 'react';
import type { Building } from '../BuildingsPageContent';
import { useBuildingFloorplans } from '../../../hooks/useBuildingFloorplans';
import { GenericBuildingTabsRenderer } from '@/components/generic';
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

    // Debug logging
    console.log('🏗️ BuildingTabs Debug:', {
        buildingId: building?.id,
        hasBuildingFloorplan: !!buildingFloorplan,
        hasStorageFloorplan: !!storageFloorplan,
        floorplansLoading,
        floorplansError,
        buildingFloorplan,
        storageFloorplan
    });

    // Get building tabs from centralized config
    const buildingTabs = getSortedBuildingTabs();

    return (
        <GenericBuildingTabsRenderer
            tabs={buildingTabs}
            building={building}
            defaultTab="general"
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
