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
import { useIconSizes } from '@/hooks/useIconSizes';
import { PROJECT_STATUS_LABELS } from '@/types/project';
import { COMPLEX_HOVER_EFFECTS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
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
          `relative overflow-hidden cursor-pointer group ${quick.card}`,
          // Override default border with thicker one
          "border-2",
          COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
          isSelected
            ? "border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-800"
            : "border-border"
        )}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isSelected && (
          <div className={`absolute top-2 right-2 z-20 bg-primary text-white rounded-full ${iconSizes.md} text-xs flex items-center justify-center`}>
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
              className: `${iconSizes.xl} p-0`
            }
          ]}
          variant="compact"
          className={quick.borderB}
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
