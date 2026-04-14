
'use client';

import React, { useState, useMemo } from 'react';
import { useSortState } from '@/hooks/useSortState';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Project } from '@/types/project';
import type { NavigationCompany } from '@/components/navigation/core/types';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ProjectListCard } from '@/domain';
import { CompactToolbar, projectsConfig } from '@/components/core/CompactToolbar';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { EntityListColumn } from '@/core/containers';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: ADR-147 unified share surface + project formatter SSoT
import { ShareModal } from '@/components/ui/ShareModal';
import { formatProjectsForShare, type ProjectShareData } from '@/lib/sharing/format-project-share';

// 🏢 ENTERPRISE: Sort types from CompactToolbar
import type { SortField } from '@/components/core/CompactToolbar/types';
import '@/lib/design-system';

interface ProjectsListProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject?: (project: Project) => void;
  companies: NavigationCompany[];
  onNewProject?: () => void;
  onEditProject?: () => void;
  onDeleteProject?: () => void;
}

export function ProjectsList({
  projects,
  selectedProject,
  onSelectProject,
  companies: _companies,
  onNewProject,
  onEditProject,
  onDeleteProject,
}: ProjectsListProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: Using string IDs for Firebase compatibility
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // 🏢 ENTERPRISE: ADR-147 Phase C — Project sharing via unified share surface
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<ProjectShareData>({ title: '', text: '', url: '' });

  const handleShareProject = React.useCallback(() => {
    if (!selectedProject) return;
    const payload = formatProjectsForShare([selectedProject], t);
    setShareData(payload);
    setShareModalOpen(true);
  }, [selectedProject, t]);

  // 🏢 ENTERPRISE: Sort state via centralized hook (ADR-205 Phase 4)
  const { sortBy, sortOrder, onSortChange } = useSortState<SortField>('name');

  const toggleFavorite = (projectId: string) => {
    setFavorites(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  // 🏢 ENTERPRISE: Sorted projects with memoization
  const displayProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    const sorted = [...projects].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '', 'el');
          break;
        case 'date': {
          // 🏢 ENTERPRISE: Use startDate or lastUpdate for date sorting
          const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0);
          const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0);
          comparison = dateA - dateB;
          break;
        }
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '', 'el');
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [projects, sortBy, sortOrder]);


  return (
    <EntityListColumn hasBorder aria-label={t('list.ariaLabel')}>
      <GenericListHeader
        icon={NAVIGATION_ENTITIES.project.icon}
        entityName={t('list.entityName')}
        itemCount={displayProjects.length}
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
      <div className="hidden md:block">
        <CompactToolbar
          config={projectsConfig}
          selectedItems={selectedProject ? [selectedProject.id] : []}
          hasSelectedContact={!!selectedProject}
          sortBy={sortBy}
          onFiltersChange={() => {}}
          onSortChange={onSortChange}
          onNewItem={onNewProject}
          onEditItem={onEditProject ? (_id: string) => onEditProject() : undefined}
          onDeleteItems={onDeleteProject ? (_ids: string[]) => onDeleteProject() : undefined}
          onShare={handleShareProject}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={projectsConfig}
            selectedItems={selectedProject ? [selectedProject.id] : []}
            hasSelectedContact={!!selectedProject}
            sortBy={sortBy}
            onFiltersChange={() => {}}
            onSortChange={onSortChange}
            onNewItem={onNewProject}
            onEditItem={onEditProject ? (_id: string) => onEditProject() : undefined}
            onDeleteItems={onDeleteProject ? (_ids: string[]) => onDeleteProject() : undefined}
          />
        )}
      </div>

      <ScrollArea className="flex-1 overflow-y-auto w-full">
        <div className={cn(spacing.padding.sm, spacing.spaceBetween.sm, "min-h-0 w-full")}>
          {displayProjects.map((project: Project) => (
            <div key={project.id} className="shrink-0 w-full">
              <ProjectListCard
                project={project}
                isSelected={selectedProject?.id === project.id}
                isFavorite={favorites.includes(project.id)}
                onSelect={() => onSelectProject?.(project)}
                onToggleFavorite={() => toggleFavorite(project.id)}
              />
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* 🏢 ENTERPRISE: ADR-147 Phase C — unified share modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        shareData={shareData}
      />
    </EntityListColumn>
  );
}
