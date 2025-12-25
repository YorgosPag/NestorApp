'use client';

/**
 * Centralized Navigation Button Component
 * Reusable button for navigation selections (based on SelectionButton)
 */
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { UnifiedBadge } from '../../../core/badges/UnifiedBadgeSystem';
import { NavigationStatus } from '../../../core/types/BadgeTypes';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS, HOVER_BORDER_EFFECTS } from '../../ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface NavigationButtonProps {
  onClick: () => void;
  icon: string | LucideIcon;
  title: string;
  subtitle?: string;
  extraInfo?: string;
  isSelected?: boolean;
  variant?: 'default' | 'compact';
  // Νέο κεντρικοποιημένο badge system
  badgeStatus?: NavigationStatus;
  badgeText?: string; // Override default badge text
  // Backward compatibility
  hasWarning?: boolean; // DEPRECATED: Use badgeStatus='no_projects' instead
  warningText?: string; // DEPRECATED: Use badgeText instead
}

export function NavigationButton({
  onClick,
  icon,
  title,
  subtitle,
  extraInfo,
  isSelected = false,
  variant = 'default',
  badgeStatus,
  badgeText,
  // Backward compatibility
  hasWarning = false,
  warningText
}: NavigationButtonProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const baseClasses = `w-full text-left ${quick.button} ${TRANSITION_PRESETS.STANDARD_COLORS} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`;

  const variantClasses = {
    default: `p-4 ${quick.card}`,
    compact: `p-2 ${quick.card}`
  };

  // Backward compatibility: χρήση hasWarning για badgeStatus
  const effectiveBadgeStatus = badgeStatus || (hasWarning ? 'no_projects' : undefined);
  const effectiveBadgeText = badgeText || warningText;

  // 🏢 ENTERPRISE: χρωματική διαφοροποίηση με centralized status borders
  const selectedClasses = isSelected
    ? `${getStatusBorder('info')} bg-blue-50 dark:bg-blue-900/30`
    : effectiveBadgeStatus
      ? `${getStatusBorder('warning')} bg-orange-50 dark:bg-orange-900/20 ${HOVER_BORDER_EFFECTS.ORANGE}`
      : `${quick.card} ${HOVER_BORDER_EFFECTS.GRAY}`;

  const iconSize = variant === 'compact' ? iconSizes.sm : iconSizes.md;
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
            {effectiveBadgeStatus && (
              <div className="ml-2 shrink-0">
                <UnifiedBadge
                  domain="NAVIGATION"
                  status={effectiveBadgeStatus}
                  customLabel={effectiveBadgeText}
                  size="sm"
                />
              </div>
            )}
          </div>
          {subtitle && (
            <div className={`text-sm truncate ${effectiveBadgeStatus ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-muted-foreground'}`}>
              {subtitle}
            </div>
          )}
          {extraInfo && (
            <div className={`text-sm truncate ${effectiveBadgeStatus ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-muted-foreground'}`}>
              {extraInfo}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default NavigationButton;