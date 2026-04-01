'use client';

/**
 * PropertyEntityLinks — Building linking for properties
 *
 * A property's only direct parent is its Building.
 * Company and Project are resolved through the hierarchy:
 * Property → Building → Project → Company
 *
 * ADR-200: Uses centralized useEntityLink hook.
 * @see ADR-199 changelog 2026-03-12
 *
 * @module features/property-details/components/PropertyEntityLinks
 */

import React, { useCallback } from 'react';
import { Building } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { updatePropertyLink, getBuildingsList } from '@/services/properties.service';
import { useTranslation } from 'react-i18next';
import { useEntityLink } from '@/hooks/useEntityLink';

interface PropertyEntityLinksProps {
  propertyId: string;
  /** @deprecated Kept for backward compatibility — no longer rendered */
  currentCompanyId?: string;
  /** @deprecated Kept for backward compatibility — no longer rendered */
  currentProjectId?: string;
  currentBuildingId?: string;
  isEditing: boolean;
  onLinkChanged?: () => void;
}

export function PropertyEntityLinks({
  propertyId,
  currentBuildingId,
  isEditing,
  onLinkChanged,
}: PropertyEntityLinksProps) {
  const { t } = useTranslation('properties');

  const loadBuildings = useCallback(() => getBuildingsList(), []);

  const saveBuilding = useCallback(async (newId: string | null) => {
    const result = await updatePropertyLink(propertyId, { buildingId: newId });
    if (result.success && onLinkChanged) onLinkChanged();
    return result;
  }, [propertyId, onLinkChanged]);

  // ADR-200: Centralized entity linking via useEntityLink
  const buildingLink = useEntityLink({
    relation: 'unit-building',
    entityId: propertyId,
    initialParentId: currentBuildingId ?? null,
    loadOptions: loadBuildings,
    saveMode: 'immediate',
    onSave: saveBuilding,
    icon: Building,
    cardId: 'unit-building-link',
    labels: {
      title: t('entityLinks.building.title'),
      label: t('entityLinks.building.label'),
      placeholder: t('entityLinks.building.placeholder'),
      noSelection: t('entityLinks.building.noSelection'),
      loading: t('entityLinks.building.loading'),
      save: t('entityLinks.save'),
      saving: t('entityLinks.saving'),
      success: t('entityLinks.building.success'),
      error: t('entityLinks.error'),
      currentLabel: t('entityLinks.building.currentLabel'),
    },
  }, isEditing);

  return (
    <section>
      <EntityLinkCard key={buildingLink.linkCardKey} {...buildingLink.linkCardProps} />
    </section>
  );
}
