'use client';

/**
 * 🏢 SPOT CARD SHELL (ADR-585)
 *
 * Shared shell for "spatial spot" domain cards (parking / storage / property)
 * whose Grid views support **shift-click multi-select** + keyboard activation.
 * The `handleClick` / `handleKeyDown` logic was previously copy-pasted byte-for-
 * byte across every spatial Grid card (the parking↔storage cross-clone); it now
 * lives here once. The List variant additionally forwards hover-sync props.
 *
 * Distinct from {@link DomainCard} (plain single-click shell) because the
 * interaction contract genuinely differs — merging both into one shell would
 * mean an either/or god-component. Same {@link CardViewModel} feeds both.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import React from 'react';

import { GridCard, ListCard } from '@/design-system';

import type { CardViewModel, SpotCardInteraction } from './card-model.types';

export interface SpotCardProps extends SpotCardInteraction {
  /** Which design-system shell to render into */
  variant: 'grid' | 'list';
  /** The computed, view-agnostic card model */
  model: CardViewModel;
}

/**
 * Render a spatial-spot card model into the Grid or List shell, wiring the
 * shared shift-click + keyboard multi-select handlers.
 */
export function SpotCard({
  variant,
  model,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
  isHovered = false,
  onMouseEnter,
  onMouseLeave,
}: SpotCardProps) {
  const { ariaLabel, ...cardProps } = model;

  const handleClick = () => {
    onSelect?.(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(event.shiftKey || event.metaKey);
    }
  };

  const shellProps = {
    ...cardProps,
    isSelected,
    onClick: handleClick,
    onKeyDown: handleKeyDown,
    isFavorite,
    onToggleFavorite,
    compact,
    className,
    'aria-label': ariaLabel,
  };

  return variant === 'grid' ? (
    <GridCard {...shellProps} />
  ) : (
    <ListCard
      {...shellProps}
      isHovered={isHovered}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

SpotCard.displayName = 'SpotCard';
