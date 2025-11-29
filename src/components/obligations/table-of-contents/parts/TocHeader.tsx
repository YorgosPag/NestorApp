"use client";

import React from 'react';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { TocHeaderProps } from '../types';
import { cn } from '@/lib/utils';

export function TocHeader({
  items,
  compact,
  expandedIds,
  onExpandAll,
  onCollapseAll,
}: TocHeaderProps) {
  const isAllExpanded = expandedIds.length > 0; // Simplified check for toggle icon

  return (
    <CardHeader className={cn("pb-4", compact && "pb-2")}>
      <div className="flex items-center justify-between">
        <CardTitle className={cn("text-lg flex items-center gap-2", compact && "text-base")}>
          <BookOpen className="h-5 w-5" />
          Πίνακας Περιεχομένων
          <CommonBadge
            status="company"
            customLabel={`${items.length} ${items.length === 1 ? 'ενότητα' : 'ενότητες'}`}
            variant="secondary"
            className="text-xs"
          />
        </CardTitle>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={isAllExpanded ? onCollapseAll : onExpandAll}
            className="h-7 px-2"
            title={isAllExpanded ? "Σύμπτυξη όλων" : "Επέκταση όλων"}
            aria-label={isAllExpanded ? "Σύμπτυξη όλων" : "Επέκταση όλων"}
          >
            {isAllExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      {!compact && (
        <CardDescription>
          Κλικ σε μια ενότητα για πλοήγηση
        </CardDescription>
      )}
    </CardHeader>
  );
}
