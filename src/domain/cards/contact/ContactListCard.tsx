'use client';

/**
 * 👤 ENTERPRISE CONTACT LIST CARD - Domain Component
 *
 * Thin wrapper: computes the shared view-model via useContactCardModel (ADR-585)
 * and renders it into the ListCard shell. List-only concern = address enrichment
 * mini-badges (ADR-332 Phase 10) rendered as children.
 *
 * @fileoverview Contact domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see useContactCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Contact } from '@/types/contacts';

// ADR-332 Phase 10 — address enrichment mini-badges
import { AddressSourceLabel, AddressFreshnessIndicator, computeFreshness } from '@/components/shared/addresses/editor';

// 🏢 SHARED VIEW-MODEL (ADR-585)
import { useContactCardModel } from './useContactCardModel';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface ContactListCardProps {
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
 * 👤 ContactListCard Component
 *
 * Domain-specific card for contacts in list views.
 *
 * @example
 * ```tsx
 * <ContactListCard
 *   contact={contact}
 *   isSelected={selectedId === contact.id}
 *   onSelect={() => setSelectedId(contact.id)}
 *   onToggleFavorite={() => toggleFavorite(contact.id)}
 *   isFavorite={favorites.has(contact.id)}
 * />
 * ```
 */
export function ContactListCard({
  contact,
  isSelected = false,
  isFavorite,
  onSelect,
  onToggleFavorite,
  compact = false,
  className,
}: ContactListCardProps) {
  const { ariaLabel, ...cardProps } = useContactCardModel(contact);

  /** Address enrichment badges for primary address (ADR-332 Phase 10) */
  const addressEnrichment = useMemo(() => {
    const primaryAddr = contact.addresses?.find(a => a.isPrimary) ?? contact.addresses?.[0];
    if (!primaryAddr?.source && primaryAddr?.verifiedAt == null) return null;
    return {
      source: primaryAddr.source,
      freshness: computeFreshness(primaryAddr.verifiedAt ?? null),
    };
  }, [contact.addresses]);

  return (
    <ListCard
      {...cardProps}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={ariaLabel}
    >
      {addressEnrichment && (
        <div className="flex items-center gap-1.5 pt-1">
          {addressEnrichment.source && (
            <AddressSourceLabel source={addressEnrichment.source} />
          )}
          <AddressFreshnessIndicator freshness={addressEnrichment.freshness} />
        </div>
      )}
    </ListCard>
  );
}

ContactListCard.displayName = 'ContactListCard';

export default ContactListCard;
