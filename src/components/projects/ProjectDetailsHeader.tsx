'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ProjectBadge } from '@/core/badges';
import { Briefcase, Eye } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types/project';
import { PROJECT_STATUS_LABELS } from '@/types/project';

// Removed hardcoded getStatusColor function - using centralized ProjectBadge instead


interface ProjectDetailsHeaderProps {
    project: Project;
}

export function ProjectDetailsHeader({ project }: ProjectDetailsHeaderProps) {
    return (
        <EntityDetailsHeader
            icon={Briefcase}
            title={project.name}
            actions={[
                {
                    label: 'Επίδειξη Έργου',
                    onClick: () => console.log('Show project details'),
                    icon: Eye,
                    className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                }
            ]}
            variant="detailed"
        >
            {/* Centralized ProjectBadge Components */}
            <div className="flex gap-2 mt-2">
                <ProjectBadge status={project.status} size="sm" />
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
                    {project.progress}% ολοκληρωμένο
                </span>
            </div>
        </EntityDetailsHeader>
    );
}
