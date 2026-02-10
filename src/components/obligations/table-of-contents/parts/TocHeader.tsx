// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
"use client";

import React from 'react';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TocHeaderProps } from '../types';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function TocHeader({
  items,
  compact,
  expandedIds,
  onExpandAll,
  onCollapseAll,
}: TocHeaderProps) {
  const { t } = useTranslation('obligations');
  const iconSizes = useIconSizes();
  const isAllExpanded = expandedIds.length > 0; // Simplified check for toggle icon

  return (
    <CardHeader className={cn("pb-4", compact && "pb-2")}>
      <div className="flex items-center justify-between">
        <CardTitle className={cn("text-lg flex items-center gap-2", compact && "text-base")}>
          <BookOpen className={iconSizes.md} />
          {t('toc.title')}
          <Badge variant="secondary" className="text-xs">
            {t('toc.sectionCount', { count: items.length })}
          </Badge>
        </CardTitle>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={isAllExpanded ? onCollapseAll : onExpandAll}
                className="h-7 px-2"
                aria-label={isAllExpanded ? t('toc.collapseAll') : t('toc.expandAll')}
              >
                {isAllExpanded ? (
                  <ChevronDown className={iconSizes.sm} />
                ) : (
                  <ChevronRight className={iconSizes.sm} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isAllExpanded ? t('toc.collapseAll') : t('toc.expandAll')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {!compact && (
        <CardDescription>
          {t('toc.clickToNavigate')}
        </CardDescription>
      )}
    </CardHeader>
  );
}
