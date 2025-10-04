'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { ProjectCard } from './ProjectCard';

interface ProjectsGridViewProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  companies: { id: string; name: string }[];
}

const MemoizedProjectCard = React.memo(ProjectCard);

export function ProjectsGridView({
  projects,
  selectedProject,
  onSelectProject,
  companies,
}: ProjectsGridViewProps) {
  return (
    <div className="flex-1 p-4 overflow-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <MemoizedProjectCard
            key={project.id}
            project={project}
            isSelected={selectedProject?.id === project.id}
            onClick={(e) => onSelectProject(project)}
            companyName={companies.find(c => c.id === project.companyId)?.name || project.company}
          />
        ))}
      </div>
    </div>
  );
}
