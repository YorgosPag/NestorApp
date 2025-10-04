'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { ProjectHeaderBackground } from './ProjectHeader/ProjectHeaderBackground';
import { ProjectHeaderLogo } from './ProjectHeader/ProjectHeaderLogo';
import { ProjectHeaderActions } from './ProjectHeader/ProjectHeaderActions';
import { ProjectHeaderBadges } from './ProjectHeader/ProjectHeaderBadges';
import { ProjectHeaderProgress } from './ProjectHeader/ProjectHeaderProgress';
import { getStatusColor, getStatusLabel } from '@/lib/project-utils';

interface ProjectCardHeaderProps {
    project: Project;
    isFavorite: boolean;
    setIsFavorite: (isFavorite: boolean) => void;
    isHovered: boolean;
}

export function ProjectCardHeader({
    project,
    isFavorite,
    setIsFavorite,
    isHovered,
}: ProjectCardHeaderProps) {
  return (
    <div className="relative h-48 bg-gradient-to-br from-blue-100 via-purple-50 to-blue-50 dark:from-blue-950 dark:via-purple-950 dark:to-blue-900 overflow-hidden">
      <ProjectHeaderBackground />

      <ProjectHeaderLogo />
      
      <ProjectHeaderActions
        isHovered={isHovered}
        isFavorite={isFavorite}
        setIsFavorite={setIsFavorite}
      />

      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
        <ProjectHeaderBadges
          status={project.status}
          company={project.company || 'Unknown'}
          getStatusColor={getStatusColor}
          getStatusLabel={getStatusLabel}
        />
        <ProjectHeaderProgress
          isFavorite={isFavorite}
          progress={project.progress}
          status={project.status}
          getStatusColor={getStatusColor}
        />
      </div>
    </div>
  );
}
