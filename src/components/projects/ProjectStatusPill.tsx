/**
 * 🏢 ProjectStatusPill — Inline interactive status pill for the project header.
 *
 * Linear/Notion pattern: click the pill → popover with status options →
 * one-click change. Works in two modes:
 *
 *   - `draft=false` (default): persisted entity — calls `updateProjectClient`
 *     with optimistic update + rollback on error. Runs regardless of edit
 *     mode, because status is not a form field anymore.
 *   - `draft=true`: pre-create entity — skips the API entirely and delegates
 *     persistence to the parent via `onChange`. The same component drives
 *     both read/edit and "Fill then Create" flows (ADR-300 §Addendum).
 *
 * @see ADR-145 lifecycle (project status semantics)
 * @see ADR-300 status pill information architecture
 */

'use client';

import React, { useState, useTransition } from 'react';
import { Check, CircleDashed } from 'lucide-react';
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
  status: ProjectStatus | '';
  disabled?: boolean;
  /**
   * When true, the pill skips the API call and delegates persistence to the
   * parent via `onChange`. Used by the "Fill then Create" flow where the
   * project has no Firestore id yet.
   */
  draft?: boolean;
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
  draft = false,
  onChange,
}: ProjectStatusPillProps) {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const { error: notifyError } = useNotifications();
  const iconSizes = useIconSizes();

  const [optimisticStatus, setOptimisticStatus] = useState<ProjectStatus | ''>(status);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Sync optimistic state when parent updates (e.g. realtime/refetch, or the
  // draft project rehydrating from the page-level selectedProject store).
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

    // Draft mode: the project has no Firestore id yet — persistence happens
    // at form submit time. Delegate to the parent so it can update the draft
    // store (projects-page-content → selectedProject).
    if (draft) {
      onChange?.(next);
      return;
    }

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

  const isEmpty = optimisticStatus === '';

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
          {isEmpty ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-dashed',
                'border-muted-foreground/40 px-2.5 py-0.5 text-xs font-medium',
                'text-muted-foreground hover:border-muted-foreground/70 hover:text-foreground'
              )}
            >
              <CircleDashed className={iconSizes.xs} aria-hidden="true" />
              {t('statusPill.placeholder')}
            </span>
          ) : (
            <ProjectBadge status={optimisticStatus} size="sm" />
          )}
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
