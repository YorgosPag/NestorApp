'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { BuildingBadge } from '@/core/badges';
import type { BuildingStatus } from '@/core/types/BadgeTypes';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { getStatusColor, getStatusLabel } from '@/lib/project-utils';

// 🏢 ENTERPRISE: Typed mock building data
interface MockBuilding {
    id: number;
    name: string;
    progress: number;
    status: BuildingStatus;
}

const mockBuildings: MockBuilding[] = [
    { id: 1, name: 'Κτίριο Α', progress: 100, status: 'completed' },
    { id: 2, name: 'Κτίριο Β', progress: 60, status: 'in_progress' },
    { id: 3, name: 'Κτίριο Γ', progress: 15, status: 'planning' },
]

export function ProjectTimelineTab({ project }: { project: Project }) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline Έργου: {project.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
            <h3 className="text-lg font-semibold mb-4">Συνολική Πρόοδος Έργου</h3>
            <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-primary">{project.progress}%</span>
                <div className="w-full">
                  <ThemeProgressBar
                    progress={project.progress}
                    label=""
                    size="md"
                    showPercentage={false}
                  />
                </div>
            </div>
        </div>

        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Πρόοδος ανά Κτίριο</h3>
            {mockBuildings.map(building => (
                <div key={building.id} className="p-4 ${quick.card}">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {/* 🏢 ENTERPRISE: Using centralized building icon/color */}
                            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color)} />
                            <span className="font-medium">{building.name}</span>
                        </div>
                        <BuildingBadge
                          status={building.status}
                          variant="secondary"
                          size="sm"
                          className="text-xs"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-primary">{building.progress}%</span>
                        <div className="w-full">
                          <ThemeProgressBar
                            progress={building.progress}
                            label=""
                            size="sm"
                            showPercentage={false}
                          />
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
