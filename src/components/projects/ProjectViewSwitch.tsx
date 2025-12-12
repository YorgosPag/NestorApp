'use client';

import React from 'react';
import type { Project } from '@/types/project';
import { Edit, Trash2 } from 'lucide-react';
import { ProjectsList } from './projects-list';
import { ProjectDetails } from './project-details';
import { MobileDetailsSlideIn } from '@/core/layouts';

interface ProjectViewSwitchProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  companies: { id: string; name: string }[];
}

export function ProjectViewSwitch({ projects, selectedProject, onSelectProject, companies }: ProjectViewSwitchProps) {

  const getProjectWithCompanyName = (project: Project) => {
    const company = companies?.find(c => c.id === project.companyId);
    return {
      ...project,
      companyName: company?.name || project.company,
    };
  };

  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className="hidden md:flex flex-1 gap-4 min-h-0">
        <ProjectsList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            companies={companies}
        />
        {selectedProject && <ProjectDetails project={getProjectWithCompanyName(selectedProject)} />}
      </div>

      {/* 📱 MOBILE: Show only ProjectsList when no project is selected */}
      <div className={`md:hidden w-full ${selectedProject ? 'hidden' : 'block'}`}>
        <ProjectsList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            companies={companies}
        />
      </div>

      {/* 📱 MOBILE: Slide-in ProjectDetails when project is selected */}
      <MobileDetailsSlideIn
        isOpen={!!selectedProject}
        onClose={() => onSelectProject(null)}
        title={selectedProject ? getProjectWithCompanyName(selectedProject).name : 'Λεπτομέρειες Έργου'}
        actionButtons={
          <>
            <button
              onClick={() => {/* TODO: Edit project handler */}}
              className="p-2 rounded-md border transition-colors bg-background border-border hover:bg-accent"
              aria-label="Επεξεργασία Έργου"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => {/* TODO: Delete project handler */}}
              className="p-2 rounded-md border transition-colors bg-background border-border hover:bg-accent text-destructive hover:text-destructive"
              aria-label="Διαγραφή Έργου"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        }
      >
        {selectedProject && <ProjectDetails project={getProjectWithCompanyName(selectedProject)} />}
      </MobileDetailsSlideIn>
    </>
  );
}
