
'use client';

import React from 'react';
import type { Project } from '../types';
import { formatCurrency } from '@/lib/intl-utils';

interface StatsGridProps {
    project: Project;
}

export function StatsGrid({ project }: StatsGridProps) {
    return (
        <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
                <p className="text-muted-foreground">Επιφάνεια</p>
                <p className="font-medium">{project.totalArea.toLocaleString('el-GR')} m²</p>
            </div>
            <div>
                <p className="text-muted-foreground">Αξία</p>
                <p className="font-medium text-green-600">{formatCurrency(project.totalValue)}</p>
            </div>
        </div>
    );
}
