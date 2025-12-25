'use client';

/**
 * Centralized Navigation Sidebar Component
 * Sidebar section for the app sidebar integration
 */
import React from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { HOVER_TEXT_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { NavigationTree } from './NavigationTree';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface NavigationSidebarProps {
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function NavigationSidebar({
  isExpanded = false,
  onToggleExpanded
}: NavigationSidebarProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();

  return (
    <div className="space-y-2">
      {/* Navigation Section Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleExpanded}
          className={cn(
            "flex items-center gap-2 text-gray-700 dark:text-gray-300 py-2 px-1 w-full text-left",
            HOVER_TEXT_EFFECTS.GRAY_TO_BLACK,
            TRANSITION_PRESETS.STANDARD_COLORS
          )}
        >
          <MapPin className={iconSizes.sm} />
          <span className="font-medium">Πλοήγηση</span>
          {isExpanded ? (
            <ChevronDown className={`${iconSizes.sm} ml-auto`} />
          ) : (
            <ChevronRight className={`${iconSizes.sm} ml-auto`} />
          )}
        </button>
      </div>

      {/* Navigation Tree (Collapsible) */}
      {isExpanded && (
        <div className={`pl-4 border-l ${quick.separatorV}`}>
          <NavigationTree />
        </div>
      )}
    </div>
  );
}

export default NavigationSidebar;