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

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

// 🏢 CENTRALIZED HOOKS
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Centralized positioning tokens (2026-01-22)
import { usePositioningTokens } from '@/hooks/usePositioningTokens';

// 🏢 CENTRALIZED UI PATTERNS
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: Centralized Badge component (single source of truth for all badges)
import { Badge } from '@/components/ui/badge';

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
export const ListCard = forwardRef<HTMLElement, ListCardProps>(function ListCard({
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
  onMouseEnter,
  // Favorites
  isFavorite,
  onToggleFavorite,
  // Actions
  actions = [],
  // Visual
  compact = false,
  hideIcon = false,
  hideStats = false,
  inlineBadges = false,
  allowOverflow = false,
  hoverVariant = 'standard',
  className,
  // Accessibility
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  tabIndex = 0,
  role = 'button',
}, ref) {
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
  // 🏢 ENTERPRISE: Hover variant patterns
  // Pattern used by: VS Code, Salesforce, SAP Fiori, Microsoft Fluent
  // ==========================================================================
  const getHoverClasses = () => {
    switch (hoverVariant) {
      case 'subtle':
        // Command palette/dropdown style: background only, no scale
        // Used in: VS Code Cmd+K, Salesforce Global Search, Slack search
        return 'transition-colors duration-150 hover:bg-accent/50';
      case 'none':
        // No hover effect - for embedded cards in other interactive elements
        return '';
      case 'standard':
      default:
        // Full card hover with scale and shadow
        // Used in: Standalone lists like ParkingsList, BuildingsList
        return INTERACTIVE_PATTERNS.CARD_STANDARD;
    }
  };

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
  // 🏢 BADGE: Now using centralized Badge component (single source of truth)
  // Removed local getBadgeClasses() - all badges use @/components/ui/badge
  // ==========================================================================

  // ==========================================================================
  // 🏢 RENDER - SEMANTIC HTML STRUCTURE
  // ==========================================================================
  return (
    <article
      ref={ref}
      className={cn(
        // Base styles using centralized tokens
        // 🏢 ENTERPRISE: overflow-hidden is conditional via allowOverflow prop
        // When allowOverflow=true, hover effects (scale/shadow) can extend beyond card
        'relative group cursor-pointer w-full',
        !allowOverflow && 'overflow-hidden',
        quick.card,
        'border',
        // Spacing based on compact mode - 🏢 ENTERPRISE: Centralized spacing
        spacing.padding.sm,
        // 🏢 ENTERPRISE: Hover variant from prop (standard/subtle/none)
        getHoverClasses(),
        // Selection state using centralized colors
        isSelected
          ? cn(getStatusBorder('info'), colors.bg.info, 'shadow-sm')
          : cn('border-border', colors.bg.card, INTERACTIVE_PATTERNS.BORDER_SUBTLE),
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      role={role}
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
            `absolute ${positioning.top.sm} ${positioning.right.sm} flex ${spacing.gap.sm}`,
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
                `${spacing.padding.xs} rounded-md transition-colors`,
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
      <header className={cn('overflow-hidden', spacing.margin.bottom.sm)}>
        {/* Row 1: Icon + Title (+ inline badges if enabled) */}
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

          {/* Title & Subtitle - 🏢 ENTERPRISE: Using centralized typography */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {/* 🏢 PR1.2: Inline badges support - Title + Badge on same row */}
            <div className={cn('flex items-center', spacing.gap.sm)}>
              <h3
                className={cn(
                  'truncate',
                  compact ? typography.card.titleCompact : typography.card.title,
                  colors.text.primary,
                  inlineBadges ? 'flex-shrink' : ''
                )}
              >
                {title}
              </h3>

              {/* Inline badges (when inlineBadges=true) - 🏢 ENTERPRISE: Using centralized Badge */}
              {inlineBadges && badges.length > 0 && (
                <>
                  {badges.slice(0, 1).map((badge, index) => (
                    <Badge
                      key={`inline-${badge.label}-${index}`}
                      variant={badge.variant as 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' | 'error'}
                      className={cn('whitespace-nowrap flex-shrink-0', badge.className)}
                    >
                      {badge.label}
                    </Badge>
                  ))}
                </>
              )}
            </div>

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

        {/* Row 2: Badges (separate row when NOT inline) - 🏢 ENTERPRISE: Using centralized Badge */}
        {!inlineBadges && badges.length > 0 && (
          <div className={cn(`flex items-center ${spacing.gap.sm} ${spacing.margin.top.sm} overflow-hidden`)}>
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
      {/* 🏢 STATS SECTION */}
      {/* ================================================================== */}
      {!hideStats && stats.length > 0 && (
        <CardStats
          stats={stats}
          layout="horizontal"
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
});

export default ListCard;
