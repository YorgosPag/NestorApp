/**
 * Unit Floorplan Tab — ADR-031, ADR-033, ADR-236 Phase 3
 *
 * Multi-level properties (maisonettes, shops) show level sub-tabs
 * so the admin can upload/view one floorplan per level.
 * Single-level properties: no sub-tabs, unchanged behavior.
 *
 * @module features/properties-sidebar/components/FloorPlanTab
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { LevelTabStrip } from '@/features/property-details/components/PropertyFieldsReadOnly';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getCompanyById } from '@/services/companies.service';
import { ENTITY_TYPES, FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('FloorPlanTab');

const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

interface FloorPlanTabProps {
  selectedProperty: Property | null;
}

export function FloorPlanTab({ selectedProperty }: FloorPlanTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const fallbackCompanyId = useCompanyId()?.companyId;

  const unitCompanyId = (selectedProperty as Record<string, unknown> | null)?.companyId as string | undefined;
  const companyId = unitCompanyId || fallbackCompanyId;
  const currentUserId = user?.uid;

  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  // Multi-level: active level selection
  const levels = selectedProperty?.levels ?? [];
  const isMultiLevel = !!selectedProperty?.isMultiLevel && levels.length >= 2;
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);

  // Reset level selection when property changes
  useEffect(() => {
    if (isMultiLevel && levels.length > 0) {
      const sorted = [...levels].sort((a, b) => a.floorNumber - b.floorNumber);
      setActiveLevelId(sorted[0].floorId);
    } else {
      setActiveLevelId(null);
    }
  }, [selectedProperty?.id, isMultiLevel, levels.length]);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!companyId) { setCompanyDisplayName(undefined); return; }
      try {
        const company = await getCompanyById(companyId);
        if (company && company.type === 'company') {
          setCompanyDisplayName(company.companyName || company.tradeName || companyId);
        } else {
          setCompanyDisplayName(companyId);
        }
      } catch (error) {
        logger.error('[FloorPlanTab] Failed to fetch company name:', { error });
        setCompanyDisplayName(companyId);
      }
    };
    fetchCompanyName();
  }, [companyId]);

  if (!selectedProperty) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-center p-8", colors.text.muted)}>
        <PropertyIcon className={`${iconSizes['2xl']} ${propertyColor} mb-4 opacity-50`} />
        <h3 className="text-xl font-semibold mb-2">{t('floorplan.selectProperty')}</h3>
        <p className="text-sm max-w-sm">{t('floorplan.selectUnitDescription')}</p>
      </div>
    );
  }

  if (!companyId || !currentUserId) {
    return (
      <section className={cn("p-6 text-center", colors.text.muted)}>
        <p>{t('floorplan.noAuth', { defaultValue: '' })}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Level sub-tabs for multi-level properties (ADR-236 Phase 3) */}
      {isMultiLevel && (
        <div className="px-2 pt-2 pb-1">
          <LevelTabStrip
            levels={levels}
            activeLevelId={activeLevelId}
            onSelectLevel={setActiveLevelId}
            t={t}
          />
        </div>
      )}

      <EntityFilesManager
        companyId={companyId}
        currentUserId={currentUserId}
        entityType={ENTITY_TYPES.PROPERTY}
        entityId={String(selectedProperty.id)}
        entityLabel={selectedProperty.name || `Μονάδα ${selectedProperty.id}`}
        domain="construction"
        category="floorplans"
        purpose={FLOORPLAN_PURPOSES.PROPERTY}
        entryPointCategoryFilter="floorplans"
        displayStyle="floorplan-gallery"
        acceptedTypes={FLOORPLAN_ACCEPT}
        companyName={companyDisplayName}
        levelFloorId={activeLevelId ?? undefined}
      />
    </div>
  );
}
