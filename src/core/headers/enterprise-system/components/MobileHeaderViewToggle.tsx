/**
 * 🏢 MOBILE HEADER VIEW TOGGLE COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο mobile view toggle component
 * Enterprise implementation με single-button cycling pattern
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
import { HEADER_THEME } from '../constants';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import '@/lib/design-system';

export const MobileHeaderViewToggle: React.FC<HeaderViewToggleProps> = ({
  viewMode,
  onViewModeChange,
  viewModes = ['list', 'grid'],
  className
}) => {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
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
    const labelMap = {
      list: 'Προβολή λίστας',
      grid: 'Προβολή πλέγματος',
      byType: 'Ομαδοποίηση κατά τύπο',
      byStatus: 'Ομαδοποίηση κατά κατάσταση'
    };
    return labelMap[mode] || 'Προβολή';
  };

  // Find the next view mode to toggle to
  const getNextViewMode = () => {
    const currentIndex = viewModes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % viewModes.length;
    return viewModes[nextIndex];
  };

  const nextMode = getNextViewMode();
  const NextIcon = getViewIcon(nextMode);

  const buttonClasses = cn(
    HEADER_THEME.components.viewToggle.mobile,
    spacing.padding.x.sm,
    className
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewModeChange(nextMode)}
          className={buttonClasses}
          aria-label={getViewLabel(nextMode)}
        >
          <NextIcon className={iconSizes.sm} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{getViewLabel(nextMode)}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default MobileHeaderViewToggle;