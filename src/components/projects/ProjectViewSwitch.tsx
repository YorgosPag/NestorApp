'use client';

import React, { useState, useCallback } from 'react';
import type { Project } from '@/types/project';
import type { ProjectStatus } from '@/constants/project-statuses';
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
import '@/lib/design-system';
import { gridPatterns } from '@/styles/design-tokens';

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
  /** ADR-300 §Addendum — draft-mode status pill persistence (Fill then Create) */
  onDraftStatusChange?: (next: ProjectStatus) => void;
  /** Trash mode — disables edit actions (items in trash are read-only) */
  isTrashMode?: boolean;
}

export function ProjectViewSwitch({
  projects, selectedProject, onSelectProject, companies, viewMode = 'list', initialTab, onNewProject, onDeleteProject, startInEditMode, isCreateMode, onProjectCreated, onCancelCreate, onDraftStatusChange, isTrashMode = false }: ProjectViewSwitchProps) {
  // 🏢 ENTERPRISE: Hooks must be called inside component body
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
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

  /**
   * 🔴 ADR-784 §10.7 / CHECK 3.28 — **ΤΟ ΣΥΡΤΑΡΙ ΤΟΥ ΚΙΝΗΤΟΥ ΓΡΑΦΟΤΑΝ ΔΥΟ ΦΟΡΕΣ.**
   *
   * Η προβολή πλέγματος και η προβολή λίστας κατέληγαν στο **ίδιο ακριβώς** συρτάρι με τις
   * λεπτομέρειες του έργου — δεκατέσσερις γραμμές props η καθεμία. Δύο αντίγραφα σημαίνει ότι
   * ένα prop μπορούσε να προστεθεί στο ένα και να **λείπει σιωπηλά** στο άλλο, δηλαδή η ίδια
   * οθόνη να συμπεριφέρεται αλλιώς ανάλογα με το πώς την άνοιξες.
   */
  const mobileSlideIn = (
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
          onDraftStatusChange={onDraftStatusChange}
          isTrashMode={isTrashMode}
        />
      )}
    </MobileDetailsSlideIn>
  );

  /** Ο ίδιος κατάλογος σε δύο δοχεία (desktop split · κινητό πλήρους πλάτους) — **μία** δήλωση. */
  const projectsListPanel = (
    <ProjectsList
      projects={projects}
      selectedProject={selectedProject}
      onSelectProject={(p) => onSelectProject(toggleSelect(selectedProject, p))}
      companies={companies}
      onNewProject={onNewProject}
      onEditProject={selectedProject && !isTrashMode ? handleEditProject : undefined}
      onDeleteProject={selectedProject && onDeleteProject ? () => onDeleteProject(selectedProject) : undefined}
    />
  );

  // 🏢 ENTERPRISE: Grid View Rendering - Using proper GridCard (PR: Enterprise Grid System)
  // Uses ProjectGridCard (vertical layout) for grid view
  if (viewMode === 'grid') {
    return (
      <>
        {/* 🖥️ DESKTOP & MOBILE: Grid layout */}
        <ScrollArea className="flex-1 w-full">
          <section
            className={cn(spacing.padding.sm, "grid", gridPatterns.cards.tile, spacing.gap.sm)}
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

        {mobileSlideIn}
      </>
    );
  }

  // 🏢 ENTERPRISE: List View (Original behavior)
  return (
    <>
      {/* 🖥️ DESKTOP: Standard split layout */}
      <div className={cn("hidden md:flex flex-1 min-h-0", spacing.gap.sm)}>
        {projectsListPanel}
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
          onDraftStatusChange={onDraftStatusChange}
          isTrashMode={isTrashMode}
        />
      </div>

      {/* 📱 MOBILE: Show only ProjectsList when no project is selected */}
      <div className={`md:hidden w-full ${selectedProject ? 'hidden' : 'block'}`}>
        {projectsListPanel}
      </div>

      {mobileSlideIn}
    </>
  );
}
