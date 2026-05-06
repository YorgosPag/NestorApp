'use client';

import React, { useMemo } from 'react';
import type { Building } from '../BuildingsPageContent';
import { useBuildingFloorplans } from '../../../hooks/useBuildingFloorplans';
// ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
import type { UniversalTabConfig, BuildingTabAdditionalData, BuildingTabComponentProps, BuildingTabGlobalProps } from '@/components/generic/UniversalTabsRenderer';
import { BUILDING_COMPONENT_MAPPING } from '@/components/generic/mappings/buildingMappings';
import { getSortedBuildingTabs } from '../../../config/building-tabs-config';

// ✅ PERF: Module-level stable reference — tabs config is static
const STABLE_BUILDING_TABS: UniversalTabConfig[] = getSortedBuildingTabs().map(convertToUniversalConfig);

interface BuildingTabsProps {
    building: Building;
    /** Whether inline editing is active (controlled by parent header) */
    isEditing?: boolean;
    /** Callback when editing state changes (from child tab components) */
    onEditingChange?: (editing: boolean) => void;
    /** Ref for save delegation — GeneralTabContent registers its save here */
    saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
    /** 🏢 ENTERPRISE: "Fill then Create" — building not yet in Firestore */
    isCreateMode?: boolean;
    /** Callback after successful creation — receives real Firestore building ID */
    onBuildingCreated?: (buildingId: string) => void;
    /** Notifies parent when the active tab changes (used to hide tab-irrelevant header actions). */
    onActiveTabChange?: (tabId: string) => void;
}

export function BuildingTabs({ building, isEditing, onEditingChange, saveRef, isCreateMode, onBuildingCreated, onActiveTabChange }: BuildingTabsProps) {
    // Load building floorplans from Firestore
    const {
        buildingFloorplan,
        storageFloorplan,
        loading: floorplansLoading,
        error: floorplansError,
        refetch: refetchFloorplans
    } = useBuildingFloorplans(building?.id || 0);

    // ✅ PERF: Memoize additionalData — only changes when floorplan data changes
    const additionalData = useMemo<BuildingTabAdditionalData>(() => ({
        buildingFloorplan,
        storageFloorplan,
        floorplansLoading,
        floorplansError,
        refetchFloorplans
    }), [buildingFloorplan, storageFloorplan, floorplansLoading, floorplansError, refetchFloorplans]);

    // Warning dots: locations = no address, floors = no floors registered.
    const tabWarnings = useMemo(() => ({
        locations: (building.addresses?.length ?? 0) === 0,
        floors: (building.floors ?? 0) === 0,
    }), [building.addresses, building.floors]);

    // ✅ PERF: Memoize globalProps — only changes when editing state or building changes
    const globalProps = useMemo<BuildingTabGlobalProps>(() => ({
        buildingId: building.id,
        isEditing,
        onEditingChange,
        onSaveRef: saveRef,
        isCreateMode,
        onBuildingCreated,
    }), [building.id, isEditing, onEditingChange, saveRef, isCreateMode, onBuildingCreated]);

    return (
        <UniversalTabsRenderer<Building, BuildingTabComponentProps, BuildingTabAdditionalData, BuildingTabGlobalProps>
            tabs={STABLE_BUILDING_TABS}
            data={building}
            componentMapping={BUILDING_COMPONENT_MAPPING}
            defaultTab="general"
            theme="default"
            translationNamespace="building"
            additionalData={additionalData}
            globalProps={globalProps}
            tabWarnings={tabWarnings}
            onTabChange={onActiveTabChange}
        />
    );
}
