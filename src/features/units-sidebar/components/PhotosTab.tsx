/**
 * =============================================================================
 * 🏢 ENTERPRISE: Unit Photos Tab
 * =============================================================================
 *
 * Uses centralized EntityFilesManager for photo upload with:
 * - Enterprise naming convention (ΔΟΜΗ.txt pattern)
 * - Smart compression for images
 * - Multi-tenant Storage Rules
 * - Entry point selection for photo types
 * - Media gallery display style
 *
 * @module features/units-sidebar/components/PhotosTab
 * @enterprise ADR-031 - Canonical File Storage System
 *
 * Storage Path:
 * companies/{companyId}/entities/unit/{unitId}/domains/sales/categories/photos/files/
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EntityFilesManager } from '@/components/shared/files/EntityFilesManager';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { getCompanyById } from '@/services/companies.service';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { DEFAULT_PHOTO_ACCEPT } from '@/config/file-upload-config';
import type { Property } from '@/types/property-viewer';
import type { FloorData } from '../types';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('PhotosTab');

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

interface PhotosTabProps {
  selectedUnit: Property | null;
  currentFloor: FloorData | null;
  safeFloors: FloorData[];
  safeViewerProps: ViewerProps;
  safeViewerPropsWithFloors: ViewerProps & { floors?: FloorData[] };
  setShowHistoryPanel: (show: boolean) => void;
  units: Property[];
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * 🏢 ENTERPRISE: Unit Photos Tab
 *
 * Displays unit photos using centralized EntityFilesManager with:
 * - Domain: sales
 * - Category: photos
 * - DisplayStyle: media-gallery
 * - Entry points: interior photos, exterior photos, etc.
 */
export function PhotosTab({
  selectedUnit,
}: PhotosTabProps) {
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
        logger.error('[PhotosTab] Failed to fetch company name:', { error: error });
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
        <h3 className="text-xl font-semibold mb-2">{t('photos.selectUnit', 'Επιλέξτε Μονάδα')}</h3>
        <p className="text-sm max-w-sm">
          {t('photos.selectUnitDescription', 'Επιλέξτε μια μονάδα από τη λίστα για να δείτε τις φωτογραφίες της.')}
        </p>
      </div>
    );
  }

  // If no companyId or userId, show auth placeholder
  if (!companyId || !currentUserId) {
    return (
      <section className="p-6 text-center text-muted-foreground">
        <p>{t('photos.noAuth', 'Απαιτείται σύνδεση για να δείτε τις φωτογραφίες.')}</p>
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
      domain="sales"
      category="photos"
      purpose="photo"
      entryPointCategoryFilter="photos"
      displayStyle="media-gallery"
      acceptedTypes={DEFAULT_PHOTO_ACCEPT}
      companyName={companyDisplayName}
    />
  );
}
