'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import type { Building } from '../../BuildingsPageContent';

interface OverallProgressCardProps {
    building: Building;
    milestones: { status: string }[];
}

export function OverallProgressCard({ building, milestones }: OverallProgressCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Συνολική Πρόοδος</span>
                    <span className="text-2xl font-bold text-blue-600">{building.progress}%</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ThemeProgressBar
                    progress={building.progress}
                    label="Συνολική Πρόοδος Κτιρίου"
                    size="md"
                    showPercentage={false}
                />
                <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-green-600">{milestones.filter(m => m.status === 'completed').length}</dd>
                        <dt className="text-muted-foreground">Ολοκληρωμένα</dt>
                    </div>
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-blue-600">{milestones.filter(m => m.status === 'in-progress').length}</dd>
                        <dt className="text-muted-foreground">Σε εξέλιξη</dt>
                    </div>
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-gray-600">{milestones.filter(m => m.status === 'pending').length}</dd>
                        <dt className="text-muted-foreground">Εκκρεμεί</dt>
                    </div>
                    <div className="text-center">
                        <dd className="text-2xl font-bold text-purple-600">
                            {milestones.find(m => m.status === 'in-progress')?.date ?
                                Math.ceil((new Date(milestones.find(m => m.status === 'in-progress')!.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                : 0
                            }
                        </dd>
                        <dt className="text-muted-foreground">Ημέρες απομένουν</dt>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}