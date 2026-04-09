/**
 * =============================================================================
 * GroupedFilesByDomainCategoryList — Files grouped by domain + category
 * =============================================================================
 *
 * Renders files organized into collapsible sections based on their
 * `domain` + `category` metadata. Each section uses the canonical
 * `FilesList` component for row rendering.
 *
 * Follows the same structural pattern as `GroupedFilesList` (study groups).
 *
 * @module components/shared/files/GroupedFilesByDomainCategoryList
 * @enterprise ADR-031
 */

'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getCategoryIconInfo } from './utils/file-icons';
import { groupFilesByDomainCategory } from './utils/domain-category-grouping';
import type { DomainCategoryGroup } from './utils/domain-category-grouping';
import type { FilesListProps } from './FilesList';
import { FilesList } from './FilesList';

// ============================================================================
// GROUP HEADER
// ============================================================================

interface DomainCategoryGroupHeaderProps {
  domain: string;
  category: string;
  fileCount: number;
  expanded: boolean;
  onToggle: () => void;
}

function DomainCategoryGroupHeader({
  domain,
  category,
  fileCount,
  expanded,
  onToggle,
}: DomainCategoryGroupHeaderProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  const colors = useSemanticColors();

  const iconInfo = getCategoryIconInfo(category);
  const Icon = iconInfo.icon;

  const domainLabel = t(`domains.${domain}`, { defaultValue: '' }) || domain;
  const categoryLabel = t(`categories.${category}`, { defaultValue: '' }) || category;
  const composedLabel = `${domainLabel} \u2022 ${categoryLabel}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 rounded-md border-l-4 px-3 py-2.5',
        'transition-colors cursor-pointer select-none',
        'hover:bg-accent/50',
        'border-l-muted-foreground/40 bg-muted/30'
      )}
      aria-expanded={expanded}
      aria-label={
        expanded
          ? `${t('list.collapseGroup')}: ${composedLabel}`
          : `${t('list.expandGroup')}: ${composedLabel}`
      }
    >
      <span className="flex items-center justify-center rounded-md bg-muted p-1.5">
        <Icon className={cn(iconSizes.sm, iconInfo.colorClass)} aria-hidden="true" />
      </span>
      <span className={cn('text-sm font-semibold', colors.text.muted)}>
        {composedLabel}
      </span>
      <span className={cn(
        'ml-auto flex items-center gap-2 text-xs font-medium',
        colors.text.muted,
      )}>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
          {fileCount}
        </span>
        <ChevronDown
          className={cn(
            iconSizes.sm,
            'transition-transform',
            expanded ? 'rotate-0' : '-rotate-90',
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

export type GroupedFilesByDomainCategoryListProps = FilesListProps;

/**
 * Files list with collapsible domain-category sections.
 *
 * Groups files by `domain + category` and renders each group with a header
 * showing the composed label (e.g. "Νομικά • Συμβόλαια").
 * Each section is independently collapsible. All sections start expanded.
 */
export function GroupedFilesByDomainCategoryList(props: GroupedFilesByDomainCategoryListProps) {
  const { files, loading, ...restProps } = props;

  const groups: DomainCategoryGroup<typeof files[number]>[] = useMemo(
    () => groupFilesByDomainCategory(files),
    [files],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  // Loading / empty → delegate to FilesList
  if (loading || files.length === 0) {
    return <FilesList files={files} loading={loading} {...restProps} />;
  }

  // Single group → flat list (no headers needed)
  if (groups.length <= 1) {
    return <FilesList files={files} loading={loading} {...restProps} />;
  }

  return (
    <section className="space-y-3" role="region" aria-label="Grouped files by domain">
      {groups.map((group) => {
        const isExpanded = !collapsed.has(group.key);

        return (
          <section key={group.key} aria-label={`${group.domain} ${group.category}`}>
            <DomainCategoryGroupHeader
              domain={group.domain}
              category={group.category}
              fileCount={group.files.length}
              expanded={isExpanded}
              onToggle={() => toggleGroup(group.key)}
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
