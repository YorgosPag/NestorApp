
'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { GenericListHeader } from '@/components/shared/GenericListHeader';

interface BuildingsListHeaderProps {
    buildingCount: number;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function BuildingsListHeader({
    buildingCount,
    showToolbar = false,
    onToolbarToggle
}: BuildingsListHeaderProps) {
    return (
        <GenericListHeader
            icon={NAVIGATION_ENTITIES.building.icon}
            entityName="Κτίρια"
            itemCount={buildingCount}
            hideSearch={true}
            showToolbar={showToolbar}
            onToolbarToggle={onToolbarToggle}
        />
    );
}
