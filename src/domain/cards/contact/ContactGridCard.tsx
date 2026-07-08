'use client';

/**
 * 👤 ENTERPRISE CONTACT GRID CARD - Domain Component
 *
 * Thin typed adapter: computes the shared view-model via useContactCardModel
 * (ADR-585) and delegates rendering to the DomainCard grid shell.
 *
 * @fileoverview Contact domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ContactListCard for list view equivalent
 * @see useContactCardModel for the shared view-model (ADR-585)
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React from 'react';

import type { Contact } from '@/types/contacts';
import type { DomainCardInteraction } from '../shared/card-model.types';
import { DomainCard } from '../shared/DomainCard';
import { useContactCardModel } from './useContactCardModel';

export interface ContactGridCardProps extends DomainCardInteraction {
  /** Contact data */
  contact: Contact;
}

/**
 * 👤 ContactGridCard — domain card for contacts in grid/tile views.
 */
export function ContactGridCard({ contact, ...interaction }: ContactGridCardProps) {
  const model = useContactCardModel(contact);
  return <DomainCard variant="grid" model={model} {...interaction} />;
}

ContactGridCard.displayName = 'ContactGridCard';

export default ContactGridCard;
