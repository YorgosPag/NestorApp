
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Project } from '@/types/project';
import type { NavigationCompany } from '@/components/navigation/core/types';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ProjectListCard } from '@/domain';
import { CompactToolbar, projectsConfig } from '@/components/core/CompactToolbar';
import { Briefcase } from 'lucide-react';
import { EntityListColumn } from '@/core/containers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Sort types from CompactToolbar
import type { SortField } from '@/components/core/CompactToolbar/types';
type SortDirection = 'asc' | 'desc';

interface ProjectsListProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject?: (project: Project) => void;
  companies: NavigationCompany[];
}

export function ProjectsList({
  projects,
  selectedProject,
  onSelectProject,
  companies,
}: ProjectsListProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('projects');
  // 🏢 ENTERPRISE: Using string IDs for Firebase compatibility
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // 🏢 ENTERPRISE: Sorting state
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const toggleFavorite = (projectId: string) => {
    setFavorites(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  // 🏢 ENTERPRISE: Sort handler
  const handleSortChange = useCallback((field: SortField, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
  }, []);

  // 🏢 ENTERPRISE: Sorted projects with memoization
  const displayProjects = useMemo(() => {
    if (!projects || projects.length === 0) return [];

    const sorted = [...projects].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '', 'el');
          break;
        case 'date':
          // 🏢 ENTERPRISE: Use startDate or lastUpdate for date sorting
          const dateA = a.startDate ? new Date(a.startDate).getTime() : (a.lastUpdate ? new Date(a.lastUpdate).getTime() : 0);
          const dateB = b.startDate ? new Date(b.startDate).getTime() : (b.lastUpdate ? new Date(b.lastUpdate).getTime() : 0);
          comparison = dateA - dateB;
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '', 'el');
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [projects, sortBy, sortDirection]);


  return (
    <EntityListColumn hasBorder aria-label={t('list.ariaLabel')}>
      <GenericListHeader
        icon={Briefcase}
        entityName={t('list.entityName')}
        itemCount={displayProjects.length}
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
      <div className="hidden md:block">
        <CompactToolbar
          config={projectsConfig}
          sortBy={sortBy}
          onFiltersChange={() => {}}
          onSortChange={handleSortChange}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={projectsConfig}
            sortBy={sortBy}
            onFiltersChange={() => {}}
            onSortChange={handleSortChange}
          />
        )}
      </div>

      <ScrollArea className="flex-1 overflow-y-auto w-full">
        <div className="p-2 space-y-2 min-h-0 w-full">
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
    </EntityListColumn>
  );
}
