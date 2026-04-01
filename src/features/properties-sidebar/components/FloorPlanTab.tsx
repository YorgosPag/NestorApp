/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Floorplan Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for floorplan upload with:
 * - Same UI as Photos/Videos tabs (Αρχεία | Κάδος, Gallery/List/Tree views)
 * - Full-width FloorplanGallery for DXF/PDF display
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Multi-tenant Storage Rules
 *
 * @module features/properties-sidebar/components/FloorPlanTab
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{propertyId}/domains/construction/categories/floorplans/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from 'react-i18next';
import { getCompanyById } from '@/services/companies.service';
import { FLOORPLAN_PURPOSES } from '@/config/domain-constants';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('FloorPlanTab');

// =============================================================================
// PROPS
// =============================================================================

// 🏢 ENTERPRISE: Centralized Property Icon & Color
const PropertyIcon = NAVIGATION_ENTITIES.property.icon;
const propertyColor = NAVIGATION_ENTITIES.property.color;

/** Viewer props structure */
interface ViewerProps {
  onSelectFloor?: (floorId: string) => void;
  properties?: Property[];
  [key: string]: unknown;
}

interface FloorPlanTabProps {
  selectedProperty: Property | null;
  currentFloor: FloorData | null;
  safeFloors: FloorData[];
  safeViewerProps: ViewerProps;
  safeViewerPropsWithFloors: ViewerProps & { floors?: FloorData[] };
  setShowHistoryPanel: (show: boolean) => void;
  units: Property[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Accepted file types for floorplans (DXF, PDF, images) */
const FLOORPLAN_ACCEPT = '.dxf,.pdf,application/pdf,application/dxf,image/vnd.dxf,.jpg,.jpeg,.png,image/jpeg,image/png';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Unit Floorplan Tab
 *
 * Displays unit floorplans using centralized EntityFilesManager with:
 * - Domain: construction
 * - Category: floorplans
 * - DisplayStyle: floorplan-gallery (full-width DXF/PDF viewer)
 * - Purpose: 'unit-floorplan' for filtering
 */
export function FloorPlanTab({
  selectedProperty,
}: FloorPlanTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const fallbackCompanyId = useCompanyId()?.companyId;

  // 🏢 ENTERPRISE: Use unit's companyId (from Firestore) if available,
  // fallback to auth context. This ensures super_admin sees files
  // for units belonging to other companies.
  const unitCompanyId = (selectedProperty as Record<string, unknown> | null)?.companyId as string | undefined;
  const companyId = unitCompanyId || fallbackCompanyId;
  const currentUserId = user?.uid;

  // 🏢 ENTERPRISE: Fetch company name for Technical View display (ADR-031)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (!companyId) {
        setCompanyDisplayName(undefined);
        return;
      }

      try {
        const company = await getCompanyById(companyId);
        if (company && company.type === 'company') {
          // 🏢 ENTERPRISE: Use companyName or tradeName as fallback
          const displayName = company.companyName || company.tradeName || companyId;
          setCompanyDisplayName(displayName);
        } else {
          setCompanyDisplayName(companyId); // Fallback to ID if company not found
        }
      } catch (error) {
        logger.error('[FloorPlanTab] Failed to fetch company name:', { error: error });
        setCompanyDisplayName(companyId); // Fallback to ID on error
      }
    };

    fetchCompanyName();
  }, [companyId]);

  // If no unit selected, show placeholder
  if (!selectedProperty) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-center p-8", colors.text.muted)}>
        <PropertyIcon className={`${iconSizes['2xl']} ${propertyColor} mb-4 opacity-50`} />
        <h3 className="text-xl font-semibold mb-2">{t('floorplan.selectProperty')}</h3>
        <p className="text-sm max-w-sm">
          {t('floorplan.selectUnitDescription')}
        </p>
      </div>
    );
  }

  // If no companyId or userId, show auth placeholder
  if (!companyId || !currentUserId) {
    return (
      <section className={cn("p-6 text-center", colors.text.muted)}>
        <p>{t('floorplan.noAuth', 'Απαιτείται σύνδεση για να δείτε τις κατόψεις.')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType="property"
      entityId={String(selectedProperty.id)}
      entityLabel={selectedProperty.name || `Μονάδα ${selectedProperty.id}`}
      domain="construction"
      category="floorplans"
      purpose={FLOORPLAN_PURPOSES.PROPERTY}
      entryPointCategoryFilter="floorplans"
      displayStyle="floorplan-gallery"
      acceptedTypes={FLOORPLAN_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}
