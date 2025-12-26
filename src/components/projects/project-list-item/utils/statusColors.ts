
import type { ProjectStatus } from "../types";
import { useSemanticColors } from '@/hooks/useSemanticColors';

export const getStatusColorClass = (status: ProjectStatus) => {
  const colors = useSemanticColors();

  const STATUS_MAP: Record<ProjectStatus, string> = {
    planning:    `${colors.status.warning.bg} ${colors.status.warning.text} ${colors.status.warning.border}`,
    in_progress: `${colors.status.info.bg} ${colors.status.info.text} ${colors.status.info.border}`,
    completed:   `${colors.status.success.bg} ${colors.status.success.text} ${colors.status.success.border}`,
    on_hold:     `${colors.status.muted.bg} ${colors.status.muted.text} ${colors.status.muted.border}`,
    cancelled:   `${colors.status.error.bg} ${colors.status.error.text} ${colors.status.error.border}`,
  };

  return STATUS_MAP[status];
};
