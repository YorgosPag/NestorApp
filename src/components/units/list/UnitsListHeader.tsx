// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
'use client';

import React from 'react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from 'react-i18next';

// 🏢 ENTERPRISE: Centralized Unit Icon
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

interface UnitsListHeaderProps {
    unitCount: number;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function UnitsListHeader({
    unitCount,
    showToolbar = false,
    onToolbarToggle
}: UnitsListHeaderProps) {
    const { t } = useTranslation('units');

    return (
        <div>
            {/* 🏢 ENTERPRISE CENTRALIZED GenericListHeader */}
            {/* 🏢 local_4.log: hideSearch=true - Search is handled in CompactToolbar/list area */}
            <GenericListHeader
                icon={UnitIcon}
                entityName={t('list.title')}
                itemCount={unitCount}
                hideSearch={true}
                showToolbar={showToolbar}
                onToolbarToggle={onToolbarToggle}
            />

        </div>
    );
}
