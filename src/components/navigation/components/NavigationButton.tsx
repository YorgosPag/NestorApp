'use client';

/**
 * Centralized Navigation Button Component
 * Reusable button for navigation selections (based on SelectionButton)
 */
import React from 'react';

interface NavigationButtonProps {
  onClick: () => void;
  icon: string;
  title: string;
  subtitle?: string;
  extraInfo?: string;
  isSelected?: boolean;
  variant?: 'default' | 'compact';
}

export function NavigationButton({
  onClick,
  icon,
  title,
  subtitle,
  extraInfo,
  isSelected = false,
  variant = 'default'
}: NavigationButtonProps) {
  const baseClasses = "w-full text-left rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50";

  const variantClasses = {
    default: "p-4 border-gray-200 dark:border-gray-600",
    compact: "p-2 border-gray-200 dark:border-gray-600"
  };

  const selectedClasses = isSelected
    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500";

  const iconSize = variant === 'compact' ? 'text-lg' : 'text-2xl';
  const spacing = variant === 'compact' ? 'space-x-2' : 'space-x-3';

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${selectedClasses}`}
    >
      <div className={`flex items-center ${spacing}`}>
        <span className={iconSize}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-gray-900 dark:text-foreground font-medium truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-gray-500 dark:text-muted-foreground text-sm truncate">
              {subtitle}
            </div>
          )}
          {extraInfo && (
            <div className="text-gray-400 dark:text-muted-foreground text-sm truncate">
              {extraInfo}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default NavigationButton;