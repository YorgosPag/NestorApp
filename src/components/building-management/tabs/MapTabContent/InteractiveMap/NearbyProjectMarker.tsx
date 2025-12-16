'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Building2, Home, Users } from 'lucide-react';
import { CORE_HOVER_TRANSFORMS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects/hover-effects';
import { layoutUtilities } from '@/styles/design-tokens';

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
  const getIcon = (type: string) => {
    switch (type) {
      case 'commercial': return <Building2 className="w-3 h-3" />;
      case 'residential': return <Home className="w-3 h-3" />;
      default: return <Users className="w-3 h-3" />;
    }
  };

  return (
    <div
      className="absolute z-10 transform -translate-x-1/2 -translate-y-1/2"
      style={layoutUtilities.position(position.top, position.left)}
    >
      <div className="group relative">
        <div className={cn(
          "p-2 rounded-full shadow-md border-2 border-white cursor-pointer transition-transform",
          CORE_HOVER_TRANSFORMS.SCALE_UP_MEDIUM,
          project.status === 'active' ? 'bg-blue-500' :
          project.status === 'completed' ? 'bg-green-500' :
          'bg-yellow-500'
        )}>
          <div className="w-4 h-4 text-white flex items-center justify-center">
            {getIcon(project.type)}
          </div>
        </div>
        <div className={`absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-90 text-white px-3 py-2 rounded text-xs whitespace-nowrap ${GROUP_HOVER_PATTERNS.SHOW_ON_GROUP} transition-opacity`}>
          <div className="font-medium">{project.name}</div>
          <div className="text-gray-300">{project.distance} • {project.progress}%</div>
        </div>
      </div>
    </div>
  );
}
