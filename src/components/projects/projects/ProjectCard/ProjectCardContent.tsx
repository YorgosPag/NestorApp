'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { ProjectCardTitle } from './ProjectCardContent/ProjectCardTitle';
import { ProjectCardLocation } from './ProjectCardContent/ProjectCardLocation';
import { ProjectCardProgress } from './ProjectCardProgress';
import { ProjectCardMetrics } from './ProjectCardContent/ProjectCardMetrics';

interface ProjectCardContentProps {
  project: Project;
}

export function ProjectCardContent({ project }: ProjectCardContentProps) {
  return (
    <div className="p-6 space-y-4">
      <ProjectCardTitle name={project.name} description={project.title} />
      <ProjectCardLocation address={project.address} city={project.city} />
      <ProjectCardProgress progress={project.progress} />
      <ProjectCardMetrics project={project} />
    </div>
  );
}
