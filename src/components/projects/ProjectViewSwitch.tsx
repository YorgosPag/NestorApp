'use client';

import React, { useState, useCallback } from 'react';
import type { Project } from '@/types/project';
import type { NavigationCompany } from '@/components/navigation/core/types';
import { Trash2 } from 'lucide-react';
import { ProjectsList } from './projects-list';
import { ProjectDetails } from './project-details';
import { MobileDetailsSlideIn } from '@/core/layouts';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { toggleSelect } from '@/lib/toggle-select';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
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
  viewMode?: ProjectsViewMode;
  /** Deep-link initial tab — forwarded to ProjectDetails → UniversalTabsRenderer */
  initialTab?: string;
  onNewProject?: () => void;
  onDeleteProject?: (project: Project) => void;
  /** Start in edit mode (for inline project creation) */
  startInEditMode?: boolean;
  /** 🏢 ENTERPRISE: "Fill then Create" — form is in create mode */
  isCreateMode?: boolean;
  /** Callback after successful creation — receives real Firestore project ID */
  onProjectCreated?: (projectId: string) => void;
  /** Callback to cancel create mode */
  onCancelCreate?: () => void;
}

export function ProjectViewSwitch({
  projects, selectedProject, onSelectProject, companies, viewMode = 'list', initialTab, onNewProject, onDeleteProject, startInEditMode, isCreateMode, onProjectCreated, onCancelCreate }: ProjectViewSwitchProps) {
  // 🏢 ENTERPRISE: Hooks must be called inside component body
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Lifted edit state — shared between CompactToolbar and ProjectDetails
  const [isEditingProject, setIsEditingProject] = useState(false);

  const handleEditProject = useCallback(() => {
    setIsEditingProject(true);
  }, []);

  // Reset or activate edit mode when selected project changes
  React.useEffect(() => {
    setIsEditingProject(!!startInEditMode);
  }, [selectedProject?.id, startInEditMode]);

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
    const company = companies?.find(c => c.id === project.linkedCompanyId);
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
            className={cn(spacing.padding.sm, "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", spacing.gap.sm)}
            aria-label={t('grid.ariaLabel')}
          >
            {projects.map((project: Project) => (
              <ProjectGridCard
                key={project.id}
                project={project}
                isSelected={selectedProject?.id === project.id}
                isFavorite={favorites.includes(project.id)}
                onSelect={() => onSelectProject(toggleSelect(selectedProject, project))}
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
            <button
              onClick={() => selectedProject && onDeleteProject?.(selectedProject)}
              className={cn(spacing.padding.sm, "rounded-md border border-border text-destructive", colors.bg.primary, INTERACTIVE_PATTERNS.SUBTLE_HOVER)}
              aria-label={t('viewSwitch.deleteLabel')}
            >
              <Trash2 className={iconSizes.sm} />
            </button>
          }
        >
          {selectedProject && (
            <ProjectDetails
              project={getProjectWithCompanyName(selectedProject)}
              initialTab={initialTab}
              onNewProject={onNewProject}
              onDeleteProject={onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
              isEditing={isEditingProject}
            onSetEditing={setIsEditingProject}
            isCreateMode={isCreateMode}
            onProjectCreated={onProjectCreated}
            onCancelCreate={onCancelCreate}
            />
          )}
        </MobileDetailsSlideIn>
      </>
    );
  }

  // 🏢 ENTERPRISE: List View (Original behavior)
  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className={cn("hidden md:flex flex-1 min-h-0", spacing.gap.sm)}>
        <ProjectsList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={(p) => onSelectProject(toggleSelect(selectedProject, p))}
            companies={companies}
            onNewProject={onNewProject}
            onEditProject={selectedProject ? handleEditProject : undefined}
            onDeleteProject={selectedProject && onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
        />
        <ProjectDetails
          project={selectedProject ? getProjectWithCompanyName(selectedProject) : null}
          initialTab={initialTab}
          onNewProject={onNewProject}
          onDeleteProject={selectedProject && onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
          isEditing={isEditingProject}
          onSetEditing={setIsEditingProject}
          isCreateMode={isCreateMode}
          onProjectCreated={onProjectCreated}
          onCancelCreate={onCancelCreate}
        />
      </div>

      {/* 📱 MOBILE: Show only ProjectsList when no project is selected */}
      <div className={`md:hidden w-full ${selectedProject ? 'hidden' : 'block'}`}>
        <ProjectsList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={(p) => onSelectProject(toggleSelect(selectedProject, p))}
            companies={companies}
            onNewProject={onNewProject}
            onEditProject={selectedProject ? handleEditProject : undefined}
            onDeleteProject={selectedProject && onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
        />
      </div>

      {/* 📱 MOBILE: Slide-in ProjectDetails when project is selected */}
      <MobileDetailsSlideIn
        isOpen={!!selectedProject}
        onClose={() => onSelectProject(null)}
        title={selectedProject ? getProjectWithCompanyName(selectedProject).name : t('viewSwitch.detailsTitle')}
        actionButtons={
          <button
            onClick={() => selectedProject && onDeleteProject?.(selectedProject)}
            className={cn(spacing.padding.sm, "rounded-md border border-border text-destructive", colors.bg.primary, INTERACTIVE_PATTERNS.SUBTLE_HOVER)}
            aria-label={t('viewSwitch.deleteLabel')}
          >
            <Trash2 className={iconSizes.sm} />
          </button>
        }
      >
        {selectedProject && (
          <ProjectDetails
            project={getProjectWithCompanyName(selectedProject)}
            initialTab={initialTab}
            onNewProject={onNewProject}
            onDeleteProject={onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
            isEditing={isEditingProject}
            onSetEditing={setIsEditingProject}
            isCreateMode={isCreateMode}
            onProjectCreated={onProjectCreated}
            onCancelCreate={onCancelCreate}
          />
        )}
      </MobileDetailsSlideIn>
    </>
  );
}
