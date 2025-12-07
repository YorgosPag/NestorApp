'use client';

import { useState, useEffect } from 'react';
import type { Project } from '@/types/project';

export function useProjectsState(initialProjects: Project[]) {
  
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
  const [viewMode, setViewMode] = useState<'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDashboard, setShowDashboard] = useState(false);

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
