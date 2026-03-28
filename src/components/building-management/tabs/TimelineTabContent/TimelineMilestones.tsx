'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { MilestoneItem, type Milestone } from './MilestoneItem';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

// 🏢 ENTERPRISE: LucideIcon type for icon components
type LucideIconType = React.ComponentType<{ className?: string }>;

interface TimelineMilestonesProps {
    milestones: Milestone[];
    getStatusColor: (status: string) => string;
    getStatusText: (status: string) => string;
    getTypeIcon: (type: string) => LucideIconType;
    onEditMilestone?: (milestone: Milestone) => void;
    onDeleteMilestone?: (milestone: Milestone) => void;
}

export function TimelineMilestones({ milestones, getStatusColor, getStatusText, getTypeIcon, onEditMilestone, onDeleteMilestone }: TimelineMilestonesProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');
    const colors = useSemanticColors();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('tabs.timeline.milestones.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <div className={`absolute left-6 top-4 bottom-4 w-0.5 ${colors.bg.muted}`} />

                    <div className="space-y-2">
                        {milestones.map((milestone) => (
                            <MilestoneItem
                                key={milestone.id}
                                milestone={milestone}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                getTypeIcon={getTypeIcon}
                                onEdit={onEditMilestone ? () => onEditMilestone(milestone) : undefined}
                                onDelete={onDeleteMilestone ? () => onDeleteMilestone(milestone) : undefined}
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}