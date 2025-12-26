'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { nearbyProjects } from './nearbyProjects';
import { NearbyProjectMarker } from './NearbyProjectMarker';
import {
  getProjectMarkerPosition,
  getMapCanvasStyles,
  getMapGridStyles,
  getMainBuildingMarkerStyles,
  getDistanceCircleStyles,
  getScaleIndicatorStyles,
  getMapTypeIndicatorStyles,
  getMapViewDisplayName,
  type MapViewType,
  type ProjectStatusType
} from './MapComponents.styles';

interface MapCanvasProps {
    buildingName: string;
    mapView: MapViewType;
    showNearbyProjects: boolean;
    selectedLayer: ProjectStatusType;
}

export function MapCanvas({ buildingName, mapView, showNearbyProjects, selectedLayer }: MapCanvasProps) {
    const iconSizes = useIconSizes();
    const { createBorder, quick, getStatusBorder } = useBorderTokens();

    // Enterprise: Get centralized marker styles με semantic secondary border
    const markerStyles = getMainBuildingMarkerStyles('hsl(var(--border))'); // Secondary border semantic color
    const filteredProjects = nearbyProjects.filter(project => {
        if (selectedLayer === 'all') return true;
        return project.status === selectedLayer;
    });

    return (
        <div className={`relative h-96 bg-gradient-to-br from-green-100 via-blue-50 to-green-100 ${quick.card} border border-dashed overflow-hidden`}>
            {/* Simulated Map Background */}
            <div className="absolute inset-0">
                <div className="w-full h-full relative">
                    {/* Grid pattern to simulate map */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
                            {Array.from({ length: 96 }).map((_, i) => (
                                <div key={i} className="border border-border/50"></div>
                            ))}
                        </div>
                    </div>

                    {/* Main Building Marker - Enterprise Centralized */}
                    <div style={markerStyles.container}>
                        <div style={markerStyles.wrapper} className="group">
                            <div style={markerStyles.bounceContainer}>
                                <div style={markerStyles.marker}>
                                    <Building2 className={`${iconSizes.lg} text-white`} />
                                </div>
                            </div>
                            <div style={markerStyles.tooltip} className={GROUP_HOVER_PATTERNS.SHOW_ON_GROUP}>
                                {buildingName}
                            </div>
                        </div>
                    </div>

                    {/* Nearby Projects */}
                    {showNearbyProjects && filteredProjects.map((project, index) => (
                        <NearbyProjectMarker
                            key={project.id}
                            project={project}
                            position={getProjectMarkerPosition(index)}
                        />
                    ))}

                    {/* Distance circles */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className={`${iconSizes.xl8} ${createBorder('medium', 'rgb(147 197 253)', 'dashed')} rounded-full opacity-30`}></div>
                        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${iconSizes.xl12} ${createBorder('medium', 'rgb(191 219 254)', 'dashed')} rounded-full opacity-20`}></div>
                    </div>

                    {/* Scale indicator */}
                    <div className={`absolute bottom-4 left-4 bg-white bg-opacity-90 px-3 py-2 ${quick.input} text-sm`}>
                        <div className="flex items-center gap-2">
                            <div className={`${iconSizes.xl4} h-1 bg-black`}></div>
                            <span>100m</span>
                        </div>
                    </div>

                    {/* Map type indicator */}
                    <div className={`absolute top-4 right-4 bg-white bg-opacity-90 px-3 py-2 ${quick.input} text-sm font-medium`}>
                        {mapView === 'street' ? 'Χάρτης δρόμων' :
                            mapView === 'satellite' ? 'Δορυφορική όψη' :
                                'Υβριδική όψη'}
                    </div>
                </div>
            </div>
        </div>
    );
}
