'use client';

/**
 * Projects Statistics — thin wrapper over useEntityStats
 * @module hooks/useProjectsStats
 */

import { useMemo, useCallback } from 'react';
import type { Project } from '@/types/project';
import { useEntityStats, countBy, avgRounded } from './useEntityStats';

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

const ACTIVE_STATUSES = ['in_progress', 'planning'];
const COMPLETED_STATUSES = ['completed'];

const getArea = (p: Project): number =>
  (p as { totalArea?: number; area?: number }).totalArea
  ?? (p as { totalArea?: number; area?: number }).area
  ?? 0;

const getValue = (p: Project): number => p.budget || 0;
const getStatus = (p: Project): string => p.status || 'unknown';
const getType = (p: Project): string => p.type || 'unknown';

export function useProjectsStats(projects: Project[]): ProjectsStats {
  const base = useEntityStats(projects, { getArea, getValue, getStatus, getType });

  const getProgress = useCallback((p: Project) => (p as { progress?: number }).progress ?? 0, []);

  const stats = useMemo<ProjectsStats>(() => {
    if (base.total === 0) {
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
        projectsByType: {},
      };
    }

    const activeProjects = countBy(projects, p => ACTIVE_STATUSES.includes(p.status));
    const completedProjects = countBy(projects, p => COMPLETED_STATUSES.includes(p.status));
    const progressSum = projects.reduce((sum, p) => sum + getProgress(p), 0);

    return {
      totalProjects: base.total,
      activeProjects,
      completedProjects,
      totalBudget: base.totalValue,
      averageBudget: base.averageValue,
      totalValue: base.totalValue,
      totalArea: base.totalArea,
      averageProgress: avgRounded(progressSum, base.total),
      projectsByStatus: base.byStatus,
      projectsByType: base.byType,
    };
  }, [base, projects, getProgress]);

  return stats;
}
