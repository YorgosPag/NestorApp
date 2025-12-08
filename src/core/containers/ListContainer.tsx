'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ListContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Centralized List Container Component
 *
 * Provides consistent responsive styling for all list pages:
 * - Contacts, Projects, Buildings, Units
 *
 * Features:
 * - Mobile: px-1 py-4 gap-1 (smaller margins)
 * - Desktop: px-4 py-4 gap-4 (larger margins)
 * - Responsive behavior
 * - Consistent overflow handling
 */
export function ListContainer({ children, className }: ListContainerProps) {
  return (
    <div className={cn(
      "flex-1 flex overflow-hidden px-1 py-4 sm:px-4 sm:py-4 gap-1 sm:gap-4",
      className
    )}>
      {children}
    </div>
  );
}