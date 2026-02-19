'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import type { Building } from '../../BuildingsPageContent';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Milestone type with date for calculations
interface MilestoneWithDate {
    status: string;
    date?: string;
}

interface OverallProgressCardProps {
    building: Building;
    milestones: MilestoneWithDate[];
}

export function OverallProgressCard({ building, milestones }: OverallProgressCardProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('building');

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{t('tabs.timeline.overallProgress.title')}</span>
                    <span className="text-2xl font-bold text-blue-600">{building.progress}%</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ThemeProgressBar
                    progress={building.progress}
                    label={t('tabs.timeline.overallProgress.label')}
                    size="md"
                    showPercentage={false}
                />
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-green-600">{milestones.filter(m => m.status === 'completed').length}</dd>
                        <dt className="text-muted-foreground">{t('tabs.timeline.overallProgress.completed')}</dt>
                    </div>
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-blue-600">{milestones.filter(m => m.status === 'in-progress').length}</dd>
                        <dt className="text-muted-foreground">{t('tabs.timeline.overallProgress.inProgress')}</dt>
                    </div>
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-gray-600">{milestones.filter(m => m.status === 'pending').length}</dd>
                        <dt className="text-muted-foreground">{t('tabs.timeline.overallProgress.pending')}</dt>
                    </div>
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-purple-600">
                            {(() => {
                                const inProgressMilestone = milestones.find(m => m.status === 'in-progress');
                                if (inProgressMilestone?.date) {
                                    return Math.ceil((new Date(inProgressMilestone.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                }
                                return 0;
                            })()}
                        </dd>
                        <dt className="text-muted-foreground">{t('tabs.timeline.overallProgress.daysRemaining')}</dt>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}