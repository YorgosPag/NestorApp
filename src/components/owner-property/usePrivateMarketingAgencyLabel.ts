'use client';

/**
 * @fileoverview Η ετικέτα γραφείου στην κλειστή διάθεση του ιδιοκτήτη (ADR-864 §18).
 * @related components/owner-property/PrivateMarketingOwnerSection.tsx · components/owner-property/PrivateMarketingOwnerConsent.tsx
 * @module components/owner-property/usePrivateMarketingAgencyLabel
 *
 * 🔑 Ζει σε δικό της module επειδή τη ζητούν **και** η ενότητα **και** η φόρμα πίσω από το όριο `next/dynamic`
 * (CHECK 3.34 Κ2): αν έμενε σε ένα από τα δύο, το άλλο θα έπρεπε να το εισάγει — και είτε θα έσπαγε το όριο,
 * είτε θα γεννούσε δίδυμο.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PrivateMarketingPanel } from '@/lib/mandate/private-marketing-panel';

import { OWNER_MANDATE_KEYS } from './owner-mandate-labels';

export function usePrivateMarketingAgencyLabel(): (panel: PrivateMarketingPanel) => string {
  const { t } = useTranslation(['property-market']);
  return (panel) => (panel.agencyName.trim() === '' ? t(OWNER_MANDATE_KEYS.agencyUnnamed) : panel.agencyName);
}
