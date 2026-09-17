/**
 * =============================================================================
 * 🏢 Property files tabs — κοινό σώμα (Documents · Photos · Videos · FloorPlan)
 * =============================================================================
 *
 * Οι καρτέλες αρχείων ακινήτου ήταν δίδυμα: ίδια επίλυση συνεδρίας, ίδιο αντιγραμμένο
 * `useEffect` ονόματος εταιρείας (χωρίς φρουρό ακύρωσης), ίδια δύο placeholders και ίδιο
 * μπλοκ ταυτότητας στον `EntityFilesManager`. Εδώ ζει ό,τι μοιράζονται· κάθε καρτέλα
 * κρατά μόνο ό,τι τη διαφοροποιεί.
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{propertyId}/domains/{domain}/categories/{category}/files/
 *
 * @module features/properties-sidebar/components/property-files-tab
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import React from 'react';
import type { EntityFilesManagerProps } from '@/components/shared/files/EntityFilesManager';
import { EntityFilesTabPlaceholder } from '@/components/shared/files/EntityFilesTabPlaceholder';
import {
  useEntityFilesTabSession,
  type EntityFilesTabSessionOptions,
} from '@/components/shared/files/useEntityFilesTabSession';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Centralized Property Icon & Color
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

/** Τα μηνύματα κάθε καρτέλας — ρητά κλειδιά, ώστε να τα βλέπουν οι πύλες i18n. */
const PROPERTY_TAB_MESSAGES = {
  documents: {
    title: 'documents.selectProperty',
    description: 'documents.selectUnitDescription',
    noAuth: 'documents.noAuth',
  },
  photos: {
    title: 'photos.selectProperty',
    description: 'photos.selectUnitDescription',
    noAuth: 'photos.noAuth',
  },
  videos: {
    title: 'videos.selectProperty',
    description: 'videos.selectUnitDescription',
    noAuth: 'videos.noAuth',
  },
  floorplan: {
    title: 'floorplan.selectProperty',
    description: 'floorplan.selectUnitDescription',
    noAuth: 'floorplan.noAuth',
  },
} as const;

export type PropertyFilesTabSection = keyof typeof PROPERTY_TAB_MESSAGES;

type PropertyFilesIdentity = Pick<
  EntityFilesManagerProps,
  'custody' | 'currentUserId' | 'entityType' | 'entityId' | 'entityLabel' | 'companyName'
>;

/**
 * Ακίνητο + συνεδρία + ταυτότητα αρχείων. Όσο λείπει ακίνητο ή σύνδεση, `identity` είναι
 * `null` και `fallback` είναι η οθόνη που πρέπει να δειχθεί.
 */
export function usePropertyFilesTab(
  selectedProperty: Property | null,
  section: PropertyFilesTabSection,
  options: EntityFilesTabSessionOptions = {},
) {
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { companyId, currentUserId, companyName } = useEntityFilesTabSession({
    ...options,
    withCompanyName: true,
  });
  const messages = PROPERTY_TAB_MESSAGES[section];

  if (!selectedProperty) {
    const fallback = (
      <section className={cn('flex flex-col items-center justify-center h-full text-center p-8', colors.text.muted)}>
        <PropertyIcon className={`${iconSizes['2xl']} ${propertyColor} mb-4 opacity-50`} />
        <h3 className="text-xl font-semibold mb-2">{t(messages.title)}</h3>
        <p className="text-sm max-w-sm">{t(messages.description)}</p>
      </section>
    );
    return { t, companyId, identity: null, fallback };
  }

  if (!companyId || !currentUserId) {
    const fallback = <EntityFilesTabPlaceholder message={t(messages.noAuth)} paddingClassName="p-6" />;
    return { t, companyId, identity: null, fallback };
  }

  const identity: PropertyFilesIdentity = {
    custody: { companyId },
    currentUserId,
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: String(selectedProperty.id),
    entityLabel: selectedProperty.name || t('unitFallbackLabel', { id: selectedProperty.id }),
    companyName,
  };
  return { t, companyId, identity, fallback: null };
}
