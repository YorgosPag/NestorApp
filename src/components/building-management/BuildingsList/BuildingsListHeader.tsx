
'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');

    return (
        <GenericListHeader
            icon={NAVIGATION_ENTITIES.building.icon}
            entityName={t('list.entityName')}
            itemCount={buildingCount}
            hideSearch={true}
            showToolbar={showToolbar}
            onToolbarToggle={onToolbarToggle}
        />
    );
}
