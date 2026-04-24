// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Property Icon
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;

interface PropertiesListHeaderProps {
    propertyCount: number;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function PropertiesListHeader({
    propertyCount,
    showToolbar = false,
    onToolbarToggle
}: PropertiesListHeaderProps) {
    const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

    return (
        <div>
            {/* 🏢 ENTERPRISE CENTRALIZED GenericListHeader */}
            {/* 🏢 local_4.log: hideSearch=true - Search is handled in CompactToolbar/list area */}
            <GenericListHeader
                icon={PropertyIcon}
                entityName={t('list.title')}
                itemCount={propertyCount}
                hideSearch
                showToolbar={showToolbar}
                onToolbarToggle={onToolbarToggle}
            />

        </div>
    );
}
