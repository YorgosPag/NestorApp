'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

const nearbyProjects = [
    {
      id: 1,
      name: "Εμπορικό Κέντρο Κολωνάκι",
      distance: "200m",
      status: "active",
      type: "commercial",
      progress: 65
    },
    {
      id: 2, 
      name: "Κατοικίες Μαρασλή",
      distance: "350m",
      status: "completed",
      type: "residential",
      progress: 100
    },
    {
      id: 3,
      name: "Γραφεία Σκουφά",
      distance: "120m", 
      status: "planning",
      type: "office",
      progress: 15
    }
];

export function NearbyProjectsList() {
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    const { bg } = useSemanticColors();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
                    Γειτονικά Έργα
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {nearbyProjects.map((project) => (
                        <div key={project.id} className={`flex items-center justify-between p-4 ${quick.card} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} transition-colors`}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    `${iconSizes.xs} rounded-full`,
                                    project.status === 'active' ? bg.info :
                                        project.status === 'completed' ? bg.success :
                                            bg.warning
                                )}></div>
                                <div>
                                    <p className="font-medium">{project.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {project.distance} απόσταση • {project.type === 'commercial' ? 'Εμπορικό' :
                                            project.type === 'residential' ? 'Κατοικίες' : 'Γραφεία'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium">{project.progress}%</div>
                                <div className="text-xs text-muted-foreground">
                                    {project.status === 'active' ? 'Σε εξέλιξη' :
                                        project.status === 'completed' ? 'Ολοκληρωμένο' :
                                            'Σχεδιασμός'}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
