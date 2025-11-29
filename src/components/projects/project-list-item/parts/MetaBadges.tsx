
'use client';

import React from 'react';
import { ProjectBadge, CommonBadge } from '@/core/badges';
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
            <ProjectBadge
              status={status}
              variant="secondary"
              size="sm"
              className="text-xs"
            />
            <CommonBadge
              status="company"
              customLabel={companyName}
              variant="outline"
              size="sm"
              className="text-xs"
            />
        </div>
    );
}
