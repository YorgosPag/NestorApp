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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BuildingTabs');

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

    // Debug: Log rendering info
    logger.info('BuildingTabs rendering', { buildingId: building?.id, tabsCount: buildingTabs.length });
    logger.info('Config tabs', { tabs: buildingTabs.map(tab => ({ id: tab.id, label: tab.label, component: tab.component })) });

    // Debug: Log tabs information
    React.useEffect(() => {
        logger.info('Building tabs debug', {
            buildingId: building?.id,
            totalTabs: buildingTabs.length,
            tabs: buildingTabs.map((tab, index) => ({
                index: index + 1,
                id: tab.id,
                value: tab.value,
                label: tab.label,
                order: tab.order,
                enabled: tab.enabled,
                component: tab.component,
            })),
        });

        // Check for duplicates
        const ids = buildingTabs.map(tab => tab.id);
        const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            logger.error('Duplicate tab IDs found', { duplicateIds });
        } else {
            logger.info('No duplicate tab IDs found');
        }

        // Expose to window for debugging
        window.getSortedBuildingTabs = () => buildingTabs;
        window.BUILDING_TABS = buildingTabs;
        window.currentBuilding = building;

        logger.info('Debug functions exposed to window');
    }, [buildingTabs, building]);

    return (
        <UniversalTabsRenderer
            tabs={buildingTabs.map(convertToUniversalConfig)}
            data={building}
            componentMapping={BUILDING_COMPONENT_MAPPING}
            defaultTab="general"
            theme="default"
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
