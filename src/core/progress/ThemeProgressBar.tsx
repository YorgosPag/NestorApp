// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { layoutUtilities } from '@/styles/design-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from 'react-i18next';

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
  label,
  size = 'md',
  showPercentage = true
}: ThemeProgressBarProps) {
  const { t } = useTranslation('common');
  const displayLabel = label ?? t('progress.label');
  const colors = useSemanticColors();

  // ✅ ENTERPRISE: Theme-aware progress bar colors using semantic system
  const getProgressColorClass = (value: number) => {
    if (value >= 80) return colors.text.success;      // ✅ SEMANTIC: text-green-500 -> success text
    if (value >= 60) return 'text-primary';           // Keep primary (framework)
    if (value >= 40) return colors.text.warning;      // ✅ SEMANTIC: text-orange-500 -> warning text
    return colors.text.error;                         // ✅ SEMANTIC: error text
  };

  // ✅ ENTERPRISE: Theme-aware progress bar background colors using semantic system
  const getProgressBarColorClass = (value: number) => {
    if (value >= 80) return colors.bg.success;    // ✅ SEMANTIC: Green for 80%+
    if (value >= 60) return colors.bg.info;       // ✅ SEMANTIC: Blue for 60-79%
    if (value >= 40) return colors.bg.warning;    // ✅ SEMANTIC: Orange for 40-59%
    return colors.bg.error;                       // ✅ SEMANTIC: Red for <40%
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
        <span className="text-muted-foreground">{displayLabel}</span>
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
            getProgressBarColorClass(progress)
          )}
          style={{
            width: layoutUtilities.percentage(Math.min(100, Math.max(0, progress)))
          }}
        />
      </div>
    </div>
  );
}
