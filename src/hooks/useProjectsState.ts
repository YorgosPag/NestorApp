'use client';

import { useState, useEffect } from 'react';
import type { Project } from '@/types/project';

export function useProjectsState(initialProjects: Project[]) {
  console.log('🎯 useProjectsState Debug:');
  console.log('  - initialProjects received:', initialProjects?.length || 0);
  console.log('  - initialProjects data:', initialProjects);
  
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    initialProjects && initialProjects.length > 0 ? initialProjects[0] : null
  );

  // Update projects when initialProjects changes
  useEffect(() => {
    setProjects(initialProjects);
    if (initialProjects && initialProjects.length > 0 && !selectedProject) {
      setSelectedProject(initialProjects[0]);
    }
  }, [initialProjects, selectedProject]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDashboard, setShowDashboard] = useState(true);

  return {
    projects,
    setProjects,
    selectedProject,
    setSelectedProject: setSelectedProject as (project: Project | null) => void,
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    filterCompany,
    setFilterCompany,
    filterStatus,
    setFilterStatus,
    showDashboard,
    setShowDashboard,
  };
}
