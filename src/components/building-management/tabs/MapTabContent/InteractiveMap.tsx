'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapCanvas } from './InteractiveMap/MapCanvas';
import { MapControls } from './InteractiveMap/MapControls';
import type { Building } from '../../BuildingsPageContent';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface InteractiveMapProps {
    building: Pick<Building, 'name'>;
    mapView: 'satellite' | 'street' | 'hybrid';
    showNearbyProjects: boolean;
    setShowNearbyProjects: (show: boolean) => void;
    selectedLayer: 'all' | 'active' | 'completed';
    setSelectedLayer: (layer: 'all' | 'active' | 'completed') => void;
}

export function InteractiveMap({
    building,
    mapView,
    showNearbyProjects,
    setShowNearbyProjects,
    selectedLayer,
    setSelectedLayer,
}: InteractiveMapProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('map.interactiveMap')}</CardTitle>
            </CardHeader>
            <CardContent>
                <MapCanvas
                    buildingName={building.name}
                    mapView={mapView}
                    showNearbyProjects={showNearbyProjects}
                    selectedLayer={selectedLayer}
                />
                <MapControls
                    showNearbyProjects={showNearbyProjects}
                    setShowNearbyProjects={setShowNearbyProjects}
                    selectedLayer={selectedLayer}
                    setSelectedLayer={setSelectedLayer}
                />
            </CardContent>
        </Card>
    );
}
