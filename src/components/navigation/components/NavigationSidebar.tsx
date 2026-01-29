'use client';

/**
 * Centralized Navigation Sidebar Component
 * Sidebar section for the app sidebar integration
 */
import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { HOVER_TEXT_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { cn } from '@/lib/utils';
import { NavigationTree } from './NavigationTree';
// 🏢 ENTERPRISE: Icons από centralized config - ZERO hardcoded values
import { NAVIGATION_ENTITIES } from '../config';

interface NavigationSidebarProps {
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function NavigationSidebar({
  isExpanded = false,
  onToggleExpanded
}: NavigationSidebarProps) {
  // 🏢 ENTERPRISE: Icon from centralized config - ZERO hardcoded values
  const LocationIcon = NAVIGATION_ENTITIES.location.icon;

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
          <LocationIcon className="h-4 w-4" />
          <span className="font-medium">Ιεραρχία</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 ml-auto" />
          ) : (
            <ChevronRight className="h-4 w-4 ml-auto" />
          )}
        </button>
      </div>

      {/* Navigation Tree (Collapsible) */}
      {isExpanded && (
        <div className="pl-4 border-l border-gray-200 dark:border-gray-700">
          <NavigationTree />
        </div>
      )}
    </div>
  );
}

export default NavigationSidebar;