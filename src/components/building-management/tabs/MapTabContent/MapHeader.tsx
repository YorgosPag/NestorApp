'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Globe, Map as MapIcon, Satellite } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface MapHeaderProps {
    mapView: 'satellite' | 'street' | 'hybrid';
    setMapView: (view: 'satellite' | 'street' | 'hybrid') => void;
}

export function MapHeader({ mapView, setMapView }: MapHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();

    return (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold">{t('tabs.map.header.title')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('tabs.map.header.subtitle')}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant={mapView === 'street' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMapView('street')}
                >
                    <MapIcon className={`${iconSizes.sm} mr-2`} />
                    {t('tabs.map.header.streetButton')}
                </Button>
                <Button
                    variant={mapView === 'satellite' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMapView('satellite')}
                >
                    <Satellite className={`${iconSizes.sm} mr-2`} />
                    {t('tabs.map.header.satelliteButton')}
                </Button>
                <Button
                    variant={mapView === 'hybrid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMapView('hybrid')}
                >
                    <Globe className={`${iconSizes.sm} mr-2`} />
                    {t('tabs.map.header.hybridButton')}
                </Button>
            </div>
        </div>
    );
}
