'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { ProjectsList } from './projects-list';
import { ProjectDetails } from './project-details';
import { ProjectsGridView } from './projects/ProjectsGridView';

interface ProjectViewSwitchProps {
  viewMode: 'list' | 'grid';
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  companies: { id: string; name: string }[];
}

export function ProjectViewSwitch({ viewMode, projects, selectedProject, onSelectProject, companies }: ProjectViewSwitchProps) {
  // Debug logging
  console.log('📊 ProjectViewSwitch Debug:');
  console.log('  - projects received:', projects?.length || 0);
  console.log('  - viewMode:', viewMode);
  console.log('  - selectedProject:', selectedProject?.name || 'null');
  
  const getProjectWithCompanyName = (project: Project) => {
    const company = companies.find(c => c.id === project.companyId);
    return {
      ...project,
      companyName: company?.name || project.company,
    };
  };

  if (viewMode === 'list') {
    return (
      <>
        <ProjectsList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            companies={companies}
        />
        {selectedProject && <ProjectDetails project={getProjectWithCompanyName(selectedProject)} />}
      </>
    );
  }

  return (
    <ProjectsGridView
      projects={projects}
      selectedProject={selectedProject}
      onSelectProject={onSelectProject}
      companies={companies}
    />
  );
}
