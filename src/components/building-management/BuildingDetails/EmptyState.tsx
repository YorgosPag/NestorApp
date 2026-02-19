'use client';

import React from 'react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function EmptyState() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    return (
        <section className={`flex-1 flex flex-col items-center justify-center bg-card ${quick.card} min-w-0 shadow-sm text-center p-2`}>
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xl2, NAVIGATION_ENTITIES.building.color, 'mb-2')} />
            <h2 className="text-xl font-semibold text-foreground">{t('emptyState.selectBuilding')}</h2>
            <p className="text-muted-foreground">{t('emptyState.selectBuildingDescription')}</p>
        </section>
    );
}
