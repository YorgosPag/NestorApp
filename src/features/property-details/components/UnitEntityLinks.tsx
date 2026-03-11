'use client';

/**
 * UnitEntityLinks — Company, Project, Building linking for units
 *
 * Uses the centralized EntityLinkCard component.
 * Allows linking a unit to a specific company, project, and building.
 *
 * @module features/property-details/components/UnitEntityLinks
 */

import React, { useCallback } from 'react';
import { Building } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { updateUnitLink, getBuildingsList } from '@/services/units.service';
import { useTranslation } from 'react-i18next';

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

/**
 * UnitEntityLinks — Building linking for units
 *
 * A unit's only direct parent is its Building.
 * Company and Project are resolved through the hierarchy:
 * Unit → Building → Project → Company
 *
 * @see ADR-199 changelog 2026-03-12
 */
export function UnitEntityLinks({
  unitId,
  currentBuildingId,
  isEditing,
  onLinkChanged,
}: UnitEntityLinksProps) {
  const { t } = useTranslation('units');

  const loadBuildings = useCallback(async (): Promise<EntityLinkOption[]> => {
    return getBuildingsList();
  }, []);

  const saveBuilding = useCallback(async (newId: string | null) => {
    return updateUnitLink(unitId, {
      buildingId: newId,
    });
  }, [unitId]);

  return (
    <section>
      <EntityLinkCard
        cardId="unit-building-link"
        icon={Building}
        currentValue={currentBuildingId}
        loadOptions={loadBuildings}
        onSave={saveBuilding}
        onChanged={onLinkChanged ? () => onLinkChanged() : undefined}
        isEditing={isEditing}
        labels={{
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
        }}
      />
    </section>
  );
}
