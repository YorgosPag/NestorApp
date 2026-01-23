'use client';

import { useMemo } from 'react';
import type { Project } from '@/types/project';

export interface ProjectsStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalBudget: number;
  averageBudget: number;
  /** Total value of all projects (alias for totalBudget) */
  totalValue: number;
  /** Total area in square meters across all projects */
  totalArea: number;
  /** Average progress percentage (0-100) across all projects */
  averageProgress: number;
  projectsByStatus: { [key: string]: number };
  projectsByType: { [key: string]: number };
}

export function useProjectsStats(projects: Project[]): ProjectsStats {
  const stats = useMemo(() => {
    if (!projects || projects.length === 0) {
      return {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        totalBudget: 0,
        averageBudget: 0,
        totalValue: 0,
        totalArea: 0,
        averageProgress: 0,
        projectsByStatus: {},
        projectsByType: {}
      };
    }

    const activeStatuses = ['in_progress', 'planning'];
    const completedStatuses = ['completed'];

    const activeProjects = projects.filter(p => activeStatuses.includes(p.status)).length;
    const completedProjects = projects.filter(p => completedStatuses.includes(p.status)).length;

    const totalBudget = projects.reduce((sum, project) => sum + (project.budget || 0), 0);
    const averageBudget = projects.length > 0 ? totalBudget / projects.length : 0;

    // Calculate total area (from project totalArea or area property)
    const totalArea = projects.reduce((sum, project) => {
      const area = (project as { totalArea?: number; area?: number }).totalArea
        ?? (project as { totalArea?: number; area?: number }).area
        ?? 0;
      return sum + area;
    }, 0);

    // Calculate average progress (from project progress property)
    const progressSum = projects.reduce((sum, project) => {
      const progress = (project as { progress?: number }).progress ?? 0;
      return sum + progress;
    }, 0);
    const averageProgress = projects.length > 0 ? Math.round(progressSum / projects.length) : 0;

    // Count by status
    const projectsByStatus: { [key: string]: number } = {};
    projects.forEach(project => {
      const status = project.status || 'unknown';
      projectsByStatus[status] = (projectsByStatus[status] || 0) + 1;
    });

    // Count by type
    const projectsByType: { [key: string]: number } = {};
    projects.forEach(project => {
      const type = project.type || 'unknown';
      projectsByType[type] = (projectsByType[type] || 0) + 1;
    });

    return {
      totalProjects: projects.length,
      activeProjects,
      completedProjects,
      totalBudget,
      averageBudget,
      totalValue: totalBudget, // Alias for dashboard display
      totalArea,
      averageProgress,
      projectsByStatus,
      projectsByType
    };
  }, [projects]);

  return stats;
}