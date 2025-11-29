'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { ProjectCardContent } from './ProjectCard/ProjectCardContent';
import { ProjectCardTimeline } from './ProjectCard/ProjectCardTimeline';
import { getStatusColor, getStatusLabel } from '@/lib/project-utils';
import { Briefcase } from 'lucide-react';
import { PROJECT_STATUS_LABELS } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  companyName: string;
}

export function ProjectCard({
  project,
  isSelected,
  onClick,
  companyName,
}: ProjectCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // EntityDetailsHeader centralized component

  return (
    <TooltipProvider>
      <Card
        role="button"
        aria-pressed={isSelected}
        aria-label={`Επιλογή ${project.name}`}
        tabIndex={0}
        className={cn(
          "relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl group border-2",
          isSelected
            ? "border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800"
            : "border-border hover:border-blue-300 hover:shadow-lg",
          "transform hover:scale-[1.02]"
        )}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isSelected && (
          <div className="absolute top-2 right-2 z-20 bg-primary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
            ✓
          </div>
        )}

        {/* EntityDetailsHeader instead of complex visual header */}
        <EntityDetailsHeader
          icon={Briefcase}
          title={project.name}
          subtitle={companyName}
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
              label: isFavorite ? '★' : '☆',
              onClick: () => {
                setIsFavorite(!isFavorite);
              },
              variant: 'ghost',
              className: 'w-8 h-8 p-0'
            }
          ]}
          variant="compact"
          className="border-b"
        />
        
        <ProjectCardContent
          project={project}
        />

        <ProjectCardTimeline
          project={project}
        />

        {/* Hover overlay effect */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none transition-opacity duration-300",
          isHovered ? "opacity-100" : "opacity-0"
        )} />
      </Card>
    </TooltipProvider>
  );
}
