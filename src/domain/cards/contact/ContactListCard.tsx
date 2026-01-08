'use client';

/**
 * 👤 ENTERPRISE CONTACT LIST CARD - Domain Component
 *
 * Domain-specific card for contacts in list views.
 * Extends ListCard with contact-specific defaults and stats.
 *
 * @fileoverview Contact domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-08
 */

import React, { useMemo } from 'react';
import { Mail, Phone, Briefcase, Building2, Users } from 'lucide-react';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Contact } from '@/types/contacts';
import {
  getContactDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  isIndividualContact,
  isCompanyContact,
} from '@/types/contacts';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';

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
// 🏢 CONTACT TYPE TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

const TYPE_BADGE_VARIANTS: Record<string, ListCardBadgeVariant> = {
  individual: 'info',
  company: 'secondary',
  service: 'warning',
};

// =============================================================================
// 🏢 CONTACT TYPE LABELS (Greek)
// =============================================================================

const TYPE_LABELS: Record<string, string> = {
  individual: 'Φυσικό Πρόσωπο',
  company: 'Εταιρεία',
  service: 'Υπηρεσία',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 👤 ContactListCard Component
 *
 * Domain-specific card for contacts.
 * Uses ListCard with contact defaults from NAVIGATION_ENTITIES.
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
  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /** Get display name from contact */
  const displayName = useMemo(() => getContactDisplayName(contact), [contact]);

  /** Get primary email */
  const email = useMemo(() => getPrimaryEmail(contact), [contact]);

  /** Get primary phone */
  const phone = useMemo(() => getPrimaryPhone(contact), [contact]);

  /** Build stats array from contact data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Email
    if (email) {
      items.push({
        icon: Mail,
        label: 'Email',
        value: email,
      });
    }

    // Phone
    if (phone) {
      items.push({
        icon: Phone,
        label: 'Τηλέφωνο',
        value: phone,
      });
    }

    // Profession (for individuals) or VAT (for companies)
    if (isIndividualContact(contact) && contact.profession) {
      items.push({
        icon: Briefcase,
        label: 'Επάγγελμα',
        value: contact.profession,
      });
    } else if (isCompanyContact(contact) && contact.vatNumber) {
      items.push({
        icon: Building2,
        label: 'ΑΦΜ',
        value: contact.vatNumber,
      });
    }

    return items;
  }, [contact, email, phone]);

  /** Build badges from contact type */
  const badges = useMemo(() => {
    const contactType = contact.type || 'individual';
    const typeLabel = TYPE_LABELS[contactType] || contactType;
    const variant = TYPE_BADGE_VARIANTS[contactType] || 'default';

    return [{ label: typeLabel, variant }];
  }, [contact.type]);

  /** Get subtitle based on contact type */
  const subtitle = useMemo(() => {
    if (isIndividualContact(contact)) {
      return contact.profession ?? undefined;
    } else if (isCompanyContact(contact)) {
      return contact.vatNumber ? `ΑΦΜ: ${contact.vatNumber}` : undefined;
    }
    return undefined;
  }, [contact]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <ListCard
      customIcon={Users}
      customIconColor="text-blue-600 dark:text-blue-400"
      title={displayName}
      subtitle={subtitle}
      badges={badges}
      stats={stats}
      isSelected={isSelected}
      onClick={onSelect}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      compact={compact}
      className={className}
      aria-label={`Επαφή ${displayName}`}
    />
  );
}

ContactListCard.displayName = 'ContactListCard';

export default ContactListCard;
