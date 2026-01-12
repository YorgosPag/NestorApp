'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';

interface TimelineHeaderProps {
    milestones: { status: string }[];
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
                <CommonBadge
                  status="company"
                  customLabel={`${milestones.filter(m => m.status === 'completed').length} / ${milestones.length} ολοκληρώθηκαν`}
                  variant="outline"
                  size="sm"
                  className="bg-green-50 text-green-700"
                />
            </div>
        </div>
    );
}