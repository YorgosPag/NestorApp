'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Share } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface LocationInfoCardProps {
    building: { name: string; address?: string, city?: string };
    coordinates: { lat: number, lng: number };
}

export function LocationInfoCard({ building, coordinates }: LocationInfoCardProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MapPin className={iconSizes.md} />
                    {t('tabs.general.location.title')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-2">
                        <div>
                            <Label className="text-sm font-medium">{t('tabs.general.location.address')}</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                {building.address}, {building.city}
                            </p>
                        </div>
                        <div>
                            <Label className="text-sm font-medium">{t('tabs.general.location.coordinates')}</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                {coordinates.lat}°N, {coordinates.lng}°E
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                                <MapPin className={`${iconSizes.sm} mr-2`} />
                                {t('tabs.general.location.directions')}
                            </Button>
                            <Button variant="outline" size="sm">
                                <Share className={`${iconSizes.sm} mr-2`} />
                                {t('tabs.general.location.shareLocation')}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <Label className="text-sm font-medium">{t('tabs.general.location.areaInfo')}</Label>
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t('tabs.general.location.areaType')}</span>
                                    <span>{t('tabs.general.location.centralCommercial')}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t('tabs.general.location.buildingRatio')}</span>
                                    <span>3.6</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">{t('tabs.general.location.maxHeight')}</span>
                                    <span>27m ({t('tabs.general.location.floors', { count: 9 })})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
