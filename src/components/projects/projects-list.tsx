
'use client';

import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Project } from '@/types/project';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { ProjectListCard } from '@/domain';
import { CompactToolbar, projectsConfig } from '@/components/core/CompactToolbar';
import { Briefcase } from 'lucide-react';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface ProjectsListProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject?: (project: Project) => void;
  companies: { id: string; name: string }[];
}

export function ProjectsList({
  projects,
  selectedProject,
  onSelectProject,
  companies,
}: ProjectsListProps) {
  const { quick } = useBorderTokens();

  const [favorites, setFavorites] = useState<number[]>([1]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showToolbar, setShowToolbar] = useState(false);

  const toggleFavorite = (projectId: number) => {
    setFavorites(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };
  
  // Use projects directly since CompactToolbar handles filtering and sorting
  const displayProjects = projects || [];


  return (
    <div className={`min-w-[300px] max-w-[420px] w-full bg-card ${quick.card} flex flex-col shrink-0 shadow-sm h-fit overflow-hidden`}>
      <GenericListHeader
        icon={Briefcase}
        entityName="Έργα"
        itemCount={displayProjects.length}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Αναζήτηση έργων..."
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
      <div className="hidden md:block">
        <CompactToolbar
          config={projectsConfig}
          data={displayProjects}
          onFiltersChange={() => {}}
          onSortChange={() => {}}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={projectsConfig}
            data={displayProjects}
            onFiltersChange={() => {}}
            onSortChange={() => {}}
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
    </div>
  );
}
