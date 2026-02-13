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
import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { spacing } from '@/styles/design-tokens/core/spacing';

interface NavigationButtonProps {
  onClick: () => void;
  icon: string | LucideIcon;
  title: string;
  subtitle?: string;
  extraInfo?: string;
  isSelected?: boolean;
  variant?: 'default' | 'compact';
  // 🏢 ENTERPRISE: Custom icon color for entity type consistency
  iconColor?: string; // e.g., 'text-blue-600', 'text-green-600', etc.
  // Νέο κεντρικοποιημένο badge system
  badgeStatus?: NavigationStatus;
  badgeText?: string; // Override default badge text
  // Backward compatibility
  hasWarning?: boolean; // DEPRECATED: Use badgeStatus='no_projects' instead
  warningText?: string; // DEPRECATED: Use badgeText instead

  // 🔗 ENTERPRISE: Navigation to entity source page
  navigationHref?: string; // e.g., '/contacts/123' for companies
  navigationTooltip?: string; // e.g., 'Άνοιγμα στις Επαφές'

  // 🏢 ENTERPRISE: Keyboard navigation support (ADR-029 Global Search)
  onMouseEnter?: () => void; // For hover-based selection in lists
  onKeyDown?: (event: React.KeyboardEvent) => void; // Custom keyboard handling

  // 🏢 ENTERPRISE: Accessibility for listbox pattern
  role?: 'option' | 'button'; // Default: 'button', use 'option' for listbox items
  ariaSelected?: boolean; // For role="option" items
  ariaLabel?: string; // Custom accessible label

  // 🏢 ENTERPRISE: Additional styling
  className?: string; // Merge with internal classes

  // 🏢 ENTERPRISE: Entity type label badge (for search results)
  entityTypeLabel?: string; // e.g., "ΕΡΓΟ", "ΕΠΑΦΗ" - displayed as badge on right
}

export function NavigationButton({
  onClick,
  icon,
  title,
  subtitle,
  extraInfo,
  isSelected = false,
  variant = 'default',
  iconColor,
  badgeStatus,
  badgeText,
  // Backward compatibility
  hasWarning = false,
  warningText,
  // Navigation props
  navigationHref,
  navigationTooltip,
  // 🏢 ENTERPRISE: Keyboard navigation (ADR-029)
  onMouseEnter,
  onKeyDown,
  // 🏢 ENTERPRISE: Accessibility
  role = 'button',
  ariaSelected,
  ariaLabel,
  // 🏢 ENTERPRISE: Styling
  className,
  // 🏢 ENTERPRISE: Entity type label
  entityTypeLabel,
}: NavigationButtonProps) {
  const router = useRouter();
  const baseClasses = cn(
    'w-full text-left rounded-lg border',
    TRANSITION_PRESETS.STANDARD_COLORS,
    INTERACTIVE_PATTERNS.SUBTLE_HOVER
  );

  // Enterprise variant configuration using design tokens
  const variantConfig = {
    default: {
      padding: spacing.component.padding.md,
      iconSize: 20,
      gap: spacing.component.gap.md
    },
    compact: {
      padding: spacing.component.padding.sm,
      iconSize: 16,
      gap: spacing.component.gap.sm
    }
  } as const;

  const currentVariant = variantConfig[variant];

  // Backward compatibility: χρήση hasWarning για badgeStatus
  const effectiveBadgeStatus = badgeStatus || (hasWarning ? 'no_projects' : undefined);
  const effectiveBadgeText = badgeText || warningText;

  // Enterprise state-based styling
  const stateClasses = cn(
    isSelected && 'border-blue-500 bg-blue-50 dark:bg-blue-900/30',
    !isSelected && effectiveBadgeStatus && `border-orange-300 bg-orange-50 dark:bg-orange-900/20 ${HOVER_BORDER_EFFECTS.ORANGE}`,
    !isSelected && !effectiveBadgeStatus && `border-border ${HOVER_BORDER_EFFECTS.GRAY}`
  );

  const renderIcon = () => {
    if (typeof icon === 'string') {
      // Fallback για emojis
      return <span className={variant === 'compact' ? 'text-lg' : 'text-2xl'}>{icon}</span>;
    } else {
      // Enterprise icon rendering with design tokens
      const IconComponent = icon;
      const colorClass = iconColor || 'text-gray-600 dark:text-gray-400';
      return <IconComponent size={currentVariant.iconSize} className={colorClass} />;
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onKeyDown={onKeyDown}
      role={role}
      aria-selected={role === 'option' ? ariaSelected : undefined}
      aria-label={ariaLabel}
      className={cn(
        baseClasses,
        stateClasses,
        'relative group',
        variant === 'compact' ? 'p-3' : 'p-4',
        className
      )}
    >
      {/* 🔗 ENTERPRISE: Navigation Icon - Enterprise Pattern */}
      {navigationHref && <NavigationLinkOverlay href={navigationHref} tooltip={navigationTooltip} variant={variant} />}

      <div className={cn('flex items-center', variant === 'compact' ? 'gap-2' : 'gap-3')}>
        {renderIcon()}
        <div className="flex-1 min-w-0">
          <div className="text-gray-900 dark:text-foreground font-medium truncate">
            {title}
          </div>
          {subtitle && (
            <div className={`text-sm truncate ${effectiveBadgeStatus ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-muted-foreground'}`}>
              {subtitle}
            </div>
          )}
          {(extraInfo || effectiveBadgeStatus || entityTypeLabel) && (
            <div className="flex items-center justify-between gap-2 mt-1">
              {extraInfo ? (
                <div className={cn(
                  'text-sm truncate min-w-0',
                  effectiveBadgeStatus
                    ? 'text-orange-500 dark:text-orange-400'
                    : 'text-gray-400 dark:text-muted-foreground'
                )}>
                  {extraInfo}
                </div>
              ) : (
                <div className="flex-1" aria-hidden="true" />
              )}
              {/* 🏢 ENTERPRISE: Entity type label badge (ADR-029 Global Search) */}
              {entityTypeLabel && (
                <span className={cn(
                  'shrink-0 uppercase tracking-wider',
                  'text-[10px] font-medium',
                  'px-2 py-0.5',
                  'rounded bg-muted text-muted-foreground'
                )}>
                  {entityTypeLabel}
                </span>
              )}
              {effectiveBadgeStatus && (
                <div className="shrink-0">
                  <UnifiedBadge
                    domain="NAVIGATION"
                    status={effectiveBadgeStatus}
                    customLabel={effectiveBadgeText}
                    size="sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// 🔗 ENTERPRISE: NavigationLinkOverlay Component
// ============================================================================

interface NavigationLinkOverlayProps {
  href: string;
  tooltip?: string;
  variant?: 'default' | 'compact';
}

/**
 * Enterprise-grade navigation overlay component
 * Avoids nested buttons by using semantic HTML
 */
function NavigationLinkOverlay({ href, tooltip = 'Άνοιγμα στις Επαφές', variant = 'default' }: NavigationLinkOverlayProps) {
  const router = useRouter();

  // Enterprise size configuration
  const sizeClasses = {
    default: 'top-3 right-3 p-1.5',
    compact: 'top-2 right-2 p-1'
  };

  const iconSize = variant === 'compact' ? 14 : 16;

  const handleNavigation = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    e.preventDefault();

    // Enterprise navigation pattern
    const shouldOpenNewTab = e.ctrlKey || e.metaKey;

    if (shouldOpenNewTab) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(href);
    }
  };

  return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="link"
            tabIndex={0}
            aria-label={tooltip}
            onClick={handleNavigation}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                // 🏢 ENTERPRISE: Create synthetic mouse event for keyboard activation
                const syntheticEvent = {
                  stopPropagation: () => e.stopPropagation(),
                  preventDefault: () => e.preventDefault(),
                  ctrlKey: e.ctrlKey,
                  metaKey: e.metaKey
                } as React.MouseEvent<HTMLSpanElement>;
                handleNavigation(syntheticEvent);
              }
            }}
            className={cn(
              // Positioning
              'absolute z-10',
              sizeClasses[variant],

              // Visibility
              'opacity-0 group-hover:opacity-100',

              // Transitions
              'transition-all duration-200',

              // Interaction
              'rounded-md cursor-pointer',
              'hover:bg-accent/10',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',

              // Display
              'inline-flex items-center justify-center'
            )}
          >
            <ExternalLink size={iconSize} className="text-muted-foreground hover:text-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">
            {tooltip}
            <span className="ml-1 opacity-60">
              (Ctrl+Click για νέα καρτέλα)
            </span>
          </p>
        </TooltipContent>
      </Tooltip>
  );
}

export default NavigationButton;