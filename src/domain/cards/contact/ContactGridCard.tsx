'use client';

/**
 * 👤 ENTERPRISE CONTACT GRID CARD - Domain Component
 *
 * Domain-specific card for contacts in grid/tile views.
 * Extends GridCard with contact-specific defaults and stats.
 *
 * @fileoverview Contact domain card using centralized GridCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see GridCard for base component
 * @see ContactListCard for list view equivalent
 * @see NAVIGATION_ENTITIES for entity config
 * @author Enterprise Architecture Team
 * @since 2026-01-24
 */

import React, { useMemo } from 'react';
import { Briefcase } from 'lucide-react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 DESIGN SYSTEM
import { GridCard } from '@/design-system';
import type { StatItem } from '@/design-system';

// 🏢 DOMAIN TYPES
import type { Contact } from '@/types/contacts';
import {
  getContactDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  isIndividualContact,
  isCompanyContact,
  isServiceContact,
} from '@/types/contacts';

// 🏢 BADGE VARIANT MAPPING
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
// 🏢 CONTACT TYPE TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

const TYPE_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  individual: 'info',
  company: 'secondary',
  service: 'warning',
};

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 👤 ContactGridCard Component
 *
 * Domain-specific card for contacts in grid views.
 * Uses GridCard with contact defaults from NAVIGATION_ENTITIES.
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
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');

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

    // Email - 🏢 ENTERPRISE: Using centralized email icon/color
    if (email) {
      items.push({
        icon: NAVIGATION_ENTITIES.email.icon,
        iconColor: NAVIGATION_ENTITIES.email.color,
        label: 'Email',
        value: email,
      });
    }

    // Phone - 🏢 ENTERPRISE: Using centralized phone icon/color + i18n label
    if (phone) {
      items.push({
        icon: NAVIGATION_ENTITIES.phone.icon,
        iconColor: NAVIGATION_ENTITIES.phone.color,
        label: t('card.labels.phone'),
        value: phone,
      });
    }

    // Profession (for individuals) or VAT (for companies) - 🏢 ENTERPRISE: i18n labels
    if (isIndividualContact(contact) && contact.profession) {
      items.push({
        icon: Briefcase,
        label: t('card.labels.profession'),
        value: contact.profession,
      });
    } else if (isCompanyContact(contact) && contact.vatNumber) {
      items.push({
        icon: NAVIGATION_ENTITIES.vat.icon,
        iconColor: NAVIGATION_ENTITIES.vat.color,
        label: t('card.labels.vat'),
        value: contact.vatNumber,
      });
    }

    return items;
  }, [contact, email, phone, t]);

  /** Build badges from contact type - 🏢 ENTERPRISE: i18n labels */
  const badges = useMemo(() => {
    const contactType = contact.type || 'individual';
    const typeLabel = t(`types.${contactType}`);
    const variant = TYPE_BADGE_VARIANTS[contactType] || 'default';

    return [{ label: typeLabel, variant }];
  }, [contact.type, t]);

  /** Get subtitle based on contact type - shows profession/industry/department */
  const subtitle = useMemo(() => {
    if (isIndividualContact(contact)) {
      return contact.profession ?? undefined;
    } else if (isCompanyContact(contact)) {
      return contact.industry ?? undefined;
    } else if (isServiceContact(contact)) {
      return contact.department ?? undefined;
    }
    return undefined;
  }, [contact]);

  /** 🏢 ENTERPRISE: Get contact icon and color based on type */
  const contactIconConfig = useMemo(() => {
    const contactType = contact.type || 'individual';
    switch (contactType) {
      case 'individual':
        return NAVIGATION_ENTITIES.contactIndividual;
      case 'company':
        return NAVIGATION_ENTITIES.contactCompany;
      case 'service':
        return NAVIGATION_ENTITIES.contactService;
      default:
        return NAVIGATION_ENTITIES.contactIndividual;
    }
  }, [contact.type]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <GridCard
      customIcon={contactIconConfig.icon}
      customIconColor={contactIconConfig.color}
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
      aria-label={t('list.contactAriaLabel', { name: displayName })}
    />
  );
}

ContactGridCard.displayName = 'ContactGridCard';

export default ContactGridCard;
