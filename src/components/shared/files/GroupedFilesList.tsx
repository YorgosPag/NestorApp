/**
 * =============================================================================
 * GroupedFilesList — Files grouped by study category (ADR-191)
 * =============================================================================
 *
 * Renders files organized into collapsible sections based on their study group
 * (purpose → group lookup). Files without a study group appear under
 * "Γενικά Έγγραφα" at the bottom.
 *
 * Uses the same FilesList component internally for per-section rendering.
 *
 * @module components/shared/files/GroupedFilesList
 * @enterprise ADR-031 + ADR-191
 */

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  groupFilesByStudyGroup,
  type StudyGroupMeta,
} from '@/config/study-groups-config';
import type { FilesListProps } from './FilesList';
import { FilesList } from './FilesList';
import '@/lib/design-system';

// ============================================================================
// HELPERS
// ============================================================================

function getIcon(iconName?: string): LucideIcons.LucideIcon {
  if (!iconName) return FileText;
  const icons: Record<string, LucideIcons.LucideIcon | undefined> =
    LucideIcons as unknown as Record<string, LucideIcons.LucideIcon | undefined>;
  return icons[iconName] ?? FileText;
}

// ============================================================================
// GROUP HEADER
// ============================================================================

interface GroupHeaderProps {
  meta: StudyGroupMeta | null;
  fileCount: number;
  expanded: boolean;
  onToggle: () => void;
  language: 'el' | 'en';
}

function GroupHeader({ meta, fileCount, expanded, onToggle, language }: GroupHeaderProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();

  if (meta) {
    const Icon = getIcon(meta.icon);
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-3 rounded-md border-l-4 px-3 py-2.5',
          'transition-colors cursor-pointer select-none',
          'hover:bg-accent/50', // eslint-disable-line custom/no-hardcoded-strings
          meta.borderClass,
          meta.bgClass
        )}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? `${t('list.collapseGroup')}: ${meta.label[language]}`
            : `${t('list.expandGroup')}: ${meta.label[language]}`
        }
      >
        <span className={cn('flex items-center justify-center rounded-md p-1.5', meta.iconBgClass)}>
          <Icon className={cn(iconSizes.sm, meta.colorClass)} aria-hidden="true" />
        </span>
        <span className={cn('text-sm font-semibold', meta.colorClass)}>
          {meta.label[language]}
        </span>
        <span className={cn(
          'ml-auto flex items-center gap-2 text-xs font-medium',
          meta.colorClass
        )}>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs tabular-nums',
            meta.iconBgClass,
            meta.colorClass
          )}>
            {fileCount}
          </span>
          <ChevronDown
            className={cn(
              iconSizes.sm,
              'transition-transform',
              expanded ? 'rotate-0' : '-rotate-90' // eslint-disable-line custom/no-hardcoded-strings
            )}
            aria-hidden="true"
          />
        </span>
      </button>
    );
  }

  // Fallback group — "Γενικά Έγγραφα"
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-md border-l-4 px-3 py-2.5',
        'transition-colors cursor-pointer select-none',
        'hover:bg-accent/50', // eslint-disable-line custom/no-hardcoded-strings
        'border-l-muted-foreground/40 bg-muted/30'
      )}
      aria-expanded={expanded}
      aria-label={
        expanded
          ? `${t('list.collapseGroup')}: ${t('studies.generalDocuments')}`
          : `${t('list.expandGroup')}: ${t('studies.generalDocuments')}`
      }
    >
      <span className="flex items-center justify-center rounded-md bg-muted p-1.5">
        <FileText className={cn(iconSizes.sm, colors.text.muted)} aria-hidden="true" />
      </span>
      <span className={cn("text-sm font-semibold", colors.text.muted)}>
        {t('studies.generalDocuments')}
      </span>
      <span className={cn("ml-auto flex items-center gap-2 text-xs font-medium", colors.text.muted)}>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
          {fileCount}
        </span>
        <ChevronDown
          className={cn(
            iconSizes.sm,
            'transition-transform',
            expanded ? 'rotate-0' : '-rotate-90' // eslint-disable-line custom/no-hardcoded-strings
          )}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

// ============================================================================
// GROUPED FILES LIST
// ============================================================================

export type GroupedFilesListProps = FilesListProps;

/**
 * Files list with collapsible study group sections.
 *
 * Groups files by study category (purpose → group) and renders each group
 * with a colored header. Each section is independently collapsible.
 * All sections start expanded.
 */
export function GroupedFilesList(props: GroupedFilesListProps) {
  const { files, loading, ...restProps } = props;
  const { i18n } = useTranslation(['files', 'files-media']);

  const language = (i18n.language?.split('-')[0] || 'en') as 'el' | 'en';

  // Group files
  const groups = useMemo(() => groupFilesByStudyGroup(files), [files]);

  // If only 1 group or no grouping needed, fall through to flat list
  const hasMultipleGroups = groups.length > 1;
  const hasStudyGroup = groups.some((g) => g.meta !== null);

  // Track expanded state per group key
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const getGroupKey = useCallback((meta: StudyGroupMeta | null): string => {
    return meta?.group ?? '__general__';
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // No grouping needed → render flat FilesList
  if (!hasMultipleGroups && !hasStudyGroup) {
    return <FilesList files={files} loading={loading} {...restProps} />;
  }

  // Loading/empty states delegate to FilesList
  if (loading || files.length === 0) {
    return <FilesList files={files} loading={loading} {...restProps} />;
  }

  return (
    <section className="space-y-3" role="region" aria-label="Grouped files">
      {groups.map((group) => {
        const key = getGroupKey(group.meta);
        const isExpanded = !collapsed.has(key);

        return (
          <section key={key} aria-label={group.meta?.label[language] ?? 'General'}>
            <GroupHeader
              meta={group.meta}
              fileCount={group.files.length}
              expanded={isExpanded}
              onToggle={() => toggleGroup(key)}
              language={language}
            />
            {isExpanded && (
              <div className="mt-1 pl-2">
                <FilesList
                  files={group.files}
                  loading={false}
                  {...restProps}
                />
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
