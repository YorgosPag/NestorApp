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
 * @module features/units-sidebar/components/FloorPlanTab
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-033 - Floorplan Processing Pipeline
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{unitId}/domains/construction/categories/floorplans/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getCompanyById } from '@/services/companies.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('FloorPlanTab');

// =============================================================================
// PROPS
// =============================================================================

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

/** Viewer props structure */
interface ViewerProps {
  onSelectFloor?: (floorId: string) => void;
  properties?: Property[];
  [key: string]: unknown;
}

interface FloorPlanTabProps {
  selectedUnit: Property | null;
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
  selectedUnit,
}: FloorPlanTabProps) {
  const { user } = useAuth();
  const { t } = useTranslation('units');
  const iconSizes = useIconSizes();

  // Get companyId and userId from auth context
  const companyId = user?.companyId;
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
  if (!selectedUnit) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
        <UnitIcon className={`${iconSizes['2xl']} ${unitColor} mb-4 opacity-50`} />
        <h3 className="text-xl font-semibold mb-2">{t('floorplan.selectUnit')}</h3>
        <p className="text-sm max-w-sm">
          {t('floorplan.selectUnitDescription')}
        </p>
      </div>
    );
  }

  // If no companyId or userId, show auth placeholder
  if (!companyId || !currentUserId) {
    return (
      <section className="p-6 text-center text-muted-foreground">
        <p>{t('floorplan.noAuth', 'Απαιτείται σύνδεση για να δείτε τις κατόψεις.')}</p>
      </section>
    );
  }

  return (
    <EntityFilesManager
      companyId={companyId}
      currentUserId={currentUserId}
      entityType="unit"
      entityId={String(selectedUnit.id)}
      entityLabel={selectedUnit.name || `Μονάδα ${selectedUnit.id}`}
      domain="construction"
      category="floorplans"
      purpose="unit-floorplan"
      entryPointCategoryFilter="floorplans"
      displayStyle="floorplan-gallery"
      acceptedTypes={FLOORPLAN_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}
