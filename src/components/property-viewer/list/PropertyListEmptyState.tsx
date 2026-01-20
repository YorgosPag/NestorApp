"use client";

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

export function PropertyListEmptyState() {
    const iconSizes = useIconSizes();
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('properties');

    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <UnitIcon className={`${iconSizes.xl} ${unitColor} mb-2`} />
            <p className="text-sm">{t('grid.emptyState.title')}</p>
            <p className="text-xs">{t('grid.emptyState.subtitle')}</p>
        </div>
    );
}
