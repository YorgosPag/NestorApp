"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TocItem } from './TocItem';
import { useTocStats } from '../utils/stats';
import type { TocBodyProps } from '../types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

export function TocBody({
  items,
  expandedIds,
  onToggle,
  activeItemId,
  onItemClick,
  showPageNumbers,
  compact,
}: TocBodyProps) {
  const stats = useTocStats(items);
  const { t } = useTranslation('obligations');
  const colors = useSemanticColors();

  return (
    <>
      <ScrollArea className="max-h-96">
        <div className="space-y-1">
          {items.map(item => (
            <TocItem
              key={item.id}
              item={item}
              level={0}
              expandedIds={expandedIds}
              onToggle={onToggle}
              activeItemId={activeItemId}
              onClick={onItemClick}
              showPageNumbers={showPageNumbers}
              compact={compact}
            />
          ))}
        </div>
      </ScrollArea>
      {!compact && items.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-primary">{stats.sections}</div>
              <div className={cn("text-xs", colors.text.muted)}>{t('tableOfContents.sections')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-accent-foreground">{stats.articles}</div>
              <div className={cn("text-xs", colors.text.muted)}>{t('tableOfContents.articles')}</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">{stats.paragraphs}</div>
              <div className={cn("text-xs", colors.text.muted)}>{t('tableOfContents.paragraphs')}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

