'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { MilestoneItem, type Milestone } from './MilestoneItem';

interface TimelineMilestonesProps {
    milestones: Milestone[];
    getStatusColor: (status: string) => string;
    getStatusText: (status: string) => string;
    getTypeIcon: (type: string) => string;
}

export function TimelineMilestones({ milestones, getStatusColor, getStatusText, getTypeIcon }: TimelineMilestonesProps) {
    const colors = useSemanticColors();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Λεπτομερή Milestones</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <div className={`absolute left-6 top-4 bottom-4 w-0.5 ${colors.bg.muted}`}></div>

                    <div className="space-y-6">
                        {milestones.map((milestone) => (
                            <MilestoneItem
                                key={milestone.id}
                                milestone={milestone}
                                getStatusColor={getStatusColor}
                                getStatusText={getStatusText}
                                getTypeIcon={getTypeIcon}
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}