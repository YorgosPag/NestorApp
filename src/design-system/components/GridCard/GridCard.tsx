'use client';

/**
 * 🏢 ENTERPRISE GRID CARD - Molecule Component
 *
 * Centralized card component for grid/tile views.
 * Designed with vertical layout and enhanced visual hierarchy.
 *
 * @fileoverview Reusable grid card molecule for tile-based layouts.
 * @enterprise Fortune 500 compliant - SAP/Salesforce pattern
 * @see ListCard for horizontal list view equivalent
 * @see CardIcon, CardStats for primitive components
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

// 🏢 CENTRALIZED HOOKS
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { usePositioningTokens } from '@/hooks/usePositioningTokens';

// 🏢 CENTRALIZED UI PATTERNS
import { INTERACTIVE_PATTERNS, COMPLEX_HOVER_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: Centralized Badge component
import { Badge } from '@/components/ui/badge';

// 🏢 CENTRALIZED ENTITY CONFIG
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';

// 🏢 DESIGN SYSTEM PRIMITIVES
import { CardIcon } from '../../primitives/Card/CardIcon';
import { CardStats } from '../../primitives/Card/CardStats';

// 🏢 TYPES
import type { GridCardProps, GridCardAction } from './GridCard.types';

/**
 * 🏢 GridCard Component
 *
 * A reusable card component for grid/tile views that follows Enterprise standards.
 * Uses vertical layout with icon at top, optimized for visual scanning.
 *
 * Key differences from ListCard:
 * - Vertical layout (icon/title at top)
 * - More visual prominence for badges
 * - Better suited for 2-4 column grids
 * - Enhanced hover effects
 *
 * @example
 * ```tsx
 * <GridCard
 *   entityType="unit"
 *   title="Διαμέρισμα Α1"
 *   subtitle="apartment"
 *   badges={[{ label: 'Προς πώληση', variant: 'warning' }]}
 *   stats={[
 *     { icon: Ruler, label: 'Εμβαδόν', value: '85 m²' },
 *   ]}
 *   isSelected={selected === 'a1'}
 *   onClick={() => setSelected('a1')}
 * />
 * ```
 */
export function GridCard({
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
}: GridCardProps) {
  // ==========================================================================
  // 🏢 CENTRALIZED HOOKS
  // ==========================================================================
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, getStatusBorder } = useBorderTokens();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const positioning = usePositioningTokens();

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
    action: GridCardAction
  ) => {
    event.stopPropagation();
    action.onClick(event);
  };

  // ==========================================================================
  // 🏢 RENDER - SEMANTIC HTML STRUCTURE (Vertical Layout)
  // ==========================================================================
  return (
    <article
      className={cn(
        // Base styles
        'relative group cursor-pointer overflow-hidden w-full',
        quick.card,
        'border rounded-lg',
        // Padding - slightly more than ListCard for visual hierarchy
        compact ? spacing.padding.sm : spacing.padding.md,
        // Hover effects - enhanced for grid view
        COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
        // Selection state - matches ListCard for consistency
        isSelected
          ? cn(getStatusBorder('info'), colors.bg.info, 'ring-2 ring-primary shadow-lg')
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
      {/* 🏢 HOVER ACTIONS (Top Right) */}
      {/* ================================================================== */}
      {(onToggleFavorite || actions.length > 0) && (
        <nav
          className={cn(
            `absolute ${positioning.top.sm} ${positioning.right.sm} flex ${spacing.gap.sm}`,
            'opacity-0 group-hover:opacity-100 transition-opacity z-10'
          )}
          aria-label="Card actions"
        >
          {/* Favorite button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={handleFavoriteClick}
              className={cn(
                `${spacing.padding.xs} rounded-md transition-colors`,
                colors.bg.card,
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
                `${spacing.padding.xs} rounded-md transition-colors`,
                colors.bg.card,
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
      {/* 🏢 HEADER: Icon + Title + Subtitle (Vertical Layout) */}
      {/* ================================================================== */}
      <header className={cn('overflow-hidden', spacing.margin.bottom.sm)}>
        {/* Row 1: Icon + Title */}
        <div className={`flex items-center ${spacing.gap.sm}`}>
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
          <div className="flex-1 min-w-0 overflow-hidden">
            <h3
              className={cn(
                'truncate',
                compact ? typography.card.titleCompact : typography.card.title,
                colors.text.primary
              )}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                className={cn(
                  'truncate',
                  compact ? typography.card.subtitleCompact : typography.card.subtitle,
                  colors.text.muted
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Badges */}
        {badges.length > 0 && (
          <div className={cn(`flex items-center flex-wrap ${spacing.gap.sm} ${spacing.margin.top.sm}`)}>
            {badges.slice(0, 2).map((badge, index) => (
              <Badge
                key={`${badge.label}-${index}`}
                variant={badge.variant as 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'error'}
                className={cn('whitespace-nowrap', badge.className)}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {/* ================================================================== */}
      {/* 🏢 STATS SECTION (Vertical Layout - Stacked) */}
      {/* ================================================================== */}
      {!hideStats && stats.length > 0 && (
        <CardStats
          stats={stats}
          layout="vertical"
          compact={compact}
          className={spacing.margin.top.sm}
        />
      )}

      {/* ================================================================== */}
      {/* 🏢 CUSTOM CONTENT */}
      {/* ================================================================== */}
      {children && (
        <div className={spacing.margin.top.sm}>
          {children}
        </div>
      )}

      {/* ================================================================== */}
      {/* 🏢 SELECTION INDICATOR (Left Border) */}
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

GridCard.displayName = 'GridCard';

export default GridCard;
