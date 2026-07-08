'use client';

/**
 * 👤 ENTERPRISE CONTACT GRID CARD - Domain Component
 *
 * Thin wrapper: computes the shared view-model via useContactCardModel (ADR-585)
 * and renders it into the GridCard shell. All contact-specific computation lives
 * in the hook and is shared 1:1 with ContactListCard.
 *
 * @fileoverview Contact domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see ContactListCard for list view equivalent
 * @see useContactCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Contact } from '@/types/contacts';

// 🏢 SHARED VIEW-MODEL (ADR-585)
import { useContactCardModel } from './useContactCardModel';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface ContactGridCardProps {
  /** Contact data */
  contact: Contact;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether item is favorite */
  isFavorite?: boolean;
  /** Click handler */
  onSelect?: () => void;
  /** Favorite toggle handler */
  onToggleFavorite?: () => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 👤 ContactGridCard Component
 *
 * Domain-specific card for contacts in grid views.
 *
 * @example
 * ```tsx
 * <ContactGridCard
 *   contact={contact}
 *   isSelected={selectedId === contact.id}
 *   onSelect={() => setSelectedId(contact.id)}
 *   onToggleFavorite={() => toggleFavorite(contact.id)}
 *   isFavorite={favorites.has(contact.id)}
 * />
 * ```
 */
export function ContactGridCard({
  contact,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: ContactGridCardProps) {
  const { ariaLabel, ...cardProps } = useContactCardModel(contact);

  return (
    <GridCard
      {...cardProps}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

ContactGridCard.displayName = 'ContactGridCard';

export default ContactGridCard;
