'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { layoutUtilities } from '@/styles/design-tokens';

/**
 * 🎨 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ THEME-AWARE PROGRESS BAR
 *
 * Χρησιμοποιεί ενιαία χρώματα σε όλη την εφαρμογή
 * Συμβατό με light/dark mode
 */

interface ThemeProgressBarProps {
  progress: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
}

export function ThemeProgressBar({
  progress,
  label = "Πρόοδος",
  size = 'md',
  showPercentage = true
}: ThemeProgressBarProps) {
  // Theme-aware progress bar colors using CSS variables
  const getProgressColorClass = (value: number) => {
    if (value >= 80) return 'text-green-500';      // Success (green) - για το χρώμα του ποσοστού
    if (value >= 60) return 'text-primary';        // Primary (blue/dark)
    if (value >= 40) return 'text-orange-500';     // Warning (orange)
    return 'text-destructive';                     // Destructive (red)
  };

  // Theme-aware progress bar background colors
  const getProgressBarColor = (value: number) => {
    if (value >= 80) return '#22c55e';    // Green for 80%+
    if (value >= 60) return '#3b82f6';    // Blue for 60-79%
    if (value >= 40) return '#f97316';    // Orange for 40-59%
    return '#ef4444';                     // Red for <40%
  };

  // Size variations
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm'
  };

  return (
    <div className="mb-3">
      <div className={cn("flex items-center justify-between mb-1", textSizeClasses[size])}>
        <span className="text-muted-foreground">{label}</span>
        {showPercentage && (
          <span className={cn(
            "font-medium",
            getProgressColorClass(progress)
          )}>
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className={cn(
        "relative w-full overflow-hidden rounded-full bg-secondary",
        sizeClasses[size]
      )}>
        <div
          className={cn(
            "h-full transition-all duration-300 ease-in-out rounded-full",
            getDynamicBackgroundClass(getProgressBarColor(progress))
          )}
          style={{
            width: layoutUtilities.percentage(Math.min(100, Math.max(0, progress)))
          }}
        />
      </div>
    </div>
  );
}