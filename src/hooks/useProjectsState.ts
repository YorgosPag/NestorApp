'use client';

import { useState, useEffect } from 'react';
import type { Project } from '@/types/project';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type ProjectUpdatedPayload } from '@/services/realtime';
import { createModuleLogger } from '@/lib/telemetry';
import { applyUpdates } from '@/lib/utils';

const logger = createModuleLogger('useProjectsState');

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

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Uses RealtimeService.subscribeToProjectUpdates() for cross-page sync
  useEffect(() => {
    const handleProjectUpdate = (payload: ProjectUpdatedPayload) => {
      logger.info('Applying update for project', { projectId: payload.projectId });

      setProjects(prev => prev.map(project =>
        project.id === payload.projectId
          ? applyUpdates(project, payload.updates)
          : project
      ));

      // Also update selectedProject if it's the one being updated
      setSelectedProject(prev =>
        prev?.id === payload.projectId
          ? applyUpdates(prev, payload.updates)
          : prev
      );
    };

    // Subscribe to project updates (same-page + cross-page)
    const unsubscribe = RealtimeService.subscribe('PROJECT_UPDATED', handleProjectUpdate, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, []);
  const [viewMode, setViewMode] = useState<'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDashboard, setShowDashboard] = useState(false);

  return {
    projects,
    setProjects,
    selectedProject,
    setSelectedProject,
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
