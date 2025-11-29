'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import type { Building } from '../../BuildingsPageContent';

interface OverallProgressCardProps {
    building: Building;
    milestones: any[];
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{milestones.filter(m => m.status === 'completed').length}</div>
                        <div className="text-muted-foreground">Ολοκληρωμένα</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{milestones.filter(m => m.status === 'in-progress').length}</div>
                        <div className="text-muted-foreground">Σε εξέλιξη</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-600">{milestones.filter(m => m.status === 'pending').length}</div>
                        <div className="text-muted-foreground">Εκκρεμεί</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                            {milestones.find(m => m.status === 'in-progress')?.date ?
                                Math.ceil((new Date(milestones.find(m => m.status === 'in-progress')!.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                : 0
                            }
                        </div>
                        <div className="text-muted-foreground">Ημέρες απομένουν</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}