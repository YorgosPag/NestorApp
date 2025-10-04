
'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getStatusColorClass } from '../utils/statusColors';
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/types/project';

interface MetaBadgesProps {
    status: ProjectStatus;
    companyName: string;
}

export function MetaBadges({ status, companyName }: MetaBadgesProps) {
    return (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge 
                variant="secondary" 
                className={cn("text-xs", getStatusColorClass(status))}
            >
                {PROJECT_STATUS_LABELS[status]}
            </Badge>
             <Badge variant="outline" className="text-xs">
                {companyName}
            </Badge>
        </div>
    );
}
