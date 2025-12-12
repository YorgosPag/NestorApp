"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { CommonBadge } from '@/core/badges';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { TocItemProps } from '../types';
import { getItemIcon } from '../utils/icons';
import { getItemBadgeColor } from '../utils/badges';
import { cn } from '@/lib/utils';

export function TocItem({
  item,
  level,
  expandedIds,
  activeItemId,
  compact,
  showPageNumbers,
  onToggle,
  onClick,
}: TocItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedIds.includes(item.id);
  const isActive = activeItemId === item.id;
  const indentClass = level === 0 ? '' : `ml-${Math.min(level * 4, 16)}`;
  const Icon = getItemIcon(item.type);

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors",
          INTERACTIVE_PATTERNS.SUBTLE_HOVER,
          isActive && "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700",
          indentClass
        )}
        onClick={() => onClick?.(item)}
        aria-current={isActive ? 'page' : undefined}
      >
        {hasChildren && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(item.id);
            }}
            className={`h-6 w-6 p-0 opacity-70 ${INTERACTIVE_PATTERNS.OPACITY_HOVER}`}
            aria-label={isExpanded ? `Σύμπτυξη ενότητας ${item.title}` : `Επέκταση ενότητας ${item.title}`}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        )}

        {!compact && (
          <div className="flex-shrink-0">
            <Icon />
          </div>
        )}

        <CommonBadge
          status="company"
          customLabel={item.number}
          variant="outline"
          size="sm"
          className={cn("text-xs font-mono min-w-8 justify-center", getItemBadgeColor(item.type))}
        />

        <div className="flex-1 min-w-0">
          <span className={cn(
            "text-sm truncate block",
            item.type === 'section' && "font-semibold",
            item.type === 'article' && "font-medium",
            item.type === 'paragraph' && "font-normal text-gray-600 dark:text-gray-400"
          )}>
            {item.title}
          </span>
        </div>

        {showPageNumbers && item.page && (
          <CommonBadge
            status="company"
            customLabel={`σελ. ${item.page}`}
            variant="outline"
            size="sm"
            className="text-xs"
          />
        )}

        {compact && (
          <span className="text-xs text-gray-400 uppercase tracking-wide">
            {item.type === 'section' ? 'ΕΝ' : item.type === 'article' ? 'ΑΡ' : 'ΠΑ'}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {item.children!.map(child => (
            <TocItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              activeItemId={activeItemId}
              onItemClick={onClick}
              showPageNumbers={showPageNumbers}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
