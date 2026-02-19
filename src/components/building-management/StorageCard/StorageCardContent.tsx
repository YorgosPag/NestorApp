'use client';

import React from 'react';
import { CardContent } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import {
  Link,
  Ruler
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { formatNumber } from '@/lib/intl-utils';
import type { StorageUnit } from '@/types/storage';
import { formatPrice, formatArea, getPricePerSqm } from './StorageCardUtils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Import StorageType for proper typing
import type { StorageType } from '@/types/storage';

interface StorageCardContentProps {
    unit: StorageUnit;
    getTypeIcon: (type: StorageType) => React.ElementType;
}

export function StorageCardContent({ unit, getTypeIcon }: StorageCardContentProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    const TypeIcon = getTypeIcon(unit.type);
    return (
        <CardContent className="p-2 space-y-2">
            <div>
                <h4 className={`font-semibold text-foreground truncate flex items-center gap-2 ${GROUP_HOVER_PATTERNS.ACCENT_ON_GROUP}`}>
                    <TypeIcon className={iconSizes.sm} />
                    <span>{unit.code}</span>
                </h4>
                <p className="text-sm text-muted-foreground h-10 line-clamp-2">
                    {unit.description}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        {/* 🏢 ENTERPRISE: Using centralized floor icon/color */}
                        <NAVIGATION_ENTITIES.floor.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.floor.color)} />
                        <span>{t('storage.card.labels.floor')}</span>
                    </div>
                    <div className="font-medium text-foreground">{unit.floor}</div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Ruler className={iconSizes.sm} />
                        <span>{t('storage.card.labels.area')}</span>
                    </div>
                    <div className="font-medium text-foreground">{formatArea(unit.area)}</div>
                </div>
            </div>

            <div className={`pt-2 ${quick.separatorH}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-muted-foreground">{t('storage.card.labels.price')}</div>
                        <div className="font-bold text-green-600 dark:text-green-400 text-lg">{formatPrice(unit.price)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-muted-foreground">{t('storage.card.labels.pricePerSqm')}</div>
                        <div className="font-medium text-muted-foreground">{formatNumber(getPricePerSqm(unit))}€</div>
                    </div>
                </div>
            </div>

            {unit.linkedProperty && (
                <div className={`pt-2 ${quick.separatorH}`}>
                    <div className="flex items-center gap-1.5 text-sm">
                        <Link className={`${iconSizes.sm} text-primary`} />
                        <span className="text-muted-foreground">{t('storage.card.labels.linked')}</span>
                        <span className="font-medium text-primary">{unit.linkedProperty}</span>
                    </div>
                </div>
            )}

            {unit.features && unit.features.length > 0 && (
                <div className={`pt-2 ${quick.separatorH}`}>
                    <div className="flex flex-wrap gap-2">
                        {unit.features.slice(0, 3).map((feature, index) => (
                            <CommonBadge
                                key={index}
                                status="building"
                                customLabel={feature}
                                variant="outline"
                                className="font-normal"
                            />
                        ))}
                        {unit.features.length > 3 && (
                            <CommonBadge
                                status="building"
                                customLabel={`+${unit.features.length - 3}`}
                                variant="outline"
                                className="font-normal"
                            />
                        )}
                    </div>
                </div>
            )}
        </CardContent>
    );
}
