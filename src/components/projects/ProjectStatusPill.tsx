/**
 * 🏢 ProjectStatusPill — Inline interactive status pill for the project header.
 *
 * Linear/Gmail pattern: click the pill → popover with status options →
 * one-click change. Bypasses the form/auto-save path; calls the API directly
 * with optimistic update + rollback on error. Works regardless of edit mode,
 * because state ≠ form content.
 *
 * @see ADR-145 lifecycle (project status semantics)
 */

'use client';

import React, { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProjectBadge } from '@/core/badges/UnifiedBadgeSystem';
import { ACTIVE_PROJECT_STATUSES, type ProjectStatus } from '@/constants/project-statuses';
import { updateProjectClient } from '@/services/projects-client.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import '@/lib/design-system';

interface ProjectStatusPillProps {
  projectId: string;
  status: ProjectStatus;
  disabled?: boolean;
  onChange?: (next: ProjectStatus) => void;
}

// snake_case ProjectStatus → camelCase i18n key under `projects.status.*`
const STATUS_I18N_KEY: Record<ProjectStatus, string> = {
  planning: 'planning',
  in_progress: 'inProgress',
  completed: 'completed',
  on_hold: 'onHold',
  cancelled: 'cancelled',
  deleted: 'deleted',
};

export const ProjectStatusPill = React.memo(function ProjectStatusPill({
  projectId,
  status,
  disabled = false,
  onChange,
}: ProjectStatusPillProps) {
  const { t } = useTranslation('projects');
  const { error: notifyError } = useNotifications();
  const iconSizes = useIconSizes();

  const [optimisticStatus, setOptimisticStatus] = useState<ProjectStatus>(status);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Sync optimistic state when parent updates (e.g. realtime/refetch)
  React.useEffect(() => {
    setOptimisticStatus(status);
  }, [status]);

  const handleSelect = (next: ProjectStatus) => {
    if (next === optimisticStatus) {
      setOpen(false);
      return;
    }
    const previous = optimisticStatus;
    setOptimisticStatus(next);
    setOpen(false);

    startTransition(async () => {
      const result = await updateProjectClient(projectId, { status: next });
      if (!result.success) {
        setOptimisticStatus(previous);
        notifyError(t('statusPill.updateFailed'));
        return;
      }
      onChange?.(next);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled || isPending}>
        <button
          type="button"
          aria-label={t('statusPill.ariaLabel')}
          className={cn(
            'rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            (disabled || isPending) && 'opacity-60 cursor-not-allowed',
            !disabled && !isPending && 'cursor-pointer'
          )}
        >
          <ProjectBadge status={optimisticStatus} size="sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1">
        <ul role="listbox" aria-label={t('statusPill.ariaLabel')} className="flex flex-col">
          {ACTIVE_PROJECT_STATUSES.map((value) => {
            const isSelected = value === optimisticStatus;
            return (
              <li key={value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(value)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    isSelected && 'bg-accent/60'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <ProjectBadge status={value} size="sm" />
                  </span>
                  {isSelected && <Check className={iconSizes.sm} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
});
