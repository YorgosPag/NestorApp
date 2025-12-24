'use client';

import React from 'react';
import { CardContent } from '@/components/ui/card';
import { CommonBadge } from '@/core/badges';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import {
  Link,
  Building,
  Ruler
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatNumber } from '@/lib/intl-utils';
import type { StorageUnit } from '@/types/storage';
import { formatPrice, formatArea, getPricePerSqm, getFeatureIcon } from './StorageCardUtils';

interface StorageCardContentProps {
    unit: StorageUnit;
    getTypeIcon: (type: 'storage' | 'parking') => React.ElementType;
}

export function StorageCardContent({ unit, getTypeIcon }: StorageCardContentProps) {
    const iconSizes = useIconSizes();
    const TypeIcon = getTypeIcon(unit.type);
    return (
        <CardContent className="p-4 space-y-4">
            <div>
                <h4 className={`font-semibold text-foreground truncate flex items-center gap-2 ${GROUP_HOVER_PATTERNS.TEXT_PRIMARY_ON_GROUP}`}>
                    <TypeIcon className={iconSizes.sm} />
                    <span>{unit.code}</span>
                </h4>
                <p className="text-sm text-muted-foreground h-10 line-clamp-2">
                    {unit.description}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Building className={iconSizes.sm} />
                        <span>Όροφος</span>
                    </div>
                    <div className="font-medium text-foreground">{unit.floor}</div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Ruler className={iconSizes.sm} />
                        <span>Επιφάνεια</span>
                    </div>
                    <div className="font-medium text-foreground">{formatArea(unit.area)}</div>
                </div>
            </div>

            <div className="pt-3 border-t">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-xs text-muted-foreground">Τιμή</div>
                        <div className="font-bold text-green-600 dark:text-green-400 text-lg">{formatPrice(unit.price)}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-muted-foreground">€/m²</div>
                        <div className="font-medium text-muted-foreground">{formatNumber(getPricePerSqm(unit))}€</div>
                    </div>
                </div>
            </div>

            {unit.linkedProperty && (
                <div className="pt-3 border-t">
                    <div className="flex items-center gap-1.5 text-sm">
                        <Link className={`${iconSizes.sm} text-primary`} />
                        <span className="text-muted-foreground">Συνδεδεμένο:</span>
                        <span className="font-medium text-primary">{unit.linkedProperty}</span>
                    </div>
                </div>
            )}

            {unit.features && unit.features.length > 0 && (
                <div className="pt-3 border-t">
                    <div className="flex flex-wrap gap-2">
                        {unit.features.slice(0, 3).map((feature, index) => {
                            const FeatureIcon = getFeatureIcon(feature);
                            return (
                                <CommonBadge
                                    key={index}
                                    status="building"
                                    customLabel={
                                        <div className="flex items-center gap-1">
                                            <FeatureIcon className={iconSizes.xs} />
                                            {feature}
                                        </div>
                                    }
                                    variant="outline"
                                    className="font-normal"
                                />
                            );
                        })}
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
