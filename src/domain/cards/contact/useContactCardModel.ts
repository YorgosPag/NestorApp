'use client';

/**
 * 👤 CONTACT CARD VIEW-MODEL HOOK (ADR-585)
 *
 * Computes the shared, view-agnostic props consumed by BOTH ContactGridCard
 * and ContactListCard. Extracted from the previously-duplicated computation
 * block (jscpd twin) so the two wrappers stay thin — differing only in shell
 * (`<GridCard>` vs `<ListCard>`) and List-only address enrichment children.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 * @see ContactGridCard / ContactListCard for the thin wrappers
 */

import { useMemo } from 'react';
import { Briefcase } from 'lucide-react';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { StatItem } from '@/design-system';
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Contact } from '@/types/contacts';
import {
  getContactDisplayName,
  getPrimaryEmail,
  getPrimaryPhone,
  isIndividualContact,
  isCompanyContact,
  isServiceContact,
} from '@/types/contacts';
import '@/lib/design-system';

import type { CardViewModel } from '../shared/card-model.types';

// =============================================================================
// 🏢 CONTACT TYPE TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

const TYPE_BADGE_VARIANTS: Record<string, GridCardBadgeVariant> = {
  individual: 'info',
  company: 'secondary',
  service: 'warning',
};

/**
 * Build the shared Contact card view-model (title, subtitle, icon, badges, stats, aria).
 */
export function useContactCardModel(contact: Contact): CardViewModel {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);

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

  return {
    customIcon: contactIconConfig.icon,
    customIconColor: contactIconConfig.color,
    title: displayName,
    subtitle,
    badges,
    stats,
    ariaLabel: t('list.contactAriaLabel', { name: displayName }),
  };
}
