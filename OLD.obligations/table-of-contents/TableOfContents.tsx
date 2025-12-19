"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { useExpandedToc } from './hooks/useExpandedToc';
import { TocHeader } from './parts/TocHeader';
import { TocBody } from './parts/TocBody';
import type { TableOfContentsProps } from './types';
import { cn } from '@/lib/utils';

export default function TableOfContents({ 
  items, 
  onItemClick, 
  activeItemId,
  showPageNumbers = false,
  compact = false,
  className
}: TableOfContentsProps) {
  const { expandedIds, toggle, expandAll, collapseAll } = useExpandedToc(items);

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className={cn("pb-4", compact && "pb-2")}>
          <CardTitle className={cn("text-lg flex items-center gap-2", compact && "text-base")}>
            <BookOpen className="h-5 w-5" />
            Πίνακας Περιεχομένων
          </CardTitle>
          {!compact && (
            <CardDescription>
              Η δομή του εγγράφου θα εμφανιστεί εδώ
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm text-gray-500">Δεν υπάρχουν ενότητες ακόμα</p>
            <p className="text-xs text-gray-400 mt-1">
              Προσθέστε ενότητες για να δημιουργηθεί ο πίνακας περιεχομένων
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
