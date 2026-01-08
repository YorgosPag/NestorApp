'use client';

/**
 * 🏢 ENTERPRISE LIST CARD - Molecule Component
 *
 * Centralized card component for list views.
 * Eliminates duplicate list item patterns across the application.
 *
 * @fileoverview Reusable list card molecule that composes primitives.
 * @enterprise Fortune 500 compliant
 * @see CardIcon, CardStats for primitive components
 * @see NAVIGATION_ENTITIES for entity icons/colors
 * @see INTERACTIVE_PATTERNS for hover effects
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

// 🏢 CENTRALIZED HOOKS
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// 🏢 CENTRALIZED UI PATTERNS
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

// 🏢 CENTRALIZED ENTITY CONFIG
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';

// 🏢 DESIGN SYSTEM PRIMITIVES
import { CardIcon } from '../../primitives/Card/CardIcon';
import { CardStats } from '../../primitives/Card/CardStats';

// 🏢 TYPES
import type { ListCardProps, ListCardAction } from './ListCard.types';

/**
 * 🏢 ListCard Component
 *
 * A reusable card component for list views that follows Enterprise standards.
 * Uses semantic HTML, centralized systems, and ZERO hardcoded values.
 *
 * @example
 * ```tsx
 * <ListCard
 *   entityType="parking"
 *   title="P-001"
 *   subtitle="Τυπική Θέση"
 *   badges={[{ label: 'Διαθέσιμη', variant: 'success' }]}
 *   stats={[
 *     { icon: Ruler, label: 'Εμβαδόν', value: '15 m²' },
 *     { icon: Euro, label: 'Τιμή', value: '€25,000' },
 *   ]}
 *   isSelected={selected === 'p-001'}
 *   onClick={() => setSelected('p-001')}
 * />
 * ```
 */
export function ListCard({
  // Identity
  entityType,
  customIcon,
  customIconColor,
  title,
  subtitle,
  // Content
  badges = [],
  stats = [],
  children,
  // Selection
  isSelected = false,
  onClick,
  onKeyDown,
  // Favorites
  isFavorite,
  onToggleFavorite,
  // Actions
  actions = [],
  // Visual
  compact = false,
  hideIcon = false,
  hideStats = false,
  className,
  // Accessibility
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  tabIndex = 0,
}: ListCardProps) {
  // ==========================================================================
  // 🏢 CENTRALIZED HOOKS
  // ==========================================================================
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, getStatusBorder } = useBorderTokens();

  // ==========================================================================
  // 🏢 COMPUTED VALUES FROM CENTRALIZED SYSTEMS
  // ==========================================================================
  const entityConfig = entityType ? NAVIGATION_ENTITIES[entityType] : null;

  // ==========================================================================
  // 🏢 EVENT HANDLERS
  // ==========================================================================
  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    // Accessibility: Enter or Space to select
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
    onKeyDown?.(event);
  };

  const handleFavoriteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleFavorite?.();
  };

  const handleActionClick = (
    event: React.MouseEvent,
    action: ListCardAction
  ) => {
    event.stopPropagation();
    action.onClick(event);
  };

  // ==========================================================================
  // 🏢 BADGE VARIANT MAPPING (uses centralized colors)
  // ==========================================================================
  const getBadgeClasses = (variant: string = 'default'): string => {
    const variantMap: Record<string, string> = {
      default: cn(colors.bg.muted, colors.text.primary),
      secondary: cn(colors.bg.secondary, colors.text.secondary),
      destructive: cn(colors.bg.error, 'text-white'),
      outline: cn('bg-transparent border', colors.text.primary),
      success: cn(colors.bg.success, colors.text.success),
      warning: cn(colors.bg.warning, colors.text.warning),
      info: cn(colors.bg.info, colors.text.info),
    };
    return variantMap[variant] || variantMap.default;
  };

  // ==========================================================================
  // 🏢 RENDER - SEMANTIC HTML STRUCTURE
  // ==========================================================================
  return (
    <article
      className={cn(
        // Base styles using centralized tokens
        'relative group cursor-pointer',
        quick.card,
        'border',
        // Spacing based on compact mode
        compact ? 'p-2' : 'p-3',
        // Interactive patterns from centralized system
        INTERACTIVE_PATTERNS.CARD_STANDARD,
        // Selection state using centralized colors
        isSelected
          ? cn(getStatusBorder('info'), colors.bg.info, 'shadow-sm')
          : cn('border-border', colors.bg.card, INTERACTIVE_PATTERNS.BORDER_SUBTLE),
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={tabIndex}
      aria-label={ariaLabel || title}
      aria-describedby={ariaDescribedBy}
      aria-selected={isSelected}
    >
      {/* ================================================================== */}
      {/* 🏢 HOVER ACTIONS */}
      {/* ================================================================== */}
      {(onToggleFavorite || actions.length > 0) && (
        <nav
          className={cn(
            'absolute top-2 right-2 flex gap-1',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
          aria-label="Card actions"
        >
          {/* Favorite button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={handleFavoriteClick}
              className={cn(
                'p-1 rounded-md transition-colors',
                isFavorite
                  ? 'text-yellow-500'
                  : cn(colors.text.muted, 'hover:text-yellow-500')
              )}
              aria-label={isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
              aria-pressed={isFavorite}
            >
              <Star className={cn(iconSizes.sm, isFavorite && 'fill-current')} />
            </button>
          )}

          {/* Additional actions */}
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={(e) => handleActionClick(e, action)}
              disabled={action.disabled}
              className={cn(
                'p-1 rounded-md transition-colors',
                colors.text.muted,
                'hover:text-primary',
                action.disabled && 'opacity-50 cursor-not-allowed',
                action.className
              )}
              aria-label={action.label}
            >
              <action.icon className={iconSizes.sm} />
            </button>
          ))}
        </nav>
      )}

      {/* ================================================================== */}
      {/* 🏢 HEADER: Icon + Title + Badges */}
      {/* ================================================================== */}
      <header className={cn('flex items-center gap-2', compact ? 'mb-1.5' : 'mb-2')}>
        {/* Entity Icon */}
        {!hideIcon && (entityType || customIcon) && (
          <CardIcon
            entityType={entityType}
            icon={customIcon}
            color={customIconColor}
            size={compact ? 'sm' : 'md'}
          />
        )}

        {/* Title & Subtitle */}
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'font-medium truncate',
              compact ? 'text-sm' : 'text-base',
              colors.text.primary
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p
              className={cn(
                'truncate',
                compact ? 'text-xs' : 'text-sm',
                colors.text.muted
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Badges (max 2 recommended per Enterprise spec) */}
        {badges.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {badges.slice(0, 2).map((badge, index) => (
              <span
                key={`${badge.label}-${index}`}
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  getBadgeClasses(badge.variant),
                  badge.className
                )}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* ================================================================== */}
      {/* 🏢 STATS SECTION */}
      {/* ================================================================== */}
      {!hideStats && stats.length > 0 && (
        <CardStats
          stats={stats}
          layout="horizontal"
          compact={compact}
          className={compact ? 'mt-1.5' : 'mt-2'}
        />
      )}

      {/* ================================================================== */}
      {/* 🏢 CUSTOM CONTENT */}
      {/* ================================================================== */}
      {children && (
        <div className={compact ? 'mt-1.5' : 'mt-2'}>
          {children}
        </div>
      )}

      {/* ================================================================== */}
      {/* 🏢 SELECTION INDICATOR */}
      {/* ================================================================== */}
      {isSelected && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
          aria-hidden="true"
        />
      )}
    </article>
  );
}

ListCard.displayName = 'ListCard';

export default ListCard;
