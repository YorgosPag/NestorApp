'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Building2, Users } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized navigation entities for residential icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useNearbyProjectMarkerStyles } from './hooks/useMapStyles';

interface NearbyProjectMarkerProps {
  project: {
    id: string;
    name: string;
    distance: string;
    status: string;
    type: string;
    progress: number;
  };
  position: { top: string; left: string };
}

export function NearbyProjectMarker({ project, position }: NearbyProjectMarkerProps) {
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: CSS-in-JS hook - ZERO inline styles, ZERO hardcoded colors
  const markerStyles = useNearbyProjectMarkerStyles(position, project.status);

  // 🏢 ENTERPRISE: Use centralized navigation entity icon for residential
  const ResidentialIcon = NAVIGATION_ENTITIES.unit.icon;

  const getIcon = (type: string) => {
    const iconClass = iconSizes.xs;
    switch (type) {
      case 'commercial': return <Building2 className={iconClass} />;
      case 'residential': return <ResidentialIcon className={iconClass} />;
      default: return <Users className={iconClass} />;
    }
  };

  return (
    <div className={markerStyles.containerClass}>
      <div className="group relative">
        <div className={markerStyles.markerClass}>
          <div className={cn(iconSizes.sm, markerStyles.iconContainerClass)}>
            {getIcon(project.type)}
          </div>
        </div>
        {/* 🏷️ ENTERPRISE TOOLTIP: Centralized styling */}
        <div className={markerStyles.tooltipClass}>
          <div className="font-medium">{project.name}</div>
          <div className="text-gray-300">{project.distance} • {project.progress}%</div>
          {/* Progress bar - Enterprise compliance */}
          <div className={markerStyles.progressBarClass}>
            <div
              className={cn(
                markerStyles.progressFillClass,
                // 🎯 ENTERPRISE: CSS arbitrary value instead of inline style
                `[width:${project.progress}%]`
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
