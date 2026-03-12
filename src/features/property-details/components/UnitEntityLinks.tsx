'use client';

/**
 * UnitEntityLinks — Building linking for units
 *
 * A unit's only direct parent is its Building.
 * Company and Project are resolved through the hierarchy:
 * Unit → Building → Project → Company
 *
 * ADR-200: Uses centralized useEntityLink hook.
 * @see ADR-199 changelog 2026-03-12
 *
 * @module features/property-details/components/UnitEntityLinks
 */

import React, { useCallback } from 'react';
import { Building } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { updateUnitLink, getBuildingsList } from '@/services/units.service';
import { useTranslation } from 'react-i18next';
import { useEntityLink } from '@/hooks/useEntityLink';

interface UnitEntityLinksProps {
  unitId: string;
  /** @deprecated Kept for backward compatibility — no longer rendered */
  currentCompanyId?: string;
  /** @deprecated Kept for backward compatibility — no longer rendered */
  currentProjectId?: string;
  currentBuildingId?: string;
  isEditing: boolean;
  onLinkChanged?: () => void;
}

export function UnitEntityLinks({
  unitId,
  currentBuildingId,
  isEditing,
  onLinkChanged,
}: UnitEntityLinksProps) {
  const { t } = useTranslation('units');

  const loadBuildings = useCallback(() => getBuildingsList(), []);

  const saveBuilding = useCallback(async (newId: string | null) => {
    const result = await updateUnitLink(unitId, { buildingId: newId });
    if (result.success && onLinkChanged) onLinkChanged();
    return result;
  }, [unitId, onLinkChanged]);

  // ADR-200: Centralized entity linking via useEntityLink
  const buildingLink = useEntityLink({
    relation: 'unit-building',
    entityId: unitId,
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
      <EntityLinkCard {...buildingLink.linkCardProps} />
    </section>
  );
}
