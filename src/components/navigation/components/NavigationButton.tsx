'use client';

/**
 * Centralized Navigation Button Component
 * Reusable button for navigation selections (based on SelectionButton)
 */
import React from 'react';
import { LucideIcon, AlertTriangle } from 'lucide-react';

interface NavigationButtonProps {
  onClick: () => void;
  icon: string | LucideIcon;
  title: string;
  subtitle?: string;
  extraInfo?: string;
  isSelected?: boolean;
  variant?: 'default' | 'compact';
  hasWarning?: boolean; // Για εταιρείες χωρίς έργα
  warningText?: string; // Custom warning text
}

export function NavigationButton({
  onClick,
  icon,
  title,
  subtitle,
  extraInfo,
  isSelected = false,
  variant = 'default',
  hasWarning = false,
  warningText
}: NavigationButtonProps) {
  const baseClasses = "w-full text-left rounded-lg border transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50";

  const variantClasses = {
    default: "p-4 border-gray-200 dark:border-gray-600",
    compact: "p-2 border-gray-200 dark:border-gray-600"
  };

  // Χρωματική διαφοροποίηση βάσει κατάστασης
  const selectedClasses = isSelected
    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
    : hasWarning
      ? "border-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-400 dark:hover:border-orange-500"
      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500";

  const iconSize = variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5';
  const spacing = variant === 'compact' ? 'space-x-2' : 'space-x-3';

  const renderIcon = () => {
    if (typeof icon === 'string') {
      // Fallback για emojis
      return <span className={variant === 'compact' ? 'text-lg' : 'text-2xl'}>{icon}</span>;
    } else {
      // Lucide icon component
      const IconComponent = icon;
      return <IconComponent className={`${iconSize} text-gray-600 dark:text-gray-400`} />;
    }
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${selectedClasses}`}
    >
      <div className={`flex items-center ${spacing}`}>
        {renderIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-gray-900 dark:text-foreground font-medium truncate">
              {title}
            </div>
            {hasWarning && (
              <div className="flex items-center gap-1 ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-600 rounded-md shrink-0">
                <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                  {warningText || 'Χωρίς έργα'}
                </span>
              </div>
            )}
          </div>
          {subtitle && (
            <div className={`text-sm truncate ${hasWarning ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-muted-foreground'}`}>
              {subtitle}
            </div>
          )}
          {extraInfo && (
            <div className={`text-sm truncate ${hasWarning ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-muted-foreground'}`}>
              {extraInfo}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default NavigationButton;