'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ProjectBadge } from '@/core/badges';
import { Briefcase, Eye } from 'lucide-react';
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
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                    {project.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                    <ProjectBadge
                      status={project.status}
                      size="sm"
                      className="text-xs text-white"
                    />
                    <span className="text-sm text-muted-foreground">
                        {project.progress}% ολοκληρωμένο
                    </span>
                </div>
                </div>
            </div>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                <Eye className="w-4 h-4 mr-2" />
                Επίδειξη Έργου
            </Button>
            </div>
      </div>
    );
}
