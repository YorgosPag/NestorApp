'use client';

/**
 * 🏢 ENTERPRISE LIST CARD - Molecule Component
 *
 * Centralized card component for list views.
 * Eliminates duplicate list item patterns across the application.
 *
 * @fileoverview Reusable list card molecule that composes primitives.
 * @enterprise Fortune 500 compliant
 * @see GridCard for vertical grid/tile view equivalent
 * @see CardHeaderBlock, CardBody, CardActionsToolbar for the shared primitives
 * @see INTERACTIVE_PATTERNS for hover effects
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// 🏢 CENTRALIZED UI PATTERNS
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

// 🏢 DESIGN SYSTEM PRIMITIVES
import { CardActionsToolbar } from '../../primitives/Card/CardActionsToolbar';
import { CardHeaderBlock } from '../../primitives/Card/CardHeaderBlock';
import { CardBody } from '../../primitives/Card/CardBody';
import { CardSelectionIndicator } from '../../primitives/Card/CardSelectionIndicator';
import { useCardShell } from '../../primitives/Card/useCardShell';
import { pickCardIdentity } from '../../primitives/Card/card-identity';

// 🏢 TYPES
import type { ListCardProps } from './ListCard.types';
import '@/lib/design-system';

/**
 * 🏢 ENTERPRISE: Hover variant patterns
 * Pattern used by: VS Code, Salesforce, SAP Fiori, Microsoft Fluent
 */
const HOVER_VARIANT_CLASSES: Record<NonNullable<ListCardProps['hoverVariant']>, string> = {
  // Command palette/dropdown style: background only, no scale
  // Used in: VS Code Cmd+K, Salesforce Global Search, Slack search
  subtle: 'transition-colors duration-150 hover:bg-accent/50',
  // No hover effect - for embedded cards in other interactive elements
  none: '',
  // Full card hover with scale and shadow
  // Used in: Standalone lists like ParkingsList, BuildingsList
  standard: INTERACTIVE_PATTERNS.CARD_STANDARD,
};

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
export const ListCard = forwardRef<HTMLElement, ListCardProps>(function ListCard(props, ref) {
  // Only what this shell's own element renders is unpacked here; every other
  // prop travels to the primitive that owns it, defaults and all.
  const {
    title,
    isSelected = false,
    compact = false,
    isHovered = false,
    allowOverflow = false,
    hoverVariant = 'standard',
    className,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    tabIndex = 0,
    role,
  } = props;

  // ==========================================================================
  // 🏢 CENTRALIZED HOOKS
  // ==========================================================================
  const { colors, quick, getStatusBorder, spacing, handleClick, handleKeyDown } =
    useCardShell(props);

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
        HOVER_VARIANT_CLASSES[hoverVariant],
        // SPEC-237C: External hover highlight (bidirectional sync from canvas)
        isHovered && !isSelected && 'ring-2 ring-primary/40 bg-accent/50',
        // Selection state using centralized colors
        isSelected
          ? cn(getStatusBorder('info'), colors.bg.info, 'shadow-sm')
          : cn('border-border', colors.bg.card, INTERACTIVE_PATTERNS.BORDER_SUBTLE),
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      role={role}
      tabIndex={tabIndex}
      aria-label={ariaLabel || title}
      aria-describedby={ariaDescribedBy}
      aria-pressed={isSelected}
    >
      {/* ================================================================== */}
      {/* 🏢 HOVER ACTIONS */}
      {/* ================================================================== */}
      <CardActionsToolbar
        isFavorite={props.isFavorite}
        onToggleFavorite={props.onToggleFavorite}
        actions={props.actions}
        withTooltips
      />

      {/* ================================================================== */}
      {/* 🏢 HEADER: Icon + Title + Badges */}
      {/* ================================================================== */}
      {/* Badges clip rather than wrap - a list row must keep its height */}
      <CardHeaderBlock
        {...pickCardIdentity(props)}
        badges={props.badges}
        inlineBadges={props.inlineBadges}
        badgeRowClassName="overflow-hidden"
      />

      {/* ================================================================== */}
      {/* 🏢 STATS + CUSTOM CONTENT */}
      {/* ================================================================== */}
      <CardBody
        stats={props.hideStats ? undefined : props.stats}
        statsLayout="horizontal"
        compact={compact}
      >
        {props.children}
      </CardBody>

      {/* ================================================================== */}
      {/* 🏢 SELECTION INDICATOR */}
      {/* ================================================================== */}
      <CardSelectionIndicator isSelected={isSelected} />
    </article>
  );
});

export default ListCard;
