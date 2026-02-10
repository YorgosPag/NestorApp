'use client';

import React from 'react';
import { Building2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { colors as tokenColors } from '@/styles/design-tokens';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { nearbyProjects } from './nearbyProjects';
import { NearbyProjectMarker } from './NearbyProjectMarker';
import { useMapCanvasStyles, useProjectMarkerStyles } from './hooks/useMapStyles';
import {
  getProjectMarkerPosition,
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
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();

    // 🏢 ENTERPRISE: CSS-in-JS hooks - NO inline styles, NO hardcoded colors
    const mapCanvas = useMapCanvasStyles('success');
    const projectMarker = useProjectMarkerStyles();

    // 🏢 ENTERPRISE: Border tokens hook for createBorder utility
    const { createBorder, quick } = useBorderTokens();

    // 🏢 ENTERPRISE: Semantic colors hook for centralized colors
    const colors = useSemanticColors();

    const filteredProjects = nearbyProjects.filter(project => {
        if (selectedLayer === 'all') return true;
        return project.status === selectedLayer;
    });

    return (
        <div className={mapCanvas.containerClass}>
            {/* Simulated Map Background */}
            <div className={mapCanvas.innerClass}>
                <div className={mapCanvas.relativeClass}>
                    {/* Grid pattern to simulate map */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="grid grid-cols-12 grid-rows-8 h-full w-full">
                            {Array.from({ length: 96 }).map((_, i) => (
                                <div key={i} className="border border-border/50" />
                            ))}
                        </div>
                    </div>

                    {/* Main Building Marker - Enterprise CSS-in-JS */}
                    <div className={projectMarker.containerClass}>
                        <div className={cn(projectMarker.wrapperClass, "group")}>
                            <div className={projectMarker.bounceClass}>
                                <div className={projectMarker.markerClass}>
                                    <Building2 className={`${iconSizes.lg} text-white`} />
                                </div>
                            </div>
                            <div className={cn(projectMarker.tooltipClass, GROUP_HOVER_PATTERNS.SHOW_ON_GROUP)}>
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
                        <div className={`${iconSizes.xl8} ${createBorder('medium', tokenColors.blue['300'], 'dashed')} rounded-full opacity-30`} />
                        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${iconSizes.xl12} ${createBorder('medium', tokenColors.blue['200'], 'dashed')} rounded-full opacity-20`} />
                    </div>

                    {/* Scale indicator */}
                    <div className={`absolute bottom-4 left-4 ${colors.bg.primary} opacity-90 px-3 py-2 ${quick.input} text-sm`}>
                        <div className="flex items-center gap-2">
                            <div className={`${iconSizes.xl4} h-1 bg-black`} />
                            <span>100m</span>
                        </div>
                    </div>

                    {/* Map type indicator */}
                    <div className={`absolute top-4 right-4 ${colors.bg.primary} opacity-90 px-3 py-2 ${quick.input} text-sm font-medium`}>
                        {mapView === 'street' ? t('tabs.map.views.street') :
                            mapView === 'satellite' ? t('tabs.map.views.satellite') :
                                t('tabs.map.views.hybrid')}
                    </div>
                </div>
            </div>
        </div>
    );
}
