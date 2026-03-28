"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { BookOpen } from 'lucide-react';
import { useExpandedToc } from './hooks/useExpandedToc';
import { TocHeader } from './parts/TocHeader';
import { TocBody } from './parts/TocBody';
import type { TableOfContentsProps } from './types';
import { cn } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export default function TableOfContents({
  items,
  onItemClick,
  activeItemId,
  showPageNumbers = false,
  compact = false,
  className
}: TableOfContentsProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('obligations');
  const colors = useSemanticColors();
  const { expandedIds, toggle, expandAll, collapseAll } = useExpandedToc(items);

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className={cn("pb-4", compact && "pb-2")}>
          <CardTitle className={cn("text-lg flex items-center gap-2", compact && "text-base")}>
            <BookOpen className={iconSizes.md} />
            {t('tableOfContents.title')}
          </CardTitle>
          {!compact && (
            <CardDescription>
              {t('tableOfContents.description')}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BookOpen className={cn(iconSizes.xl, "mx-auto mb-4", `${colors.text.muted}/50`)} />
            <p className={cn("text-sm", colors.text.muted)}>{t('tableOfContents.emptyTitle')}</p>
            <p className={cn("text-xs mt-1", `${colors.text.muted}/80`)}>
              {t('tableOfContents.emptyDescription')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <TocHeader
        items={items}
        compact={compact}
        expandedIds={expandedIds}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />
      <CardContent className="pt-0">
        <TocBody
          items={items}
          expandedIds={expandedIds}
          onToggle={toggle}
          activeItemId={activeItemId}
          onItemClick={onItemClick}
          showPageNumbers={showPageNumbers}
          compact={compact}
        />
      </CardContent>
    </Card>
  );
}


