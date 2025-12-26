"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { TocItemProps } from '../types';
import { getItemIcon } from '../utils/icons';
import { getItemBadgeColor } from '../utils/badges';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

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
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
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
          "hover:bg-accent/10",
          isActive && `bg-primary/10 text-primary ${quick.info}`,
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
            className={`${iconSizes.lg} p-0 opacity-70 hover:opacity-100`}
            aria-label={isExpanded ? `Σύμπτυξη ενότητας ${item.title}` : `Επέκταση ενότητας ${item.title}`}
          >
            {isExpanded ? <ChevronDown className={iconSizes.xs} /> : <ChevronRight className={iconSizes.xs} />}
          </Button>
        )}

        {!compact && (
          <div className="flex-shrink-0">
            <Icon />
          </div>
        )}

        <Badge
          variant="outline"
          className={cn("text-xs font-mono min-w-8 justify-center", getItemBadgeColor(item.type))}
        >
          {item.number}
        </Badge>

        <div className="flex-1 min-w-0">
          <span className={cn(
            "text-sm truncate block",
            item.type === 'section' && "font-semibold",
            item.type === 'article' && "font-medium",
            item.type === 'paragraph' && "font-normal text-muted-foreground"
          )}>
            {item.title}
          </span>
        </div>

        {showPageNumbers && item.page && (
          <Badge variant="outline" className="text-xs">
            σελ. {item.page}
          </Badge>
        )}

        {compact && (
          <span className="text-xs text-muted-foreground/80 uppercase tracking-wide">
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
