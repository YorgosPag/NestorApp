'use client';

import React from 'react';
import { cn } from '@/lib/utils';

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

  // Theme-aware inline colors for progress bar
  const getProgressBarColor = (value: number) => {
    if (value >= 80) return '#22c55e';  // Green-500
    if (value >= 60) return 'hsl(var(--primary))';  // Primary CSS variable
    if (value >= 40) return '#f97316';  // Orange-500
    return 'hsl(var(--destructive))';  // Destructive CSS variable
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
          className={cn("h-full transition-all duration-300 ease-in-out rounded-full")}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: getProgressBarColor(progress)
          }}
        />
      </div>
    </div>
  );
}