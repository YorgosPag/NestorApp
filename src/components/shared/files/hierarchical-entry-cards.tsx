/**
 * Sub-components for HierarchicalEntryPointSelector (ADR-191)
 * Entry card and Group card render components, extracted for file-size compliance.
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import * as LucideIcons from 'lucide-react';
import type { UploadEntryPoint } from '@/config/upload-entry-points';
import { getStudyGroupMeta, type StudyGroupMeta, type StudyGroup } from '@/config/study-groups-config';
import '@/lib/design-system';

// ============================================================================
// HELPERS
// ============================================================================

export const getIcon = (iconName?: string): LucideIcons.LucideIcon => {
  if (!iconName) return LucideIcons.File;
  const icons: Record<string, LucideIcons.LucideIcon | undefined> =
    LucideIcons as unknown as Record<string, LucideIcons.LucideIcon | undefined>;
  return icons[iconName] ?? LucideIcons.File;
};

// ============================================================================
// ENTRY CARD
// ============================================================================

export interface EntryCardProps {
  entryPoint: UploadEntryPoint;
  isSelected: boolean;
  currentLanguage: 'el' | 'en';
  showGroupBadge?: boolean;
  onSelect: (entryPoint: UploadEntryPoint) => void;
  freeTitleLabel: string;
}

export function EntryCard({
  entryPoint,
  isSelected,
  currentLanguage,
  showGroupBadge = false,
  onSelect,
  freeTitleLabel,
}: EntryCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const Icon = getIcon(entryPoint.icon);
  const isCustomTitle = entryPoint.requiresCustomTitle === true;
  const groupMeta = entryPoint.group ? getStudyGroupMeta(entryPoint.group) : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onSelect(entryPoint)}
          className={cn(
            'relative flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all',
            'hover:shadow-md hover:scale-105',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            isSelected
              ? 'border-primary bg-primary/10 shadow-md scale-105'
              : isCustomTitle
                ? 'border-dashed border-amber-400 bg-amber-50 hover:border-amber-500 dark:border-amber-600 dark:bg-amber-950/30 dark:hover:border-amber-500'
                : 'border-border bg-card hover:border-primary/50'
          )}
          role="radio"
          aria-checked={isSelected}
          aria-label={entryPoint.label[currentLanguage]}
        >
          <div
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-full',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : isCustomTitle
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                  : `bg-muted ${colors.text.muted}`
            )}
          >
            <Icon className={iconSizes.md} aria-hidden="true" />
          </div>

          <span
            className={cn(
              'text-xs font-medium text-center leading-tight',
              isSelected
                ? 'text-primary'
                : isCustomTitle
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-foreground'
            )}
          >
            {entryPoint.label[currentLanguage]}
          </span>

          {isCustomTitle && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
              {freeTitleLabel}
            </span>
          )}

          {showGroupBadge && groupMeta && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', groupMeta.bgClass, groupMeta.colorClass)}>
              {groupMeta.label[currentLanguage]}
            </span>
          )}

          {isSelected && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
          )}
        </button>
      </TooltipTrigger>
      {entryPoint.description?.[currentLanguage] && (
        <TooltipContent>{entryPoint.description[currentLanguage]}</TooltipContent>
      )}
    </Tooltip>
  );
}

// ============================================================================
// GROUP CARD
// ============================================================================

export interface GroupCardProps {
  group: StudyGroupMeta;
  count: number;
  currentLanguage: 'el' | 'en';
  onGroupClick: (group: StudyGroup) => void;
  entriesCountLabel: string;
}

export function GroupCard({
  group,
  count: _count,
  currentLanguage,
  onGroupClick,
  entriesCountLabel,
}: GroupCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const Icon = getIcon(group.icon);

  return (
    <button
      type="button"
      onClick={() => onGroupClick(group.group)}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border-2 border-l-4 transition-all',
        'hover:shadow-md hover:scale-[1.02]',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'border-border bg-card hover:border-primary/50',
        group.borderClass
      )}
    >
      <div className={cn('flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full', group.iconBgClass)}>
        <Icon className={cn(iconSizes.md, group.colorClass)} aria-hidden="true" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <h4 className="text-sm font-semibold text-foreground leading-tight">
          {group.label[currentLanguage]}
        </h4>
        <p className={cn("text-xs mt-0.5 leading-tight", colors.text.muted)}>
          {group.description[currentLanguage]}
        </p>
        <span className={cn('inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full', group.bgClass, group.colorClass)}>
          {entriesCountLabel}
        </span>
      </div>
    </button>
  );
}
