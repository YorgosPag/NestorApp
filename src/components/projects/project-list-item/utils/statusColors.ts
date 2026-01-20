// 🏢 ENTERPRISE: Project status color mapping using semantic colors
import type { ProjectStatus } from "../types";
import type { UseSemanticColorsReturn } from '@/hooks/useSemanticColors';

/**
 * 🏢 ENTERPRISE: Get status color class for project status
 * Uses Dependency Injection pattern - colors passed as parameter
 *
 * Semantic mapping:
 * - planning → pending (yellow - waiting to start)
 * - in_progress → active (green - currently active)
 * - completed → completed (blue - finished successfully)
 * - on_hold → inactive (gray - paused/waiting)
 * - cancelled → cancelled (red - stopped/failed)
 */
export const getStatusColorClass = (status: ProjectStatus, colors: UseSemanticColorsReturn): string => {
  const STATUS_MAP: Record<ProjectStatus, string> = {
    planning:    `${colors.status.pending.bg} ${colors.status.pending.text} ${colors.status.pending.border}`,
    in_progress: `${colors.status.active.bg} ${colors.status.active.text} ${colors.status.active.border}`,
    completed:   `${colors.status.completed.bg} ${colors.status.completed.text} ${colors.status.completed.border}`,
    on_hold:     `${colors.status.inactive.bg} ${colors.status.inactive.text} ${colors.status.inactive.border}`,
    cancelled:   `${colors.status.cancelled.bg} ${colors.status.cancelled.text} ${colors.status.cancelled.border}`,
  };

  return STATUS_MAP[status];
};
