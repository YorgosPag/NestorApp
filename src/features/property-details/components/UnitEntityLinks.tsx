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
import { Building2, FolderKanban, Building } from 'lucide-react';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { getAllActiveCompanies } from '@/services/companies.service';
import { getProjectsList } from '@/components/building-management/building-services';
import { updateUnitLink, getBuildingsList } from '@/services/units.service';
import { useTranslation } from 'react-i18next';

interface UnitEntityLinksProps {
  unitId: string;
  currentCompanyId?: string;
  currentProjectId?: string;
  currentBuildingId?: string;
  isEditing: boolean;
  onLinkChanged?: () => void;
}

export function UnitEntityLinks({
  unitId,
  currentCompanyId,
  currentProjectId,
  currentBuildingId,
  isEditing,
  onLinkChanged,
}: UnitEntityLinksProps) {
  const { t } = useTranslation('units');

  // Load functions (stable references via useCallback)
  const loadCompanies = useCallback(async (): Promise<EntityLinkOption[]> => {
    const companies = await getAllActiveCompanies();
    return companies
      .filter(c => c.id)
      .map(c => ({ id: c.id!, name: c.companyName || '' }));
  }, []);

  const loadProjects = useCallback(async (): Promise<EntityLinkOption[]> => {
    const projects = await getProjectsList();
    return projects.map(p => ({ id: p.id, name: p.name }));
  }, []);

  const loadBuildings = useCallback(async (): Promise<EntityLinkOption[]> => {
    return getBuildingsList();
  }, []);

  // Save functions
  const saveCompany = useCallback(async (newId: string | null, name: string) => {
    return updateUnitLink(unitId, {
      companyId: newId,
      companyName: newId ? name : undefined,
    });
  }, [unitId]);

  const saveProject = useCallback(async (newId: string | null, name: string) => {
    return updateUnitLink(unitId, {
      projectId: newId,
      projectName: newId ? name : undefined,
    });
  }, [unitId]);

  const saveBuilding = useCallback(async (newId: string | null) => {
    return updateUnitLink(unitId, {
      buildingId: newId,
    });
  }, [unitId]);

  return (
    <section className="grid grid-cols-1 gap-2">
      <EntityLinkCard
        cardId="unit-company-link"
        icon={Building2}
        currentValue={currentCompanyId}
        loadOptions={loadCompanies}
        onSave={saveCompany}
        onChanged={onLinkChanged ? () => onLinkChanged() : undefined}
        isEditing={isEditing}
        labels={{
          title: t('entityLinks.company.title'),
          label: t('entityLinks.company.label'),
          placeholder: t('entityLinks.company.placeholder'),
          noSelection: t('entityLinks.company.noSelection'),
          loading: t('entityLinks.company.loading'),
          save: t('entityLinks.save'),
          saving: t('entityLinks.saving'),
          success: t('entityLinks.company.success'),
          error: t('entityLinks.error'),
          currentLabel: t('entityLinks.company.currentLabel'),
        }}
      />
      <EntityLinkCard
        cardId="unit-project-link"
        icon={FolderKanban}
        currentValue={currentProjectId}
        loadOptions={loadProjects}
        onSave={saveProject}
        onChanged={onLinkChanged ? () => onLinkChanged() : undefined}
        isEditing={isEditing}
        labels={{
          title: t('entityLinks.project.title'),
          label: t('entityLinks.project.label'),
          placeholder: t('entityLinks.project.placeholder'),
          noSelection: t('entityLinks.project.noSelection'),
          loading: t('entityLinks.project.loading'),
          save: t('entityLinks.save'),
          saving: t('entityLinks.saving'),
          success: t('entityLinks.project.success'),
          error: t('entityLinks.error'),
          currentLabel: t('entityLinks.project.currentLabel'),
        }}
      />
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
