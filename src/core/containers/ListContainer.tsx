'use client';

import React from 'react';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized layout classes
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

interface ListContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Centralized List Container Component
 *
 * Provides consistent responsive styling for all list pages:
 * - Contacts, Projects, Buildings, Units, Storage, Parking
 *
 * Features:
 * - Mobile: px-1 py-2 gap-1 (4px)
 * - Desktop: px-2 py-2 gap-2 (8px)
 * - Responsive behavior
 * - Consistent overflow handling
 *
 * 🏢 ENTERPRISE: Uses centralized spacing tokens from useLayoutClasses
 * NO hardcoded values - all spacing comes from central design system
 */
export function ListContainer({ children, className }: ListContainerProps) {
  const layout = useLayoutClasses();

  return (
    <div className={cn(
      "flex-1 flex overflow-hidden",
      layout.listPaddingResponsive,  // px-1 py-2 sm:px-2 sm:py-2
      layout.listGapResponsive,      // gap-1 sm:gap-2
      className
    )}>
      {children}
    </div>
  );
}