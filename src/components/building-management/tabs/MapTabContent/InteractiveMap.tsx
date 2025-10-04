'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapCanvas } from './InteractiveMap/MapCanvas';
import { MapControls } from './InteractiveMap/MapControls';
import type { Building } from '../../BuildingsPageContent';

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
    return (
        <Card>
            <CardHeader>
                <CardTitle>Διαδραστικός Χάρτης</CardTitle>
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
