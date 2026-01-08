'use client';

/**
 * 🏢 ENTERPRISE CARD ICON - Primitive Component
 *
 * Centralized icon component for cards that leverages NAVIGATION_ENTITIES.
 * Eliminates duplicate icon/color definitions across the application.
 *
 * @fileoverview Reusable icon primitive for card components.
 * @enterprise Fortune 500 compliant - Uses existing centralized systems
 * @see NAVIGATION_ENTITIES for icon/color source of truth
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import {
  NAVIGATION_ENTITIES,
  type NavigationEntityType,
} from '@/components/navigation/config/navigation-entities';
import type { CardIconProps, CardIconSize } from './types';
import { CARD_SIZES, CARD_ROUNDED } from './types';

/**
 * 🏢 CardIcon Component
 *
 * Displays an entity icon with proper styling from centralized systems.
 *
 * @example
 * ```tsx
 * // Using entity type (recommended - uses NAVIGATION_ENTITIES)
 * <CardIcon entityType="building" size="md" />
 *
 * // Using custom icon
 * <CardIcon icon={CustomIcon} color="text-blue-600" size="lg" />
 *
 * // Filled variant with background
 * <CardIcon entityType="parking" variant="filled" size="md" />
 * ```
 */
export function CardIcon({
  entityType,
  icon: CustomIcon,
  color: customColor,
  size = 'md',
  variant = 'default',
  className,
  backgroundColor,
  rounded = 'md',
  'aria-label': ariaLabel,
}: CardIconProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();

  // Get icon and color from NAVIGATION_ENTITIES if entityType is provided
  const entityConfig = entityType ? NAVIGATION_ENTITIES[entityType] : null;
  const IconComponent = CustomIcon || entityConfig?.icon;
  const iconColor = customColor || entityConfig?.color || colors.text.primary;

  // If no icon available, return null
  if (!IconComponent) {
    return null;
  }

  // Size mapping using centralized icon sizes
  const sizeMap: Record<CardIconSize, string> = {
    xs: iconSizes.xs,
    sm: iconSizes.sm,
    md: iconSizes.md,
    lg: iconSizes.lg,
    xl: iconSizes.xl,
  };

  // Container size for filled/outlined variants
  const containerSizeMap: Record<CardIconSize, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
  };

  // Variant-specific styling
  const variantStyles = {
    default: '',
    outlined: cn(
      'flex items-center justify-center',
      containerSizeMap[size],
      'border-2 border-border',
      radius.md,
      CARD_ROUNDED[rounded]
    ),
    filled: cn(
      'flex items-center justify-center',
      containerSizeMap[size],
      backgroundColor || getBackgroundFromColor(iconColor),
      CARD_ROUNDED[rounded]
    ),
    ghost: cn(
      'flex items-center justify-center',
      containerSizeMap[size],
      'hover:bg-accent/50 transition-colors',
      CARD_ROUNDED[rounded]
    ),
  };

  // Accessibility label
  const accessibilityLabel = ariaLabel || entityConfig?.description || 'Icon';

  // Default variant - just the icon
  if (variant === 'default') {
    return (
      <IconComponent
        className={cn(sizeMap[size], iconColor, className)}
        aria-label={accessibilityLabel}
      />
    );
  }

  // Wrapped variants (outlined, filled, ghost)
  return (
    <span
      className={cn(variantStyles[variant], className)}
      role="img"
      aria-label={accessibilityLabel}
    >
      <IconComponent
        className={cn(
          sizeMap[size],
          variant === 'filled' ? 'text-white' : iconColor
        )}
      />
    </span>
  );
}

/**
 * Helper function to get a background color from text color
 * Maps text-{color}-600 to bg-{color}-100 for filled variant
 */
function getBackgroundFromColor(textColor: string): string {
  // Extract color name from text-{color}-600 pattern
  const match = textColor.match(/text-(\w+)-\d+/);
  if (match) {
    const colorName = match[1];
    return `bg-${colorName}-100 dark:bg-${colorName}-900/30`;
  }
  return 'bg-muted';
}

CardIcon.displayName = 'CardIcon';

export default CardIcon;
