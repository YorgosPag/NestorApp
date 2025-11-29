'use client';

/**
 * Centralized Navigation Sidebar Component
 * Sidebar section for the app sidebar integration
 */
import React from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { NavigationTree } from './NavigationTree';

interface NavigationSidebarProps {
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export function NavigationSidebar({
  isExpanded = false,
  onToggleExpanded
}: NavigationSidebarProps) {

  return (
    <div className="space-y-2">
      {/* Navigation Section Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-2 px-1 w-full text-left"
        >
          <MapPin className="h-4 w-4" />
          <span className="font-medium">Πλοήγηση</span>
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