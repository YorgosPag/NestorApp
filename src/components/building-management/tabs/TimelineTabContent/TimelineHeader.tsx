'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface TimelineHeaderProps {
    milestones: any[];
}

export function TimelineHeader({ milestones }: TimelineHeaderProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold">Χρονοδιάγραμμα Έργου</h3>
                <p className="text-sm text-muted-foreground">
                    Παρακολούθηση προόδου και milestones
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                    {milestones.filter(m => m.status === 'completed').length} / {milestones.length} ολοκληρώθηκαν
                </Badge>
            </div>
        </div>
    );
}