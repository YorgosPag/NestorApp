'use client';

import React from 'react';
import { ProjectBadge, CommonBadge } from '@/core/badges';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types/project';

interface ProjectHeaderBadgesProps {
  status: ProjectStatus;
  company: string;
  getStatusColor: (status: ProjectStatus) => string;
  getStatusLabel: (status: ProjectStatus) => string;
}

export function ProjectHeaderBadges({
  status,
  company,
  getStatusColor,
  getStatusLabel,
}: ProjectHeaderBadgesProps) {
  return (
    <div className="flex items-center gap-2">
      <ProjectBadge
        status={status}
        size="sm"
        className="text-xs shadow-sm text-white"
      />
      <CommonBadge
        status="company"
        customLabel={company}
        variant="secondary"
        size="sm"
        className="text-xs bg-white/90 text-gray-700 shadow-sm"
      />
    </div>
  );
}
