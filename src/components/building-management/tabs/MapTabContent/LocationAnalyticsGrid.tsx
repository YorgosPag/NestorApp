'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Train, Bus, Car, Building, GraduationCap, ShoppingCart, TrendingUp, Euro } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized navigation entities
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function LocationAnalyticsGrid() {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    // 🏢 ENTERPRISE: Use centralized unit icon for area quality
    const AreaQualityIcon = NAVIGATION_ENTITIES.unit.icon;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('tabs.map.analytics.transportation.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Train className={iconSizes.sm} />
                                {t('tabs.map.analytics.transportation.metro')}
                            </span>
                            <span className="text-sm font-medium">300m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Bus className={iconSizes.sm} />
                                {t('tabs.map.analytics.transportation.busStop')}
                            </span>
                            <span className="text-sm font-medium">50m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Car className={iconSizes.sm} />
                                {t('tabs.map.analytics.transportation.parking')}
                            </span>
                            <span className="text-sm font-medium">150m</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('tabs.map.analytics.services.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Building className={iconSizes.sm} />
                                {t('tabs.map.analytics.services.hospital')}
                            </span>
                            <span className="text-sm font-medium">800m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <GraduationCap className={iconSizes.sm} />
                                {t('tabs.map.analytics.services.schools')}
                            </span>
                            <span className="text-sm font-medium">400m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <ShoppingCart className={iconSizes.sm} />
                                {t('tabs.map.analytics.services.supermarket')}
                            </span>
                            <span className="text-sm font-medium">200m</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">{t('tabs.map.analytics.areaRating.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <TrendingUp className={iconSizes.sm} />
                                {t('tabs.map.analytics.areaRating.investmentIndex')}
                            </span>
                            <span className="text-sm font-medium text-green-600">8.5/10</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <AreaQualityIcon className={iconSizes.sm} />
                                {t('tabs.map.analytics.areaRating.areaQuality')}
                            </span>
                            <span className="text-sm font-medium text-green-600">9.2/10</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Euro className={iconSizes.sm} />
                                {t('tabs.map.analytics.areaRating.propertyPrices')}
                            </span>
                            <span className="text-sm font-medium text-blue-600">€3,200/m²</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
