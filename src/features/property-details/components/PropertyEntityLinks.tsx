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
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { loadScopedBuildingOptions } from '@/components/shared/space-info/scoped-building-options';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityLink } from '@/hooks/useEntityLink';

interface PropertyEntityLinksProps {
  propertyId: string;
  /** @deprecated Kept for backward compatibility — no longer rendered */
  currentCompanyId?: string;
  /** Το έργο της μονάδας — ορίζει **ποια** κτίρια προσφέρονται (ADR-898 §21.6 Ε6-α). Δεν αποδίδεται ως πεδίο. */
  currentProjectId?: string | null;
  currentBuildingId?: string;
  isEditing: boolean;
  onBuildingLinkChange?: (newId: string | null) => Promise<{ success: boolean; error?: string }>;
  onLinkChanged?: () => void;
}

export function PropertyEntityLinks({
  propertyId,
  currentProjectId,
  currentBuildingId,
  isEditing,
  onBuildingLinkChange,
  onLinkChanged,
}: PropertyEntityLinksProps) {
  const { t, currentLanguage } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);

  // ADR-898 §21.6 Ε6-α — το ΙΔΙΟ κατηγόρημα με τον φρουρό του server (`property-anchor-guard`): μονάδα έργου βλέπει
  // μόνο τα κτίρια του έργου της. Ως τις 2026-10-05 έδειχνε κάθε κτίριο του χώρου εργασίας (έξι «Κτήριο Α»).
  const buildingId = currentBuildingId ?? null;
  const projectId = currentProjectId ?? null;
  const noProjectGroup = t('entityLinks.building.noProjectGroup');
  const loadBuildings = useCallback(
    () => loadScopedBuildingOptions({ buildingId, projectId }, { noProjectGroup, locale: currentLanguage }),
    [buildingId, projectId, noProjectGroup, currentLanguage],
  );

  const saveBuilding = useCallback(async (newId: string | null) => {
    if (!onBuildingLinkChange) {
      return {
        success: false,
        error: t('entityLinks.error'),
      };
    }

    const result = await onBuildingLinkChange(newId);
    if (result.success && onLinkChanged) onLinkChanged();
    return result;
  }, [onBuildingLinkChange, onLinkChanged, t]);

  // ADR-200: Centralized entity linking via useEntityLink
  const buildingLink = useEntityLink({
    relation: 'property-building',
    entityId: propertyId,
    initialParentId: currentBuildingId ?? null,
    loadOptions: loadBuildings,
    saveMode: 'immediate',
    onSave: saveBuilding,
    icon: NAVIGATION_ENTITIES.building.icon,
    iconColor: NAVIGATION_ENTITIES.building.color,
    cardId: 'property-building-link',
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
