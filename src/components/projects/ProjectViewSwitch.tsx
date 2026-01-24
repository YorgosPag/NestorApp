'use client';

import React, { useState } from 'react';
import type { Project } from '@/types/project';
import type { NavigationCompany } from '@/components/navigation/core/types';
import { Edit, Trash2 } from 'lucide-react';
import { ProjectsList } from './projects-list';
import { ProjectDetails } from './project-details';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Grid view imports - Using proper GridCard (PR: Enterprise Grid System)
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProjectGridCard } from '@/domain';

// 🏢 ENTERPRISE: View mode type (matches useProjectsPageState)
type ProjectsViewMode = 'list' | 'grid' | 'byType' | 'byStatus';

interface ProjectViewSwitchProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project | null) => void;
  companies: NavigationCompany[];
  // 🏢 ENTERPRISE: Added viewMode prop for grid/list switching (PR: Projects Grid View)
  viewMode?: ProjectsViewMode;
}

export function ProjectViewSwitch({
  projects, selectedProject, onSelectProject, companies, viewMode = 'list' }: ProjectViewSwitchProps) {
  // 🏢 ENTERPRISE: Hooks must be called inside component body
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Favorites state for grid view (PR: Projects Grid View)
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = (projectId: string) => {
    setFavorites(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const getProjectWithCompanyName = (project: Project) => {
    const company = companies?.find(c => c.id === project.companyId);
    return {
      ...project,
      companyName: company?.companyName || project.company,
    };
  };

  // 🏢 ENTERPRISE: Grid View Rendering - Using proper GridCard (PR: Enterprise Grid System)
  // Uses ProjectGridCard (vertical layout) for grid view
  if (viewMode === 'grid') {
    return (
      <>
        {/* 🖥️ DESKTOP & MOBILE: Grid layout */}
        <ScrollArea className="flex-1 w-full">
          <section
            className="p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2"
            aria-label={t('grid.ariaLabel')}
          >
            {projects.map((project: Project) => (
              <ProjectGridCard
                key={project.id}
                project={project}
                isSelected={selectedProject?.id === project.id}
                isFavorite={favorites.includes(project.id)}
                onSelect={() => onSelectProject(project)}
                onToggleFavorite={() => toggleFavorite(project.id)}
              />
            ))}
          </section>
        </ScrollArea>

        {/* 📱 MOBILE: Slide-in ProjectDetails when project is selected */}
        <MobileDetailsSlideIn
          isOpen={!!selectedProject}
          onClose={() => onSelectProject(null)}
          title={selectedProject ? getProjectWithCompanyName(selectedProject).name : t('viewSwitch.detailsTitle')}
          actionButtons={
            <>
              <button
                onClick={() => {/* TODO: Edit project handler */}}
                className={`p-2 rounded-md border ${colors.bg.primary} border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                aria-label={t('viewSwitch.editLabel')}
              >
                <Edit className={iconSizes.sm} />
              </button>
              <button
                onClick={() => {/* TODO: Delete project handler */}}
                className={`p-2 rounded-md border ${colors.bg.primary} border-border text-destructive ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                aria-label={t('viewSwitch.deleteLabel')}
              >
                <Trash2 className={iconSizes.sm} />
              </button>
            </>
          }
        >
          {selectedProject && <ProjectDetails project={getProjectWithCompanyName(selectedProject)} />}
        </MobileDetailsSlideIn>
      </>
    );
  }

  // 🏢 ENTERPRISE: List View (Original behavior)
  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className="hidden md:flex flex-1 gap-2 min-h-0">
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
        title={selectedProject ? getProjectWithCompanyName(selectedProject).name : t('viewSwitch.detailsTitle')}
        actionButtons={
          <>
            <button
              onClick={() => {/* TODO: Edit project handler */}}
              className={`p-2 rounded-md border ${colors.bg.primary} border-border ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              aria-label={t('viewSwitch.editLabel')}
            >
              <Edit className={iconSizes.sm} />
            </button>
            <button
              onClick={() => {/* TODO: Delete project handler */}}
              className={`p-2 rounded-md border ${colors.bg.primary} border-border text-destructive ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
              aria-label={t('viewSwitch.deleteLabel')}
            >
              <Trash2 className={iconSizes.sm} />
            </button>
          </>
        }
      >
        {selectedProject && <ProjectDetails project={getProjectWithCompanyName(selectedProject)} />}
      </MobileDetailsSlideIn>
    </>
  );
}
