'use client';

import React from 'react';
import type { Building } from '../BuildingsPageContent';
import type { BuildingTabConfig } from '@/config/building-tabs-config';

// 🏢 ENTERPRISE: Window type extension for debugging
declare global {
  interface Window {
    getSortedBuildingTabs?: () => BuildingTabConfig[];
    BUILDING_TABS?: BuildingTabConfig[];
    currentBuilding?: Building;
  }
}
import { useBuildingFloorplans } from '../../../hooks/useBuildingFloorplans';
// 🏢 ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
import { BUILDING_COMPONENT_MAPPING } from '@/components/generic/mappings/buildingMappings';
import { getSortedBuildingTabs } from '../../../config/building-tabs-config';

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

    // 🚨 FORCE DEBUG: Log immediately
    console.log('🏠 BuildingTabs RENDERING!', { buildingId: building?.id, tabsCount: buildingTabs.length });
    console.log('📋 BACKUP CONFIG TABS:', buildingTabs.map(tab => ({
        id: tab.id,
        label: tab.label,
        component: tab.component
    })));

    // 🔍 DEBUG: Log tabs for debugging
    React.useEffect(() => {
        console.group('🔍 BUILDING TABS DEBUG');
        console.log(`🏠 Building ID: ${building?.id}`);
        console.log(`📋 Total tabs: ${buildingTabs.length}`);
        buildingTabs.forEach((tab, index) => {
            console.log(`${index + 1}. ID: ${tab.id} | Value: ${tab.value} | Label: ${tab.label} | Order: ${tab.order} | Enabled: ${tab.enabled} | Component: ${tab.component}`);
        });

        // Check for duplicates
        const ids = buildingTabs.map(tab => tab.id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            console.error('🚨 DUPLICATE IDs FOUND:', duplicateIds);
        } else {
            console.log('✅ No duplicate IDs found');
        }

        // 📍 EXPOSE TO WINDOW για debugging
        window.getSortedBuildingTabs = () => buildingTabs;
        window.BUILDING_TABS = buildingTabs;
        window.currentBuilding = building;

        console.log('🎯 Functions exposed to window: getSortedBuildingTabs, BUILDING_TABS, currentBuilding');
        console.groupEnd();
    }, [buildingTabs, building]);

    return (
        <UniversalTabsRenderer
            tabs={buildingTabs.map(convertToUniversalConfig)}
            data={building}
            componentMapping={BUILDING_COMPONENT_MAPPING}
            defaultTab="general"
            theme="clean"
            // 🏢 ENTERPRISE: i18n - Use building namespace for tab labels
            translationNamespace="building"
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
