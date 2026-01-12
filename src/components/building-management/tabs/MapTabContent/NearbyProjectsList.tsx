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
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    const { bg } = useSemanticColors();

    const getTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            commercial: t('tabs.map.nearbyProjects.types.commercial'),
            residential: t('tabs.map.nearbyProjects.types.residential'),
            office: t('tabs.map.nearbyProjects.types.office')
        };
        return types[type] || type;
    };

    const getStatusLabel = (status: string) => {
        const statuses: Record<string, string> = {
            active: t('tabs.map.nearbyProjects.statuses.active'),
            completed: t('tabs.map.nearbyProjects.statuses.completed'),
            planning: t('tabs.map.nearbyProjects.statuses.planning')
        };
        return statuses[status] || status;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
                    {t('tabs.map.nearbyProjects.title')}
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
                                        {project.distance} {t('tabs.map.nearbyProjects.distance')} • {getTypeLabel(project.type)}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium">{project.progress}%</div>
                                <div className="text-xs text-muted-foreground">
                                    {getStatusLabel(project.status)}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
