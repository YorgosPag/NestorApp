'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Building } from '../BuildingsPageContent';
import { useBuildingFloorplans } from '../../../hooks/useBuildingFloorplans';
// ENTERPRISE: Direct imports to avoid barrel (reduces module graph)
import { UniversalTabsRenderer, convertToUniversalConfig } from '@/components/generic/UniversalTabsRenderer';
import type { UniversalTabConfig, BuildingTabAdditionalData, BuildingTabComponentProps, BuildingTabGlobalProps } from '@/components/generic/UniversalTabsRenderer';
import { BUILDING_COMPONENT_MAPPING } from '@/components/generic/mappings/buildingMappings';
import { getSortedBuildingTabs } from '../../../config/building-tabs-config';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';

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

    // Live counts from subcollections — building.floors / building.units are static fields
    // set at creation and NOT updated when subcollection records are added/removed.
    const [actualFloorsCount, setActualFloorsCount] = useState<number | null>(null);
    const [activeUnitsCount, setActiveUnitsCount] = useState<number | null>(null);

    useEffect(() => {
        apiClient
            .get<{ floors: unknown[] }>(`${API_ROUTES.FLOORS.LIST}?buildingId=${building.id}`)
            .then((r) => setActualFloorsCount(r?.floors?.length ?? 0))
            .catch(() => {});
    }, [building.id]);

    useEffect(() => {
        apiClient
            .get<{ units: unknown[] }>(`${API_ROUTES.PROPERTIES.LIST}?buildingId=${building.id}`)
            .then((r) => setActiveUnitsCount(r?.units?.length ?? 0))
            .catch(() => {});
    }, [building.id]);

    // Callback so PropertiesTabContent can keep count live after unit add/delete
    const handleActiveUnitsCountChange = useCallback((count: number) => {
        setActiveUnitsCount(count);
    }, []);

    // ✅ PERF: Memoize additionalData — only changes when floorplan data changes
    const additionalData = useMemo<BuildingTabAdditionalData>(() => ({
        buildingFloorplan,
        storageFloorplan,
        floorplansLoading,
        floorplansError,
        refetchFloorplans
    }), [buildingFloorplan, storageFloorplan, floorplansLoading, floorplansError, refetchFloorplans]);

    // Warning dots — use live subcollection counts, fall back to static building fields
    // while fetches are in-flight.
    const tabWarnings = useMemo(() => {
        const resolvedFloors = actualFloorsCount ?? (building.floors ?? 0);
        const resolvedUnits = activeUnitsCount ?? (building.units ?? 0);
        return {
            locations: (building.addresses?.length ?? 0) === 0,
            floors: resolvedFloors === 0,
            units: resolvedFloors > 0 && resolvedUnits === 0,
        };
    }, [building.addresses, building.floors, building.units, actualFloorsCount, activeUnitsCount]);

    // ✅ PERF: Memoize globalProps — only changes when editing state or building changes
    const globalProps = useMemo<BuildingTabGlobalProps>(() => ({
        buildingId: building.id,
        isEditing,
        onEditingChange,
        onSaveRef: saveRef,
        isCreateMode,
        onBuildingCreated,
        onActiveUnitsCountChange: handleActiveUnitsCountChange,
    }), [building.id, isEditing, onEditingChange, saveRef, isCreateMode, onBuildingCreated, handleActiveUnitsCountChange]);

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
