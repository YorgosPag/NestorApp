'use client';

/**
 * 🏢 DOMAIN CARD SHELL (ADR-585)
 *
 * Single source of truth for wiring a computed {@link CardViewModel} + the
 * shared interaction props into the correct design-system shell. Every domain
 * `XxxGridCard` / `XxxListCard` is a thin typed adapter that computes its model
 * via `useXxxCardModel()` and delegates rendering here — so the interaction
 * plumbing and the `<GridCard>` / `<ListCard>` render live in ONE place instead
 * of being copy-pasted across ~22 wrapper files.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 * @see ADR-013 Enterprise card system (atomic design)
 */

import React from 'react';

import { GridCard, ListCard } from '@/design-system';

import type { CardViewModel, DomainCardInteraction } from './card-model.types';

export interface DomainCardProps extends DomainCardInteraction {
  /** Which design-system shell to render into */
  variant: 'grid' | 'list';
  /** The computed, view-agnostic card model */
  model: CardViewModel;
  /** List-only enrichment content rendered inside the shell (e.g. address badges) */
  children?: React.ReactNode;
}

/**
 * Render a domain card model into the Grid or List shell.
 */
export function DomainCard({
  variant,
  model,
  children,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: DomainCardProps) {
  const { ariaLabel, ...cardProps } = model;

  // Shared prop set forwarded to whichever shell is selected.
  const shellProps = {
    ...cardProps,
    isSelected,
    onClick: onSelect,
    isFavorite,
    onToggleFavorite,
    compact,
    className,
    'aria-label': ariaLabel,
  };

  return variant === 'grid' ? (
    <GridCard {...shellProps} />
  ) : (
    <ListCard {...shellProps}>{children}</ListCard>
  );
}

DomainCard.displayName = 'DomainCard';
