'use client';

/**
 * 👤 ENTERPRISE CONTACT LIST CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useContactCardModel
 * (ADR-585) and delegates rendering to the DomainCard list shell. List-only
 * concern = address enrichment mini-badges (ADR-332 Phase 10) as children.
 *
 * @fileoverview Contact domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see useContactCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';

import type { Contact } from '@/types/contacts';
// ADR-332 Phase 10 — address enrichment mini-badges
import { AddressSourceLabel, AddressFreshnessIndicator, computeFreshness } from '@/components/shared/addresses/editor';
import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import { useContactCardModel } from './useContactCardModel';

export interface ContactListCardProps extends DomainCardInteraction {
  /** Contact data */
  contact: Contact;
}

/**
 * 👤 ContactListCard — domain card for contacts in list views.
 */
export function ContactListCard({ contact, ...interaction }: ContactListCardProps) {
  const model = useContactCardModel(contact);

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
    <DomainCard variant="list" model={model} {...interaction}>
      {addressEnrichment && (
        <div className="flex items-center gap-1.5 pt-1">
          {addressEnrichment.source && (
            <AddressSourceLabel source={addressEnrichment.source} />
          )}
          <AddressFreshnessIndicator freshness={addressEnrichment.freshness} />
        </div>
      )}
    </DomainCard>
  );
}

ContactListCard.displayName = 'ContactListCard';

export default ContactListCard;
