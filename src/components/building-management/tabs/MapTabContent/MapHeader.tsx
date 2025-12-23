'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Globe, Map as MapIcon, Satellite } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface MapHeaderProps {
    mapView: 'satellite' | 'street' | 'hybrid';
    setMapView: (view: 'satellite' | 'street' | 'hybrid') => void;
}

export function MapHeader({ mapView, setMapView }: MapHeaderProps) {
    const iconSizes = useIconSizes();

    return (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold">Χάρτης & Τοποθεσία</h3>
                <p className="text-sm text-muted-foreground">
                    Διαδραστικός χάρτης με nearby projects
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant={mapView === 'street' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMapView('street')}
                >
                    <MapIcon className={`${iconSizes.sm} mr-2`} />
                    Δρόμος
                </Button>
                <Button
                    variant={mapView === 'satellite' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMapView('satellite')}
                >
                    <Satellite className={`${iconSizes.sm} mr-2`} />
                    Δορυφόρος
                </Button>
                <Button
                    variant={mapView === 'hybrid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMapView('hybrid')}
                >
                    <Globe className={`${iconSizes.sm} mr-2`} />
                    Υβριδικός
                </Button>
            </div>
        </div>
    );
}
