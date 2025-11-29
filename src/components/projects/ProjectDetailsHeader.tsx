'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ProjectBadge } from '@/core/badges';
import { Briefcase, Eye } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types/project';
import { PROJECT_STATUS_LABELS } from '@/types/project';

const getStatusColor = (status: ProjectStatus): string => {
    const colors: Record<ProjectStatus, string> = {
      planning: 'bg-yellow-500',
      in_progress: 'bg-blue-500',
      completed: 'bg-green-500',
      on_hold: 'bg-gray-500',
      cancelled: 'bg-red-500',
    };
    return colors[status];
};


interface ProjectDetailsHeaderProps {
    project: Project;
}

export function ProjectDetailsHeader({ project }: ProjectDetailsHeaderProps) {
    return (
        <EntityDetailsHeader
            icon={Briefcase}
            title={project.name}
            badges={[
                {
                    type: 'status',
                    value: PROJECT_STATUS_LABELS[project.status] || project.status,
                    size: 'sm'
                },
                {
                    type: 'progress',
                    value: `${project.progress}% ολοκληρωμένο`,
                    variant: 'secondary',
                    size: 'sm'
                }
            ]}
            actions={[
                {
                    label: 'Επίδειξη Έργου',
                    onClick: () => console.log('Show project details'),
                    icon: Eye,
                    className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                }
            ]}
            variant="detailed"
        />
    );
}
