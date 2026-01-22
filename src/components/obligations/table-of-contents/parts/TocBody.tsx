"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TocItem } from './TocItem';
import { useTocStats } from '../utils/stats';
import type { TocBodyProps } from '../types';

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
              <div className="text-xs text-muted-foreground">Ενότητες</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-accent-foreground">{stats.articles}</div>
              <div className="text-xs text-muted-foreground">Άρθρα</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-foreground">{stats.paragraphs}</div>
              <div className="text-xs text-muted-foreground">Παράγραφοι</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
