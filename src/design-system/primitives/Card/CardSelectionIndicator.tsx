'use client';

/**
 * 🏢 ENTERPRISE CARD SELECTION INDICATOR - Primitive Component
 *
 * The accent rail marking a selected card. Purely decorative: the selected
 * state itself is announced by the card shell's ARIA attributes, so this is
 * hidden from assistive technology.
 *
 * @fileoverview Reusable selection rail for card components.
 * @enterprise Fortune 500 compliant - Single source of truth for the selected affordance
 * @see GridCard, ListCard for consumers
 * @author Enterprise Architecture Team
 * @since 2026-07-16
 */

import React from 'react';

/**
 * Props for CardSelectionIndicator
 */
export interface CardSelectionIndicatorProps {
  /** Whether the card is selected - renders nothing when false */
  isSelected?: boolean;
}

/**
 * 🏢 CardSelectionIndicator Component
 *
 * Positions itself against the nearest positioned ancestor, so the card shell
 * must be `relative`.
 *
 * @example
 * ```tsx
 * <article className="relative ...">
 *   <CardSelectionIndicator isSelected={isSelected} />
 * </article>
 * ```
 */
export function CardSelectionIndicator({ isSelected = false }: CardSelectionIndicatorProps) {
  if (!isSelected) {
    return null;
  }

  return (
    <div
      className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
      aria-hidden="true"
    />
  );
}

CardSelectionIndicator.displayName = 'CardSelectionIndicator';

export default CardSelectionIndicator;
