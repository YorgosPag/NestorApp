'use client';

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';

const connectionTypeColors = {
  sameBuilding: 'bg-blue-500',
  sameFloor: 'bg-green-500',
  related: 'bg-purple-500',
  parking: 'bg-yellow-500'
};

const connectionTypeLabels = {
    sameBuilding: 'Ίδιο Κτίριο',
    sameFloor: 'Ίδιος Όροφος',
    related: 'Σχετικό',
    parking: 'Parking'
};

export function Legend() {
    const { radius } = useBorderTokens();
    return (
        <div className="border-t pt-3">
            <h5 className="text-xs font-medium mb-2">Υπόμνημα</h5>
            <div className="space-y-1 text-xs text-muted-foreground">
                {Object.entries(connectionTypeColors).map(([type, colorClass]) => (
                    <div key={type} className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${radius.sm} ${colorClass}`}></div>
                        <span>{connectionTypeLabels[type as keyof typeof connectionTypeLabels]}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}