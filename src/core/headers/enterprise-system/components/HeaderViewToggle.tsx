/**
 * 🏢 HEADER VIEW TOGGLE COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο view toggle component για headers
 * Enterprise implementation με multi-mode support και responsive design
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  List,
  LayoutGrid,
  Filter,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HeaderViewToggleProps, ViewMode } from '../types';
import { HEADER_THEME, VIEW_MODE_CONFIG } from '../constants';

export const HeaderViewToggle: React.FC<HeaderViewToggleProps> = ({
  viewMode,
  onViewModeChange,
  viewModes = ['list', 'grid'],
  className
}) => {
  const getViewIcon = (mode: ViewMode) => {
    const iconMap = {
      list: List,
      grid: LayoutGrid,
      byType: Filter,
      byStatus: BarChart3
    };
    return iconMap[mode] || List;
  };

  const getViewLabel = (mode: ViewMode) => {
    return VIEW_MODE_CONFIG.labels[mode] || mode;
  };

  const containerClasses = cn(
    HEADER_THEME.components.viewToggle.desktop,
    className
  );

  return (
    <div className={containerClasses}>
      {viewModes.map((mode, index) => {
        const Icon = getViewIcon(mode);
        const isFirst = index === 0;
        const isLast = index === viewModes.length - 1;

        return (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange(mode)}
                className={cn(
                  "h-8 border-0",
                  !isFirst && "rounded-l-none",
                  !isLast && "rounded-r-none"
                )}
              >
                <Icon className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{getViewLabel(mode)}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

export default HeaderViewToggle;