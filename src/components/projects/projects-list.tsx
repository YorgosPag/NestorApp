
'use client';

import React, { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProjectToolbar } from './ProjectToolbar';
import type { Project, ProjectSortKey } from '@/types/project';
import { ProjectListHeader } from './list/ProjectListHeader';
import { ProjectListItem } from './project-list-item'; // Updated import path

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
  // Debug logging
  console.log('📋 ProjectsList Debug:');
  console.log('  - projects received:', projects?.length || 0);
  console.log('  - projects data:', projects);
  console.log('  - selectedProject:', selectedProject?.name || 'null');
  
  const [favorites, setFavorites] = useState<number[]>([1]);
  const [sortBy, setSortBy] = useState<ProjectSortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const toggleFavorite = (projectId: number) => {
    setFavorites(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };
  
  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return [...projects].sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'progress':
          aValue = a.progress;
          bValue = b.progress;
          break;
        case 'totalValue':
          aValue = a.totalValue;
          bValue = b.totalValue;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
      return 0;
    });
  }, [projects, sortBy, sortOrder]);


  return (
    <div className="min-w-[300px] max-w-[420px] w-full bg-card border rounded-lg flex flex-col shrink-0 shadow-sm h-fit overflow-hidden">
      <ProjectListHeader 
        projects={sortedProjects || []}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
      />

      <ProjectToolbar />

      <ScrollArea className="flex-1 overflow-y-auto w-full">
        <div className="p-2 space-y-2 min-h-0 w-full">
          {sortedProjects.map((project: Project) => (
            <div key={project.id} className="shrink-0 w-full">
              <ProjectListItem
                project={project}
                isSelected={selectedProject?.id === project.id}
                isFavorite={favorites.includes(project.id)}
                onSelect={() => onSelectProject?.(project)}
                onToggleFavorite={() => toggleFavorite(project.id)}
                companyName={companies.find(c => c.id === project.companyId)?.name || project.company}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
