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
 * @see CardHeaderBlock, CardBody, CardActionsToolbar for the shared primitives
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';
import { cn } from '@/lib/utils';

// 🏢 CENTRALIZED UI PATTERNS
import { INTERACTIVE_PATTERNS, COMPLEX_HOVER_EFFECTS } from '@/components/ui/effects';

// 🏢 DESIGN SYSTEM PRIMITIVES
import { CardActionsToolbar } from '../../primitives/Card/CardActionsToolbar';
import { CardHeaderBlock } from '../../primitives/Card/CardHeaderBlock';
import { CardBody } from '../../primitives/Card/CardBody';
import { CardSelectionIndicator } from '../../primitives/Card/CardSelectionIndicator';
import { useCardShell } from '../../primitives/Card/useCardShell';
import { pickCardIdentity } from '../../primitives/Card/card-identity';

// 🏢 TYPES
import type { GridCardProps } from './GridCard.types';
import '@/lib/design-system';

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
export function GridCard(props: GridCardProps) {
  // Only what this shell's own element renders is unpacked here; every other
  // prop travels to the primitive that owns it, defaults and all.
  const {
    title,
    isSelected = false,
    compact = false,
    className,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    tabIndex = 0,
  } = props;

  // ==========================================================================
  // 🏢 CENTRALIZED HOOKS
  // ==========================================================================
  const { colors, quick, getStatusBorder, spacing, handleClick, handleKeyDown } =
    useCardShell(props);

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
      tabIndex={tabIndex}
      aria-label={ariaLabel || title}
      aria-describedby={ariaDescribedBy}
      aria-selected={isSelected}
    >
      {/* ================================================================== */}
      {/* 🏢 HOVER ACTIONS (Top Right) */}
      {/* ================================================================== */}
      <CardActionsToolbar
        isFavorite={props.isFavorite}
        onToggleFavorite={props.onToggleFavorite}
        actions={props.actions}
        density="compact"
        overlay
      />

      {/* ================================================================== */}
      {/* 🏢 HEADER: Icon + Title + Subtitle (Vertical Layout) */}
      {/* ================================================================== */}
      {/* Badges wrap onto further lines - a tile has the vertical room */}
      <CardHeaderBlock
        {...pickCardIdentity(props)}
        badges={props.badges}
        badgeRowClassName="flex-wrap"
      />

      {/* ================================================================== */}
      {/* 🏢 STATS (Stacked) + CUSTOM CONTENT */}
      {/* ================================================================== */}
      <CardBody
        stats={props.hideStats ? undefined : props.stats}
        statsLayout="vertical"
        compact={compact}
      >
        {props.children}
      </CardBody>

      {/* ================================================================== */}
      {/* 🏢 SELECTION INDICATOR (Left Border) */}
      {/* ================================================================== */}
      <CardSelectionIndicator isSelected={isSelected} />
    </article>
  );
}

GridCard.displayName = 'GridCard';

export default GridCard;
